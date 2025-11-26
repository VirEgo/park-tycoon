import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttractionUpgradeService } from '../../services/attraction-upgrade.service';
import { BuildingStatusService } from '../../services/building-status.service';
import { AttractionUpgrade, THEMES, ThemeType } from '../../models/attraction-upgrade.model';
import { BuildingType } from '../../models/building.model';

type TabType = 'upgrade' | 'stats' | 'customization';

@Component({
    selector: 'app-upgrade-panel',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="modal-backdrop" (click)="onClose.emit()">
            <div class="upgrade-panel" (click)="$event.stopPropagation()">
                <!-- Header -->
                <div class="panel-header">
                    <div class="header-title">
                        <h3>{{ building().name }}</h3>
                        <span class="level-badge">Уровень {{ currentLevel }}</span>
                    </div>
                    <button class="close-btn" (click)="onClose.emit()">✖</button>
                </div>

                <!-- Repair Banner -->
                @if (isBroken()) {
                    <div class="repair-banner">
                        <div class="repair-info">
                            <span class="repair-icon">⚠️</span>
                            <div class="repair-text">
                                <strong>Здание сломано!</strong>
                                <p>Посетители не могут войти.</p>
                            </div>
                        </div>
                        <button 
                            class="repair-btn"
                            [disabled]="currentMoney() < repairCost()"
                            (click)="onRepair.emit({ cost: repairCost() })">
                            Починить за \${{ repairCost() }}
                        </button>
                    </div>
                }

                <!-- Tabs -->
                <div class="tabs">
                    <button 
                        class="tab-btn" 
                        [class.active]="activeTab() === 'upgrade'"
                        (click)="activeTab.set('upgrade')">
                        ⬆️ Улучшения
                    </button>
                    <button 
                        class="tab-btn" 
                        [class.active]="activeTab() === 'stats'"
                        (click)="activeTab.set('stats')">
                        📊 Статистика
                    </button>
                    <button 
                        class="tab-btn" 
                        [class.active]="activeTab() === 'customization'"
                        (click)="activeTab.set('customization')">
                        🎨 Вид
                    </button>
                </div>

                <div class="panel-content">
                    <!-- UPGRADE TAB -->
                    @if (activeTab() === 'upgrade') {
                        <div class="tab-content">
                            <!-- Current Stats -->
                            <div class="section">
                                <h4>Текущие показатели</h4>
                                <div class="stats-grid">
                                    <div class="stat-item">
                                        <span class="stat-label">Скорость</span>
                                        <span class="stat-value">+{{ upgrade?.upgrades?.speed || 0 }}%</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Доход</span>
                                        <span class="stat-value">+{{ upgrade?.upgrades?.income || 0 }}%</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Удовлетворение</span>
                                        <span class="stat-value">+{{ upgrade?.upgrades?.satisfaction || 0 }}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Next Upgrade -->
                            <div class="section highlight">
                                <h4>Следующий уровень</h4>
                                @if (nextUpgradeCost !== null) {
                                    <div class="upgrade-preview">
                                        <div class="level-transition">
                                            <span class="lvl">{{ currentLevel }}</span>
                                            <span class="arrow">➜</span>
                                            <span class="lvl next">{{ currentLevel + 1 }}</span>
                                        </div>
                                        <div class="bonuses-list">
                                            <div class="bonus-item">
                                                <span class="icon">💰</span>
                                                <span>+{{ getNextLevelBonus().income }}% доход</span>
                                            </div>
                                            <div class="bonus-item">
                                                <span class="icon">⚡</span>
                                                <span>+{{ getNextLevelBonus().speed }}% скорость</span>
                                            </div>
                                            <div class="bonus-item">
                                                <span class="icon">😊</span>
                                                <span>+{{ getNextLevelBonus().satisfaction }} счастья</span>
                                            </div>
                                        </div>
                                        <button 
                                            class="action-btn upgrade-action"
                                            [disabled]="currentMoney() < nextUpgradeCost"
                                            (click)="upgradeLevel()">
                                            Улучшить (\${{ nextUpgradeCost }})
                                        </button>
                                    </div>
                                } @else {
                                    <div class="max-level-message">
                                        🏆 Максимальный уровень достигнут!
                                    </div>
                                }
                            </div>
                        </div>
                    }

                    <!-- STATS TAB -->
                    @if (activeTab() === 'stats') {
                        <div class="tab-content">
                            <div class="section">
                                <h4>Финансы</h4>
                                <div class="stats-list">
                                    <div class="stat-row">
                                        <span>Всего посещений:</span>
                                        <span>{{ totalVisits }}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span>Всего инвестировано:</span>
                                        <span class="money">\${{ upgrade?.totalInvested || 0 }}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span>Бонус к доходу:</span>
                                        <span class="positive">+{{ calculateFinalIncome() }}%</span>
                                    </div>
                                </div>
                            </div>
                            <div class="section">
                                <h4>Информация</h4>
                                <div class="stats-list">
                                    <div class="stat-row">
                                        <span>Тип:</span>
                                        <span>{{ building().name }}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span>Размер:</span>
                                        <span>{{ building().width }}x{{ building().height }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    }

                    <!-- CUSTOMIZATION TAB -->
                    @if (activeTab() === 'customization') {
                        <div class="tab-content">
                            <div class="section">
                                <h4>Темы оформления</h4>
                                <div class="themes-grid">
                                    @for (theme of availableThemes; track theme.id) {
                                        <div class="theme-card" [class.active]="currentTheme === theme.id">
                                            <div class="theme-icon">{{ theme.icon }}</div>
                                            <div class="theme-info">
                                                <div class="theme-name">{{ theme.name }}</div>
                                                <div class="theme-bonuses">
                                                    @if (theme.bonuses.income) { <span>💰 +{{ theme.bonuses.income }}%</span> }
                                                    @if (theme.bonuses.satisfaction) { <span>😊 +{{ theme.bonuses.satisfaction }}</span> }
                                                </div>
                                            </div>
                                            @if (currentTheme !== theme.id) {
                                                <button 
                                                    class="theme-select-btn"
                                                    [disabled]="currentMoney() < theme.cost"
                                                    (click)="applyTheme(theme.id)">
                                                    \${{ theme.cost }}
                                                </button>
                                            } @else {
                                                <div class="active-badge">✓</div>
                                            }
                                        </div>
                                    }
                                </div>
                            </div>
                        </div>
                    }
                </div>
            </div>
        </div>
    `,
    styles: [`
        .modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            backdrop-filter: blur(4px);
        }

        .upgrade-panel {
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            width: 90%;
            max-width: 500px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .panel-header {
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }

        .header-title h3 {
            margin: 0 0 5px 0;
            font-size: 22px;
        }

        .level-badge {
            background: rgba(255,255,255,0.2);
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
        }

        .close-btn {
            background: none;
            border: none;
            color: rgba(255,255,255,0.8);
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
        }

        .close-btn:hover {
            color: white;
        }

        /* Repair Banner */
        .repair-banner {
            background: #fee2e2;
            border-bottom: 1px solid #fecaca;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
        }

        .repair-info {
            display: flex;
            gap: 12px;
            align-items: center;
        }

        .repair-icon {
            font-size: 24px;
        }

        .repair-text strong {
            display: block;
            color: #dc2626;
            font-size: 14px;
        }

        .repair-text p {
            margin: 0;
            color: #7f1d1d;
            font-size: 12px;
        }

        .repair-btn {
            background: #dc2626;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
        }

        .repair-btn:hover:not(:disabled) {
            background: #b91c1c;
        }

        .repair-btn:disabled {
            background: #fca5a5;
            cursor: not-allowed;
        }

        /* Tabs */
        .tabs {
            display: flex;
            border-bottom: 1px solid #eee;
            padding: 0 20px;
            background: #f8f9fa;
        }

        .tab-btn {
            padding: 15px 20px;
            background: none;
            border: none;
            border-bottom: 3px solid transparent;
            color: #666;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .tab-btn:hover {
            color: #333;
            background: rgba(0,0,0,0.02);
        }

        .tab-btn.active {
            color: #764ba2;
            border-bottom-color: #764ba2;
        }

        /* Content */
        .panel-content {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
            background: #f8f9fa;
        }

        .section {
            background: white;
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .section h4 {
            margin: 0 0 15px 0;
            color: #444;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .section.highlight {
            border: 2px solid #e0e7ff;
            background: #eef2ff;
        }

        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
        }

        .stat-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            background: #f8f9fa;
            padding: 10px;
            border-radius: 8px;
        }

        .stat-label {
            font-size: 11px;
            color: #666;
            margin-bottom: 4px;
        }

        .stat-value {
            font-weight: bold;
            color: #2e7d32;
        }

        /* Upgrade Preview */
        .upgrade-preview {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .level-transition {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            font-size: 18px;
            font-weight: bold;
            color: #333;
        }

        .lvl {
            background: white;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        .lvl.next {
            background: #764ba2;
            color: white;
        }

        .bonuses-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .bonus-item {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
            color: #555;
        }

        .action-btn {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s;
        }

        .action-btn:hover:not(:disabled) {
            transform: translateY(-2px);
        }

        .upgrade-action {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(118, 75, 162, 0.3);
        }

        .upgrade-action:disabled {
            background: #ccc;
            box-shadow: none;
            cursor: not-allowed;
        }

        .max-level-message {
            text-align: center;
            color: #f59e0b;
            font-weight: bold;
            padding: 10px;
        }

        /* Stats List */
        .stats-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .stat-row {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            color: #555;
            border-bottom: 1px dashed #eee;
            padding-bottom: 5px;
        }

        .stat-row:last-child {
            border-bottom: none;
        }

        .money { color: #2e7d32; font-weight: bold; }
        .positive { color: #2e7d32; }

        /* Themes */
        .themes-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
        }

        .theme-card {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 10px;
            border: 2px solid transparent;
            transition: all 0.2s;
        }

        .theme-card.active {
            border-color: #4caf50;
            background: #e8f5e9;
        }

        .theme-icon {
            font-size: 24px;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
            border-radius: 8px;
        }

        .theme-info {
            flex: 1;
        }

        .theme-name {
            font-weight: bold;
            color: #333;
            margin-bottom: 4px;
        }

        .theme-bonuses {
            display: flex;
            gap: 10px;
            font-size: 12px;
            color: #666;
        }

        .theme-select-btn {
            padding: 6px 12px;
            border: none;
            border-radius: 6px;
            background: #e0e0e0;
            color: #333;
            font-weight: bold;
            cursor: pointer;
        }

        .theme-select-btn:hover:not(:disabled) {
            background: #d0d0d0;
        }

        .active-badge {
            color: #4caf50;
            font-weight: bold;
            font-size: 20px;
        }
    `]
})
export class UpgradePanelComponent {
    private upgradeService = inject(AttractionUpgradeService);
    private buildingStatusService = inject(BuildingStatusService);

    building = input.required<BuildingType>();
    cellX = input.required<number>();
    cellY = input.required<number>();
    currentMoney = input.required<number>();

    // New inputs for repair
    isBroken = input<boolean>(false);
    repairCost = input<number>(0);

    onClose = output<void>();
    onUpgrade = output<{ cost: number }>();
    onThemeApplied = output<{ cost: number }>();
    onRepair = output<{ cost: number }>();

    activeTab = signal<TabType>('upgrade');

    get totalVisits(): number {
        return this.buildingStatusService.getStatus(this.cellX(), this.cellY())?.totalVisits || 0;
    }

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
