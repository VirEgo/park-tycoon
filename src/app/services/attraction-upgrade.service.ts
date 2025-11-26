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
    private readonly STORAGE_KEY = 'park-upgrades-v1';
    private upgrades: Map<string, AttractionUpgrade> = new Map();

    constructor() {
        this.loadFromStorage();
    }

    /**
     * Получить улучшение аттракциона
     */
    getUpgrade(attractionId: string): AttractionUpgrade | null {
        return this.upgrades.get(attractionId) || null;
    }

    /**
     * Проверить, улучшен ли аттракцион
     */
    isUpgraded(attractionId: string): boolean {
        const upgrade = this.upgrades.get(attractionId);
        return upgrade ? upgrade.level > 1 : false;
    }

    /**
     * Получить текущий уровень аттракциона
     */
    getLevel(attractionId: string): number {
        const upgrade = this.upgrades.get(attractionId);
        return upgrade ? upgrade.level : 1;
    }

    /**
     * Улучшить аттракцион на следующий уровень
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
        const currentUpgrade = this.upgrades.get(attractionId);
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
                message: 'Ошибка: данные улучшения не найдены'
            };
        }

        if (currentMoney < upgradeCost.cost) {
            return {
                success: false,
                cost: upgradeCost.cost,
                message: `Недостаточно денег. Нужно: $${upgradeCost.cost}`
            };
        }

        // Создаем или обновляем улучшение
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

        this.upgrades.set(attractionId, newUpgrade);
        this.saveToStorage();

        return {
            success: true,
            cost: upgradeCost.cost,
            newUpgrade,
            message: `Аттракцион улучшен до уровня ${nextLevel}!`
        };
    }

    /**
     * Применить тему к аттракциону
     */
    applyTheme(
        attractionId: string,
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

        const upgrade = this.upgrades.get(attractionId);
        const currentLevel = upgrade ? upgrade.level : 1;

        // Проверка требований
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

        // Применяем тему
        if (upgrade) {
            upgrade.theme = theme;
            upgrade.totalInvested += themeData.cost;
            this.upgrades.set(attractionId, upgrade);
        } else {
            // Создаем базовое улучшение с темой
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
            this.upgrades.set(attractionId, newUpgrade);
        }

        this.saveToStorage();

        return {
            success: true,
            cost: themeData.cost,
            message: `Тема "${themeData.name}" применена!`
        };
    }

    /**
     * Рассчитать модифицированный доход с учетом улучшений
     */
    calculateModifiedIncome(attractionId: string, baseIncome: number): number {
        const upgrade = this.upgrades.get(attractionId);
        if (!upgrade) return baseIncome;

        let modifiedIncome = baseIncome;

        // Бонус от уровня
        modifiedIncome += (baseIncome * upgrade.upgrades.income) / 100;

        // Бонус от темы
        if (upgrade.theme) {
            const theme = THEMES.find(t => t.id === upgrade.theme);
            if (theme?.bonuses.income) {
                modifiedIncome += (baseIncome * theme.bonuses.income) / 100;
            }
        }

        return Math.floor(modifiedIncome);
    }

    /**
     * Рассчитать модифицированное удовлетворение
     */
    calculateModifiedSatisfaction(attractionId: string, baseSatisfaction: number): number {
        const upgrade = this.upgrades.get(attractionId);
        if (!upgrade) return baseSatisfaction;

        let modified = baseSatisfaction + upgrade.upgrades.satisfaction;

        // Бонус от темы
        if (upgrade.theme) {
            const theme = THEMES.find(t => t.id === upgrade.theme);
            if (theme?.bonuses.satisfaction) {
                modified += theme.bonuses.satisfaction;
            }
        }

        return Math.min(100, modified);
    }

    /**
     * Получить стоимость следующего улучшения
     */
    getNextUpgradeCost(attractionId: string): number | null {
        const upgrade = this.upgrades.get(attractionId);
        const currentLevel = upgrade ? upgrade.level : 1;

        if (currentLevel >= 5) return null;

        const nextUpgrade = UPGRADE_COSTS.find(u => u.level === currentLevel + 1);
        return nextUpgrade ? nextUpgrade.cost : null;
    }

    /**
     * Получить список доступных тем
     */
    getAvailableThemes(attractionId: string): ThemeDefinition[] {
        const upgrade = this.upgrades.get(attractionId);
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
     * Получить иконку темы аттракциона
     */
    getThemeIcon(attractionId: string): string {
        const upgrade = this.upgrades.get(attractionId);
        if (!upgrade || !upgrade.theme) return '';

        const theme = THEMES.find(t => t.id === upgrade.theme);
        return theme ? theme.icon : '';
    }

    /**
     * Получить все улучшенные аттракционы
     */
    getAllUpgrades(): AttractionUpgrade[] {
        return Array.from(this.upgrades.values());
    }

    /**
     * Получить статистику по улучшениям
     */
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
     * Загрузить из localStorage
     */
    private loadFromStorage(): void {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) {
                const entries = JSON.parse(data) as Array<[string, AttractionUpgrade]>;
                this.upgrades = new Map(entries);
            }
        } catch (e) {
            console.error('Failed to load upgrades:', e);
        }
    }

    /**
     * Очистить все улучшения
     */
    clearAll(): void {
        this.upgrades.clear();
        localStorage.removeItem(this.STORAGE_KEY);
    }

    /**
     * Удалить улучшение конкретного аттракциона (при сносе)
     */
    removeUpgrade(attractionId: string): void {
        this.upgrades.delete(attractionId);
        this.saveToStorage();
    }
}
