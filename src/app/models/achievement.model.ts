import { Cell } from './cell.model';
import { Guest } from './guest.model';

export interface ParkLifetimeStats {
  totalBuildsPlaced: number;
  totalPathsPlaced: number;
  totalAttractionsBuilt: number;
  totalShopsBuilt: number;
  totalDecorationsBuilt: number;
  totalServicesBuilt: number;
  totalGuestsSpawned: number;
  totalRepairsCompleted: number;
  totalDemolitions: number;
  highestMoneyReached: number;
}

export interface GamificationSnapshot {
  money: number;
  dayCount: number;
  grid: Cell[];
  guests: Guest[];
  premiumOwnedSkins: string[];
  lifetimeStats: ParkLifetimeStats;
}

export type AchievementCategory =
  | 'park'
  | 'economy'
  | 'building'
  | 'guests'
  | 'maintenance'
  | 'collection';

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type AchievementReward =
  | { type: 'money'; amount: number }
  | { type: 'building'; buildingId: string }
  | { type: 'skin'; skinId: string };

export interface AchievementDefinition {
  id: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  target: number;
  reward: AchievementReward;
  evaluateProgress: (snapshot: GamificationSnapshot) => number;
}

export interface AchievementProgressState {
  id: string;
  progress: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface AchievementView extends AchievementDefinition {
  title: string;
  description: string;
  categoryLabel: string;
  categoryIcon: string;
  rarityLabel: string;
  rarityIcon: string;
  rewardLabel: string;
  progress: number;
  unlocked: boolean;
  unlockedAt: string | null;
  progressPercent: number;
}

export function createInitialLifetimeStats(): ParkLifetimeStats {
  return {
    totalBuildsPlaced: 0,
    totalPathsPlaced: 0,
    totalAttractionsBuilt: 0,
    totalShopsBuilt: 0,
    totalDecorationsBuilt: 0,
    totalServicesBuilt: 0,
    totalGuestsSpawned: 0,
    totalRepairsCompleted: 0,
    totalDemolitions: 0,
    highestMoneyReached: 5000
  };
}
