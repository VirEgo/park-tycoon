import { CommonModule } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { ExpansionState, LandPlot, TerrainType } from '../../models/expansion.model';
import { ExpansionService } from '../../services/expansion.service';

@Component({
    selector: 'app-expansion-panel',
    standalone: true,
    imports: [CommonModule],
    styleUrls: ['./expansion-panel.component.scss'],
    template: `
        <div class="expansion-panel">
            <div class="panel-header">
                <div>
                    <h3>🗺️ Расширение территории</h3>
                    <p>Карта имеет фиксированный размер. Выберите соседнюю секцию, которую хотите открыть.</p>
                </div>
                <button class="close-btn" (click)="onClose.emit()">✖</button>
            </div>

            <div class="panel-content">
                <div class="stats">
                    <div class="stat-item">
                        <span class="label">Открыто секций:</span>
                        <span class="value">{{ expansionState().purchasedCount + 1 }} / {{ expansionState().plots.length + 1 }}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">Потрачено:</span>
                        <span class="value money">\${{ expansionState().totalSpent }}</span>
                    </div>
                </div>

                <div class="map-board">
                    @for (row of mapRows; track row) {
                        <div class="map-row">
                            @for (col of mapCols; track col) {
                                @let plot = getPlotAt(col, row);
                                <button
                                    type="button"
                                    class="map-cell"
                                    [class.center]="isCenterPlot(col, row)"
                                    [class.purchased]="!!plot && plot.purchased"
                                    [class.available]="!!plot && isPlotAvailable(plot)"
                                    [class.unaffordable]="!!plot && isPlotAvailable(plot) && currentMoney() < plot.currentPrice"
                                    [class.locked]="!!plot && !plot.purchased && !isPlotAvailable(plot)"
                                    [disabled]="!canPurchase(plot)"
                                    (click)="plot && buyPlot(plot.id)">
                                    @if (isCenterPlot(col, row)) {
                                        <span class="terrain-icon">🏁</span>
                                        <span class="cell-title">Стартовая зона</span>
                                        <span class="cell-subtitle">Уже открыта</span>
                                    } @else if (plot) {
                                        <span class="terrain-icon">{{ getTerrainIcon(plot.terrain) }}</span>
                                        <span class="cell-title">{{ getPositionLabel(plot) || 'Секция' }}</span>
                                        <span class="cell-subtitle">{{ getTerrainName(plot.terrain) }}</span>

                                        @if (plot.purchased) {
                                            <span class="cell-badge success">Открыто</span>
                                            @if (!isCenterPlot(col, row)) {
                                                <button type="button" class="sell-btn" (click)="$event.stopPropagation(); sellPlot(plot.id)">
                                                    Продать (\${{ getSellRefund(plot) }})
                                                </button>
                                            }
                                        } @else if (isPlotAvailable(plot)) {
                                            <span class="cell-badge price">\${{ plot.currentPrice }}</span>
                                            <span class="cell-hint">
                                                {{ currentMoney() >= plot.currentPrice ? 'Нажмите, чтобы купить' : 'Недостаточно денег' }}
                                            </span>
                                        } @else {
                                            <span class="cell-badge muted">Недоступно</span>
                                            <span class="cell-hint">Сначала откройте соседнюю секцию</span>
                                        }
                                    }
                                </button>
                            }
                        </div>
                    }
                </div>

                <div class="available-plots">
                    <div class="section-title">Доступные покупки</div>

                    @if (getAvailablePlots().length) {
                        <div class="available-list">
                            @for (plot of getAvailablePlots(); track plot.id) {
                                <div class="available-item" [class.affordable]="currentMoney() >= plot.currentPrice">
                                    <div class="available-topline">
                                        <div class="available-name">
                                            <span>{{ getTerrainIcon(plot.terrain) }}</span>
                                            <span>{{ getPositionLabel(plot) || plot.id }}</span>
                                        </div>
                                        <div class="available-price">\${{ plot.currentPrice }}</div>
                                    </div>

                                    <div class="available-meta">
                                        <span>{{ getTerrainName(plot.terrain) }}</span>
                                        <span>{{ plot.size.w }}x{{ plot.size.h }}</span>
                                    </div>

                                    @if (plot.unlocks?.length) {
                                        <div class="unlock-tags">
                                            @for (unlock of plot.unlocks; track unlock) {
                                                <span class="unlock-tag">{{ unlock }}</span>
                                            }
                                        </div>
                                    }
                                </div>
                            }
                        </div>
                    } @else {
                        <div class="all-open">🎉 Все секции уже открыты</div>
                    }
                </div>
            </div>
        </div>
    `
})
export class ExpansionPanelComponent {
    private expansionService = inject(ExpansionService);

    readonly mapRows = [-1, 0, 1];
    readonly mapCols = [-1, 0, 1];

    expansionState = input.required<ExpansionState>();
    currentMoney = input.required<number>();

    onClose = output<void>();
    onPurchase = output<{ plotId: string; cost: number }>();
    onSell = output<string>();

    getAvailablePlots(): LandPlot[] {
        return this.expansionService.getAvailablePlots(this.expansionState());
    }

    getPlotAt(gridX: number, gridY: number): LandPlot | undefined {
        return this.expansionService.getPlotAt(this.expansionState(), gridX, gridY);
    }

    isCenterPlot(gridX: number, gridY: number): boolean {
        return this.expansionService.isCenterPlot(gridX, gridY);
    }

    isPlotAvailable(plot: LandPlot): boolean {
        return this.expansionService.isPlotAvailable(this.expansionState(), plot);
    }

    canPurchase(plot: LandPlot | undefined): boolean {
        return !!plot && this.isPlotAvailable(plot) && this.currentMoney() >= plot.currentPrice;
    }

    getPositionLabel(plot: LandPlot): string {
        return this.expansionService.getPlotLabel(plot);
    }

    getTerrainIcon(terrain: string): string {
        return this.expansionService.getTerrainInfo(terrain as TerrainType).icon;
    }

    getTerrainName(terrain: string): string {
        return this.expansionService.getTerrainInfo(terrain as TerrainType).name;
    }

    buyPlot(plotId: string): void {
        const result = this.expansionService.purchasePlot(
            this.expansionState(),
            plotId,
            this.currentMoney()
        );

        if (!result.success || !result.newState) {
            return;
        }

        const plot = this.expansionState().plots.find(currentPlot => currentPlot.id === plotId);
        this.onPurchase.emit({ plotId, cost: plot?.currentPrice || 0 });
    }

    sellPlot(plotId: string): void {
        this.onSell.emit(plotId);
    }

    getSellRefund(plot: LandPlot): number {
        return Math.floor(plot.basePrice * 0.5);
    }
}
