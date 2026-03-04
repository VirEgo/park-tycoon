import { CommonModule } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { AchievementCategory, AchievementView } from '../../models/achievement.model';
import { AchievementLocaleBundle } from '../../config/achievement-localization';

type AchievementStatusFilter = 'all' | 'unlocked' | 'locked';

@Component({
  selector: 'app-achievements-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './achievements-panel.component.html',
  styleUrl: './achievements-panel.component.scss'
})
export class AchievementsPanelComponent {
  readonly achievements = input.required<AchievementView[]>();
  readonly localeBundle = input.required<AchievementLocaleBundle>();
  readonly unlockedCount = input(0);
  readonly totalCount = input(0);
  readonly completionPercent = input(0);

  readonly close = output<void>();

  protected readonly statusFilter = signal<AchievementStatusFilter>('all');
  protected readonly categoryFilter = signal<AchievementCategory | 'all'>('all');

  protected readonly categorySummaries = computed(() => {
    const achievements = this.achievements();
    const categories = new Map<AchievementCategory, { total: number; unlocked: number }>();

    for (const achievement of achievements) {
      const current = categories.get(achievement.category) ?? { total: 0, unlocked: 0 };
      current.total += 1;
      current.unlocked += achievement.unlocked ? 1 : 0;
      categories.set(achievement.category, current);
    }

    return Array.from(categories.entries()).map(([category, summary]) => {
      const firstAchievement = achievements.find((achievement) => achievement.category === category);
      return {
        id: category,
        label: firstAchievement?.categoryLabel ?? category,
        icon: firstAchievement?.categoryIcon ?? '🏆',
        total: summary.total,
        unlocked: summary.unlocked
      };
    });
  });

  protected readonly filteredAchievements = computed(() => {
    const statusFilter = this.statusFilter();
    const categoryFilter = this.categoryFilter();

    return this.achievements()
      .filter((achievement) => {
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'unlocked' && achievement.unlocked) ||
          (statusFilter === 'locked' && !achievement.unlocked);

        const matchesCategory = categoryFilter === 'all' || achievement.category === categoryFilter;
        return matchesStatus && matchesCategory;
      })
      .sort((left, right) => {
        if (left.unlocked !== right.unlocked) {
          return left.unlocked ? -1 : 1;
        }

        const rarityOrder = {
          legendary: 0,
          epic: 1,
          rare: 2,
          common: 3
        } as const;

        const rarityDelta = rarityOrder[left.rarity] - rarityOrder[right.rarity];
        if (rarityDelta !== 0) {
          return rarityDelta;
        }

        const progressDelta = right.progressPercent - left.progressPercent;
        if (progressDelta !== 0) {
          return progressDelta;
        }

        return left.title.localeCompare(right.title, 'ru');
      });
  });

  protected setStatusFilter(filter: AchievementStatusFilter) {
    this.statusFilter.set(filter);
  }

  protected setCategoryFilter(filter: AchievementCategory | 'all') {
    this.categoryFilter.set(filter);
  }
}
