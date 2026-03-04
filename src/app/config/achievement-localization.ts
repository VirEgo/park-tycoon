import { AchievementCategory, AchievementRarity } from '../models/achievement.model';

export type AchievementLocale = 'ru';

interface AchievementTextEntry {
  title: string;
  description: string;
}

interface CategoryLocalizationEntry {
  label: string;
  icon: string;
}

interface RarityLocalizationEntry {
  label: string;
  icon: string;
}

interface AchievementUiLocalization {
  panelTitle: string;
  panelSubtitle: string;
  totalProgress: string;
  unlockedCount: string;
  allStatuses: string;
  onlyUnlocked: string;
  onlyLocked: string;
  allCategories: string;
  reward: string;
  progress: string;
  unlockedAt: string;
  noAchievements: string;
  statusUnlocked: string;
  statusLocked: string;
}

export interface AchievementLocaleBundle {
  achievements: Record<string, AchievementTextEntry>;
  categories: Record<AchievementCategory, CategoryLocalizationEntry>;
  rarities: Record<AchievementRarity, RarityLocalizationEntry>;
  ui: AchievementUiLocalization;
}

export const DEFAULT_ACHIEVEMENT_LOCALE: AchievementLocale = 'ru';

export const ACHIEVEMENT_LOCALES: Record<AchievementLocale, AchievementLocaleBundle> = {
  ru: {
    achievements: {
      trailblazer: {
        title: 'Первый маршрут',
        description: 'Постройте свою первую дорожку вручную.'
      },
      merchant_opening: {
        title: 'Первая выручка',
        description: 'Постройте первый магазин.'
      },
      showtime: {
        title: 'Шоу начинается',
        description: 'Постройте первый аттракцион.'
      },
      beautifier: {
        title: 'Уютный уголок',
        description: 'Постройте первую декорацию.'
      },
      service_launch: {
        title: 'Службы запущены',
        description: 'Постройте первое сервисное здание.'
      },
      builder_10: {
        title: 'Молодой архитектор',
        description: 'Постройте 10 объектов.'
      },
      crowd_pull: {
        title: 'Есть интерес',
        description: 'Привлеките в парк 10 гостей.'
      },
      week_one: {
        title: 'Пятидневка',
        description: 'Продержите парк открытым до 5 дня.'
      },
      food_district: {
        title: 'Фуд-корт',
        description: 'Постройте 5 магазинов.'
      },
      thrill_engineer: {
        title: 'Инженер эмоций',
        description: 'Постройте 5 аттракционов.'
      },
      city_beautifier: {
        title: 'Ландшафтный дизайнер',
        description: 'Постройте 10 декораций.'
      },
      repair_brigade: {
        title: 'Ремонтная бригада',
        description: 'Почините 5 зданий.'
      },
      two_weeks: {
        title: 'Уверенный ход',
        description: 'Дойдите до 12 дня.'
      },
      capital_15000: {
        title: 'Капиталист',
        description: 'Накопите максимум в $15 000.'
      },
      skin_collector: {
        title: 'Коллекционер образов',
        description: 'Откройте 3 премиум-скина.'
      },
      builder_25: {
        title: 'Главный застройщик',
        description: 'Постройте 25 объектов.'
      },
      crowd_master: {
        title: 'Любимец публики',
        description: 'Привлеките 50 гостей.'
      },
      month_park: {
        title: 'Опытный управляющий',
        description: 'Дойдите до 25 дня.'
      },
      capital_30000: {
        title: 'Денежный магнит',
        description: 'Достигните максимального капитала в $30 000.'
      },
      park_legend: {
        title: 'Легенда парка',
        description: 'Выполните 4 ключевых условия легендарного парка.'
      }
    },
    categories: {
      park: { label: 'Развитие парка', icon: '🎡' },
      economy: { label: 'Экономика', icon: '💰' },
      building: { label: 'Строительство', icon: '🏗️' },
      guests: { label: 'Гости', icon: '🧑‍🤝‍🧑' },
      maintenance: { label: 'Обслуживание', icon: '🛠️' },
      collection: { label: 'Коллекции', icon: '🎨' }
    },
    rarities: {
      common: { label: 'Обычная', icon: '◌' },
      rare: { label: 'Редкая', icon: '◆' },
      epic: { label: 'Эпическая', icon: '⬟' },
      legendary: { label: 'Легендарная', icon: '★' }
    },
    ui: {
      panelTitle: 'Достижения парка',
      panelSubtitle: 'Следите за прогрессом, редкостью и наградами.',
      totalProgress: 'Общий прогресс',
      unlockedCount: 'Открыто',
      allStatuses: 'Все',
      onlyUnlocked: 'Открытые',
      onlyLocked: 'Закрытые',
      allCategories: 'Все категории',
      reward: 'Награда',
      progress: 'Прогресс',
      unlockedAt: 'Открыто',
      noAchievements: 'По выбранным фильтрам достижений пока нет.',
      statusUnlocked: 'Получено',
      statusLocked: 'В процессе'
    }
  }
};
