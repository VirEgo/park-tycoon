import { Injectable, inject } from '@angular/core';
import { Guest, GuestNeedKey } from '../models/guest.model';
import { Cell, CellData } from '../models/cell.model';
import { GridService } from './grid.service';
import { BUILDINGS, BuildingType } from '../models/building.model';
import { CasinoService } from './casino.service';
import { GUEST_TYPES, GuestTypeId } from '../models/guest-type.model';
import { BuildingStatusService } from './building-status.service';
import { AttractionUpgradeService } from './attraction-upgrade.service';
import { MaintenanceService } from './maintenance.service';
import { PremiumSkinsService } from './guest/primium-skins';
import { clampPizzaPrice, getUnlockedPizzaRecipes, readPizzaMenuData } from '../models/pizza-menu.model';

export interface GuestMovementOptions {
    visibleBounds?: { startX: number; startY: number; endX: number; endY: number };
    tick?: number;
    offscreenUpdateStride?: number;
}

export interface GuestMovementResult {
    updatedGuests: Guest[];
    updatedGrid: Cell[];
    leavingGuests: Guest[];
}

// Максимальное количество гостей в здании
const BUILDING_CAPACITY = 20;

@Injectable({
    providedIn: 'root'
})
export class GuestService {
    private gridService = inject(GridService);
    private casinoService = inject(CasinoService);
    private buildingStatusService = inject(BuildingStatusService);
    private upgradeService = inject(AttractionUpgradeService);
    private maintenanceService = inject(MaintenanceService);
    private premiumSkinsService = inject(PremiumSkinsService);

    private buildingCache: Map<string, BuildingType> = new Map();

    constructor() {
        BUILDINGS.forEach(b => this.buildingCache.set(b.id, b));
    }

    // Быстрый поиск здания по ID
    private getBuildingByIdFast(id: string): BuildingType | undefined {
        return this.buildingCache.get(id);
    }

    private parseWorkerHome(homeKey: string | null | undefined): { x: number, y: number } | null {
        if (!homeKey) return null;
        const parts = homeKey.split('_');
        if (parts.length < 3) return null;
        const x = Number(parts[1]);
        const y = Number(parts[2]);
        if (Number.isNaN(x) || Number.isNaN(y)) return null;
        return { x, y };
    }

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

    spawnGuest(guestId: number, entranceX: number, entranceY: number, attractionCount: number = 0): Guest {
        const guestType = this.determineGuestType(attractionCount);
        const typeData = GUEST_TYPES.find(t => t.id === guestType) || GUEST_TYPES[0];
        const enabledSkins = this.premiumSkinsService.getEnabledSkins();

        return new Guest(
            guestId,
            entranceX,
            entranceY,
            guestType,
            typeData.spendingPower,
            typeData.speedModifier,
            enabledSkins
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

        const urgentNeed = guest.getMostUrgentNeed();
        if (urgentNeed) {
            return this.getNeedStatusMessage(urgentNeed);
        }

        if (guest.happiness < 45) {
            return 'Хочу что-то получше';
        }

        return null;
    }

    private getNeedStatusMessage(need: GuestNeedKey): string {
        switch (need) {
            case 'toilet':
                return 'Срочно ищу туалет';
            case 'hydration':
                return 'Хочу пить';
            case 'satiety':
                return 'Хочу есть';
            case 'fun':
                return 'Ищу развлечения';
            case 'energy':
                return 'Нужен отдых';
            default:
                return 'Осматриваю парк';
        }
    }

    private getRootCellData(grid: Cell[], rootX: number, rootY: number, width: number, height: number): CellData | undefined {
        const rootCell = this.gridService.getCell(grid, rootX, rootY, width, height);
        return rootCell?.data as CellData | undefined;
    }

    private getAffordablePizzaOffers(
        guest: Guest,
        rootX: number,
        rootY: number,
        baseIncome: number,
        rootData: CellData | undefined
    ): Array<{ price: number; satiety: number }> {
        const level = this.upgradeService.getLevel('pizza', rootX, rootY);
        const unlockedRecipes = getUnlockedPizzaRecipes(level);
        if (!unlockedRecipes.length) {
            return [];
        }

        const menuData = readPizzaMenuData(rootData?.pizzaMenu);
        const adjustedIncome = baseIncome > 0
            ? this.upgradeService.calculateModifiedIncome('pizza', rootX, rootY, baseIncome)
            : 0;
        const priceMultiplier = baseIncome > 0 ? adjustedIncome / baseIncome : 1;

        return unlockedRecipes
            .map((recipe) => {
                const menuPrice = menuData.prices[recipe.id] ?? recipe.defaultPrice;
                return {
                    price: clampPizzaPrice(menuPrice * priceMultiplier),
                    satiety: recipe.satiety
                };
            })
            .filter((offer) => guest.money >= offer.price);
    }

    private getPizzaOfferForGuest(
        guest: Guest,
        rootX: number,
        rootY: number,
        baseIncome: number,
        rootData: CellData | undefined
    ): { price: number; satiety: number } | null {
        const affordableOffers = this.getAffordablePizzaOffers(guest, rootX, rootY, baseIncome, rootData);
        if (!affordableOffers.length) {
            return null;
        }

        return affordableOffers[Math.floor(Math.random() * affordableOffers.length)];
    }

    private getVisitCost(
        building: BuildingType,
        rootX: number,
        rootY: number,
        rootData: CellData | undefined,
        guest: Guest
    ): number {
        if (building.id === 'pizza') {
            const offers = this.getAffordablePizzaOffers(guest, rootX, rootY, building.income, rootData);
            if (!offers.length) {
                return Number.POSITIVE_INFINITY;
            }
            return Math.min(...offers.map((offer) => offer.price));
        }

        return building.income > 0
            ? this.upgradeService.calculateModifiedIncome(building.id, rootX, rootY, building.income)
            : 0;
    }

    /**
     * Check if a building is open for visitors
     */
    private isBuildingOpen(rootData: CellData | undefined): boolean {
        return rootData?.isOpen !== false;
    }

    /**
     * Get the list of guests currently visiting a specific building
     */
    private getGuestsInBuilding(guests: Guest[], rootX: number, rootY: number): Guest[] {
        const buildingKey = `${rootX}_${rootY}`;
        return guests.filter(g => g.visitingBuildingRoot === buildingKey);
    }

    /**
     * Get the maximum capacity for a building including upgrade bonuses
     */
    private getBuildingCapacity(buildingId: string, rootX: number, rootY: number): number {
        const capacityBonus = this.upgradeService.calculateCapacityMultiplierForLevel(buildingId, this.upgradeService.getLevel(buildingId, rootX, rootY));
        const totalCapacity = Math.floor(BUILDING_CAPACITY * (1 + capacityBonus));
        return totalCapacity;
    }

    /**
     * Check if a building is at full capacity
     */
    private isBuildingAtCapacity(guests: Guest[], buildingId: string, rootX: number, rootY: number): boolean {
        const guestCount = this.getGuestsInBuilding(guests, rootX, rootY).length;
        const capacity = this.getBuildingCapacity(buildingId, rootX, rootY);
        return guestCount >= capacity;
    }

    /**
     * Find alternative buildings of the same type that have capacity
     */
    private findAlternativeBuilding(
        guests: Guest[],
        neededType: GuestNeedKey | null,
        grid: Cell[],
        width: number,
        height: number,
        currentRootX: number,
        currentRootY: number,
        guest: Guest
    ): { x: number, y: number } | null {
        const encode = (x: number, y: number) => `${x}_${y}`;
        const queue: Array<{ x: number, y: number }> = [{ x: Math.round(guest.x), y: Math.round(guest.y) }];
        const visited = new Set<string>([encode(Math.round(guest.x), Math.round(guest.y))]);
        const parents = new Map<string, { x: number, y: number }>();

        // Get the root cell to determine building ID and category
        const currentRootCell = this.gridService.getCell(grid, currentRootX, currentRootY, width, height);
        if (!currentRootCell || currentRootCell.type !== 'building' || !currentRootCell.buildingId) {
            return null;
        }

        const targetBuildingId = currentRootCell.buildingId;
        const targetBuilding = this.getBuildingByIdFast(targetBuildingId);
        if (!targetBuilding) return null;

        const canWalkTo = (cell: Cell | null | undefined): boolean => {
            if (!cell) return false;
            if (cell.type === 'path' || cell.type === 'entrance' || cell.type === 'exit') return true;
            if (cell.type !== 'building' || !cell.buildingId) return false;

            const bInfo = this.getBuildingByIdFast(cell.buildingId);
            if (!bInfo) return false;

            const rootX = cell.isRoot ? cell.x : (cell.rootX ?? cell.x);
            const rootY = cell.isRoot ? cell.y : (cell.rootY ?? cell.y);
            const isBroken = this.buildingStatusService.isBroken(rootX, rootY);
            const rootData = this.getRootCellData(grid, rootX, rootY, width, height);
            const canVisit = bInfo.isAvailableForVisit !== false && this.isBuildingOpen(rootData);
            const allowedOnPath = bInfo.allowedOnPath !== false;

            return canVisit && allowedOnPath && !isBroken;
        };

        const isValidAlternative = (cell: Cell | null | undefined, rootX: number, rootY: number): boolean => {
            if (!cell || cell.type !== 'building' || !cell.buildingId) return false;

            const bInfo = this.getBuildingByIdFast(cell.buildingId);
            if (!bInfo || bInfo.id !== targetBuildingId) return false;

            const isBroken = this.buildingStatusService.isBroken(rootX, rootY);
            if (isBroken) return false;

            // Skip if it's the same building
            if (rootX === currentRootX && rootY === currentRootY) return false;

            // Check capacity
            if (this.isBuildingAtCapacity(guests, targetBuildingId, rootX, rootY)) return false;

            // Check if guest can afford it
            const rootData = this.getRootCellData(grid, rootX, rootY, width, height);
            const visitCost = this.getVisitCost(bInfo, rootX, rootY, rootData, guest);
            return Number.isFinite(visitCost) && guest.money >= visitCost;
        };

        while (queue.length > 0) {
            const node = queue.shift()!;
            const currentCell = this.gridService.getCell(grid, node.x, node.y, width, height);

            // Check if current cell is a valid alternative
            if ((node.x !== Math.round(guest.x) || node.y !== Math.round(guest.y)) &&
                currentCell && currentCell.type === 'building' &&
                currentCell.buildingId === targetBuildingId && currentCell.isRoot) {
                const altRootX = currentCell.x;
                const altRootY = currentCell.y;
                if (isValidAlternative(currentCell, altRootX, altRootY)) {
                    // Reconstruct first step
                    let backtrack = { x: node.x, y: node.y };
                    let parent = parents.get(encode(backtrack.x, backtrack.y));

                    while (parent && !(parent.x === Math.round(guest.x) && parent.y === Math.round(guest.y))) {
                        backtrack = parent;
                        parent = parents.get(encode(backtrack.x, backtrack.y));
                    }

                    return backtrack;
                }
            }

            const neighbors = this.gridService.getNeighbors(node.x, node.y, width, height);
            for (const neighbor of neighbors) {
                const key = encode(neighbor.x, neighbor.y);
                if (visited.has(key)) continue;

                const neighborCell = this.gridService.getCell(grid, neighbor.x, neighbor.y, width, height);
                if (!canWalkTo(neighborCell)) continue;

                visited.add(key);
                parents.set(key, { x: node.x, y: node.y });
                queue.push(neighbor);
            }
        }

        return null;
    }

    private shouldPrioritizeNeed(guest: Guest): GuestNeedKey | null {
        const urgentNeed = guest.getMostUrgentNeed();
        if (!urgentNeed) {
            return null;
        }

        const needsPriority: Record<GuestNeedKey, number> = {
            toilet: guest.toilet,
            hydration: guest.hydration,
            satiety: guest.satiety,
            energy: guest.energy,
            fun: guest.fun
        };

        return needsPriority[urgentNeed] < 40 ? urgentNeed : null;
    }

    private findNextStepToNeedTarget(
        startX: number,
        startY: number,
        need: GuestNeedKey,
        guest: Guest,
        guests: Guest[],
        grid: Cell[],
        width: number,
        height: number
    ): { x: number, y: number } | null {
        const encode = (x: number, y: number) => `${x}_${y}`;
        const queue: Array<{ x: number, y: number }> = [{ x: startX, y: startY }];
        const visited = new Set<string>([encode(startX, startY)]);
        const parents = new Map<string, { x: number, y: number }>();

        const canWalkTo = (cell: Cell | null | undefined): boolean => {
            if (!cell) {
                return false;
            }

            if (cell.type === 'path' || cell.type === 'entrance' || cell.type === 'exit') {
                return true;
            }

            if (cell.type !== 'building' || !cell.buildingId) {
                return false;
            }

            const building = this.getBuildingByIdFast(cell.buildingId);
            if (!building) {
                return false;
            }

            const rootX = cell.isRoot ? cell.x : (cell.rootX ?? cell.x);
            const rootY = cell.isRoot ? cell.y : (cell.rootY ?? cell.y);
            const isBroken = this.buildingStatusService.isBroken(rootX, rootY);
            const rootData = this.getRootCellData(grid, rootX, rootY, width, height);
            const canVisit = building.isAvailableForVisit !== false && this.isBuildingOpen(rootData);
            const allowedOnPath = building.allowedOnPath !== false;

            return canVisit && allowedOnPath && !isBroken;
        };

        const isMatchingTarget = (cell: Cell | null | undefined): boolean => {
            if (!cell || cell.type !== 'building' || !cell.buildingId) {
                return false;
            }

            const building = this.getBuildingByIdFast(cell.buildingId);
            if (!building) {
                return false;
            }

            const rootX = cell.isRoot ? cell.x : (cell.rootX ?? cell.x);
            const rootY = cell.isRoot ? cell.y : (cell.rootY ?? cell.y);
            const isBroken = this.buildingStatusService.isBroken(rootX, rootY);
            const rootData = this.getRootCellData(grid, rootX, rootY, width, height);
            const canVisit = building.isAvailableForVisit !== false && this.isBuildingOpen(rootData);
            const allowedOnPath = building.allowedOnPath !== false;

            if (!canVisit || !allowedOnPath || isBroken) {
                return false;
            }

            if (building.satisfies !== need) {
                return false;
            }

            // Check building capacity
            if (this.isBuildingAtCapacity(guests, building.id, rootX, rootY)) {
                return false;
            }
            const visitCost = this.getVisitCost(building, rootX, rootY, rootData, guest);

            if (!Number.isFinite(visitCost) || guest.money < visitCost) {
                return false;
            }

            if (need === 'fun' && building.isGambling && guest.money < Math.max(1, visitCost * 3)) {
                return false;
            }

            return true;
        };

        while (queue.length > 0) {
            const node = queue.shift()!;
            const currentCell = this.gridService.getCell(grid, node.x, node.y, width, height);

            if ((node.x !== startX || node.y !== startY) && isMatchingTarget(currentCell)) {
                let backtrack = { x: node.x, y: node.y };
                let parent = parents.get(encode(backtrack.x, backtrack.y));

                while (parent && !(parent.x === startX && parent.y === startY)) {
                    backtrack = parent;
                    parent = parents.get(encode(backtrack.x, backtrack.y));
                }

                return backtrack;
            }

            const neighbors = this.gridService.getNeighbors(node.x, node.y, width, height);
            for (const neighbor of neighbors) {
                const key = encode(neighbor.x, neighbor.y);
                if (visited.has(key)) {
                    continue;
                }

                const neighborCell = this.gridService.getCell(grid, neighbor.x, neighbor.y, width, height);
                if (!canWalkTo(neighborCell)) {
                    continue;
                }

                visited.add(key);
                parents.set(key, { x: node.x, y: node.y });
                queue.push(neighbor);
            }
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
        onNotification: (msg: string) => void,
        onRepairCostSpent?: (amount: number) => void,
        options?: GuestMovementOptions
    ): GuestMovementResult {
        const hasDedicatedExits = grid.some(c => c.type === 'exit');
        const leaveTargets = hasDedicatedExits
            ? grid.filter(c => c.type === 'exit')
            : grid.filter(c => c.type === 'entrance');
        const updatedGrid = grid;
        const leavingGuests: Guest[] = [];
        const visibleBounds = options?.visibleBounds;
        const simulationTick = options?.tick ?? 0;
        const offscreenStride = Math.max(1, options?.offscreenUpdateStride ?? 1);

        // Метод для расчета стоимости ремонта
        const processRepair = (x: number, y: number) => {
            this.buildingStatusService.repair(x, y);
            if (onRepairCostSpent) {
                const cell = grid.find(c => c.x === x && c.y === y);
                if (cell?.buildingId) {
                    const building = this.getBuildingByIdFast(cell.buildingId);
                    if (building) {
                        const level = this.upgradeService.getLevel(building.id, x, y);
                        const repairCost = this.buildingStatusService.getRepairCost(building.price, level);
                        onRepairCostSpent(repairCost);
                    }
                }
            }
        };

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
                        processRepair(serviceTask.x, serviceTask.y);
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
                        processRepair(activeTask.targetX, activeTask.targetY);
                        this.maintenanceService.completeTask(guest.id, activeTask.buildingKey);
                    }
                    guest.workerTask = undefined;
                    guest.state = 'idle';
                    return guest;
                }

                guest.targetX = nextStep.x;
                guest.targetY = nextStep.y;

                const home = this.parseWorkerHome(guest.workerHome);
                const workerBaseSpeed = home
                    ? this.upgradeService.calculateModifiedSpeed('parkMaintenance', home.x, home.y, 1.0)
                    : 1.0;
                const speed = workerBaseSpeed * guest.speedModifier * deltaTime;
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
                            processRepair(activeTask.targetX, activeTask.targetY);
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
            if (visibleBounds && offscreenStride > 1) {
                const pad = 1.5;
                const isOutsideVisible =
                    g.x < visibleBounds.startX - pad ||
                    g.x > visibleBounds.endX + pad ||
                    g.y < visibleBounds.startY - pad ||
                    g.y > visibleBounds.endY + pad;
                if (isOutsideVisible && (simulationTick % offscreenStride) !== (g.id % offscreenStride)) {
                    return g;
                }
            }

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
                const canLeaveFromCurrentCell = currentCell.type === 'exit'
                    || (!hasDedicatedExits && currentCell.type === 'entrance');
                if (canLeaveFromCurrentCell && wantsToLeave) {
                    g.state = 'leaving';
                    return g;
                }

                // Если гость в здании
                if (currentCell.type === 'building' && currentCell.buildingId) {
                    const bInfo = this.getBuildingByIdFast(currentCell.buildingId);


                    // Проверка, сломано ли здание (по данным здания)
                    const checkX = currentCell.isRoot ? currentCell.x : (currentCell.rootX ?? currentCell.x);
                    const checkY = currentCell.isRoot ? currentCell.y : (currentCell.rootY ?? currentCell.y);
                    const buildingKey = `${checkX}_${checkY}`;
                    const isBroken = this.buildingStatusService.isBroken(checkX, checkY);
                    const buildingOpenData = this.getRootCellData(updatedGrid, checkX, checkY, width, height);
                    const canVisit = bInfo ? (bInfo.isAvailableForVisit !== false && this.isBuildingOpen(buildingOpenData)) : true;

                    // Вычислить срочную потребность для использования при поиске альтернатив
                    const guestUrgentNeed = wantsToLeave ? null : this.shouldPrioritizeNeed(g);

                    // Если здание сломано, гость хочет уйти
                    if (isBroken) {
                        g.visitingBuildingRoot = null;
                        g.wantsToLeave = true;
                    }

                    // Если гость уже посещает это здание и оно не сломано - пропустить логику
                    if (g.visitingBuildingRoot === buildingKey && !isBroken) {
                        // Уже посещает
                    } else {
                        const rootData = this.getRootCellData(updatedGrid, checkX, checkY, width, height);
                        const pizzaOffer = bInfo?.id === 'pizza'
                            ? this.getPizzaOfferForGuest(g, checkX, checkY, bInfo.income, rootData)
                            : null;
                        const visitCost = bInfo
                            ? (pizzaOffer?.price ?? this.getVisitCost(bInfo, checkX, checkY, rootData, g))
                            : Number.POSITIVE_INFINITY;
                        const enoughMoney = g.money >= visitCost;

                        // Проверка вместимости здания
                        const isBuildingFull = bInfo && this.isBuildingAtCapacity(guests, bInfo.id, checkX, checkY);

                        // Если здание переполнено – ищем альтернативу
                        if (isBuildingFull && bInfo) {
                            const alternativeStep = this.findAlternativeBuilding(
                                guests,
                                guestUrgentNeed,
                                grid,
                                width,
                                height,
                                checkX,
                                checkY,
                                g
                            );
                            if (alternativeStep) {
                                g.targetX = alternativeStep.x;
                                g.targetY = alternativeStep.y;
                                g.state = 'walking';
                            } else {
                                // Нет альтернативных зданий – стать бездельником
                                g.visitingBuildingRoot = null;
                                g.state = 'idle';
                            }
                        } else if (canVisit && !isBroken && bInfo && enoughMoney && Number.isFinite(visitCost) && bInfo.allowedOnPath !== false && this.isBuildingOpen(rootData)) {
                            // Если можно посещать, здание не закрыто, здание не сломано, хватает денег и разрешено движение по дорожке
                            g.visitingBuildingRoot = buildingKey;

                            // Записать посещение
                            const justBroke = this.buildingStatusService.recordVisit(checkX, checkY);
                            if (justBroke) {
                                this.maintenanceService.requestRepair(checkX, checkY);
                            }

                            // Логика казино
                            if (bInfo.isGambling && rootData && typeof rootData.bank === "number") {
                                const bet = Math.max(0.1, visitCost);

                                // Если хватает денег на ставку
                                if (g.money >= bet) {
                                    g.money -= bet;

                                    const result = this.casinoService.processBet(
                                        checkX,
                                        checkY,
                                        g.id,
                                        bet,
                                        g.money
                                    );

                                    if (result.outcome === 'win') {
                                        g.money += result.payout;
                                        onNotification(`Гость выиграл $${result.payout.toFixed(2)}!`);
                                    } else if (result.outcome === 'jackpot') {
                                        g.money += result.payout;
                                        onNotification(`Гость сорвал джек-пот: $${result.payout.toFixed(2)}!`);
                                    } else if (result.outcome === 'bankrupt') {
                                        g.money = Math.max(0, g.money - result.extraLoss);
                                        onNotification(`Гость проиграл все деньги в казино.`);
                                    }

                                    rootData.bank = result.bankAfter;
                                }
                            } else {
                                // Стандартная логика
                                const cost = visitCost;
                                g.money -= cost;
                                onMoneyEarned(cost);
                            }

                            const baseSatisfaction = pizzaOffer?.satiety ?? bInfo.statValue ?? 0;

                            // Применить изменения характеристик перса
                            const adjustedStat = this.upgradeService.calculateModifiedSatisfaction(
                                bInfo.id,
                                checkX,
                                checkY,
                                baseSatisfaction
                            );

                            const stats: any = {};
                            if (bInfo.satisfies) {
                                stats[bInfo.satisfies] = adjustedStat || bInfo.statValue || 20;
                            }
                            if (bInfo.category === 'attraction') {
                                stats.fun = adjustedStat || bInfo.statValue || 30;
                            }
                            g.visitAttraction(stats, {
                                category: bInfo.category,
                                satisfies: bInfo.satisfies,
                                isGambling: !!bInfo.isGambling
                            });
                        } else {
                            g.visitingBuildingRoot = null;
                        }
                    }
                } else {
                    g.visitingBuildingRoot = null;
                }

                // Получить соседние клетки, по которым можно пройти
                const urgentNeed = wantsToLeave ? null : this.shouldPrioritizeNeed(g);
                const nextNeedStep = urgentNeed
                    ? this.findNextStepToNeedTarget(Math.round(g.x), Math.round(g.y), urgentNeed, g, guests, grid, width, height)
                    : null;

                if (nextNeedStep) {
                    g.targetX = nextNeedStep.x;
                    g.targetY = nextNeedStep.y;
                    g.state = 'walking';
                } else {
                    const neighbors = this.getWalkableNeighbors(Math.round(g.x), Math.round(g.y), wantsToLeave, grid, leaveTargets, width, height);

                    if (neighbors.length > 0) {
                        const chosenNeighbor = wantsToLeave
                            ? neighbors[0]
                            : neighbors[Math.floor(Math.random() * neighbors.length)];
                        g.targetX = chosenNeighbor.x;
                        g.targetY = chosenNeighbor.y;
                        g.state = 'walking';
                    } else {
                        g.state = 'idle';
                    }
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
        }).filter((g): g is Guest => {
            if (g === null) {
                return false;
            }

            if (g.state === 'leaving') {
                if (!g.isWorker) {
                    leavingGuests.push(g);
                }
                return false;
            }

            return true;
        });

        return { updatedGuests, updatedGrid, leavingGuests };
    }

    private getWalkableNeighbors(
        cx: number,
        cy: number,
        wantsToLeave: boolean,
        grid: Cell[],
        leaveTargets: Cell[],
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
                const bInfo = this.getBuildingByIdFast(cell.buildingId);

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
                    const rootData = this.getRootCellData(grid, checkX, checkY, width, height);
                    const canVisit = bInfo.isAvailableForVisit !== false && this.isBuildingOpen(rootData);
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
            const nextStepToExit = this.findNextStepToExit(cx, cy, grid, width, height, leaveTargets);
            if (nextStepToExit) {
                return [nextStepToExit];
            }
        }

        // Если гость хочет уйти и есть цели ухода, сортировать соседние клетки по расстоянию до ближайшей цели
        if (wantsToLeave && leaveTargets.length > 0) {
            const guestPos = { x: cx, y: cy };
            let nearestExit = leaveTargets[0];
            let minExitDist = Infinity;

            for (const exit of leaveTargets) {
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
     * BFS to the nearest leave target using only roads/entrances/exits.
     */
    private findNextStepToExit(
        startX: number,
        startY: number,
        grid: Cell[],
        width: number,
        height: number,
        leaveTargets: Cell[]
    ): { x: number, y: number } | null {
        if (leaveTargets.length === 0) return null;

        const queue: Array<{ x: number, y: number }> = [{ x: startX, y: startY }];
        const visited = new Set<string>([`${startX},${startY}`]);
        const parents = new Map<string, { x: number, y: number }>();
        const encode = (x: number, y: number) => `${x},${y}`;
        const leaveTargetSet = new Set(leaveTargets.map(target => encode(target.x, target.y)));

        const isWalkableRoad = (cell: Cell | null | undefined) =>
            !!cell && (cell.type === 'path' || cell.type === 'entrance' || cell.type === 'exit');

        while (queue.length > 0) {
            const node = queue.shift()!;
            if (leaveTargetSet.has(encode(node.x, node.y))) {
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
