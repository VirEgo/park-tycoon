import { TerrainType } from './expansion.model';
import { PizzaMenuData } from './pizza-menu.model';

export interface CellData {
    bank?: number;
    treeHueShift?: number;
    workerHome?: string;
    pizzaMenu?: PizzaMenuData;
    [key: string]: unknown;
}

export interface Cell {
    x: number;
    y: number;
    type: 'grass' | 'path' | 'building' | 'entrance' | 'exit';
    locked?: boolean;
    buildingId?: string;
    variant?: number;
    data?: CellData;
    terrain?: TerrainType;
    isRoot?: boolean;
    rootX?: number;
    rootY?: number;
}
