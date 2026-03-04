import { Injectable } from '@angular/core';
import {
    LandPlot,
    ExpansionState,
    INITIAL_LAND_PLOTS,
    TerrainType
} from '../models/expansion.model';

@Injectable({
    providedIn: 'root'
})
export class ExpansionService {
    private readonly PRICE_MULTIPLIER = 1.5;
    private readonly STORAGE_KEY = 'park-expansion-v1';

    getInitialState(): ExpansionState {
        return this.updatePlotPrices({
            plots: INITIAL_LAND_PLOTS.map(plot => ({ ...plot })),
            purchasedCount: 0,
            totalSpent: 0
        });
    }

    normalizeState(state: ExpansionState | null | undefined): ExpansionState {
        if (!state) {
            return this.getInitialState();
        }

        const plotById = new Map(state.plots.map(plot => [plot.id, plot]));
        const plots = INITIAL_LAND_PLOTS.map((initialPlot) => {
            const savedPlot = plotById.get(initialPlot.id);
            return {
                ...initialPlot,
                purchased: savedPlot?.purchased ?? false
            };
        });

        return this.updatePlotPrices({
            plots,
            purchasedCount: plots.filter(plot => plot.purchased).length,
            totalSpent: state.totalSpent ?? 0
        });
    }

    isCenterPlot(gridX: number, gridY: number): boolean {
        return gridX === 0 && gridY === 0;
    }

    isPlotPurchasedOrCenter(state: ExpansionState, gridX: number, gridY: number): boolean {
        if (this.isCenterPlot(gridX, gridY)) {
            return true;
        }

        return state.plots.some(plot => plot.gridX === gridX && plot.gridY === gridY && plot.purchased);
    }

    isPlotAvailable(state: ExpansionState, plot: LandPlot): boolean {
        if (plot.purchased) {
            return false;
        }

        const orthogonalNeighbors = [
            { x: plot.gridX - 1, y: plot.gridY },
            { x: plot.gridX + 1, y: plot.gridY },
            { x: plot.gridX, y: plot.gridY - 1 },
            { x: plot.gridX, y: plot.gridY + 1 }
        ];

        return orthogonalNeighbors.some(neighbor =>
            this.isPlotPurchasedOrCenter(state, neighbor.x, neighbor.y)
        );
    }

    getPlotAt(state: ExpansionState, gridX: number, gridY: number): LandPlot | undefined {
        return state.plots.find(plot => plot.gridX === gridX && plot.gridY === gridY);
    }

    getPlotLabel(plot: LandPlot): string {
        const horizontal = plot.gridX < 0 ? 'слева' : plot.gridX > 0 ? 'справа' : '';
        const vertical = plot.gridY < 0 ? 'сверху' : plot.gridY > 0 ? 'снизу' : '';

        return [vertical, horizontal].filter(Boolean).join('-');
    }

    getPurchasedBounds(state: ExpansionState): { minPlotX: number; maxPlotX: number; minPlotY: number; maxPlotY: number } {
        let minPlotX = 0;
        let maxPlotX = 0;
        let minPlotY = 0;
        let maxPlotY = 0;

        state.plots
            .filter(plot => plot.purchased)
            .forEach(plot => {
                minPlotX = Math.min(minPlotX, plot.gridX);
                maxPlotX = Math.max(maxPlotX, plot.gridX);
                minPlotY = Math.min(minPlotY, plot.gridY);
                maxPlotY = Math.max(maxPlotY, plot.gridY);
            });

        return { minPlotX, maxPlotX, minPlotY, maxPlotY };
    }

    /**
     * Рассчитывает текущую цену участка на основе количества купленных
     */
    calculatePlotPrice(basePlotPrice: number, purchasedCount: number): number {
        return Math.floor(basePlotPrice * Math.pow(this.PRICE_MULTIPLIER, purchasedCount));
    }

    /**
     * Обновляет цены всех участков на основе количества купленных
     */
    updatePlotPrices(state: ExpansionState): ExpansionState {
        const updatedPlots = state.plots.map(plot => ({
            ...plot,
            currentPrice: this.calculatePlotPrice(plot.basePrice, state.purchasedCount)
        }));

        return {
            ...state,
            plots: updatedPlots
        };
    }

    /**
     * Покупка участка земли
     */
    purchasePlot(state: ExpansionState, plotId: string, currentMoney: number): {
        success: boolean;
        newState?: ExpansionState;
        message: string;
    } {
        const normalizedState = this.normalizeState(state);
        const plot = normalizedState.plots.find(p => p.id === plotId);

        if (!plot) {
            return { success: false, message: 'Участок не найден' };
        }

        if (plot.purchased) {
            return { success: false, message: 'Участок уже куплен' };
        }

        if (!this.isPlotAvailable(normalizedState, plot)) {
            return { success: false, message: 'Этот участок пока нельзя открыть' };
        }

        if (currentMoney < plot.currentPrice) {
            return {
                success: false,
                message: `Недостаточно денег. Нужно: $${plot.currentPrice}`
            };
        }

        const updatedPlots = normalizedState.plots.map(currentPlot =>
            currentPlot.id === plotId
                ? { ...currentPlot, purchased: true }
                : currentPlot
        );

        const newState = this.updatePlotPrices({
            plots: updatedPlots,
            purchasedCount: normalizedState.purchasedCount + 1,
            totalSpent: normalizedState.totalSpent + plot.currentPrice
        });

        return {
            success: true,
            newState,
            message: `Участок ${this.getPlotLabel(plot) || `"${plot.id}"`} куплен за $${plot.currentPrice}!`
        };
    }

    /**
     * Получить список доступных участков для покупки
     */
    getAvailablePlots(state: ExpansionState): LandPlot[] {
        const normalizedState = this.normalizeState(state);
        return normalizedState.plots.filter(plot => this.isPlotAvailable(normalizedState, plot));
    }

    /**
     * Получить список купленных участков
     */
    getPurchasedPlots(state: ExpansionState): LandPlot[] {
        const normalizedState = this.normalizeState(state);
        return normalizedState.plots.filter(plot => plot.purchased);
    }

    /**
     * Проверить, открыты ли новые здания после покупки участка
     */
    getUnlockedBuildings(state: ExpansionState): string[] {
        const unlocked: string[] = [];

        state.plots.forEach(plot => {
            if (plot.purchased && plot.unlocks) {
                unlocked.push(...plot.unlocks);
            }
        });

        return [...new Set(unlocked)];
    }

    /**
     * Получить информацию о бонусах от типа ландшафта
     */
    getTerrainInfo(terrain: TerrainType): {
        name: string;
        icon: string;
        description: string;
    } {
        const terrainData: Record<TerrainType, { name: string; icon: string; description: string }> = {
            grass: {
                name: 'Равнина',
                icon: '🌱',
                description: 'Универсальная местность'
            },
            forest: {
                name: 'Лес',
                icon: '🌲',
                description: 'Открывает декорации и кемпинг'
            },
            mountain: {
                name: 'Горы',
                icon: '⛰️',
                description: 'Открывает экстрим аттракционы'
            },
            water: {
                name: 'Водоем',
                icon: '🌊',
                description: 'Открывает водные аттракционы'
            }
        };

        return terrainData[terrain];
    }

    /**
     * Сохранить состояние в localStorage
     */
    saveToStorage(state: ExpansionState): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error('Failed to save expansion state:', e);
        }
    }

    /**
     * Загрузить состояние из localStorage
     */
    loadFromStorage(): ExpansionState | null {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (!data) return null;

            return this.normalizeState(JSON.parse(data) as ExpansionState);
        } catch (e) {
            console.error('Failed to load expansion state:', e);
            return null;
        }
    }

    /**
     * Очистить сохраненное состояние
     */
    clearStorage(): void {
        localStorage.removeItem(this.STORAGE_KEY);
    }

    /**
     * Получить статистику по расширению
     */
    getExpansionStats(state: ExpansionState): {
        totalPlots: number;
        purchased: number;
        available: number;
        totalSpent: number;
        nextCheapestPlot: LandPlot | null;
    } {
        const normalizedState = this.normalizeState(state);
        const available = this.getAvailablePlots(normalizedState);
        const nextCheapest = available.length > 0
            ? available.reduce((min, plot) =>
                plot.currentPrice < min.currentPrice ? plot : min
            )
            : null;

        return {
            totalPlots: normalizedState.plots.length,
            purchased: normalizedState.purchasedCount,
            available: available.length,
            totalSpent: normalizedState.totalSpent,
            nextCheapestPlot: nextCheapest
        };
    }
}
