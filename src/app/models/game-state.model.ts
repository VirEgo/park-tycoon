import { Cell } from './cell.model';
import { Guest } from './guest.model';
import { AchievementProgressState, ParkLifetimeStats } from './achievement.model';
import { ExpansionState } from './expansion.model';
import { PremiumSkinStorageData } from '../services/guest/primium-skins';

export interface GameSaveState {
    money: number;
    dayCount: number;
    grid: Cell[];
    gridWidth?: number;
    gridHeight?: number;
    guests: Guest[];
    guestIdCounter: number;
    entranceIndex: number;
    casinoLastPayoutDay: number;
    casinoData?: string;
    isParkClosed?: boolean;
    premiumSkinsOwned?: string[];
    premiumSkinState?: PremiumSkinStorageData;
    achievementProgress?: AchievementProgressState[];
    parkLifetimeStats?: ParkLifetimeStats;
    expansionState?: ExpansionState;
}

export interface GuestStats {
    happiness: number;
    satiety: number;
    hydration: number;
    energy: number;
    fun: number;
    money: number;
}
