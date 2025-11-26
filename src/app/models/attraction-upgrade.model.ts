export interface AttractionUpgrade {
    attractionId: string; // ID здания из BUILDINGS
    level: number; // 1-5
    totalInvested: number; // Сколько всего потрачено
    upgrades: {
        speed: number; // Бонус к скорости обслуживания (проценты)
        capacity: number; // Бонус к вместимости
        income: number; // Бонус к доходу (проценты)
        satisfaction: number; // Бонус к удовлетворению гостей
    };
    theme?: ThemeType;
    hasStaff: boolean;
}

export type ThemeType = 'default' | 'space' | 'underwater' | 'fantasy' | 'horror' | 'safari';

export interface ThemeDefinition {
    id: ThemeType;
    name: string;
    icon: string;
    cost: number;
    bonuses: {
        income?: number; // +% к доходу
        satisfaction?: number; // +баллов к счастью
        attractiveness?: number; // Привлекает определенный тип гостей
    };
    requirements?: {
        minLevel?: number;
    };
}

export const THEMES: ThemeDefinition[] = [
    {
        id: 'default',
        name: 'Стандарт',
        icon: '🏗️',
        cost: 0,
        bonuses: {}
    },
    {
        id: 'space',
        name: 'Космос',
        icon: '🚀',
        cost: 1000,
        bonuses: { income: 15, satisfaction: 10 },
        requirements: { minLevel: 2 }
    },
    {
        id: 'underwater',
        name: 'Подводный',
        icon: '🐠',
        cost: 1200,
        bonuses: { income: 20, satisfaction: 15 },
        requirements: { minLevel: 3 }
    },
    {
        id: 'fantasy',
        name: 'Фэнтези',
        icon: '🧙',
        cost: 1500,
        bonuses: { income: 25, satisfaction: 20 },
        requirements: { minLevel: 3 }
    },
    {
        id: 'horror',
        name: 'Ужасы',
        icon: '👻',
        cost: 1800,
        bonuses: { income: 30, satisfaction: 25 },
        requirements: { minLevel: 4 }
    },
    {
        id: 'safari',
        name: 'Сафари',
        icon: '🦁',
        cost: 2000,
        bonuses: { income: 35, satisfaction: 30 },
        requirements: { minLevel: 4 }
    }
];

export interface UpgradeCost {
    level: number;
    cost: number;
    bonusPerLevel: {
        speed: number;
        capacity: number;
        income: number;
        satisfaction: number;
    };
}

// Стоимость улучшений по уровням
export const UPGRADE_COSTS: UpgradeCost[] = [
    {
        level: 1,
        cost: 0,
        bonusPerLevel: { speed: 0, capacity: 0, income: 0, satisfaction: 0 }
    },
    {
        level: 2,
        cost: 500,
        bonusPerLevel: { speed: 10, capacity: 1, income: 10, satisfaction: 5 }
    },
    {
        level: 3,
        cost: 1500,
        bonusPerLevel: { speed: 20, capacity: 2, income: 25, satisfaction: 10 }
    },
    {
        level: 4,
        cost: 3500,
        bonusPerLevel: { speed: 35, capacity: 3, income: 40, satisfaction: 15 }
    },
    {
        level: 5,
        cost: 7000,
        bonusPerLevel: { speed: 50, capacity: 5, income: 60, satisfaction: 25 }
    }
];
