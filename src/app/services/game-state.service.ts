import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { GameSaveState } from '../models/game-state.model';
import { Guest } from '../models/guest.model';
import { CasinoService } from './casino.service';
import { PremiumSkinsService } from './guest/primium-skins';
import { GamificationService } from './gamification.service';

const STORAGE_KEY = 'angular-park-save-v1';

@Injectable({
    providedIn: 'root'
})
export class GameStateService {
    private casinoService = inject(CasinoService);
    private premiumSkinsService = inject(PremiumSkinsService);
    private gamificationService = inject(GamificationService);
    private currentState: GameSaveState | null = null;

    // Global State
    money: WritableSignal<number> = signal<number>(5000);

    saveGame(state: GameSaveState): boolean {
        try {
            const saveData = {
                ...state,
                money: this.money(), // Save money
                casinoData: this.casinoService.saveToStorage()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
            this.currentState = saveData;
            return true;
        } catch (e) {
            console.error('Save failed', e);
            return false;
        }
    }

    patchSave(patch: Partial<GameSaveState>): boolean {
        try {
            if (!this.currentState) {
                const saved = localStorage.getItem(STORAGE_KEY);
                this.currentState = saved ? JSON.parse(saved) as GameSaveState : null;
            }

            if (!this.currentState) {
                return false;
            }

            this.currentState = {
                ...this.currentState,
                ...patch,
                money: patch.money ?? this.money(),
                casinoData: this.casinoService.saveToStorage()
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentState));
            return true;
        } catch (e) {
            console.error('Patch save failed', e);
            return false;
        }
    }

    loadGame(): GameSaveState | null {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return null;

        try {
            const state: GameSaveState = JSON.parse(saved);

            // Restore money
            if (state.money !== undefined) {
                this.money.set(state.money);
            }

            if (state.premiumSkinState) {
                this.premiumSkinsService.importState(state.premiumSkinState);
            } else if (state.premiumSkinsOwned) {
                this.premiumSkinsService.importState({
                    ownedSkins: state.premiumSkinsOwned,
                    enabledSkins: state.premiumSkinsOwned
                });
            }

            this.gamificationService.importState(state.achievementProgress);

            // Restore guests using the static method
            const restoredGuests = state.guests.map(g => Guest.fromJSON(g));
            state.guests = restoredGuests;

            // Restore casino data
            if (state.casinoData) {
                this.casinoService.loadFromStorage(state.casinoData);
            }

            this.currentState = state;

            return state;
        } catch (e) {
            console.error('Load failed', e);
            return null;
        }
    }

    deductMoney(amount: number): boolean {
        if (this.money() >= amount) {
            this.money.update(m => m - amount);
            return true;
        }
        return false;
    }

    addMoney(amount: number): void {
        this.money.update(m => m + amount);
    }

    resetGame(): void {
        localStorage.removeItem(STORAGE_KEY);
        this.casinoService.reset();
        this.premiumSkinsService.reset();
        this.gamificationService.resetState();
        this.currentState = null;
    }
}
