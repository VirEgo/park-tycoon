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
        return {
            plots: [...INITIAL_LAND_PLOTS],
            purchasedCount: 0,
            totalSpent: 0
        };
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
        const plot = state.plots.find(p => p.id === plotId);

        if (!plot) {
            return { success: false, message: 'Участок не найден' };
        }

        if (plot.purchased) {
            return { success: false, message: 'Участок уже куплен' };
        }

        if (currentMoney < plot.currentPrice) {
            return {
                success: false,
                message: `Недостаточно денег. Нужно: $${plot.currentPrice}`
            };
        }

        // Покупаем участок
        const updatedPlots = state.plots.map(p =>
            p.id === plotId
                ? { ...p, purchased: true }
                : p
        );

        let newState: ExpansionState = {
            plots: updatedPlots,
            purchasedCount: state.purchasedCount + 1,
            totalSpent: state.totalSpent + plot.currentPrice
        };

        // Обновляем цены для оставшихся участков
        newState = this.updatePlotPrices(newState);

        return {
            success: true,
            newState,
            message: `Участок "${plotId}" куплен за $${plot.currentPrice}!`
        };
    }

    /**
     * Получить список доступных участков для покупки
     */
    getAvailablePlots(state: ExpansionState): LandPlot[] {
        return state.plots.filter(p => !p.purchased);
    }

    /**
     * Получить список купленных участков
     */
    getPurchasedPlots(state: ExpansionState): LandPlot[] {
        return state.plots.filter(p => p.purchased);
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

        return [...new Set(unlocked)]; // Убираем дубликаты
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

            return JSON.parse(data) as ExpansionState;
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
        const available = this.getAvailablePlots(state);
        const nextCheapest = available.length > 0
            ? available.reduce((min, plot) =>
                plot.currentPrice < min.currentPrice ? plot : min
            )
            : null;

        return {
            totalPlots: state.plots.length,
            purchased: state.purchasedCount,
            available: available.length,
            totalSpent: state.totalSpent,
            nextCheapestPlot: nextCheapest
        };
    }
}
