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


export interface ServiceBehaviorConfig {
    // сколько посещений выдерживает здание до поломки (если не задано - берется из DEFAULT в сервисе)
    visitsBeforeBreak?: number;
    // множитель для расчета стоимости ремонта относительно базовой цены здания
    // (можно комбинировать с уровнями: профиль может иметь costMultiplier)
    repairCostMultiplier?: number;
    // если true - темы запрещены для этого типа здания
    disableThemes?: boolean;
    // можно переопределить максимальный уровень для сервисных зданий
    maxLevel?: number;
    // дополнительные поля для будущего расширения
    notes?: string;
}

export interface ServiceStatus {
    // сколько посещений накоплено с последнего ремонта
    visitsSinceRepair: number;
    // флаг поломки
    isBroken: boolean;
    // timestamp последнего ремонта
    lastRepairAt?: number;
}

export interface AttractionUpgrade {
    attractionId: string;
    level: number;
    totalInvested: number;
    upgrades: {
        speed: number;
        capacity: number;
        income: number;
        satisfaction: number;
    };
    theme?: ThemeType;
    hasStaff: boolean;

    // optional service-related runtime state (для сервисных зданий)
    service?: ServiceStatus;
}

// утилита расчета стоимости ремонта (используется в сервисе/панели)
export function calcRepairCost(basePrice: number, level: number, multiplier: number = 1): number {
    // относительно базовой цены применяется коэффициент по уровню:
    // level 1 -> 25%, 2 -> 60%, 3 -> 90%, 4 -> 110%, 5 -> 150%
    const levelMap: Record<number, number> = {
        1: 0.25,
        2: 0.60,
        3: 0.90,
        4: 1.10,
        5: 1.50
    };
    const coef = levelMap[level] ?? 1.0;
    return Math.ceil(basePrice * coef * multiplier);
}
