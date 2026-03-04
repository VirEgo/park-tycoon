import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttractionUpgradeService } from '../../services/attraction-upgrade.service';
import { BuildingStatusService } from '../../services/building-status.service';
import { CasinoService, CasinoStats, CasinoTransaction } from '../../services/casino.service';
import { AttractionUpgrade, THEMES, ThemeType } from '../../models/attraction-upgrade.model';
import { BuildingType } from '../../models/building.model';
import { BuildingService } from '../../services/building.service';

type TabType = 'upgrade' | 'stats' | 'customization' | 'transactions';

@Component({
    selector: 'app-upgrade-panel',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './upgrade-panel.component.html',
    styleUrls: ['./upgrade-panel.component.scss'],
})
export class UpgradePanelComponent {
    private upgradeService = inject(AttractionUpgradeService);
    private buildingStatusService = inject(BuildingStatusService);
    private casinoService = inject(CasinoService);
    private buildingService = inject(BuildingService);

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

    // Signal to trigger refresh of computed values
    private refreshTrigger = signal(0);

    // Computed signals for reactive updates
    upgrade = computed(() => {
        this.refreshTrigger(); // Subscribe to refresh trigger
        return this.upgradeService.getUpgrade(this.building().id, this.cellX(), this.cellY());
    });

    currentLevel = computed(() => {
        this.refreshTrigger(); // Subscribe to refresh trigger
        return this.upgradeService.getLevel(this.building().id, this.cellX(), this.cellY());
    });

    maxLevel = computed(() => {
        this.refreshTrigger();
        return this.upgradeService.getMaxLevel(this.building().id);
    });

    nextUpgradeCost = computed(() => {
        this.refreshTrigger(); // Subscribe to refresh trigger
        return this.upgradeService.getNextUpgradeCost(this.building().id, this.cellX(), this.cellY());
    });

    currentMaxUsage = computed(() => {
        this.refreshTrigger(); // Subscribe to refresh trigger
        const status = this.buildingStatusService.getStatus(this.cellX(), this.cellY());
        if (status?.maxVisits) return status.maxVisits;
        return this.buildingService.computeMaxUsageLimit(this.building(), this.currentLevel());
    });

    availableThemes = computed(() => {
        this.refreshTrigger(); // Subscribe to refresh trigger
        return this.upgradeService.getAvailableThemes(this.building().id, this.cellX(), this.cellY());
    });

    currentTheme = computed(() => {
        return this.upgrade()?.theme;
    });

    get totalVisits(): number {
        return this.buildingStatusService.getStatus(this.cellX(), this.cellY())?.totalVisits || 0;
    }

    get casinoStats(): CasinoStats | null {
        if (!this.building().isGambling) return null;
        return this.casinoService.getCasinoStats(this.cellX(), this.cellY()) || null;
    }

    get upcomingMaxUsage(): Array<{ level: number; value: number; delta: number }> {
        const data: Array<{ level: number; value: number; delta: number }> = [];
        const baseLevel = this.currentLevel();
        const baseValue = this.buildingService.computeMaxUsageLimit(this.building(), baseLevel);

        for (let lvl = baseLevel + 1; lvl <= this.maxLevel(); lvl++) {
            const value = this.buildingService.computeMaxUsageLimit(this.building(), lvl);
            data.push({ level: lvl, value, delta: value - baseValue });
        }
        return data;
    }

    private triggerRefresh(): void {
        this.refreshTrigger.update(v => v + 1);
    }

    getNextLevelBonus() {
        const nextLevel = this.currentLevel() + 1;
        return this.upgradeService.getUpgradeBonusForLevel(this.building().id, nextLevel);
    }

    upgradeLevel(): void {
        const result = this.upgradeService.upgradeAttraction(
            this.building().id,
            this.cellX(),
            this.cellY(),
            this.currentMoney()
        );


        if (result.success && result.cost) {
            this.triggerRefresh(); // Trigger UI refresh after upgrade
            this.onUpgrade.emit({ cost: result.cost });
        }
    }

    applyTheme(themeId: ThemeType): void {
        const result = this.upgradeService.applyTheme(
            this.building().id,
            this.cellX(),
            this.cellY(),
            themeId,
            this.currentMoney()
        );

        if (result.success && result.cost) {
            this.triggerRefresh(); // Trigger UI refresh after theme change
            this.onThemeApplied.emit({ cost: result.cost });
        }
    }

    calculateFinalIncome(): number {
        const upgradeData = this.upgrade();
        if (!upgradeData) return 0;
        let total = upgradeData.upgrades.income;
        const themeId = this.currentTheme();
        if (themeId) {
            const theme = THEMES.find(t => t.id === themeId);
            if (theme?.bonuses.income) {
                total += theme.bonuses.income;
            }
        }
        return total;
    }

    getCasinoWinRate(stats: CasinoStats | null): number {
        if (!stats || stats.totalVisits === 0) return 0;
        return Math.round((stats.totalWins / stats.totalVisits) * 100);
    }

    formatTime(timestamp: Date | string | number): string {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    trackByTxId(index: number, tx: any): number {
        return tx.id ?? index;
    }

    getCasinoTransactionLabel(type: CasinoTransaction['type']): string {
        switch (type) {
            case 'jackpot':
                return 'Джек-пот';
            case 'bankrupt':
                return 'Проиграл всё';
            case 'win':
                return 'Выигрыш';
            case 'lose':
                return 'Проигрыш';
            case 'payout':
                return 'Выплата';
        }
    }

    isCasinoPositiveTransaction(type: CasinoTransaction['type']): boolean {
        return type === 'win' || type === 'jackpot' || type === 'payout';
    }

    getCasinoTransactionAmountClass(type: CasinoTransaction['type']): string {
        if (type === 'jackpot') return 'jackpot';
        if (type === 'bankrupt' || type === 'lose') return 'lose';
        if (type === 'payout') return 'payout';
        return 'win';
    }
}
