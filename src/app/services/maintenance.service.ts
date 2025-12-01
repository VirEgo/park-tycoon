import { Injectable } from '@angular/core';
import { Guest } from '../models/guest.model';

interface RepairTask {
    x: number;
    y: number;
    key: string;
}

@Injectable({
    providedIn: 'root'
})
export class MaintenanceService {
    private tasksQueue: RepairTask[] = [];
    private activeByWorker: Map<number, RepairTask> = new Map();
    private activeByBuilding: Map<string, number> = new Map();
    private workerHomes: Map<number, string | null> = new Map();

    private toKey(x: number, y: number): string {
        return `${x}_${y}`;
    }

    private enqueueTask(task: RepairTask) {
        const alreadyQueued = this.tasksQueue.some(t => t.key === task.key);
        const isActive = this.activeByBuilding.has(task.key);
        if (alreadyQueued || isActive) return;
        this.tasksQueue.push(task);
    }

    requestRepair(x: number, y: number) {
        const key = this.toKey(x, y);
        this.enqueueTask({ x, y, key });
        this.assignAll();
    }

    registerWorkers(workers: Guest[]) {
        workers.forEach(w => this.workerHomes.set(w.id, w.workerHome ?? null));
        this.assignAll();
    }

    unregisterWorkersByHome(homeKey: string) {
        const toRemove: number[] = [];
        this.workerHomes.forEach((home, workerId) => {
            if (home === homeKey) {
                toRemove.push(workerId);
            }
        });

        toRemove.forEach(workerId => {
            this.workerHomes.delete(workerId);
            const activeTask = this.activeByWorker.get(workerId);
            if (activeTask) {
                this.activeByWorker.delete(workerId);
                this.activeByBuilding.delete(activeTask.key);
                this.enqueueTask(activeTask);
            }
        });

        this.assignAll();
    }

    getTaskForWorker(workerId: number): RepairTask | undefined {
        const existing = this.activeByWorker.get(workerId);
        if (existing) return existing;
        return this.assignNext(workerId);
    }

    completeTask(workerId: number, taskKey: string) {
        const active = this.activeByWorker.get(workerId);
        if (active && active.key === taskKey) {
            this.activeByWorker.delete(workerId);
        }
        if (this.activeByBuilding.get(taskKey) === workerId) {
            this.activeByBuilding.delete(taskKey);
        }
        this.assignNext(workerId);
    }

    markBuildingRepaired(x: number, y: number) {
        const key = this.toKey(x, y);
        this.tasksQueue = this.tasksQueue.filter(t => t.key !== key);
        const workerId = this.activeByBuilding.get(key);
        if (workerId !== undefined) {
            this.activeByBuilding.delete(key);
            this.activeByWorker.delete(workerId);
            this.assignNext(workerId);
        }
    }

    private assignAll() {
        this.workerHomes.forEach((_home, workerId) => {
            if (!this.activeByWorker.has(workerId)) {
                this.assignNext(workerId);
            }
        });
    }

    private assignNext(workerId: number): RepairTask | undefined {
        if (!this.workerHomes.has(workerId)) return undefined;
        const nextTask = this.tasksQueue.shift();
        if (!nextTask) return undefined;
        this.activeByWorker.set(workerId, nextTask);
        this.activeByBuilding.set(nextTask.key, workerId);
        return nextTask;
    }
}
