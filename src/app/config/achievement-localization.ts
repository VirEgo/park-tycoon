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
      },
      builder_50: {
        title: 'Мастер-строитель',
        description: 'Постройте 50 объектов.'
      },
      path_master: {
        title: 'Мастер дорожек',
        description: 'Постройте 50 дорожек.'
      },
      decoration_king: {
        title: 'Король декораций',
        description: 'Постройте 20 декораций.'
      },
      service_empire: {
        title: 'Империя сервисов',
        description: 'Постройте 5 сервисных зданий.'
      },
      crowd_100: {
        title: 'Толпы гостей',
        description: 'Привлеките 100 гостей.'
      },
      crowd_200: {
        title: 'Легенда толпы',
        description: 'Привлеките 200 гостей.'
      },
      reviewer: {
        title: 'Первые отзывы',
        description: 'Получите 5 отзывов от гостей.'
      },
      critic: {
        title: 'Строгий критик',
        description: 'Получите 20 отзывов от гостей.'
      },
      month_one: {
        title: 'Первый месяц',
        description: 'Доживите до 30 дня.'
      },
      veteran: {
        title: 'Ветеран парка',
        description: 'Доживите до 50 дня.'
      },
      century: {
        title: 'Столетие',
        description: 'Доживите до 100 дня.'
      },
      capital_50000: {
        title: 'Крупный капитал',
        description: 'Достигните капитала в $50 000.'
      },
      earned_10000: {
        title: 'Первая тысяча',
        description: 'Заработайте $10 000 всего.'
      },
      earned_50000: {
        title: 'Большие деньги',
        description: 'Заработайте $50 000 всего.'
      },
      repair_master: {
        title: 'Мастер ремонтов',
        description: 'Почините 10 зданий.'
      },
      repair_legend: {
        title: 'Легенда ремонтов',
        description: 'Почините 25 зданий.'
      },
      demolition_expert: {
        title: 'Демонтажник',
        description: 'Снесите 10 зданий.'
      },
      demolition_pro: {
        title: 'Профи сноса',
        description: 'Снесите 25 зданий.'
      },
      first_expansion: {
        title: 'Первый шаг',
        description: 'Купите первый участок земли.'
      },
      land_owner: {
        title: 'Землевладелец',
        description: 'Купите 3 участка земли.'
      },
      territory_master: {
        title: 'Мастер территорий',
        description: 'Купите 5 участков земли.'
      },
      full_park: {
        title: 'Полный парк',
        description: 'Купите все 8 участков земли.'
      },
      jackpot_winner: {
        title: 'Джекпот!',
        description: 'Выиграйте джекпот в казино.'
      },
      high_roller: {
        title: 'Хай-роллер',
        description: 'Выиграйте $500+ за одну ставку.'
      },
      casino_profit: {
        title: 'Казино в плюсе',
        description: 'Выиграйте $5 000 в казино всего.'
      },
      skin_collector_5: {
        title: 'Коллекционер (5)',
        description: 'Откройте 5 премиум-скинов.'
      },
      skin_master: {
        title: 'Мастер скинов',
        description: 'Откройте 10 премиум-скинов.'
      }
    },
    categories: {
      park: { label: 'Развитие парка', icon: '🎡' },
      economy: { label: 'Экономика', icon: '💰' },
      building: { label: 'Строительство', icon: '🏗️' },
      guests: { label: 'Гости', icon: '🧑‍🤝‍🧑' },
      maintenance: { label: 'Обслуживание', icon: '🛠️' },
      collection: { label: 'Коллекции', icon: '🎨' },
      expansion: { label: 'Расширение', icon: '🗺️' },
      gambling: { label: 'Казино', icon: '🎰' }
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
