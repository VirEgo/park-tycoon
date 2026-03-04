export type TerrainType = 'grass' | 'forest' | 'mountain' | 'water';

export const PLOT_WIDTH = 20;
export const PLOT_HEIGHT = 15;
export const MAX_PLOT_RADIUS = 1;
export const PLOT_GRID_SIZE = MAX_PLOT_RADIUS * 2 + 1;
export const FULL_GRID_WIDTH = PLOT_WIDTH * PLOT_GRID_SIZE;
export const FULL_GRID_HEIGHT = PLOT_HEIGHT * PLOT_GRID_SIZE;
export const FIXED_GRID_OFFSET_X = MAX_PLOT_RADIUS * PLOT_WIDTH;
export const FIXED_GRID_OFFSET_Y = MAX_PLOT_RADIUS * PLOT_HEIGHT;

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

function createPlot(
    id: string,
    gridX: number,
    gridY: number,
    terrain: TerrainType,
    basePrice: number,
    unlocks: string[] = []
): LandPlot {
    return {
        id,
        gridX,
        gridY,
        size: { w: PLOT_WIDTH, h: PLOT_HEIGHT },
        basePrice,
        currentPrice: basePrice,
        purchased: false,
        terrain,
        unlocks
    };
}

// Максимальная карта: 3x3 секции, стартовая зона находится в центре.
export const INITIAL_LAND_PLOTS: LandPlot[] = [
    createPlot('plot-northwest-1', -1, -1, 'forest', 7000),
    createPlot('plot-north-1', 0, -1, 'forest', 5000, ['tree-house', 'camping']),
    createPlot('plot-northeast-1', 1, -1, 'mountain', 8000, ['zipline', 'climbing-wall']),
    createPlot('plot-west-1', -1, 0, 'grass', 5000),
    createPlot('plot-east-1', 1, 0, 'grass', 5000),
    createPlot('plot-southwest-1', -1, 1, 'grass', 6500),
    createPlot('plot-south-1', 0, 1, 'grass', 5000),
    createPlot('plot-southeast-1', 1, 1, 'water', 8000, ['water-park', 'boat-ride'])
];
