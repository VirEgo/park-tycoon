import { Injectable, signal } from '@angular/core';
import { Cell } from '../models/cell.model';
import { Guest } from '../models/guest.model';
import { ExpansionState } from '../models/expansion.model';

export interface GameSettings {
  notificationsEnabled: boolean;
  notificationCategories: {
    building: boolean;
    finance: boolean;
    guests: boolean;
    achievements: boolean;
    repair: boolean;
  };
  notificationDuration: 2000 | 5000 | 10000;

  renderQuality: 'high' | 'medium' | 'low';
  targetFPS: 30 | 60;
  animationsEnabled: boolean;
  guestMoodIndicators: boolean;

  simulationSpeed: 0.5 | 1 | 2 | 3;
  autoPauseOnBlur: boolean;
  autoSaveInterval: 10000 | 30000 | 60000 | 120000;

  showAchievementNotifications: boolean;
  sidebarDefaultOpen: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class GameSettingsService {
    private readonly STORAGE_KEY = 'park-tycoon-settings-v1';

    private readonly defaults: GameSettings = {
        notificationsEnabled: true,
        notificationCategories: {
            building: true,
            finance: true,
            guests: true,
            achievements: true,
            repair: true
        },
        notificationDuration: 2000,
        renderQuality: 'high',
        targetFPS: 60,
        animationsEnabled: true,
        guestMoodIndicators: true,
        simulationSpeed: 1,
        autoPauseOnBlur: false,
        autoSaveInterval: 30000,
        showAchievementNotifications: true,
        sidebarDefaultOpen: true
    };

    settings = signal<GameSettings>(this.loadFromStorage());

    update(partial: Partial<GameSettings>): void {
        const current = this.settings();
        const next = { ...current, ...partial };
        this.settings.set(next);
        this.saveToStorage(next);
    }

    updateCategories(categories: Partial<GameSettings['notificationCategories']>): void {
        const current = this.settings();
        const next = {
            ...current,
            notificationCategories: { ...current.notificationCategories, ...categories }
        };
        this.settings.set(next);
        this.saveToStorage(next);
    }

    reset(): void {
        this.settings.set({ ...this.defaults });
        this.saveToStorage(this.defaults);
    }

    shouldShowNotification(category: keyof GameSettings['notificationCategories']): boolean {
        const s = this.settings();
        return s.notificationsEnabled && s.notificationCategories[category];
    }

    exportSave(
        grid: Cell[],
        guests: Guest[],
        money: number,
        dayCount: number,
        expansionState: ExpansionState
    ): string {
        const saveData = {
            version: 1,
            timestamp: new Date().toISOString(),
            grid,
            guests,
            money,
            dayCount,
            expansionState,
            settings: this.settings()
        };
        return JSON.stringify(saveData);
    }

    importSave(jsonString: string): { success: boolean; data?: any; error?: string } {
        try {
            const data = JSON.parse(jsonString);
            if (!data.version || !data.grid || !data.guests) {
                return { success: false, error: 'Неверный формат файла сохранения.' };
            }
            return { success: true, data };
        } catch {
            return { success: false, error: 'Не удалось прочитать файл.' };
        }
    }

    private loadFromStorage(): GameSettings {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                return {
                    ...this.defaults,
                    ...parsed,
                    notificationCategories: {
                        ...this.defaults.notificationCategories,
                        ...parsed.notificationCategories
                    }
                };
            }
        } catch {}
        return { ...this.defaults };
    }

    private saveToStorage(settings: GameSettings): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
        } catch {}
    }
}
