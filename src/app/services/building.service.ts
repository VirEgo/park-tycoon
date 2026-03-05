import { Injectable, computed, inject } from '@angular/core';
import { Cell, CellData } from '../models/cell.model';
import { BuildingType, BUILDINGS } from '../models/building.model';
import { createDefaultPizzaMenuData } from '../models/pizza-menu.model';
import { GridService } from './grid.service';
import { CasinoService } from './casino.service';
import { BuildingStatusService } from './building-status.service';
import { AttractionUpgradeService } from './attraction-upgrade.service';
import { GamificationService } from './gamification.service';

@Injectable({
    providedIn: 'root'
})
export class BuildingService {
    private gridService = inject(GridService);
    private casinoService = inject(CasinoService);
    private buildingStatusService = inject(BuildingStatusService);
    private upgradeService = inject(AttractionUpgradeService);
    private gamificationService = inject(GamificationService);
    private buildingImages: Map<string, HTMLImageElement> = new Map();
    private readonly buildingsByCategory = computed(() => {
        const unlockedAchievementIds = this.gamificationService.unlockedAchievementIds();
        const grouped = new Map<string, BuildingType[]>();

        for (const building of BUILDINGS) {
            if (building.unlockAchievementId && !unlockedAchievementIds.has(building.unlockAchievementId)) {
                continue;
            }

            if (!building.unlockAchievementId && building.hidden) {
                continue;
            }

            const items = grouped.get(building.category) ?? [];
            items.push(building);
            grouped.set(building.category, items);
        }

        return grouped;
    });

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
        return this.buildingsByCategory().get(category) ?? [];
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

    computeMaxUsageLimit(building: BuildingType, level: number): number {
        const base = building.maxUsageLimit ?? this.buildingStatusService.getDefaultMaxVisits();
        const extra = this.upgradeService.calculateCapacityMultiplierForLevel(building.id, level);
        return Math.round(base * (1 + extra));
    }

    canBuild(building: BuildingType, money: number): boolean {
        return money >= building.price;
    }

    getPlacementFootprint(building: BuildingType, rotated: boolean): { width: number; height: number } {
        if (rotated && building.width !== building.height) {
            return { width: building.height, height: building.width };
        }

        return { width: building.width, height: building.height };
    }

    createPlacementBuilding(building: BuildingType, rotated: boolean): BuildingType {
        const footprint = this.getPlacementFootprint(building, rotated);

        if (footprint.width === building.width && footprint.height === building.height) {
            return building;
        }

        return {
            ...building,
            width: footprint.width,
            height: footprint.height
        };
    }

    getPlacedFootprint(building: BuildingType, data?: CellData): { width: number; height: number } {
        const width = data?.placedWidth;
        const height = data?.placedHeight;

        if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
            return { width, height };
        }

        return { width: building.width, height: building.height };
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
                if (cell.locked) return false;
                // Allow building on grass.
                // TODO: Allow paths on paths? For now, strict check.
                if (cell.type !== 'grass') return false;
                // Block building on protected terrain (water/mountains)
                if (cell.terrain === 'water' || cell.terrain === 'mountain') return false;
            }
        }
        return true;
    }

    buildBuilding(grid: Cell[], cell: Cell, building: BuildingType, width: number, rotated: boolean = false): Cell[] {
        const newGrid = [...grid];
        const footprint = this.getPlacementFootprint(building, rotated);

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
        for (let i = 0; i < footprint.width; i++) {
            for (let j = 0; j < footprint.height; j++) {
                const targetX = cell.x + i;
                const targetY = cell.y + j;
                const idx = this.gridService.getCellIndex(targetX, targetY, width);

                const isRoot = i === 0 && j === 0;
                const rootData = isRoot ? this.buildRootData(building, footprint.width, footprint.height, rotated) : undefined;

                newGrid[idx] = {
                    ...newGrid[idx],
                    type: newType,
                    buildingId: building.id,
                    data: rootData,
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

        // Initialize durability with per-building max usage limit and level multiplier
        const level = this.upgradeService.getLevel(building.id, cell.x, cell.y);
        const maxVisits = this.computeMaxUsageLimit(building, level);
        this.buildingStatusService.initStatus(cell.x, cell.y, maxVisits);

        return newGrid;
    }

    private buildRootData(building: BuildingType, placedWidth: number, placedHeight: number, rotated: boolean): CellData {
        const data: CellData = {
            placedWidth,
            placedHeight,
            rotation: rotated ? 90 : 0
        };

        if (building.isGambling) {
            data['bank'] = 20;
        }

        if (building.id === 'tree') {
            // Keep the shift in a narrow natural range to preserve a "tree-like" palette.
            data['treeHueShift'] = Math.floor(Math.random() * 71) - 35;
        }

        if (building.id === 'pizza') {
            data['pizzaMenu'] = createDefaultPizzaMenuData();
        }

        return data;
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

        const footprint = this.getPlacedFootprint(building, rootCell.data as CellData | undefined);

        // Clear all cells
        for (let i = 0; i < footprint.width; i++) {
            for (let j = 0; j < footprint.height; j++) {
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

    getMaintenanceHomeKey(x: number, y: number): string {
        return `parkMaintenance_${x}_${y}`;
    }

    buildMaintenanceWorkerBuilding(grid: Cell[], cell: Cell, width: number, rotated: boolean = false): { grid: Cell[]; workerSpawns: Array<{ x: number; y: number; homeKey: string }> } {
        const maintenanceBuilding = this.getBuildingById('parkMaintenance');
        if (!maintenanceBuilding) return { grid, workerSpawns: [] };

        const builtGrid = this.buildBuilding(grid, cell, maintenanceBuilding, width, rotated);
        const footprint = this.getPlacementFootprint(maintenanceBuilding, rotated);
        const homeKey = this.getMaintenanceHomeKey(cell.x, cell.y);

        const workerSpawns = [
            { x: cell.x, y: cell.y, homeKey },
            {
                x: Math.min(cell.x + footprint.width - 1, cell.x + 1),
                y: Math.min(cell.y + footprint.height - 1, cell.y + 1),
                homeKey
            }
        ];

        const rootIdx = this.gridService.getCellIndex(cell.x, cell.y, width);
        const rootCell = builtGrid[rootIdx];
        builtGrid[rootIdx] = {
            ...rootCell,
            data: {
                ...rootCell.data,
                workerHome: homeKey
            }
        };

        return { grid: builtGrid, workerSpawns };
    }
}
