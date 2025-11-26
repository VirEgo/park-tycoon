import { Injectable, inject } from '@angular/core';
import { Guest } from '../models/guest.model';
import { Cell } from '../models/cell.model';
import { GridService } from './grid.service';
import { BUILDINGS } from '../models/building.model';
import { CasinoService } from './casino.service';
import { GUEST_TYPES, GuestTypeId } from '../models/guest-type.model';
import { BuildingStatusService } from './building-status.service';

@Injectable({
    providedIn: 'root'
})
export class GuestService {
    private gridService = inject(GridService);
    private casinoService = inject(CasinoService);
    private buildingStatusService = inject(BuildingStatusService);

    /**
     * Определить тип гостя на основе прогресса игры
     */
    determineGuestType(attractionCount: number, parkRating: number = 3.0): GuestTypeId {
        const availableTypes = GUEST_TYPES.filter(type => {
            if (type.unlockRequirement) {
                if (type.unlockRequirement.attractionCount && attractionCount < type.unlockRequirement.attractionCount) {
                    return false;
                }
                if (type.unlockRequirement.rating && parkRating < type.unlockRequirement.rating) {
                    return false;
                }
            }
            return true;
        });

        // Вероятности появления разных типов
        const weights: Record<GuestTypeId, number> = {
            casual: 50,
            family: 20,
            teen: 15,
            elder: 10,
            vip: 5
        };

        const totalWeight = availableTypes.reduce((sum, type) => sum + (weights[type.id] || 0), 0);
        let random = Math.random() * totalWeight;

        for (const type of availableTypes) {
            random -= weights[type.id] || 0;
            if (random <= 0) {
                return type.id;
            }
        }

        return 'casual';
    }

    /**
     * Создать гостя с определенным типом
     */
    spawnGuest(guestId: number, entranceX: number, entranceY: number, attractionCount: number = 0): Guest {
        const guestType = this.determineGuestType(attractionCount);
        const typeData = GUEST_TYPES.find(t => t.id === guestType) || GUEST_TYPES[0];

        return new Guest(
            guestId,
            entranceX,
            entranceY,
            guestType,
            typeData.spendingPower,
            typeData.speedModifier
        );
    }

    updateGuestNeeds(guests: Guest[]) {
        guests.forEach(g => {
            g.updateNeeds();
            g.incrementTime();
            g.checkMood();
        });
    }

    processGuestMovement(
        guests: Guest[],
        grid: Cell[],
        width: number,
        height: number,
        deltaTime: number, // in seconds
        onMoneyEarned: (amount: number) => void,
        onNotification: (msg: string) => void
    ): { updatedGuests: Guest[], updatedGrid: Cell[] } {
        const exits = grid.filter(c => c.type === 'entrance' || c.type === 'exit');
        const updatedGrid = [...grid];

        const updatedGuests = guests.map(guest => {
            const g = guest;
            const wantsToLeave = g.wantsToLeave;

            if (Math.abs(g.x - g.targetX) < 0.1 && Math.abs(g.y - g.targetY) < 0.1) {
                g.x = g.targetX;
                g.y = g.targetY;

                const currentCellIdx = Math.round(g.y) * width + Math.round(g.x);
                const currentCell = updatedGrid[currentCellIdx];

                // Guard against missing cell (out of bounds or uninitialized grid)
                if (!currentCell) {
                    g.state = 'idle';
                    return g;
                }

                if ((currentCell.type === 'entrance' || currentCell.type === 'exit') && wantsToLeave) {
                    g.state = 'leaving';
                    return g;
                }

                if (currentCell.type === 'building' && currentCell.buildingId) {
                    const bInfo = BUILDINGS.find(b => b.id === currentCell.buildingId);

                    // Check if building is broken (check root)
                    const checkX = currentCell.isRoot ? currentCell.x : (currentCell.rootX ?? currentCell.x);
                    const checkY = currentCell.isRoot ? currentCell.y : (currentCell.rootY ?? currentCell.y);
                    const buildingKey = `${checkX}_${checkY}`;

                    if (g.visitingBuildingRoot === buildingKey) {
                        // Already visiting this building, skip logic
                    } else {
                        const isBroken = this.buildingStatusService.isBroken(checkX, checkY);
                        const canVisit = bInfo ? bInfo.isAvailableForVisit !== false : true;

                        if (canVisit && !isBroken && bInfo && g.money >= bInfo.income && bInfo.allowedOnPath !== false) {
                            g.visitingBuildingRoot = buildingKey;

                            // Record visit
                            this.buildingStatusService.recordVisit(checkX, checkY);

                            // Gambling Logic
                            if (bInfo.isGambling && currentCell.data && typeof currentCell.data.bank === 'number') {
                                const bet = 0.25;

                                if (g.money >= bet) {
                                    g.money -= bet;

                                    const won = Math.random() < 0.15;
                                    const winAmount = this.casinoService.processBet(
                                        currentCell.x,
                                        currentCell.y,
                                        g.id,
                                        bet,
                                        won
                                    );

                                    if (won) {
                                        g.money += winAmount;
                                        currentCell.data.bank = 20;
                                        onNotification(`🎰 Джекпот! Гость выиграл $${winAmount.toFixed(2)}!`);
                                    } else {
                                        currentCell.data.bank += bet;
                                    }
                                }
                            } else {
                                // Standard Logic
                                g.money -= bInfo.income;
                                onMoneyEarned(bInfo.income);
                            }

                            // Apply stats
                            const stats: any = {};
                            if (bInfo.satisfies) {
                                stats[bInfo.satisfies] = bInfo.statValue || 20;
                            }
                            if (bInfo.category === 'attraction') {
                                stats.fun = bInfo.statValue || 30;
                            }
                            g.visitAttraction(stats);
                        } else {
                            g.visitingBuildingRoot = null;
                        }
                    }
                } else {
                    g.visitingBuildingRoot = null;
                }

                const neighbors = this.getWalkableNeighbors(Math.round(g.x), Math.round(g.y), wantsToLeave, grid, exits, width, height);

                if (neighbors.length > 0) {
                    // Random choice unless wants to leave (then sorted by distance to exit)
                    const chosenNeighbor = wantsToLeave
                        ? neighbors[0]
                        : neighbors[Math.floor(Math.random() * neighbors.length)];
                    g.targetX = chosenNeighbor.x;
                    g.targetY = chosenNeighbor.y;
                    g.state = 'walking';
                } else {
                    g.state = 'idle';
                }

            } else {
                // Speed modified by guest type
                const baseSpeed = 1.0; // 1 tile per second
                const speed = baseSpeed * g.speedModifier * deltaTime;
                const dx = g.targetX - g.x;
                const dy = g.targetY - g.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= speed) {
                    g.x = g.targetX;
                    g.y = g.targetY;
                } else {
                    g.x += (dx / dist) * speed;
                    g.y += (dy / dist) * speed;
                }
            }

            return g;
        }).filter((g): g is Guest => g !== null && g.state !== 'leaving');

        return { updatedGuests, updatedGrid };
    }

    private getWalkableNeighbors(
        cx: number,
        cy: number,
        wantsToLeave: boolean,
        grid: Cell[],
        exits: Cell[],
        width: number,
        height: number
    ): Array<{ x: number, y: number }> {
        const neighbors = this.gridService.getNeighbors(cx, cy, width, height);
        const currentCell = this.gridService.getCell(grid, cx, cy, width, height);

        const walkable = neighbors.filter(({ x, y }) => {
            const cell = this.gridService.getCell(grid, x, y, width, height);
            if (!cell) return false;

            let isWalkable = cell.type === 'path' || cell.type === 'entrance' || cell.type === 'exit';

            if (cell.type === 'building' && cell.buildingId) {
                const bInfo = BUILDINGS.find(b => b.id === cell.buildingId);

                // Check if building is broken (check root)
                const checkX = cell.isRoot ? cell.x : (cell.rootX ?? cell.x);
                const checkY = cell.isRoot ? cell.y : (cell.rootY ?? cell.y);
                const isBroken = this.buildingStatusService.isBroken(checkX, checkY);

                if (bInfo) {
                    const canVisit = bInfo.isAvailableForVisit !== false;
                    const allowedOnPath = bInfo.allowedOnPath !== false;

                    if (canVisit && !isBroken && allowedOnPath) {
                        isWalkable = true;
                    }

                    // Allow movement within the same building even if broken
                    if (currentCell && currentCell.buildingId === cell.buildingId) {
                        isWalkable = true;
                    }
                }
            }

            return isWalkable;
        });

        if (wantsToLeave && exits.length > 0) {
            const guestPos = { x: cx, y: cy };
            let nearestExit = exits[0];
            let minExitDist = Infinity;

            for (const exit of exits) {
                const d = Math.hypot(exit.x - guestPos.x, exit.y - guestPos.y);
                if (d < minExitDist) {
                    minExitDist = d;
                    nearestExit = exit;
                }
            }

            walkable.sort((a, b) => {
                const distA = Math.hypot(a.x - nearestExit.x, a.y - nearestExit.y);
                const distB = Math.hypot(b.x - nearestExit.x, b.y - nearestExit.y);
                return distA - distB;
            });
        }

        return walkable;
    }

    calculateAverageStats(guests: Guest[]): {
        happiness: number;
        satiety: number;
        hydration: number;
        energy: number;
        fun: number;
        money: number;
    } | null {
        if (guests.length === 0) return null;

        const avg = (prop: keyof Guest) =>
            guests.reduce((acc, g) => acc + (typeof g[prop] === 'number' ? g[prop] as number : 0), 0) / guests.length;

        return {
            happiness: avg('happiness'),
            satiety: avg('satiety'),
            hydration: avg('hydration'),
            energy: avg('energy'),
            fun: avg('fun'),
            money: avg('money')
        };
    }
}
