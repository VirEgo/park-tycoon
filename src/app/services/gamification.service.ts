import { Injectable, computed, signal } from '@angular/core';
import { ACHIEVEMENT_DEFINITIONS } from '../config/achievement-definitions';
import {
  ACHIEVEMENT_LOCALES,
  AchievementLocaleBundle,
  AchievementLocale,
  DEFAULT_ACHIEVEMENT_LOCALE
} from '../config/achievement-localization';
import {
  AchievementProgressState,
  AchievementReward,
  AchievementView,
  GamificationSnapshot
} from '../models/achievement.model';
import { BUILDINGS } from '../models/building.model';
import { Guest } from '../models/guest.model';

export interface GamificationRewardContext {
  addMoney: (amount: number) => void;
  unlockSkin: (skinId: string) => boolean;
}

export interface AchievementUnlockEvent {
  achievement: AchievementView;
  rewardMessage: string;
}

@Injectable({
  providedIn: 'root'
})
export class GamificationService {
  private readonly progressState = signal<Record<string, AchievementProgressState>>(this.createDefaultState());
  private readonly locale = signal<AchievementLocale>(DEFAULT_ACHIEVEMENT_LOCALE);

  readonly localeBundle = computed(() => ACHIEVEMENT_LOCALES[this.locale()] ?? ACHIEVEMENT_LOCALES[DEFAULT_ACHIEVEMENT_LOCALE]);

  readonly achievements = computed(() =>
    ACHIEVEMENT_DEFINITIONS.map((definition) =>
      this.toAchievementView(definition, this.progressState()[definition.id], this.localeBundle())
    )
  );
  readonly unlockedAchievementIds = computed(() => {
    const state = this.progressState();
    const unlockedIds = new Set<string>();

    for (const definition of ACHIEVEMENT_DEFINITIONS) {
      if (state[definition.id]?.unlocked) {
        unlockedIds.add(definition.id);
      }
    }

    return unlockedIds;
  });

  readonly unlockedCount = computed(() => this.achievements().filter((achievement) => achievement.unlocked).length);
  readonly totalCount = ACHIEVEMENT_DEFINITIONS.length;
  readonly completionPercent = computed(() => {
    if (!this.totalCount) {
      return 0;
    }
    return Math.round((this.unlockedCount() / this.totalCount) * 100);
  });

  setLocale(locale: AchievementLocale) {
    this.locale.set(locale);
  }

  resetState() {
    this.progressState.set(this.createDefaultState());
  }

  importState(progress: AchievementProgressState[] | undefined | null) {
    if (!progress?.length) {
      this.progressState.set(this.createDefaultState());
      return;
    }

    const next = this.createDefaultState();
    for (const entry of progress) {
      if (!next[entry.id]) {
        continue;
      }

      next[entry.id] = {
        id: entry.id,
        progress: Math.max(0, entry.progress ?? 0),
        unlocked: !!entry.unlocked,
        unlockedAt: entry.unlockedAt ?? null
      };
    }

    this.progressState.set(next);
  }

  exportState(): AchievementProgressState[] {
    return ACHIEVEMENT_DEFINITIONS.map((definition) => ({ ...this.progressState()[definition.id] }));
  }

  isAchievementUnlocked(achievementId: string): boolean {
    return this.progressState()[achievementId]?.unlocked ?? false;
  }

  evaluate(snapshot: GamificationSnapshot, rewardContext: GamificationRewardContext): AchievementUnlockEvent[] {
    const localeBundle = this.localeBundle();
    const updatedSnapshot = {
      ...snapshot,
      lifetimeStats: {
        ...snapshot.lifetimeStats,
        highestMoneyReached: Math.max(snapshot.lifetimeStats.highestMoneyReached, snapshot.money)
      },
      premiumOwnedSkins: Array.from(new Set(snapshot.premiumOwnedSkins))
    };

    const current = { ...this.progressState() };
    const unlocks: AchievementUnlockEvent[] = [];

    for (const definition of ACHIEVEMENT_DEFINITIONS) {
      const previous = current[definition.id] ?? {
        id: definition.id,
        progress: 0,
        unlocked: false,
        unlockedAt: null
      };
      const progress = Math.max(previous.progress, definition.evaluateProgress(updatedSnapshot));
      const isNowUnlocked = previous.unlocked || progress >= definition.target;

      current[definition.id] = {
        id: definition.id,
        progress,
        unlocked: isNowUnlocked,
        unlockedAt: previous.unlockedAt ?? (isNowUnlocked ? new Date().toLocaleString() : null)
      };

      if (!previous.unlocked && isNowUnlocked) {
        const rewardMessage = this.applyReward(definition.reward, rewardContext);
        unlocks.push({
          achievement: this.toAchievementView(definition, current[definition.id], localeBundle),
          rewardMessage
        });
      }
    }

    this.progressState.set(current);
    return unlocks;
  }

  private applyReward(reward: AchievementReward, rewardContext: GamificationRewardContext): string {
    switch (reward.type) {
      case 'money':
        rewardContext.addMoney(reward.amount);
        return this.describeReward(reward);
      case 'building': {
        return this.describeReward(reward);
      }
      case 'skin': {
        const granted = rewardContext.unlockSkin(reward.skinId);
        return granted
          ? this.describeReward(reward)
          : `Награда: премиум-скин "${this.formatSkinName(reward.skinId)}" уже был открыт`;
      }
    }
  }

  private describeReward(reward: AchievementReward): string {
    switch (reward.type) {
      case 'money':
        return `Награда: $${reward.amount}`;
      case 'building': {
        const building = BUILDINGS.find((item) => item.id === reward.buildingId);
        return `Награда: здание "${building?.name ?? reward.buildingId}"`;
      }
      case 'skin': {
        const priceLabel = Guest.PremiumSkins[reward.skinId]
          ? ` (магазин: $${Guest.PremiumSkins[reward.skinId]})`
          : '';
        return `Награда: премиум-скин "${this.formatSkinName(reward.skinId)}"${priceLabel}`;
      }
    }
  }

  private formatSkinName(skinId: string): string {
    return skinId
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private toAchievementView(
    definition: (typeof ACHIEVEMENT_DEFINITIONS)[number],
    state: AchievementProgressState | undefined,
    localeBundle: AchievementLocaleBundle
  ): AchievementView {
    const translation = localeBundle.achievements[definition.id];
    const categoryMeta = localeBundle.categories[definition.category];
    const rarityMeta = localeBundle.rarities[definition.rarity];
    const progress = Math.min(state?.progress ?? 0, definition.target);

    return {
      ...definition,
      title: translation?.title ?? definition.id,
      description: translation?.description ?? definition.id,
      categoryLabel: categoryMeta?.label ?? definition.category,
      categoryIcon: categoryMeta?.icon ?? '🏆',
      rarityLabel: rarityMeta?.label ?? definition.rarity,
      rarityIcon: rarityMeta?.icon ?? '•',
      rewardLabel: this.describeReward(definition.reward),
      progress,
      unlocked: state?.unlocked ?? false,
      unlockedAt: state?.unlockedAt ?? null,
      progressPercent: Math.min(100, Math.round((progress / definition.target) * 100))
    };
  }

  private createDefaultState(): Record<string, AchievementProgressState> {
    return ACHIEVEMENT_DEFINITIONS.reduce<Record<string, AchievementProgressState>>((acc, definition) => {
      acc[definition.id] = {
        id: definition.id,
        progress: 0,
        unlocked: false,
        unlockedAt: null
      };
      return acc;
    }, {});
  }
}
