import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output, Signal } from '@angular/core';
import { Cell } from '../../models/cell.model';
import { BuildingService } from '../../services/building.service';

export interface BuildingInstance {
    x: number;
    y: number;
    isOpen: boolean;
    isBroken: boolean;
}

export interface BuildingStatusInfo {
    id: string;
    name: string;
    count: number;
    category: string;
    totalIncome: number;
    brokenCount: number;
    workingCount: number;
    openCount: number;
    closedCount: number;
    instances: BuildingInstance[];
}

@Component({
    selector: 'app-park-settings-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './park-settings-modal.component.html',
    styleUrl: './park-settings-modal.component.scss'
})
export class ParkSettingsModalComponent {
    private buildingService = inject(BuildingService);

    // Inputs
    money = input.required<number>();
    dayCount = input.required<number>();
    guestCount = input.required<number>();
    maxGuests = input<number>(100);
    isPaused = input.required<boolean>();
    isParkClosed = input.required<boolean>();
    grid = input.required<Cell[]>();
    buildingStats = input.required<{
        total: number;
        byCategory: Record<string, number>;
        byType: Record<string, { count: number; name: string; category: string }>;
    }>();
    brokenBuildings = input<Set<string>>(new Set());

    // Output events
    close = output<void>();
    togglePause = output<void>();
    toggleParkClosed = output<void>();
    toggleBuilding = output<{ x: number; y: number; isOpen: boolean }>();

    // Computed properties
    buildingsList: Signal<BuildingStatusInfo[]> = computed(() => {
        const stats = this.buildingStats();
        const grid = this.grid();
        const broken = this.brokenBuildings();
        const result: BuildingStatusInfo[] = [];

        // Analyze each building type
        Object.entries(stats.byType).forEach(([buildingId, info]) => {
            const buildingDef = this.buildingService.getBuildingById(buildingId);

            // Фильтруем только посещаемые здания, исключая декоративные элементы
            if (!buildingDef || buildingDef.isAvailableForVisit !== true || buildingDef.category === 'decoration') {
                return;
            }

            // Count broken vs working buildings and their open/closed status
            const buildings = grid.filter(cell =>
                cell.type === 'building' &&
                cell.isRoot &&
                cell.buildingId === buildingId
            );

            let brokenCount = 0;
            let openCount = 0;
            let closedCount = 0;
            const instances: BuildingInstance[] = [];

            buildings.forEach(cell => {
                const key = `${cell.x},${cell.y}`;
                const isBroken = broken.has(key);
                const isOpen = cell.data?.isOpen !== false; // По умолчанию открыто

                if (isBroken) {
                    brokenCount++;
                }

                if (isOpen) {
                    openCount++;
                } else {
                    closedCount++;
                }

                instances.push({
                    x: cell.x,
                    y: cell.y,
                    isOpen,
                    isBroken
                });
            });

            const workingCount = buildings.length - brokenCount;

            result.push({
                id: buildingId,
                name: info.name,
                count: info.count,
                category: info.category,
                totalIncome: 0,
                brokenCount,
                workingCount,
                openCount,
                closedCount,
                instances
            });
        });

        // Sort by count descending
        return result.sort((a, b) => b.count - a.count);
    });

    categoryStats = computed(() => {
        const grid = this.grid();
        const result: Record<string, { count: number; label: string }> = {
            'attraction': { count: 0, label: 'Аттракционы' },
            'shop': { count: 0, label: 'Магазины' },
            'service': { count: 0, label: 'Сервис' }
        };

        // Подсчитываем только посещаемые здания
        grid.forEach(cell => {
            if (cell.type === 'building' && cell.isRoot && cell.buildingId) {
                const buildingDef = this.buildingService.getBuildingById(cell.buildingId);
                if (buildingDef?.isAvailableForVisit === true) {
                    const category = buildingDef.category;
                    if (result[category]) {
                        result[category].count++;
                    }
                }
            }
        });

        return result;
    });

    guestUtilization = computed(() => {
        const current = this.guestCount();
        const max = this.maxGuests();
        return Math.round((current / max) * 100);
    });

    handleClose() {
        this.close.emit();
    }

    handleTogglePause() {
        this.togglePause.emit();
    }

    handleToggleParkClosed() {
        this.toggleParkClosed.emit();
    }

    getCategoryIcon(category: string): string {
        const icons: Record<string, string> = {
            'attraction': '🎢',
            'shop': '🍔',
            'decoration': '🌳',
            'path': '🛤️',
            'service': '🛠️'
        };
        return icons[category] || '📦';
    }

    getBuildingStatusClass(building: BuildingStatusInfo): string {
        if (building.brokenCount > 0) {
            return 'text-red-400';
        }
        return 'text-green-400';
    }

    handleToggleBuilding(x: number, y: number, currentIsOpen: boolean) {
        this.toggleBuilding.emit({ x, y, isOpen: !currentIsOpen });
    }
}
