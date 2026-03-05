import { GuestTypeId } from './guest-type.model';

export type ParkGuestReviewSource = 'lm-studio' | 'template';

export interface ParkGuestReviewSnapshot {
    happiness: number;
    satiety: number;
    hydration: number;
    energy: number;
    fun: number;
    toilet: number;
    moneyLeft: number;
    daysInPark: number;
}

export interface ParkGuestReview {
    id: string;
    createdAt: string;
    day: number;
    leaveOrdinal: number;
    guestType: GuestTypeId;
    rating: number;
    text: string;
    source: ParkGuestReviewSource;
    snapshot: ParkGuestReviewSnapshot;
}
