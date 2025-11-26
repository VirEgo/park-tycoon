import { Injectable } from '@angular/core';
import {
    AttractionUpgrade,
    ThemeType,
    THEMES,
    UPGRADE_COSTS,
    ThemeDefinition,
    UpgradeCost
} from '../models/attraction-upgrade.model';

@Injectable({
    providedIn: 'root'
})
export class AttractionUpgradeService {
    private readonly STORAGE_KEY = 'park-upgrades-v2';
    private upgrades: Map<string, AttractionUpgrade> = new Map();

    constructor() {
        this.loadFromStorage();
    }

    private makeKey(attractionId: string, cellX: number, cellY: number): string {
        return `${attractionId}@${cellX},${cellY}`;
    }

    /**
     * Получить улучшение конкретного экземпляра аттракциона
     */
    getUpgrade(attractionId: string, cellX: number, cellY: number): AttractionUpgrade | null {
        return this.upgrades.get(this.makeKey(attractionId, cellX, cellY)) || null;
    }

    /**
     * Проверить, есть ли прокачка у конкретного экземпляра
     */
    isUpgraded(attractionId: string, cellX: number, cellY: number): boolean {
        const upgrade = this.getUpgrade(attractionId, cellX, cellY);
        return upgrade ? upgrade.level > 1 : false;
    }

    /**
     * Текущий уровень экземпляра
     */
    getLevel(attractionId: string, cellX: number, cellY: number): number {
        const upgrade = this.getUpgrade(attractionId, cellX, cellY);
        return upgrade ? upgrade.level : 1;
    }

    /**
     * Улучшить конкретный экземпляр
     */
    upgradeAttraction(
        attractionId: string,
        cellX: number,
        cellY: number,
        currentMoney: number
    ): {
        success: boolean;
        cost?: number;
        newUpgrade?: AttractionUpgrade;
        message: string;
    } {
        const key = this.makeKey(attractionId, cellX, cellY);
        const currentUpgrade = this.upgrades.get(key);
        const currentLevel = currentUpgrade ? currentUpgrade.level : 1;

        if (currentLevel >= 5) {
            return {
                success: false,
                message: 'Аттракцион достиг максимального уровня (5)'
            };
        }

        const nextLevel = currentLevel + 1;
        const upgradeCost = UPGRADE_COSTS.find(u => u.level === nextLevel);

        if (!upgradeCost) {
            return {
                success: false,
                message: 'Ошибка: стоимость улучшения не найдена'
            };
        }

        if (currentMoney < upgradeCost.cost) {
            return {
                success: false,
                cost: upgradeCost.cost,
                message: `Недостаточно денег. Нужно: $${upgradeCost.cost}`
            };
        }

        const newUpgrade: AttractionUpgrade = currentUpgrade
            ? {
                ...currentUpgrade,
                level: nextLevel,
                totalInvested: currentUpgrade.totalInvested + upgradeCost.cost,
                upgrades: {
                    speed: currentUpgrade.upgrades.speed + upgradeCost.bonusPerLevel.speed,
                    capacity: currentUpgrade.upgrades.capacity + upgradeCost.bonusPerLevel.capacity,
                    income: currentUpgrade.upgrades.income + upgradeCost.bonusPerLevel.income,
                    satisfaction: currentUpgrade.upgrades.satisfaction + upgradeCost.bonusPerLevel.satisfaction
                }
            }
            : {
                attractionId,
                level: nextLevel,
                totalInvested: upgradeCost.cost,
                upgrades: {
                    speed: upgradeCost.bonusPerLevel.speed,
                    capacity: upgradeCost.bonusPerLevel.capacity,
                    income: upgradeCost.bonusPerLevel.income,
                    satisfaction: upgradeCost.bonusPerLevel.satisfaction
                },
                hasStaff: false
            };

        this.upgrades.set(key, newUpgrade);
        this.saveToStorage();

        return {
            success: true,
            cost: upgradeCost.cost,
            newUpgrade,
            message: `Аттракцион улучшен до уровня ${nextLevel}!`
        };
    }

    /**
     * Применить тему к экземпляру
     */
    applyTheme(
        attractionId: string,
        cellX: number,
        cellY: number,
        theme: ThemeType,
        currentMoney: number
    ): {
        success: boolean;
        cost?: number;
        message: string;
    } {
        const themeData = THEMES.find(t => t.id === theme);
        if (!themeData) {
            return { success: false, message: 'Тема не найдена' };
        }

        const key = this.makeKey(attractionId, cellX, cellY);
        const upgrade = this.upgrades.get(key);
        const currentLevel = upgrade ? upgrade.level : 1;

        if (themeData.requirements?.minLevel && currentLevel < themeData.requirements.minLevel) {
            return {
                success: false,
                message: `Требуется уровень ${themeData.requirements.minLevel}`
            };
        }

        if (currentMoney < themeData.cost) {
            return {
                success: false,
                cost: themeData.cost,
                message: `Недостаточно денег. Нужно: $${themeData.cost}`
            };
        }

        if (upgrade) {
            upgrade.theme = theme;
            upgrade.totalInvested += themeData.cost;
            this.upgrades.set(key, upgrade);
        } else {
            const newUpgrade: AttractionUpgrade = {
                attractionId,
                level: 1,
                totalInvested: themeData.cost,
                upgrades: {
                    speed: 0,
                    capacity: 0,
                    income: 0,
                    satisfaction: 0
                },
                theme,
                hasStaff: false
            };
            this.upgrades.set(key, newUpgrade);
        }

        this.saveToStorage();

        return {
            success: true,
            cost: themeData.cost,
            message: `Тема "${themeData.name}" применена!`
        };
    }

    /**
     * Посчитать доход с учетом апгрейдов
     */
    calculateModifiedIncome(attractionId: string, cellX: number, cellY: number, baseIncome: number): number {
        const upgrade = this.getUpgrade(attractionId, cellX, cellY);
        if (!upgrade) return baseIncome;

        let modifiedIncome = baseIncome;
        modifiedIncome += (baseIncome * upgrade.upgrades.income) / 100;

        if (upgrade.theme) {
            const theme = THEMES.find(t => t.id === upgrade.theme);
            if (theme?.bonuses.income) {
                modifiedIncome += (baseIncome * theme.bonuses.income) / 100;
            }
        }

        return Math.floor(modifiedIncome);
    }

    /**
     * Посчитать удовлетворенность с учетом апгрейдов
     */
    calculateModifiedSatisfaction(attractionId: string, cellX: number, cellY: number, baseSatisfaction: number): number {
        const upgrade = this.getUpgrade(attractionId, cellX, cellY);
        if (!upgrade) return baseSatisfaction;

        let modified = baseSatisfaction + upgrade.upgrades.satisfaction;

        if (upgrade.theme) {
            const theme = THEMES.find(t => t.id === upgrade.theme);
            if (theme?.bonuses.satisfaction) {
                modified += theme.bonuses.satisfaction;
            }
        }

        return Math.min(100, modified);
    }

    /**
     * Стоимость следующего уровня
     */
    getNextUpgradeCost(attractionId: string, cellX: number, cellY: number): number | null {
        const upgrade = this.getUpgrade(attractionId, cellX, cellY);
        const currentLevel = upgrade ? upgrade.level : 1;

        if (currentLevel >= 5) return null;

        const nextUpgrade = UPGRADE_COSTS.find(u => u.level === currentLevel + 1);
        return nextUpgrade ? nextUpgrade.cost : null;
    }

    /**
     * Доступные темы для экземпляра
     */
    getAvailableThemes(attractionId: string, cellX: number, cellY: number): ThemeDefinition[] {
        const upgrade = this.getUpgrade(attractionId, cellX, cellY);
        const currentLevel = upgrade ? upgrade.level : 1;

        return THEMES.filter(theme => {
            if (theme.id === 'default') return false;
            if (theme.requirements?.minLevel && currentLevel < theme.requirements.minLevel) {
                return false;
            }
            return true;
        });
    }

    /**
     * Иконка темы для экземпляра
     */
    getThemeIcon(attractionId: string, cellX: number, cellY: number): string {
        const upgrade = this.getUpgrade(attractionId, cellX, cellY);
        if (!upgrade || !upgrade.theme) return '';

        const theme = THEMES.find(t => t.id === upgrade.theme);
        return theme ? theme.icon : '';
    }

    /**
     * Статистика апгрейдов
     */
    getAllUpgrades(): AttractionUpgrade[] {
        return Array.from(this.upgrades.values());
    }

    getUpgradeStats(): {
        totalUpgrades: number;
        totalInvested: number;
        averageLevel: number;
        maxLevel: number;
    } {
        const upgrades = this.getAllUpgrades();

        if (upgrades.length === 0) {
            return {
                totalUpgrades: 0,
                totalInvested: 0,
                averageLevel: 0,
                maxLevel: 0
            };
        }

        const totalInvested = upgrades.reduce((sum, u) => sum + u.totalInvested, 0);
        const totalLevels = upgrades.reduce((sum, u) => sum + u.level, 0);
        const maxLevel = Math.max(...upgrades.map(u => u.level));

        return {
            totalUpgrades: upgrades.length,
            totalInvested,
            averageLevel: totalLevels / upgrades.length,
            maxLevel
        };
    }

    /**
     * Сбросить все улучшения
     */
    clearAll(): void {
        this.upgrades.clear();
        localStorage.removeItem(this.STORAGE_KEY);
    }

    /**
     * Удалить улучшение для конкретного экземпляра
     */
    removeUpgrade(attractionId: string, cellX: number, cellY: number): void {
        this.upgrades.delete(this.makeKey(attractionId, cellX, cellY));
        this.saveToStorage();
    }

    /**
     * Сохранить в localStorage
     */
    private saveToStorage(): void {
        try {
            const data = Array.from(this.upgrades.entries());
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save upgrades:', e);
        }
    }

    /**
     * Загрузить из localStorage (игнорируя старый формат без координат)
     */
    private loadFromStorage(): void {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) {
                const entries = JSON.parse(data) as Array<[string, AttractionUpgrade]>;
                this.upgrades = new Map(entries.filter(([key]) => key.includes('@')));
            }
        } catch (e) {
            console.error('Failed to load upgrades:', e);
        }
    }
}
