import { AchievementDefinition } from '../models/achievement.model';

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'trailblazer',
    category: 'building',
    rarity: 'common',
    target: 1,
    reward: { type: 'money', amount: 100 },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.totalPathsPlaced
  },
  {
    id: 'merchant_opening',
    category: 'building',
    rarity: 'common',
    target: 1,
    reward: { type: 'money', amount: 150 },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.totalShopsBuilt
  },
  {
    id: 'showtime',
    category: 'building',
    rarity: 'common',
    target: 1,
    reward: { type: 'money', amount: 200 },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.totalAttractionsBuilt
  },
  {
    id: 'beautifier',
    category: 'building',
    rarity: 'common',
    target: 1,
    reward: { type: 'money', amount: 100 },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.totalDecorationsBuilt
  },
  {
    id: 'service_launch',
    category: 'building',
    rarity: 'common',
    target: 1,
    reward: { type: 'money', amount: 250 },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.totalServicesBuilt
  },
  {
    id: 'builder_10',
    category: 'building',
    rarity: 'rare',
    target: 10,
    reward: { type: 'money', amount: 500 },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.totalBuildsPlaced
  },
  {
    id: 'crowd_pull',
    category: 'guests',
    rarity: 'common',
    target: 10,
    reward: { type: 'money', amount: 400 },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.totalGuestsSpawned
  },
  {
    id: 'week_one',
    category: 'park',
    rarity: 'rare',
    target: 5,
    reward: { type: 'building', buildingId: 'royalGarden' },
    evaluateProgress: (snapshot) => snapshot.dayCount
  },
  {
    id: 'food_district',
    category: 'building',
    rarity: 'rare',
    target: 5,
    reward: { type: 'building', buildingId: 'gourmetPlaza' },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.totalShopsBuilt
  },
  {
    id: 'thrill_engineer',
    category: 'building',
    rarity: 'rare',
    target: 5,
    reward: { type: 'money', amount: 1000 },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.totalAttractionsBuilt
  },
  {
    id: 'city_beautifier',
    category: 'building',
    rarity: 'rare',
    target: 10,
    reward: { type: 'money', amount: 800 },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.totalDecorationsBuilt
  },
  {
    id: 'repair_brigade',
    category: 'maintenance',
    rarity: 'epic',
    target: 5,
    reward: { type: 'building', buildingId: 'vipLounge' },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.totalRepairsCompleted
  },
  {
    id: 'two_weeks',
    category: 'park',
    rarity: 'rare',
    target: 12,
    reward: { type: 'money', amount: 1500 },
    evaluateProgress: (snapshot) => snapshot.dayCount
  },
  {
    id: 'capital_15000',
    category: 'economy',
    rarity: 'epic',
    target: 15000,
    reward: { type: 'money', amount: 2000 },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.highestMoneyReached
  },
  {
    id: 'skin_collector',
    category: 'collection',
    rarity: 'epic',
    target: 3,
    reward: { type: 'skin', skinId: 'vampire' },
    evaluateProgress: (snapshot) => snapshot.premiumOwnedSkins.length
  },
  {
    id: 'builder_25',
    category: 'building',
    rarity: 'epic',
    target: 25,
    reward: { type: 'building', buildingId: 'megaCoaster' },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.totalBuildsPlaced
  },
  {
    id: 'crowd_master',
    category: 'guests',
    rarity: 'epic',
    target: 50,
    reward: { type: 'skin', skinId: 'sonic' },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.totalGuestsSpawned
  },
  {
    id: 'month_park',
    category: 'park',
    rarity: 'epic',
    target: 25,
    reward: { type: 'skin', skinId: 'mario' },
    evaluateProgress: (snapshot) => snapshot.dayCount
  },
  {
    id: 'capital_30000',
    category: 'economy',
    rarity: 'legendary',
    target: 30000,
    reward: { type: 'building', buildingId: 'moonPalace' },
    evaluateProgress: (snapshot) => snapshot.lifetimeStats.highestMoneyReached
  },
  {
    id: 'park_legend',
    category: 'park',
    rarity: 'legendary',
    target: 4,
    reward: { type: 'skin', skinId: 'zelda' },
    evaluateProgress: (snapshot) => {
      let completed = 0;
      if (snapshot.dayCount >= 40) completed++;
      if (snapshot.lifetimeStats.totalBuildsPlaced >= 40) completed++;
      if (snapshot.lifetimeStats.totalGuestsSpawned >= 100) completed++;
      if (snapshot.lifetimeStats.highestMoneyReached >= 30000) completed++;
      return completed;
    }
  }
];
