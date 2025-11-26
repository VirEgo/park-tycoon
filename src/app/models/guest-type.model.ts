export type GuestTypeId = 'casual' | 'vip' | 'family' | 'teen' | 'elder';
export type PreferenceType = 'thrill' | 'food' | 'relax' | 'water' | 'family-friendly';

export interface GuestTypeDefinition {
    id: GuestTypeId;
    name: string;
    icon: string;
    spendingPower: number; // Множитель трат (1.0 = обычный)
    speedModifier: number; // Скорость передвижения
    preferences: PreferenceType[];
    groupSizeRange: { min: number; max: number };
    unlockRequirement?: {
        rating?: number; // Нужен рейтинг парка
        attractionCount?: number;
    };
}

export const GUEST_TYPES: GuestTypeDefinition[] = [
    {
        id: 'casual',
        name: 'Обычный',
        icon: '👤',
        spendingPower: 1.0,
        speedModifier: 1.0,
        preferences: ['food', 'relax'],
        groupSizeRange: { min: 1, max: 2 }
    },
    {
        id: 'family',
        name: 'Семья',
        icon: '👨‍👩‍👧',
        spendingPower: 1.5,
        speedModifier: 0.8,
        preferences: ['family-friendly', 'food'],
        groupSizeRange: { min: 3, max: 5 },
        unlockRequirement: { attractionCount: 5 }
    },
    {
        id: 'teen',
        name: 'Подросток',
        icon: '🧑',
        spendingPower: 0.8,
        speedModifier: 1.3,
        preferences: ['thrill', 'food'],
        groupSizeRange: { min: 2, max: 4 },
        unlockRequirement: { attractionCount: 3 }
    },
    {
        id: 'elder',
        name: 'Пожилой',
        icon: '👴',
        spendingPower: 1.2,
        speedModifier: 0.6,
        preferences: ['relax', 'food'],
        groupSizeRange: { min: 1, max: 2 },
        unlockRequirement: { attractionCount: 8 }
    },
    {
        id: 'vip',
        name: 'VIP',
        icon: '💎',
        spendingPower: 3.0,
        speedModifier: 1.0,
        preferences: ['thrill', 'relax'],
        groupSizeRange: { min: 1, max: 1 },
        unlockRequirement: { rating: 4.0, attractionCount: 10 }
    }
];
