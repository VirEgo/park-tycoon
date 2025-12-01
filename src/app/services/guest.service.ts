import { Injectable, inject } from '@angular/core';
import { Guest } from '../models/guest.model';
import { Cell } from '../models/cell.model';
import { GridService } from './grid.service';
import { BUILDINGS } from '../models/building.model';
import { CasinoService } from './casino.service';
import { GUEST_TYPES, GuestTypeId } from '../models/guest-type.model';
import { BuildingStatusService } from './building-status.service';
import { AttractionUpgradeService } from './attraction-upgrade.service';
import { MaintenanceService } from './maintenance.service';

@Injectable({
    providedIn: 'root'
})
export class GuestService {
    private gridService = inject(GridService);
    private casinoService = inject(CasinoService);
    private buildingStatusService = inject(BuildingStatusService);
    private upgradeService = inject(AttractionUpgradeService);
    private maintenanceService = inject(MaintenanceService);

    private parseWorkerHome(homeKey: string | null | undefined): { x: number, y: number } | null {
        if (!homeKey) return null;
        const parts = homeKey.split('_');
        if (parts.length < 3) return null;
        const x = Number(parts[1]);
        const y = Number(parts[2]);
        if (Number.isNaN(x) || Number.isNaN(y)) return null;
        return { x, y };
    }

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
            if (g.isWorker) return;
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
        deltaTime: number, // секунды
        onMoneyEarned: (amount: number) => void,
        onNotification: (msg: string) => void
    ): { updatedGuests: Guest[], updatedGrid: Cell[] } {
        const exits = grid.filter(c => c.type === 'entrance' || c.type === 'exit');
        const updatedGrid = [...grid];

        const updatedGuests = guests.map(guest => {
            if (guest.isWorker) {
                const serviceTask = guest.workerTask
                    ? undefined
                    : this.maintenanceService.getTaskForWorker(guest.id);

                if (serviceTask) {
                    const path = this.findWorkerPath(
                        Math.round(guest.x),
                        Math.round(guest.y),
                        serviceTask.x,
                        serviceTask.y,
                        grid,
                        width,
                        height,
                        guest.workerHome
                    );

                    if (!path) {
                        this.maintenanceService.completeTask(guest.id, serviceTask.key);
                        guest.workerTask = undefined;
                        guest.state = 'idle';
                        return guest;
                    }

                    guest.workerTask = {
                        targetX: serviceTask.x,
                        targetY: serviceTask.y,
                        buildingKey: serviceTask.key,
                        path,
                        pathIndex: 0,
                        isReturnToBase: false
                    };

                    if (path.length === 0) {
                        this.buildingStatusService.repair(serviceTask.x, serviceTask.y);
                        this.maintenanceService.completeTask(guest.id, serviceTask.key);
                        guest.workerTask = undefined;
                        guest.state = 'idle';
                        return guest;
                    }
                }

                const task = guest.workerTask;

                if (!task) {
                    // No active task: send worker home if not there
                    const home = this.parseWorkerHome(guest.workerHome);
                    const atHome = home && Math.abs(guest.x - home.x) < 0.1 && Math.abs(guest.y - home.y) < 0.1;
                    if (home && !atHome) {
                        const pathHome = this.findWorkerPath(
                            Math.round(guest.x),
                            Math.round(guest.y),
                            home.x,
                            home.y,
                            grid,
                            width,
                            height,
                            guest.workerHome
                        );
                        if (pathHome) {
                            guest.workerTask = {
                                targetX: home.x,
                                targetY: home.y,
                                buildingKey: 'home',
                                path: pathHome,
                                pathIndex: 0,
                                isReturnToBase: true
                            };
                        } else {
                            guest.state = 'idle';
                            guest.targetX = guest.x;
                            guest.targetY = guest.y;
                            return guest;
                        }
                    } else {
                        guest.state = 'idle';
                        guest.targetX = guest.x;
                        guest.targetY = guest.y;
                        return guest;
                    }
                }

                const activeTask = guest.workerTask;
                if (!activeTask || !activeTask.path || activeTask.pathIndex === undefined) {
                    guest.state = 'idle';
                    guest.targetX = guest.x;
                    guest.targetY = guest.y;
                    return guest;
                }

                const nextStep = activeTask.path[activeTask.pathIndex];
                if (!nextStep) {
                    // Path finished; ensure repair or return
                    if (!activeTask.isReturnToBase) {
                        this.buildingStatusService.repair(activeTask.targetX, activeTask.targetY);
                        this.maintenanceService.completeTask(guest.id, activeTask.buildingKey);
                    }
                    guest.workerTask = undefined;
                    guest.state = 'idle';
                    return guest;
                }

                guest.targetX = nextStep.x;
                guest.targetY = nextStep.y;

                const baseSpeed = 1.0;
                const speed = baseSpeed * guest.speedModifier * deltaTime;
                const dx = nextStep.x - guest.x;
                const dy = nextStep.y - guest.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= speed) {
                    guest.x = nextStep.x;
                    guest.y = nextStep.y;
                } else if (dist > 0) {
                    guest.x += (dx / dist) * speed;
                    guest.y += (dy / dist) * speed;
                }

                const arrivedStep = Math.abs(guest.x - nextStep.x) < 0.1 && Math.abs(guest.y - nextStep.y) < 0.1;
                if (arrivedStep) {
                    activeTask.pathIndex = (activeTask.pathIndex ?? 0) + 1;
                    if (activeTask.pathIndex >= activeTask.path.length) {
                        if (!activeTask.isReturnToBase) {
                            this.buildingStatusService.repair(activeTask.targetX, activeTask.targetY);
                            this.maintenanceService.completeTask(guest.id, activeTask.buildingKey);
                        }
                        guest.workerTask = undefined;
                        guest.state = 'idle';
                        guest.x = activeTask.targetX;
                        guest.y = activeTask.targetY;
                        guest.targetX = activeTask.targetX;
                        guest.targetY = activeTask.targetY;
                        return guest;
                    }
                }

                guest.state = 'walking';
                return guest;
            }

            const g = guest;
            const wantsToLeave = g.wantsToLeave;

            // Если гость достиг цели
            if (Math.abs(g.x - g.targetX) < 0.1 && Math.abs(g.y - g.targetY) < 0.1) {
                g.x = g.targetX;
                g.y = g.targetY;

                const currentCellIdx = Math.round(g.y) * width + Math.round(g.x);
                const currentCell = updatedGrid[currentCellIdx];

                // Защита от отсутствия клетки (выход за границы или неинициализированная сетка)
                if (!currentCell) {
                    g.state = 'idle';
                    return g;
                }

                // Если гость на входе/выходе и хочет уйти
                if ((currentCell.type === 'entrance' || currentCell.type === 'exit') && wantsToLeave) {
                    g.state = 'leaving';
                    return g;
                }

                // Если гость в здании
                if (currentCell.type === 'building' && currentCell.buildingId) {
                    const bInfo = BUILDINGS.find(b => b.id === currentCell.buildingId);

                    // Проверка, сломано ли здание (по данным здания)
                    const checkX = currentCell.isRoot ? currentCell.x : (currentCell.rootX ?? currentCell.x);
                    const checkY = currentCell.isRoot ? currentCell.y : (currentCell.rootY ?? currentCell.y);
                    const buildingKey = `${checkX}_${checkY}`;
                    const isBroken = this.buildingStatusService.isBroken(checkX, checkY);
                    const canVisit = bInfo ? bInfo.isAvailableForVisit !== false : true;

                    // Если здание сломано, гость хочет уйти
                    if (isBroken) {
                        g.visitingBuildingRoot = null;
                        g.wantsToLeave = true;
                    }

                    // Если гость уже посещает это здание и оно не сломано - пропустить логику
                    if (g.visitingBuildingRoot === buildingKey && !isBroken) {
                        // Уже посещает
                    } else {
                        // Скорректированный доход
                        const adjustedIncome = bInfo && bInfo.income > 0
                            ? this.upgradeService.calculateModifiedIncome(bInfo.id, checkX, checkY, bInfo.income)
                            : 0;
                        // Достаточно ли денег
                        const enoughMoney = g.money >= (adjustedIncome || bInfo?.income || 0);

                        // Если можно посещать, здание не сломано, хватает денег и разрешено движение по дорожке
                        if (canVisit && !isBroken && bInfo && enoughMoney && bInfo.allowedOnPath !== false) {
                            g.visitingBuildingRoot = buildingKey;

                            // Записать посещение
                            const justBroke = this.buildingStatusService.recordVisit(checkX, checkY);
                            if (justBroke) {
                                this.maintenanceService.requestRepair(checkX, checkY);
                            }

                            // Логика казино
                            if (bInfo.isGambling && currentCell.data && typeof currentCell.data.bank === "number") {
                                const bet = Math.max(0.1, adjustedIncome || bInfo.income || 0.25);

                                // Если хватает денег на ставку
                                if (g.money >= bet) {
                                    g.money -= bet;

                                    const result = this.casinoService.processBet(
                                        currentCell.x,
                                        currentCell.y,
                                        g.id,
                                        bet
                                    );

                                    // Если выиграл
                                    if (result.outcome === "win") {
                                        g.money += result.payout;
                                        onNotification(`Гость выиграл $${result.payout.toFixed(2)}!`);
                                    }

                                    currentCell.data.bank = result.bankAfter;
                                }
                            } else {
                                // Стандартная логика
                                const cost = adjustedIncome || bInfo.income;
                                g.money -= cost;
                                onMoneyEarned(cost);
                            }

                            // Применить изменения характеристик перса
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

                // Получить соседние клетки, по которым можно пройти
                const neighbors = this.getWalkableNeighbors(Math.round(g.x), Math.round(g.y), wantsToLeave, grid, exits, width, height);

                if (neighbors.length > 0) {
                    // Случайный выбор, если не хочет уйти (если хочет - сортировка по расстоянию до выхода)
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
                // Скорость с учетом типа гостя
                const baseSpeed = 1.0; // 1 клетка в секунду
                const speed = baseSpeed * g.speedModifier * deltaTime;
                const dx = g.targetX - g.x;
                const dy = g.targetY - g.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Если расстояние меньше скорости - сразу перейти
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

                // Проверка, сломано ли здание (по корню)
                const checkX = cell.isRoot ? cell.x : (cell.rootX ?? cell.x);
                const checkY = cell.isRoot ? cell.y : (cell.rootY ?? cell.y);
                const isBroken = this.buildingStatusService.isBroken(checkX, checkY);

                if (wantsToLeave) {
                    // При уходе не заходить в другие здания; разрешить выход только через то же здание
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

                    // Разрешить перемещение внутри одного экземпляра здания (один корень), даже если оно сломано
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

        // Если гость хочет уйти и находится внутри здания, сначала пытается выйти на дорогу/выход
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
            // Если гость хочет уйти, ищет ближайший выход
            const nextStepToExit = this.findNextStepToExit(cx, cy, grid, width, height, exits);
            if (nextStepToExit) {
                return [nextStepToExit];
            }
        }

        // Если гость хочет уйти и есть выходы, сортировать соседние клетки по расстоянию до ближайшего выхода
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

    private findWorkerPath(
        startX: number,
        startY: number,
        targetX: number,
        targetY: number,
        grid: Cell[],
        width: number,
        height: number,
        workerHomeKey: string | null
    ): Array<{ x: number, y: number }> | null {
        const homeRoot = this.parseWorkerHome(workerHomeKey);
        const startCell = this.gridService.getCell(grid, startX, startY, width, height);
        const startRoot = startCell && startCell.type === 'building'
            ? {
                x: startCell.isRoot ? startCell.x : (startCell.rootX ?? startCell.x),
                y: startCell.isRoot ? startCell.y : (startCell.rootY ?? startCell.y)
            }
            : null;
        const encode = (x: number, y: number) => `${x}_${y}`;

        const isWalkable = (cell: Cell | null | undefined): boolean => {
            if (!cell) return false;
            const isRoad = cell.type === 'path' || cell.type === 'entrance' || cell.type === 'exit';
            if (isRoad) return true;

            if (cell.type === 'building' && cell.buildingId) {
                const rootX = cell.isRoot ? cell.x : (cell.rootX ?? cell.x);
                const rootY = cell.isRoot ? cell.y : (cell.rootY ?? cell.y);
                const isTarget = rootX === targetX && rootY === targetY;
                const isHome = homeRoot ? (rootX === homeRoot.x && rootY === homeRoot.y) : false;
                const isStartRoot = startRoot ? (rootX === startRoot.x && rootY === startRoot.y) : false;
                return isTarget || isHome || isStartRoot;
            }
            return false;
        };

        const queue: Array<{ x: number, y: number }> = [{ x: startX, y: startY }];
        const visited = new Set<string>([encode(startX, startY)]);
        const parents = new Map<string, { x: number, y: number }>();

        while (queue.length > 0) {
            const node = queue.shift()!;
            if (node.x === targetX && node.y === targetY) {
                const path: Array<{ x: number, y: number }> = [];
                let curKey = encode(node.x, node.y);
                let cur = node;
                while (parents.has(curKey)) {
                    path.push(cur);
                    const parent = parents.get(curKey)!;
                    cur = parent;
                    curKey = encode(cur.x, cur.y);
                }
                path.reverse();
                return path;
            }

            const neighbors = this.gridService.getNeighbors(node.x, node.y, width, height);
            for (const n of neighbors) {
                const key = encode(n.x, n.y);
                if (visited.has(key)) continue;
                const cell = this.gridService.getCell(grid, n.x, n.y, width, height);
                if (!isWalkable(cell)) continue;
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
