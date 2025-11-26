import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttractionUpgradeService } from '../../services/attraction-upgrade.service';
import { BuildingStatusService } from '../../services/building-status.service';
import { CasinoService, CasinoStats } from '../../services/casino.service';
import { AttractionUpgrade, THEMES, ThemeType } from '../../models/attraction-upgrade.model';
import { BuildingType } from '../../models/building.model';

type TabType = 'upgrade' | 'stats' | 'customization';

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

    get casinoStats(): CasinoStats | null {
        if (!this.building().isGambling) return null;
        return this.casinoService.getCasinoStats(this.cellX(), this.cellY()) || null;
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

    getCasinoWinRate(stats: CasinoStats | null): number {
        if (!stats || stats.totalVisits === 0) return 0;
        return Math.round((stats.totalWins / stats.totalVisits) * 100);
    }
}
