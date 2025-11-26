import { Injectable } from '@angular/core';

export interface BuildingStatus {
    visits: number;
    maxVisits: number;
    isBroken: boolean;
    totalVisits: number;
}

@Injectable({
    providedIn: 'root'
})
export class BuildingStatusService {
    private readonly STORAGE_KEY = 'park-building-status-v1';
    private statuses: Map<string, BuildingStatus> = new Map();
    private readonly DEFAULT_MAX_VISITS = 500;

    constructor() {
        this.loadFromStorage();
    }

    private getKey(x: number, y: number): string {
        return `${x}_${y}`;
    }

    getStatus(x: number, y: number): BuildingStatus | undefined {
        return this.statuses.get(this.getKey(x, y));
    }

    initStatus(x: number, y: number, maxVisits: number = this.DEFAULT_MAX_VISITS) {
        this.statuses.set(this.getKey(x, y), {
            visits: 0,
            maxVisits,
            isBroken: false,
            totalVisits: 0
        });
        this.saveToStorage();
    }

    recordVisit(x: number, y: number): boolean {
        const key = this.getKey(x, y);
        const status = this.statuses.get(key);
        if (!status) {
            // Initialize if missing (e.g. old save)
            this.initStatus(x, y);
            return false;
        }

        if (status.isBroken) return true;

        status.visits++;
        status.totalVisits = (status.totalVisits || 0) + 1;

        if (status.visits >= status.maxVisits) {
            status.isBroken = true;
            this.saveToStorage();
            return true; // Just broke
        }

        // Save periodically or on break? Let's save on break or periodically.
        // For now, maybe not every visit to avoid spamming localStorage, but we need persistence.
        // Let's save every 10 visits or if broken.
        if (status.visits % 10 === 0) {
            this.saveToStorage();
        }

        return false;
    }

    repair(x: number, y: number) {
        const key = this.getKey(x, y);
        const status = this.statuses.get(key);
        if (status) {
            status.visits = 0;
            status.isBroken = false;
            this.saveToStorage();
        }
    }

    isBroken(x: number, y: number): boolean {
        return this.statuses.get(this.getKey(x, y))?.isBroken || false;
    }

    getRepairCost(basePrice: number, level: number): number {
        let multiplier = 0.25; // Level 1
        switch (level) {
            case 2: multiplier = 0.60; break;
            case 3: multiplier = 0.90; break;
            case 4: multiplier = 1.10; break;
            case 5: multiplier = 1.50; break;
        }
        return Math.floor(basePrice * multiplier);
    }

    // Persistence
    saveToStorage() {
        try {
            const data = Array.from(this.statuses.entries());
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save building statuses', e);
        }
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) {
                const entries = JSON.parse(data);
                this.statuses = new Map(entries);
            }
        } catch (e) {
            console.error('Failed to load building statuses', e);
        }
    }

    clearAll() {
        this.statuses.clear();
        localStorage.removeItem(this.STORAGE_KEY);
    }

    removeStatus(x: number, y: number) {
        this.statuses.delete(this.getKey(x, y));
        this.saveToStorage();
    }
}
