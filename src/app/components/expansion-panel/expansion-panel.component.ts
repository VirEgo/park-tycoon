import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpansionService } from '../../services/expansion.service';
import { LandPlot, ExpansionState } from '../../models/expansion.model';

@Component({
    selector: 'app-expansion-panel',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="expansion-panel">
            <div class="panel-header">
                <h3>🗺️ Расширение территории</h3>
                <button class="close-btn" (click)="onClose.emit()">✖</button>
            </div>

            <div class="panel-content">
                <div class="stats">
                    <div class="stat-item">
                        <span class="label">Участков куплено:</span>
                        <span class="value">{{ expansionState().purchasedCount }} / {{ expansionState().plots.length }}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">Потрачено:</span>
                        <span class="value money">\${{ expansionState().totalSpent }}</span>
                    </div>
                </div>

                <div class="plots-grid">
                    @for (plot of getAvailablePlots(); track plot.id) {
                        <div class="plot-card" [class.affordable]="currentMoney() >= plot.currentPrice">
                            <div class="plot-header">
                                <span class="terrain-icon">{{ getTerrainIcon(plot.terrain) }}</span>
                                <span class="terrain-name">{{ getTerrainName(plot.terrain) }}</span>
                            </div>
                            
                            <div class="plot-info">
                                <div class="plot-size">{{ plot.size.w }}x{{ plot.size.h }}</div>
                                <div class="plot-price">\${{ plot.currentPrice }}</div>
                            </div>

                            @if (plot.unlocks && plot.unlocks.length > 0) {
                                <div class="unlocks">
                                    <small>Открывает:</small>
                                    @for (unlock of plot.unlocks; track unlock) {
                                        <span class="unlock-tag">{{ unlock }}</span>
                                    }
                                </div>
                            }

                            <button 
                                class="buy-btn"
                                [disabled]="currentMoney() < plot.currentPrice"
                                (click)="buyPlot(plot.id)">
                                {{ currentMoney() >= plot.currentPrice ? 'Купить' : 'Недостаточно денег' }}
                            </button>
                        </div>
                    }
                </div>

                @if (getAvailablePlots().length === 0) {
                    <div class="no-plots">
                        <p>🎉 Все участки куплены!</p>
                    </div>
                }
            </div>
        </div>
    `,
    styles: [`
        .expansion-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.4);
            width: 90%;
            max-width: 700px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            z-index: 1000;
        }

        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 2px solid rgba(255,255,255,0.2);
        }

        .panel-header h3 {
            margin: 0;
            color: white;
            font-size: 24px;
        }

        .close-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
            transition: all 0.2s;
        }

        .close-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: rotate(90deg);
        }

        .panel-content {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
        }

        .stats {
            background: rgba(255,255,255,0.15);
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 20px;
        }

        .stat-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            color: white;
        }

        .stat-item:last-child {
            margin-bottom: 0;
        }

        .stat-item .label {
            opacity: 0.9;
        }

        .stat-item .value {
            font-weight: bold;
        }

        .money {
            color: #ffd700;
        }

        .plots-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
        }

        .plot-card {
            background: rgba(255,255,255,0.95);
            border-radius: 12px;
            padding: 15px;
            transition: all 0.3s;
            border: 2px solid transparent;
        }

        .plot-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.2);
        }

        .plot-card.affordable {
            border-color: #4caf50;
        }

        .plot-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
        }

        .terrain-icon {
            font-size: 24px;
        }

        .terrain-name {
            font-weight: bold;
            color: #333;
        }

        .plot-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
        }

        .plot-size {
            color: #666;
            font-size: 14px;
        }

        .plot-price {
            color: #ff9800;
            font-weight: bold;
            font-size: 18px;
        }

        .unlocks {
            background: #e3f2fd;
            padding: 8px;
            border-radius: 6px;
            margin-bottom: 12px;
        }

        .unlocks small {
            color: #1976d2;
            font-weight: bold;
            display: block;
            margin-bottom: 5px;
        }

        .unlock-tag {
            display: inline-block;
            background: #2196f3;
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            margin-right: 5px;
            margin-top: 3px;
        }

        .buy-btn {
            width: 100%;
            padding: 10px;
            border: none;
            border-radius: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
        }

        .buy-btn:hover:not(:disabled) {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .buy-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }

        .no-plots {
            text-align: center;
            padding: 40px;
            color: white;
            font-size: 18px;
        }
    `]
})
export class ExpansionPanelComponent {
    private expansionService = inject(ExpansionService);

    expansionState = input.required<ExpansionState>();
    currentMoney = input.required<number>();

    onClose = output<void>();
    onPurchase = output<{ plotId: string; cost: number }>();

    getAvailablePlots(): LandPlot[] {
        return this.expansionService.getAvailablePlots(this.expansionState());
    }

    getTerrainIcon(terrain: string): string {
        const terrainInfo = this.expansionService.getTerrainInfo(terrain as any);
        return terrainInfo.icon;
    }

    getTerrainName(terrain: string): string {
        const terrainInfo = this.expansionService.getTerrainInfo(terrain as any);
        return terrainInfo.name;
    }

    buyPlot(plotId: string): void {
        const result = this.expansionService.purchasePlot(
            this.expansionState(),
            plotId,
            this.currentMoney()
        );

        if (result.success && result.newState) {
            const plot = this.expansionState().plots.find(p => p.id === plotId);
            this.onPurchase.emit({ plotId, cost: plot?.currentPrice || 0 });
        }
    }
}
