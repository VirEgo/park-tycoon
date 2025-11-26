import { Cell } from './cell.model';
import { Guest } from './guest.model';

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
}

export interface GuestStats {
    happiness: number;
    satiety: number;
    hydration: number;
    energy: number;
    fun: number;
    money: number;
}
