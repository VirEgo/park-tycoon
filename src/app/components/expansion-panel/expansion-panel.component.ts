import { CommonModule } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { ExpansionState, LandPlot, TerrainType } from '../../models/expansion.model';
import { ExpansionService } from '../../services/expansion.service';

@Component({
    selector: 'app-expansion-panel',
    standalone: true,
    imports: [CommonModule],
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
    `,
    styles: [`
        .expansion-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: min(92vw, 860px);
            max-height: min(86vh, calc(100dvh - 2rem));
            display: flex;
            flex-direction: column;
            border-radius: 18px;
            background:
                linear-gradient(160deg, rgba(12, 18, 31, 0.98), rgba(24, 39, 66, 0.96));
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
            border: 1px solid rgba(148, 163, 184, 0.2);
            z-index: 1000;
            overflow: hidden;
        }

        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            padding: 20px 24px 16px;
            border-bottom: 1px solid rgba(148, 163, 184, 0.18);
            color: white;
        }

        .panel-header h3 {
            margin: 0 0 6px;
            font-size: 24px;
            font-weight: 800;
        }

        .panel-header p {
            margin: 0;
            color: rgba(226, 232, 240, 0.8);
            font-size: 14px;
            line-height: 1.4;
        }

        .close-btn {
            width: 38px;
            height: 38px;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.08);
            color: white;
            font-size: 18px;
            cursor: pointer;
            transition: background-color 0.2s ease, transform 0.2s ease;
        }

        .close-btn:hover {
            background: rgba(255, 255, 255, 0.16);
            transform: rotate(90deg);
        }

        .panel-content {
            padding: 20px 24px 24px;
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
        }

        .stat-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 14px;
            border-radius: 12px;
            background: rgba(15, 23, 42, 0.55);
            border: 1px solid rgba(148, 163, 184, 0.15);
            color: white;
        }

        .label {
            color: rgba(226, 232, 240, 0.72);
            font-size: 13px;
        }

        .value {
            font-size: 18px;
            font-weight: 700;
        }

        .money {
            color: #facc15;
        }

        .map-board {
            display: grid;
            gap: 10px;
            margin-bottom: 22px;
        }

        .map-row {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
        }

        .map-cell {
            min-height: 148px;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start;
            gap: 8px;
            padding: 14px;
            border-radius: 16px;
            border: 1px solid rgba(148, 163, 184, 0.22);
            background: rgba(15, 23, 42, 0.75);
            color: white;
            text-align: left;
            transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }

        .map-cell:not(:disabled) {
            cursor: pointer;
        }

        .map-cell.available:hover {
            transform: translateY(-3px);
            border-color: rgba(74, 222, 128, 0.8);
            box-shadow: 0 14px 32px rgba(34, 197, 94, 0.18);
        }

        .map-cell.center {
            background: linear-gradient(160deg, rgba(30, 41, 59, 0.95), rgba(56, 189, 248, 0.25));
            border-color: rgba(56, 189, 248, 0.5);
        }

        .map-cell.purchased {
            background: linear-gradient(160deg, rgba(20, 83, 45, 0.9), rgba(21, 128, 61, 0.6));
            border-color: rgba(74, 222, 128, 0.45);
        }

        .map-cell.available {
            background: linear-gradient(160deg, rgba(6, 95, 70, 0.92), rgba(13, 148, 136, 0.6));
            border-color: rgba(45, 212, 191, 0.45);
        }

        .map-cell.unaffordable {
            opacity: 0.78;
        }

        .map-cell.locked:disabled {
            opacity: 0.52;
        }

        .terrain-icon {
            font-size: 24px;
        }

        .cell-title {
            font-size: 16px;
            font-weight: 700;
            text-transform: capitalize;
        }

        .cell-subtitle {
            font-size: 12px;
            color: rgba(226, 232, 240, 0.78);
        }

        .cell-badge {
            margin-top: auto;
            display: inline-flex;
            align-items: center;
            padding: 5px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
        }

        .cell-badge.success {
            background: rgba(187, 247, 208, 0.16);
            color: #bbf7d0;
        }

        .cell-badge.price {
            background: rgba(254, 240, 138, 0.16);
            color: #fde68a;
        }

        .cell-badge.muted {
            background: rgba(148, 163, 184, 0.14);
            color: #cbd5e1;
        }

        .cell-hint {
            font-size: 12px;
            color: rgba(226, 232, 240, 0.7);
        }

        .available-plots {
            padding: 16px;
            border-radius: 16px;
            background: rgba(15, 23, 42, 0.55);
            border: 1px solid rgba(148, 163, 184, 0.15);
        }

        .section-title {
            margin-bottom: 12px;
            color: white;
            font-size: 15px;
            font-weight: 700;
        }

        .available-list {
            display: grid;
            gap: 12px;
        }

        .available-item {
            padding: 12px 14px;
            border-radius: 12px;
            background: rgba(30, 41, 59, 0.74);
            border: 1px solid rgba(148, 163, 184, 0.14);
        }

        .available-item.affordable {
            border-color: rgba(74, 222, 128, 0.35);
        }

        .available-topline {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 6px;
        }

        .available-name {
            display: flex;
            align-items: center;
            gap: 8px;
            color: white;
            font-weight: 600;
            text-transform: capitalize;
        }

        .available-price {
            color: #fde68a;
            font-weight: 700;
        }

        .available-meta {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            color: rgba(226, 232, 240, 0.72);
            font-size: 12px;
            margin-bottom: 8px;
        }

        .unlock-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .unlock-tag {
            display: inline-flex;
            align-items: center;
            padding: 3px 8px;
            border-radius: 999px;
            font-size: 11px;
            background: rgba(96, 165, 250, 0.16);
            color: #bfdbfe;
        }

        .all-open {
            color: #bbf7d0;
            font-size: 14px;
        }

        @media (max-width: 720px) {
            .panel-header,
            .panel-content {
                padding-left: 16px;
                padding-right: 16px;
            }

            .stats {
                grid-template-columns: 1fr;
            }

            .map-row {
                grid-template-columns: 1fr;
            }

            .map-cell {
                min-height: 118px;
            }
        }
    `]
})
export class ExpansionPanelComponent {
    private expansionService = inject(ExpansionService);

    readonly mapRows = [-1, 0, 1];
    readonly mapCols = [-1, 0, 1];

    expansionState = input.required<ExpansionState>();
    currentMoney = input.required<number>();

    onClose = output<void>();
    onPurchase = output<{ plotId: string; cost: number }>();

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
}
