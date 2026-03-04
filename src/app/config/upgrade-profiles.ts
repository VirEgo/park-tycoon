export interface UpgradeProfile {
    maxLevel?: number; // override max level (default 5)
    upgradeCosts?: Array<{ level: number; cost: number; bonusPerLevel: any }>; // partial same shape как UPGRADE_COSTS
    allowedThemeIds?: string[]; // если указан — фильтрует THEMES
    costMultiplier?: number; // множитель стоимости (например для сервисных зданий)
    disableThemes?: boolean;
}

export const DEFAULT_UPGRADE_PROFILE: UpgradeProfile = {
    maxLevel: 5,
    costMultiplier: 1
};

export const UPGRADE_PROFILES: Record<string, UpgradeProfile> = {
    parkMaintenance: {
        maxLevel: 4,
        upgradeCosts: [
            { level: 2, cost: 300, bonusPerLevel: { speed: 15, capacity: 0, income: 0, satisfaction: 0 } },
            { level: 3, cost: 600, bonusPerLevel: { speed: 30, capacity: 0, income: 0, satisfaction: 0 } },
            { level: 4, cost: 1000, bonusPerLevel: { speed: 50, capacity: 0, income: 0, satisfaction: 0 } }
        ],
        costMultiplier: 1.8,
        disableThemes: true
    }
};
