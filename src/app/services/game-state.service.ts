import { Injectable, inject } from '@angular/core';
import { GameSaveState } from '../models/game-state.model';
import { Guest } from '../models/guest.model';
import { CasinoService } from './casino.service';

const STORAGE_KEY = 'angular-park-save-v1';

@Injectable({
    providedIn: 'root'
})
export class GameStateService {
    private casinoService = inject(CasinoService);

    saveGame(state: GameSaveState): boolean {
        try {
            const saveData = {
                ...state,
                casinoData: this.casinoService.saveToStorage()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
            return true;
        } catch (e) {
            console.error('Save failed', e);
            return false;
        }
    }

    loadGame(): GameSaveState | null {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return null;

        try {
            const state: GameSaveState = JSON.parse(saved);

            // Restore guests using the static method
            const restoredGuests = state.guests.map(g => Guest.fromJSON(g));
            state.guests = restoredGuests;

            // Restore casino data
            if (state.casinoData) {
                this.casinoService.loadFromStorage(state.casinoData);
            }

            return state;
        } catch (e) {
            console.error('Load failed', e);
            return null;
        }
    }

    resetGame(): void {
        localStorage.removeItem(STORAGE_KEY);
        this.casinoService.reset();
    }

    createDemoSave(): GameSaveState {
        // Demo save creation logic moved here from component
        return {
            money: 10000,
            dayCount: 1,
            grid: [],
            guests: [],
            guestIdCounter: 1,
            entranceIndex: 0,
            casinoLastPayoutDay: 0
        };
    }
}
