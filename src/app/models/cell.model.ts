import { TerrainType } from './expansion.model';

export interface Cell {
    x: number;
    y: number;
    type: 'grass' | 'path' | 'building' | 'entrance' | 'exit';
    locked?: boolean;
    buildingId?: string;
    variant?: number;
    data?: any;
    terrain?: TerrainType;
    isRoot?: boolean;
    rootX?: number;
    rootY?: number;
}
