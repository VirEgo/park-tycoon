import { Injectable, inject } from '@angular/core';
import { Cell } from '../models/cell.model';
import { BuildingType, BUILDINGS } from '../models/building.model';
import { GridService } from './grid.service';
import { CasinoService } from './casino.service';

@Injectable({
    providedIn: 'root'
})
export class BuildingService {
    private gridService = inject(GridService);
    private casinoService = inject(CasinoService);

    getBuildingsByCategory(category: string): BuildingType[] {
        return BUILDINGS.filter(b => b.category === category);
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

    buildBuilding(grid: Cell[], cell: Cell, building: BuildingType, width: number): Cell[] {
        const newGrid = [...grid];
        const idx = this.gridService.getCellIndex(cell.x, cell.y, width);

        let newType: Cell['type'] = 'building';
        if (building.category === 'path') {
            if (building.id === 'exit') {
                newType = 'exit';
            } else {
                newType = 'path';
            }
        }

        newGrid[idx] = {
            ...cell,
            type: newType,
            buildingId: building.id,
            data: building.isGambling ? { bank: 20 } : undefined
        };

        // Initialize casino in service
        if (building.isGambling) {
            this.casinoService.initCasino(cell.x, cell.y, 20);
        }

        return newGrid;
    }

    demolishBuilding(grid: Cell[], cell: Cell, width: number): Cell[] {
        // Remove casino from service if it's a gambling building
        if (cell.buildingId) {
            const bInfo = this.getBuildingById(cell.buildingId);
            if (bInfo && bInfo.isGambling) {
                this.casinoService.removeCasino(cell.x, cell.y);
            }
        }

        const newGrid = [...grid];
        const idx = this.gridService.getCellIndex(cell.x, cell.y, width);
        newGrid[idx] = { ...cell, type: 'grass', buildingId: undefined, data: undefined };
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
                    cell.data.bank = 20;
                }
            }
        });

        return { totalPayout, updatedGrid };
    }
}
