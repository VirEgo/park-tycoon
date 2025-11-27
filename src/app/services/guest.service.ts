import { Injectable, inject } from '@angular/core';
import { Guest } from '../models/guest.model';
import { Cell } from '../models/cell.model';
import { GridService } from './grid.service';
import { BUILDINGS } from '../models/building.model';
import { CasinoService } from './casino.service';
import { GUEST_TYPES, GuestTypeId } from '../models/guest-type.model';
import { BuildingStatusService } from './building-status.service';
import { AttractionUpgradeService } from './attraction-upgrade.service';

@Injectable({
    providedIn: 'root'
})
export class GuestService {
    private gridService = inject(GridService);
    private casinoService = inject(CasinoService);
    private buildingStatusService = inject(BuildingStatusService);
    private upgradeService = inject(AttractionUpgradeService);

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
            g.statusMessage = this.getStatusMessage(g);
        });
    }

    private getStatusMessage(guest: Guest): string | null {
        if (guest.wantsToLeave) {
            return 'Покидает парк';
        }
        if (guest.toilet < 30) {
            return 'Поиск туалета';
        }
        if (guest.hydration < 30) {
            return 'Ищу напитки';
        }
        if (guest.satiety < 30) {
            return 'Ищу еду';
        }
        if (guest.fun < 30) {
            return 'Ищу развлечения';
        }
        if (guest.energy < 30) {
            return 'Ищу отдых';
        }
        return null;
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
                    const isBroken = this.buildingStatusService.isBroken(checkX, checkY);
                    const canVisit = bInfo ? bInfo.isAvailableForVisit !== false : true;

                    if (isBroken) {
                        g.visitingBuildingRoot = null;
                        g.wantsToLeave = true;
                    }

                    if (g.visitingBuildingRoot === buildingKey && !isBroken) {
                        // Already visiting this building, skip logic
                    } else {
                        const adjustedIncome = bInfo && bInfo.income > 0
                            ? this.upgradeService.calculateModifiedIncome(bInfo.id, checkX, checkY, bInfo.income)
                            : 0;
                        const enoughMoney = g.money >= (adjustedIncome || bInfo?.income || 0);

                        if (canVisit && !isBroken && bInfo && enoughMoney && bInfo.allowedOnPath !== false) {
                            g.visitingBuildingRoot = buildingKey;

                            // Record visit
                            this.buildingStatusService.recordVisit(checkX, checkY);

                            // Gambling Logic
                            if (bInfo.isGambling && currentCell.data && typeof currentCell.data.bank === "number") {
                                const bet = Math.max(0.1, adjustedIncome || bInfo.income || 0.25);

                                if (g.money >= bet) {
                                    g.money -= bet;

                                    const result = this.casinoService.processBet(
                                        currentCell.x,
                                        currentCell.y,
                                        g.id,
                                        bet
                                    );

                                    if (result.outcome === "win") {
                                        g.money += result.payout;
                                        onNotification(`Гость выиграл $${result.payout.toFixed(2)}!`);
                                    }

                                    currentCell.data.bank = result.bankAfter;
                                }
                            } else {
                                // Standard Logic
                                const cost = adjustedIncome || bInfo.income;
                                g.money -= cost;
                                onMoneyEarned(cost);
                            }

                            // Apply stats
                            const adjustedStat = this.upgradeService.calculateModifiedSatisfaction(
                                bInfo.id,
                                checkX,
                                checkY,
                                bInfo.statValue || 0
                            );

                            const stats: any = {};
                            if (bInfo.satisfies) {
                                stats[bInfo.satisfies] = adjustedStat || bInfo.statValue || 20;
                            }
                            if (bInfo.category === 'attraction') {
                                stats.fun = adjustedStat || bInfo.statValue || 30;
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

        let walkable = neighbors.filter(({ x, y }) => {
            const cell = this.gridService.getCell(grid, x, y, width, height);
            if (!cell) return false;

            let isWalkable = cell.type === 'path' || cell.type === 'entrance' || cell.type === 'exit';

            if (cell.type === 'building' && cell.buildingId) {
                const bInfo = BUILDINGS.find(b => b.id === cell.buildingId);

                // Check if building is broken (check root)
                const checkX = cell.isRoot ? cell.x : (cell.rootX ?? cell.x);
                const checkY = cell.isRoot ? cell.y : (cell.rootY ?? cell.y);
                const isBroken = this.buildingStatusService.isBroken(checkX, checkY);

                if (wantsToLeave) {
                    // When leaving, do not enter other buildings; allow only same building to exit
                    if (currentCell) {
                        const currentRootX = currentCell.isRoot ? currentCell.x : (currentCell.rootX ?? currentCell.x);
                        const currentRootY = currentCell.isRoot ? currentCell.y : (currentCell.rootY ?? currentCell.y);
                        if (currentRootX === checkX && currentRootY === checkY) {
                            isWalkable = true;
                        } else {
                            isWalkable = false;
                        }
                    } else {
                        isWalkable = false;
                    }
                } else if (bInfo) {
                    const canVisit = bInfo.isAvailableForVisit !== false;
                    const allowedOnPath = bInfo.allowedOnPath !== false;

                    if (canVisit && !isBroken && allowedOnPath) {
                        isWalkable = true;
                    }

                    // Allow movement within the same building instance (same root) even if broken
                    if (currentCell) {
                        const currentRootX = currentCell.isRoot ? currentCell.x : (currentCell.rootX ?? currentCell.x);
                        const currentRootY = currentCell.isRoot ? currentCell.y : (currentCell.rootY ?? currentCell.y);

                        if (currentRootX === checkX && currentRootY === checkY) {
                            isWalkable = true;
                        }
                    }
                }
            }

            return isWalkable;
        });

        // If guest wants to leave and is inside a building, prefer stepping onto a road/exit first
        if (wantsToLeave && currentCell?.type === 'building') {
            const nextStepToRoad = this.findNextStepToRoad(cx, cy, grid, width, height);
            if (nextStepToRoad) {
                return [nextStepToRoad];
            }

            const roadNeighbors = walkable.filter(({ x, y }) => {
                const cell = this.gridService.getCell(grid, x, y, width, height);
                return cell && (cell.type === 'path' || cell.type === 'entrance' || cell.type === 'exit');
            });
            if (roadNeighbors.length > 0) {
                walkable = roadNeighbors;
            }
        } else if (wantsToLeave) {
            const nextStepToExit = this.findNextStepToExit(cx, cy, grid, width, height, exits);
            if (nextStepToExit) {
                return [nextStepToExit];
            }
        }

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

    /**
     * BFS to find the next step from inside a building to the nearest road/entrance/exit.
     * Allows walking through the same building tiles even if broken; stops once a road tile is found.
     */
    private findNextStepToRoad(
        startX: number,
        startY: number,
        grid: Cell[],
        width: number,
        height: number
    ): { x: number, y: number } | null {
        const startCell = this.gridService.getCell(grid, startX, startY, width, height);
        if (!startCell || startCell.type !== 'building') return null;

        const rootX = startCell.isRoot ? startCell.x : (startCell.rootX ?? startCell.x);
        const rootY = startCell.isRoot ? startCell.y : (startCell.rootY ?? startCell.y);

        const queue: Array<{ x: number, y: number, prev?: { x: number, y: number } }> = [{ x: startX, y: startY }];
        const visited = new Set<string>([`${startX},${startY}`]);
        const parents = new Map<string, { x: number, y: number }>();

        const encode = (x: number, y: number) => `${x},${y}`;

        while (queue.length > 0) {
            const node = queue.shift()!;
            const neighbors = this.gridService.getNeighbors(node.x, node.y, width, height);

            for (const n of neighbors) {
                const key = encode(n.x, n.y);
                if (visited.has(key)) continue;

                const cell = this.gridService.getCell(grid, n.x, n.y, width, height);
                if (!cell) continue;

                const isRoad = cell.type === 'path' || cell.type === 'entrance' || cell.type === 'exit';
                const sameBuilding = cell.type === 'building' && (
                    (cell.isRoot ? cell.x : (cell.rootX ?? cell.x)) === rootX &&
                    (cell.isRoot ? cell.y : (cell.rootY ?? cell.y)) === rootY
                );

                if (!isRoad && !sameBuilding) continue;

                parents.set(key, { x: node.x, y: node.y });
                visited.add(key);

                if (isRoad) {
                    // Reconstruct first step
                    let back = { x: n.x, y: n.y };
                    let prev = parents.get(encode(back.x, back.y));
                    while (prev && !(prev.x === startX && prev.y === startY)) {
                        back = prev;
                        prev = parents.get(encode(back.x, back.y));
                    }
                    return back;
                }

                queue.push({ x: n.x, y: n.y });
            }
        }

        return null;
    }

    /**
     * BFS to the nearest exit/entrance using only roads/entrances/exits.
     */
    private findNextStepToExit(
        startX: number,
        startY: number,
        grid: Cell[],
        width: number,
        height: number,
        exits: Cell[]
    ): { x: number, y: number } | null {
        if (exits.length === 0) return null;

        const queue: Array<{ x: number, y: number }> = [{ x: startX, y: startY }];
        const visited = new Set<string>([`${startX},${startY}`]);
        const parents = new Map<string, { x: number, y: number }>();
        const encode = (x: number, y: number) => `${x},${y}`;

        const isWalkableRoad = (cell: Cell | null | undefined) =>
            !!cell && (cell.type === 'path' || cell.type === 'entrance' || cell.type === 'exit');

        while (queue.length > 0) {
            const node = queue.shift()!;
            const cell = this.gridService.getCell(grid, node.x, node.y, width, height);
            if (cell && (cell.type === 'exit' || cell.type === 'entrance')) {
                // reconstruct first step
                let back = { x: node.x, y: node.y };
                let prev = parents.get(encode(back.x, back.y));
                while (prev && !(prev.x === startX && prev.y === startY)) {
                    back = prev;
                    prev = parents.get(encode(back.x, back.y));
                }
                if (back.x === startX && back.y === startY) {
                    return null;
                }
                return back;
            }

            const neighbors = this.gridService.getNeighbors(node.x, node.y, width, height);
            for (const n of neighbors) {
                const key = encode(n.x, n.y);
                if (visited.has(key)) continue;
                const nCell = this.gridService.getCell(grid, n.x, n.y, width, height);
                if (!isWalkableRoad(nCell)) continue;
                visited.add(key);
                parents.set(key, { x: node.x, y: node.y });
                queue.push({ x: n.x, y: n.y });
            }
        }

        return null;
    }

    calculateAverageStats(guests: Guest[]): {
        happiness: number;
        satiety: number;
        hydration: number;
        energy: number;
        fun: number;
        toilet: number;
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
            toilet: avg('toilet'),
            money: avg('money')
        };
    }
}
