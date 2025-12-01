export interface UpgradeProfile {
    maxLevel?: number; // override max level (default 5)
    upgradeCosts?: Array<{ level: number; cost: number; bonusPerLevel: any }>; // partial same shape как UPGRADE_COSTS
    allowedThemeIds?: string[]; // если указан — фильтрует THEMES
    costMultiplier?: number; // множитель стоимости (например для сервисных зданий)
}

export const DEFAULT_UPGRADE_PROFILE: UpgradeProfile = {
    maxLevel: 5,
    costMultiplier: 1
};

export const UPGRADE_PROFILES: Record<string, UpgradeProfile> = {
    parkMaintenance: {
        maxLevel: 4,
        upgradeCosts: [
            { level: 2, cost: 300, bonusPerLevel: { workers: 1, capacity: 1, maintenance: 50 } },
            { level: 3, cost: 600, bonusPerLevel: { workers: 1, capacity: 1, maintenance: 100 } },
            { level: 4, cost: 1000, bonusPerLevel: { workers: 2, capacity: 2, maintenance: 150 } }
        ],
        allowedThemeIds: ['classic', 'nature', 'modern'],
        costMultiplier: 1.8
    }
};