import { Injectable, inject } from '@angular/core';
import { Cell } from '../models/cell.model';
import { BuildingType, BUILDINGS } from '../models/building.model';
import { GridService } from './grid.service';
import { CasinoService } from './casino.service';
import { BuildingStatusService } from './building-status.service';

@Injectable({
    providedIn: 'root'
})
export class BuildingService {
    private gridService = inject(GridService);
    private casinoService = inject(CasinoService);
    private buildingStatusService = inject(BuildingStatusService);
    private buildingImages: Map<string, HTMLImageElement> = new Map();

    constructor() {
        this.preloadBuildingImages();
    }

    private preloadBuildingImages() {
        BUILDINGS.forEach(building => {
            if (building.svgPath) {
                const img = new Image();
                img.src = building.svgPath;
                this.buildingImages.set(building.id, img);
            }
        });
    }

    getBuildingImage(id: string): HTMLImageElement | undefined {
        return this.buildingImages.get(id);
    }

    getBuildingsByCategory(category: string): BuildingType[] {
        return BUILDINGS.filter(b => b.category === category && !b.hidden);
    }

    getBuildingById(id: string): BuildingType | undefined {
        return BUILDINGS.find(b => b.id === id);
    }

    getBuildingColor(id: string): string {
        return this.getBuildingById(id)?.color || '#fff';
    }

    getBuildingIcon(id: string): string {
        return this.getBuildingById(id)?.icon || '';
    }

    canBuild(building: BuildingType, money: number): boolean {
        return money >= building.price;
    }

    checkPlacement(grid: Cell[], x: number, y: number, building: BuildingType, gridWidth: number, gridHeight: number): boolean {
        // Check if building would go out of bounds
        if (x + building.width > gridWidth || y + building.height > gridHeight) {
            return false;
        }

        // Check if building would go into negative coordinates
        if (x < 0 || y < 0) {
            return false;
        }

        for (let i = 0; i < building.width; i++) {
            for (let j = 0; j < building.height; j++) {
                const checkX = x + i;
                const checkY = y + j;

                if (checkX >= gridWidth || checkY >= gridHeight) return false;

                const idx = this.gridService.getCellIndex(checkX, checkY, gridWidth);
                const cell = grid[idx];
                // Allow building on grass.
                // TODO: Allow paths on paths? For now, strict check.
                if (cell.type !== 'grass') return false;
                // Block building on protected terrain (water/mountains)
                if (cell.terrain === 'water' || cell.terrain === 'mountain') return false;
            }
        }
        return true;
    }

    buildBuilding(grid: Cell[], cell: Cell, building: BuildingType, width: number): Cell[] {
        const newGrid = [...grid];

        // Determine type
        let newType: Cell['type'] = 'building';
        if (building.category === 'path') {
            if (building.id === 'exit') {
                newType = 'exit';
            } else {
                newType = 'path';
            }
        }

        // Loop through dimensions
        for (let i = 0; i < building.width; i++) {
            for (let j = 0; j < building.height; j++) {
                const targetX = cell.x + i;
                const targetY = cell.y + j;
                const idx = this.gridService.getCellIndex(targetX, targetY, width);

                const isRoot = i === 0 && j === 0;

                newGrid[idx] = {
                    ...newGrid[idx],
                    type: newType,
                    buildingId: building.id,
                    data: (isRoot && building.isGambling) ? { bank: 20 } : undefined,
                    isRoot: isRoot,
                    rootX: cell.x,
                    rootY: cell.y
                };
            }
        }

        // Initialize casino in service (only once for the root)
        if (building.isGambling) {
            this.casinoService.initCasino(cell.x, cell.y, 20);
        }

        // Initialize durability
        this.buildingStatusService.initStatus(cell.x, cell.y);

        return newGrid;
    }

    demolishBuilding(grid: Cell[], cell: Cell, width: number): Cell[] {
        const newGrid = [...grid];

        // If it's a building part, find the root
        let rootX = cell.x;
        let rootY = cell.y;

        if (cell.type === 'building' && cell.rootX !== undefined && cell.rootY !== undefined) {
            rootX = cell.rootX;
            rootY = cell.rootY;
        }

        // Get the building info to know dimensions
        // We need to find the root cell to get the buildingId if the current cell doesn't have it (though it should)
        const rootIdx = this.gridService.getCellIndex(rootX, rootY, width);
        const rootCell = newGrid[rootIdx];

        if (!rootCell.buildingId) return newGrid; // Should not happen

        const building = this.getBuildingById(rootCell.buildingId);
        if (!building) return newGrid;

        // Remove casino from service if it's a gambling building
        if (building.isGambling) {
            this.casinoService.removeCasino(rootX, rootY);
        }

        // Remove durability status
        this.buildingStatusService.removeStatus(rootX, rootY);

        // Clear all cells
        for (let i = 0; i < building.width; i++) {
            for (let j = 0; j < building.height; j++) {
                const targetX = rootX + i;
                const targetY = rootY + j;
                const idx = this.gridService.getCellIndex(targetX, targetY, width);

                newGrid[idx] = {
                    ...newGrid[idx],
                    type: 'grass',
                    buildingId: undefined,
                    data: undefined,
                    isRoot: undefined,
                    rootX: undefined,
                    rootY: undefined
                };
            }
        }

        return newGrid;
    }

    processCasinoPayout(grid: Cell[]): { totalPayout: number, updatedGrid: Cell[] } {
        const updatedGrid = [...grid];
        let totalPayout = 0;

        updatedGrid.forEach(cell => {
            if (cell.type === 'building' && cell.buildingId && cell.data && typeof cell.data.bank === 'number') {
                const bInfo = this.getBuildingById(cell.buildingId);
                if (bInfo && bInfo.isGambling) {
                    const payout = this.casinoService.processPayout(cell.x, cell.y);
                    totalPayout += payout;
                    const stats = this.casinoService.getCasinoStats(cell.x, cell.y);
                    cell.data.bank = stats?.currentBank ?? 20;
                }
            }
        });

        return { totalPayout, updatedGrid };
    }
}
