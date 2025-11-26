export type TerrainType = 'grass' | 'forest' | 'mountain' | 'water';

export interface LandPlot {
    id: string;
    gridX: number; // Позиция относительно основного поля (-1, 0, 1 и т.д.)
    gridY: number;
    size: { w: number; h: number };
    basePrice: number;
    currentPrice: number;
    purchased: boolean;
    terrain: TerrainType;
    unlocks?: string[]; // ID зданий, которые открываются
}

export interface ExpansionState {
    plots: LandPlot[];
    purchasedCount: number;
    totalSpent: number;
}

// Базовые участки земли вокруг стартового поля
export const INITIAL_LAND_PLOTS: LandPlot[] = [
    // Справа от основного поля
    {
        id: 'plot-east-1',
        gridX: 1,
        gridY: 0,
        size: { w: 20, h: 15 },
        basePrice: 5000,
        currentPrice: 5000,
        purchased: false,
        terrain: 'grass',
        unlocks: []
    },
    // Слева
    {
        id: 'plot-west-1',
        gridX: -1,
        gridY: 0,
        size: { w: 20, h: 15 },
        basePrice: 5000,
        currentPrice: 5000,
        purchased: false,
        terrain: 'grass',
        unlocks: []
    },
    // Сверху
    {
        id: 'plot-north-1',
        gridX: 0,
        gridY: -1,
        size: { w: 20, h: 15 },
        basePrice: 5000,
        currentPrice: 5000,
        purchased: false,
        terrain: 'forest',
        unlocks: ['tree-house', 'camping']
    },
    // Снизу
    {
        id: 'plot-south-1',
        gridX: 0,
        gridY: 1,
        size: { w: 20, h: 15 },
        basePrice: 5000,
        currentPrice: 5000,
        purchased: false,
        terrain: 'grass',
        unlocks: []
    },
    // Диагональные участки (дороже)
    {
        id: 'plot-northeast-1',
        gridX: 1,
        gridY: -1,
        size: { w: 20, h: 15 },
        basePrice: 8000,
        currentPrice: 8000,
        purchased: false,
        terrain: 'mountain',
        unlocks: ['zipline', 'climbing-wall']
    },
    {
        id: 'plot-southeast-1',
        gridX: 1,
        gridY: 1,
        size: { w: 20, h: 15 },
        basePrice: 8000,
        currentPrice: 8000,
        purchased: false,
        terrain: 'water',
        unlocks: ['water-park', 'boat-ride']
    }
];
