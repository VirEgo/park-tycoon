import { TerrainType } from './expansion.model';
import { PizzaMenuData } from './pizza-menu.model';

export interface CellData {
    bank?: number;
    treeHueShift?: number;
    workerHome?: string;
    pizzaMenu?: PizzaMenuData;
    placedWidth?: number;
    placedHeight?: number;
    rotation?: 0 | 90;
    isOpen?: boolean; // Открыто ли здание для гостей (true = открыто, undefined/false = закрыто)
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
