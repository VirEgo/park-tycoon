import { Injectable } from '@angular/core';
import { Cell } from '../models/cell.model';

export const GRID_W = 20;
export const GRID_H = 15;

@Injectable({
    providedIn: 'root'
})
export class GridService {
    createEmptyGrid(width: number = GRID_W, height: number = GRID_H): Cell[] {
        const grid: Cell[] = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                grid.push({ x, y, type: 'grass' });
            }
        }
        return grid;
    }

    getCellIndex(x: number, y: number, width: number): number {
        return y * width + x;
    }

    getCell(grid: Cell[], x: number, y: number, width: number, height: number): Cell | null {
        if (x < 0 || x >= width || y < 0 || y >= height) return null;
        return grid[this.getCellIndex(x, y, width)];
    }

    updateCell(grid: Cell[], cell: Cell, width: number): Cell[] {
        const newGrid = [...grid];
        const idx = this.getCellIndex(cell.x, cell.y, width);
        newGrid[idx] = cell;
        return newGrid;
    }

    isWalkable(cell: Cell, buildingInfo?: { allowedOnPath?: boolean }): boolean {
        if (cell.type === 'path' || cell.type === 'entrance' || cell.type === 'exit') {
            return true;
        }

        if (cell.type === 'building' && buildingInfo) {
            return buildingInfo.allowedOnPath !== false;
        }

        return false;
    }

    getNeighbors(x: number, y: number, width: number, height: number): Array<{ x: number, y: number }> {
        const offsets = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        const neighbors = [];

        for (const [dx, dy] of offsets) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                neighbors.push({ x: nx, y: ny });
            }
        }

        return neighbors;
    }
}
