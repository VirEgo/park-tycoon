import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttractionUpgradeService } from '../../services/attraction-upgrade.service';
import { AttractionUpgrade, THEMES, ThemeType } from '../../models/attraction-upgrade.model';
import { BuildingType } from '../../models/building.model';

@Component({
    selector: 'app-upgrade-panel',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="upgrade-panel">
            <div class="panel-header">
                <h3>⚙️ Улучшение: {{ building().name }}</h3>
                <button class="close-btn" (click)="onClose.emit()">✖</button>
            </div>

            <div class="panel-content">
                <!-- Current Level Info -->
                <div class="current-level">
                    <div class="level-badge">Уровень {{ currentLevel }}</div>
                    @if (upgrade) {
                        <div class="upgrade-stats">
                            <div class="stat">Скорость: +{{ upgrade.upgrades.speed }}%</div>
                            <div class="stat">Доход: +{{ upgrade.upgrades.income }}%</div>
                            <div class="stat">Удовлетворение: +{{ upgrade.upgrades.satisfaction }}</div>
                        </div>
                    }
                </div>

                <!-- Level Upgrade Section -->
                <div class="section">
                    <h4>🔧 Повышение уровня</h4>
                    @if (nextUpgradeCost !== null) {
                        <div class="upgrade-option">
                            <div class="upgrade-description">
                                <p>Уровень {{ currentLevel }} → {{ currentLevel + 1 }}</p>
                                <div class="bonuses">
                                    <span>+{{ getNextLevelBonus().income }}% доход</span>
                                    <span>+{{ getNextLevelBonus().speed }}% скорость</span>
                                    <span>+{{ getNextLevelBonus().satisfaction }} счастья</span>
                                </div>
                            </div>
                            <button 
                                class="upgrade-btn"
                                [disabled]="currentMoney() < nextUpgradeCost"
                                (click)="upgradeLevel()">
                                Улучшить за \${{ nextUpgradeCost }}
                            </button>
                        </div>
                    } @else {
                        <p class="max-level">🏆 Максимальный уровень достигнут!</p>
                    }
                </div>

                <!-- Theme Section -->
                <div class="section">
                    <h4>🎨 Темы</h4>
                    @if (currentTheme) {
                        <div class="current-theme">
                            <span class="theme-icon">{{ getThemeIcon(currentTheme) }}</span>
                            <span>Активна: {{ getThemeName(currentTheme) }}</span>
                        </div>
                    }
                    
                    <div class="themes-grid">
                        @for (theme of availableThemes; track theme.id) {
                            <div class="theme-card" [class.active]="currentTheme === theme.id">
                                <div class="theme-header">
                                    <span class="theme-icon">{{ theme.icon }}</span>
                                    <span class="theme-name">{{ theme.name }}</span>
                                </div>
                                <div class="theme-bonuses">
                                    @if (theme.bonuses.income) {
                                        <small>+{{ theme.bonuses.income }}% доход</small>
                                    }
                                    @if (theme.bonuses.satisfaction) {
                                        <small>+{{ theme.bonuses.satisfaction }} счастья</small>
                                    }
                                </div>
                                @if (currentTheme !== theme.id) {
                                    <button 
                                        class="theme-btn"
                                        [disabled]="currentMoney() < theme.cost"
                                        (click)="applyTheme(theme.id)">
                                        \${{ theme.cost }}
                                    </button>
                                } @else {
                                    <div class="applied-badge">✓ Применено</div>
                                }
                            </div>
                        }
                    </div>
                </div>

                <!-- Stats Summary -->
                @if (upgrade) {
                    <div class="section summary">
                        <h4>📊 Статистика</h4>
                        <div class="summary-stats">
                            <div class="summary-item">
                                <span>Всего потрачено:</span>
                                <span class="value">\${{ upgrade.totalInvested }}</span>
                            </div>
                            <div class="summary-item">
                                <span>Итоговый доход:</span>
                                <span class="value income">{{ calculateFinalIncome() }}%</span>
                            </div>
                        </div>
                    </div>
                }
            </div>
        </div>
    `,
    styles: [`
        .upgrade-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.4);
            width: 90%;
            max-width: 600px;
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
            font-size: 20px;
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

        .current-level {
            background: rgba(255,255,255,0.95);
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 20px;
        }

        .level-badge {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .upgrade-stats {
            display: flex;
            gap: 15px;
            margin-top: 10px;
        }

        .upgrade-stats .stat {
            background: #e8f5e9;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 14px;
            color: #2e7d32;
            font-weight: bold;
        }

        .section {
            background: rgba(255,255,255,0.95);
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 15px;
        }

        .section h4 {
            margin: 0 0 15px 0;
            color: #333;
            font-size: 16px;
        }

        .upgrade-option {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
        }

        .upgrade-description p {
            margin: 0 0 8px 0;
            font-weight: bold;
            color: #333;
        }

        .bonuses {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .bonuses span {
            background: #fff3e0;
            color: #e65100;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 12px;
        }

        .upgrade-btn, .theme-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            white-space: nowrap;
        }

        .upgrade-btn:hover:not(:disabled), .theme-btn:hover:not(:disabled) {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .upgrade-btn:disabled, .theme-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }

        .max-level {
            text-align: center;
            color: #ff9800;
            font-weight: bold;
            padding: 10px;
        }

        .current-theme {
            background: #e1f5fe;
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: bold;
            color: #01579b;
        }

        .theme-icon {
            font-size: 24px;
        }

        .themes-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 10px;
        }

        .theme-card {
            background: #f5f5f5;
            border-radius: 10px;
            padding: 12px;
            text-align: center;
            transition: all 0.3s;
            border: 2px solid transparent;
        }

        .theme-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .theme-card.active {
            border-color: #4caf50;
            background: #e8f5e9;
        }

        .theme-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
            margin-bottom: 8px;
        }

        .theme-name {
            font-weight: bold;
            font-size: 13px;
            color: #333;
        }

        .theme-bonuses {
            display: flex;
            flex-direction: column;
            gap: 3px;
            margin-bottom: 8px;
        }

        .theme-bonuses small {
            color: #666;
            font-size: 11px;
        }

        .theme-btn {
            width: 100%;
            padding: 6px;
            font-size: 13px;
        }

        .applied-badge {
            background: #4caf50;
            color: white;
            padding: 6px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: bold;
        }

        .summary {
            background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
        }

        .summary-stats {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .summary-item {
            display: flex;
            justify-content: space-between;
            padding: 8px;
            background: white;
            border-radius: 6px;
        }

        .summary-item .value {
            font-weight: bold;
            color: #333;
        }

        .summary-item .value.income {
            color: #4caf50;
        }
    `]
})
export class UpgradePanelComponent {
    private upgradeService = inject(AttractionUpgradeService);

    building = input.required<BuildingType>();
    cellX = input.required<number>();
    cellY = input.required<number>();
    currentMoney = input.required<number>();

    onClose = output<void>();
    onUpgrade = output<{ cost: number }>();
    onThemeApplied = output<{ cost: number }>();

    get upgrade(): AttractionUpgrade | null {
        return this.upgradeService.getUpgrade(this.building().id);
    }

    get currentLevel(): number {
        return this.upgradeService.getLevel(this.building().id);
    }

    get nextUpgradeCost(): number | null {
        return this.upgradeService.getNextUpgradeCost(this.building().id);
    }

    get availableThemes() {
        return this.upgradeService.getAvailableThemes(this.building().id);
    }

    get currentTheme(): ThemeType | undefined {
        return this.upgrade?.theme;
    }

    getNextLevelBonus() {
        const nextLevel = this.currentLevel + 1;
        const costs = [
            { level: 2, income: 10, speed: 10, satisfaction: 5 },
            { level: 3, income: 25, speed: 20, satisfaction: 10 },
            { level: 4, income: 40, speed: 35, satisfaction: 15 },
            { level: 5, income: 60, speed: 50, satisfaction: 25 }
        ];
        return costs.find(c => c.level === nextLevel) || { income: 0, speed: 0, satisfaction: 0 };
    }

    upgradeLevel(): void {
        const result = this.upgradeService.upgradeAttraction(
            this.building().id,
            this.cellX(),
            this.cellY(),
            this.currentMoney()
        );

        if (result.success && result.cost) {
            this.onUpgrade.emit({ cost: result.cost });
        }
    }

    applyTheme(themeId: ThemeType): void {
        const result = this.upgradeService.applyTheme(
            this.building().id,
            themeId,
            this.currentMoney()
        );

        if (result.success && result.cost) {
            this.onThemeApplied.emit({ cost: result.cost });
        }
    }

    getThemeIcon(themeId: ThemeType): string {
        const theme = THEMES.find(t => t.id === themeId);
        return theme?.icon || '';
    }

    getThemeName(themeId: ThemeType): string {
        const theme = THEMES.find(t => t.id === themeId);
        return theme?.name || '';
    }

    calculateFinalIncome(): number {
        if (!this.upgrade) return 0;
        let total = this.upgrade.upgrades.income;
        if (this.currentTheme) {
            const theme = THEMES.find(t => t.id === this.currentTheme);
            if (theme?.bonuses.income) {
                total += theme.bonuses.income;
            }
        }
        return total;
    }
}
