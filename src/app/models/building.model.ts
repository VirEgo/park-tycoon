export type ToolType = 'none' | 'demolish' | 'path' | 'attraction' | 'shop' | 'decoration' | 'service';

export interface BuildingType {
    id: string;
    name: string;
    category: ToolType;
    price: number;
    income: number;
    color: string;
    icon: string;
    width: number;
    height: number;
    description: string;
    svgPath?: string;
    allowedOnPath?: boolean;
    satisfies?: 'satiety' | 'hydration' | 'energy' | 'fun' | 'toilet';
    statValue?: number;
    isGambling?: boolean;
    hidden?: boolean;
    isAvailableForVisit?: boolean;
    maxUsageLimit?: number; // база прочности/посещений до поломки
    allowContinuousBuild?: boolean; // можно ставить несколько подряд без сброса инструмента
    unlockAchievementId?: string;
}

export const BUILDINGS: BuildingType[] = [
    // Пешеходные дорожки
    { id: 'path', name: 'Дорожка', category: 'path', price: 10, income: 0, color: '#9ca3af', icon: '', width: 1, height: 1, svgPath: 'assets/buildings/path.svg', description: 'Обычная тропинка', isAvailableForVisit: true },
    { id: 'exit', name: 'Выход', category: 'path', price: 0, income: 0, color: '#ef4444', icon: '🚪', width: 1, height: 1, svgPath: 'assets/buildings/exit2.svg', description: 'Путь на выход', isAvailableForVisit: true },

    // Аттракционы
    { id: 'carousel', name: 'Карусель', category: 'attraction', price: 400, income: 1.5, color: '#fbbf24', icon: '🎠', width: 3, height: 3, svgPath: 'assets/buildings/carousel.svg', description: 'Классическая карусель', satisfies: 'fun', statValue: 30, isAvailableForVisit: true },
    { id: 'ferris', name: 'Колесо', category: 'attraction', price: 1200, income: 0.4, color: '#f87171', icon: '🎡', width: 2, height: 2, svgPath: 'assets/buildings/ferris.svg', description: 'Вид на весь парк', satisfies: 'fun', statValue: 50, isAvailableForVisit: true },
    { id: 'coaster', name: 'Горки', category: 'attraction', price: 3000, income: 1, color: '#ef4444', icon: '🎢', width: 3, height: 2, svgPath: 'assets/buildings/coaster.svg', description: 'Скоростной адреналин', satisfies: 'fun', statValue: 80, isAvailableForVisit: true },
    { id: 'castle', name: 'Замок', category: 'attraction', price: 5000, income: 2, color: '#c084fc', icon: '🏰', width: 2, height: 2, svgPath: 'assets/buildings/castle.svg', description: 'Сказочное приключение', satisfies: 'fun', statValue: 100, isAvailableForVisit: true },
    { id: 'slots', name: 'Слоты', category: 'attraction', price: 600, income: 0.25, color: '#818cf8', icon: '🎰', width: 3, height: 3, svgPath: 'assets/buildings/slots.svg', description: 'Слот-машины', satisfies: 'fun', statValue: 15, isGambling: true, isAvailableForVisit: true },
    { id: 'shooting', name: 'Тир', category: 'attraction', price: 800, income: 0.5, color: '#4ade80', icon: '🎯', width: 1, height: 1, svgPath: 'assets/buildings/shooting.svg', description: 'Меткий выстрел', satisfies: 'fun', statValue: 20, isGambling: true, isAvailableForVisit: true },

    // Магазины
    { id: 'burger', name: 'Бургер', category: 'shop', price: 300, income: 1, color: '#f59e0b', icon: '🍔', width: 3, height: 2, svgPath: 'assets/buildings/burger.svg', description: 'Сочный и быстрый', satisfies: 'satiety', statValue: 50, isAvailableForVisit: true },
    { id: 'pizza', name: 'Пицца', category: 'shop', price: 350, income: 1.2, color: '#f59e0b', icon: '🍕', width: 3, height: 2, svgPath: 'assets/buildings/pizza.svg', description: 'Горячая и сырная', satisfies: 'satiety', statValue: 60, isAvailableForVisit: true },
    { id: 'icecream', name: 'Мороженое', category: 'shop', price: 200, income: 0.8, color: '#60a5fa', icon: '🍦', width: 2, height: 2, svgPath: 'assets/buildings/icecream.svg', description: 'Сладкое охлаждение', satisfies: 'fun', statValue: 10, isAvailableForVisit: true },
    { id: 'popcorn', name: 'Попкорн', category: 'shop', price: 150, income: 0.6, color: '#fcd34d', icon: '🍿', width: 2, height: 2, svgPath: 'assets/buildings/popcorn.svg', description: 'Идеален для прогулки', satisfies: 'satiety', statValue: 20, isAvailableForVisit: true },
    { id: 'soda', name: 'Газировка', category: 'shop', price: 150, income: 0.5, color: '#ef4444', icon: '🥤', width: 2, height: 2, svgPath: 'assets/buildings/soda.svg', description: 'Прохладный напиток', satisfies: 'hydration', statValue: 40, isAvailableForVisit: true },
    { id: 'coffee', name: 'Кофе', category: 'shop', price: 180, income: 0.7, color: '#78350f', icon: '☕', width: 2, height: 2, svgPath: 'assets/buildings/coffee.svg', description: 'Бодрит и греет', satisfies: 'energy', statValue: 30, isAvailableForVisit: true },
    { id: 'gifts', name: 'Подарки', category: 'shop', price: 400, income: 1.5, color: '#ec4899', icon: '🎁', width: 2, height: 2, svgPath: 'assets/buildings/gifts.svg', description: 'Сувениры и радость', satisfies: 'fun', statValue: 25, isAvailableForVisit: true },
    { id: 'balloons', name: 'Шарики', category: 'shop', price: 100, income: 0.3, color: '#ef4444', icon: '🎈', width: 2, height: 2, svgPath: 'assets/buildings/balloons.svg', description: 'Цветные эмоции', satisfies: 'fun', statValue: 15, isAvailableForVisit: true },

    // Декор
    { id: 'fountain', name: 'Фонтан', category: 'decoration', price: 400, income: 0, color: '#3b82f6', icon: '⛲', width: 2, height: 2, svgPath: 'assets/buildings/fountain.svg', description: 'Оживляет площадь', satisfies: 'fun', statValue: 5, isAvailableForVisit: false, allowContinuousBuild: true },
    { id: 'tree', name: 'Дерево', category: 'decoration', price: 50, income: 0, color: '#166534', icon: '🌳', width: 1, height: 1, svgPath: 'assets/buildings/tree.svg', description: 'Тень и зелень', allowedOnPath: false, isAvailableForVisit: false, allowContinuousBuild: true },
    { id: 'bench', name: 'Скамейка', category: 'decoration', price: 50, income: 0, color: '#8B4513', icon: '🪑', width: 1, height: 1, svgPath: 'assets/buildings/bench.svg', description: 'Сесть и отдохнуть', satisfies: 'energy', statValue: 40, isAvailableForVisit: true, maxUsageLimit: 1500, allowContinuousBuild: true },

    // Новые аттракционы
    { id: 'bumpers', name: 'Бамперные машинки', category: 'attraction', price: 900, income: 0.6, color: '#0ea5e9', icon: '🚗', width: 2, height: 2, svgPath: 'assets/buildings/bumpers.svg', description: 'Веселый таран на машинках', satisfies: 'fun', statValue: 35, isAvailableForVisit: true },
    { id: 'haunted', name: 'Дом с привидениями', category: 'attraction', price: 1400, income: 0.7, color: '#7c3aed', icon: '👻', width: 2, height: 2, svgPath: 'assets/buildings/haunted.svg', description: 'Щекочет нервы', satisfies: 'fun', statValue: 60, isAvailableForVisit: true },
    { id: 'waterride', name: 'Водная трасса', category: 'attraction', price: 2200, income: 1.1, color: '#0284c7', icon: '🌊', width: 3, height: 2, svgPath: 'assets/buildings/waterride.svg', description: 'Брызги и скорость', satisfies: 'fun', statValue: 70, isAvailableForVisit: true },
    { id: 'gokarts', name: 'Картинг', category: 'attraction', price: 1800, income: 0.9, color: '#f97316', icon: '🏎️', width: 3, height: 2, svgPath: 'assets/buildings/gokarts.svg', description: 'Гонки по треку', satisfies: 'fun', statValue: 55, isAvailableForVisit: true },

    // Новые магазины
    { id: 'taco', name: 'Тако', category: 'shop', price: 320, income: 1.1, color: '#facc15', icon: '🌮', width: 3, height: 2, svgPath: 'assets/buildings/taco.svg', description: 'Сытная лепешка', satisfies: 'satiety', statValue: 55, isAvailableForVisit: true },
    { id: 'donut', name: 'Пончики', category: 'shop', price: 250, income: 0.8, color: '#fb7185', icon: '🍩', width: 2, height: 2, svgPath: 'assets/buildings/donut.svg', description: 'Сладкая выпечка', satisfies: 'satiety', statValue: 30, isAvailableForVisit: true },
    { id: 'souvenir', name: 'Сувениры', category: 'shop', price: 450, income: 1.6, color: '#a78bfa', icon: '🛍️', width: 2, height: 2, svgPath: 'assets/buildings/souvenir.svg', description: 'Памятные штучки', satisfies: 'fun', statValue: 20, isAvailableForVisit: true },

    // Новый декор
    { id: 'statue', name: 'Статуя', category: 'decoration', price: 300, income: 0, color: '#9ca3af', icon: '🗿', width: 1, height: 1, svgPath: 'assets/buildings/statue.svg', description: 'Центр внимания', satisfies: 'fun', statValue: 8, isAvailableForVisit: false, allowContinuousBuild: true },
    { id: 'lamp', name: 'Фонарь', category: 'decoration', price: 120, income: 0, color: '#f59e0b', icon: '💡', width: 1, height: 1, svgPath: 'assets/buildings/lamp.svg', description: 'Светит по вечерам', satisfies: 'energy', statValue: 5, isAvailableForVisit: false, allowContinuousBuild: true },
    { id: 'flowerbed', name: 'Клумба', category: 'decoration', price: 90, income: 0, color: '#22c55e', icon: '🌸', width: 1, height: 1, svgPath: 'assets/buildings/flowerbed.svg', description: 'Яркие цветы', satisfies: 'fun', statValue: 6, isAvailableForVisit: false, allowContinuousBuild: true },

    // Уникальные здания за достижения
    { id: 'royalGarden', name: 'Королевский сад', category: 'decoration', price: 650, income: 0, color: '#34d399', icon: '🌺', width: 2, height: 2, svgPath: 'assets/buildings/royal-garden.svg', description: 'Элитная зона отдыха, которую можно получить только за достижения.', satisfies: 'fun', statValue: 20, isAvailableForVisit: false, hidden: true, allowContinuousBuild: true, unlockAchievementId: 'week_one' },
    { id: 'gourmetPlaza', name: 'Гурме-плаза', category: 'shop', price: 1200, income: 2.4, color: '#f97316', icon: '🍽️', width: 3, height: 2, svgPath: 'assets/buildings/gourmet-plaza.svg', description: 'Премиальная гастро-зона для самых голодных гостей.', satisfies: 'satiety', statValue: 95, isAvailableForVisit: true, hidden: true, unlockAchievementId: 'food_district' },
    { id: 'vipLounge', name: 'VIP-лаунж', category: 'service', price: 1600, income: 0.8, color: '#8b5cf6', icon: '🥂', width: 2, height: 2, svgPath: 'assets/buildings/vip-lounge.svg', description: 'Закрытая лаунж-зона, быстро восстанавливающая энергию гостей.', satisfies: 'energy', statValue: 85, isAvailableForVisit: true, hidden: true, unlockAchievementId: 'repair_brigade' },
    { id: 'megaCoaster', name: 'Мега-горки', category: 'attraction', price: 7200, income: 2.7, color: '#dc2626', icon: '🎢', width: 3, height: 3, svgPath: 'assets/buildings/mega-coaster.svg', description: 'Редкий аттракцион для настоящих фанатов адреналина.', satisfies: 'fun', statValue: 145, isAvailableForVisit: true, hidden: true, unlockAchievementId: 'builder_25' },
    { id: 'moonPalace', name: 'Лунный дворец', category: 'attraction', price: 12000, income: 3.8, color: '#a78bfa', icon: '🌙', width: 3, height: 3, svgPath: 'assets/buildings/moon-palace.svg', description: 'Легендарный аттракцион высокого класса с огромной прибылью.', satisfies: 'fun', statValue: 180, isAvailableForVisit: true, hidden: true, unlockAchievementId: 'capital_30000' },

    // Служебные элементы рельефа (не отображаются в магазине)
    { id: 'toilet', name: 'Туалет', category: 'shop', price: 100, income: 0.5, color: '#ffffff', icon: '🚽', width: 1, height: 1, svgPath: 'assets/buildings/toilet.svg', description: 'Место для важных дел', satisfies: 'toilet', statValue: 100, isAvailableForVisit: true, maxUsageLimit: 1300 },
    { id: 'mountain', name: 'Гора', category: 'decoration', price: 0, income: 0, color: '#6b7280', icon: '⛰️', width: 7, height: 7, svgPath: 'assets/buildings/mountain.svg', description: 'Высокая гора', satisfies: 'fun', statValue: 2, hidden: true, isAvailableForVisit: false, allowContinuousBuild: true },
    { id: 'pond', name: 'Пруд', category: 'decoration', price: 0, income: 0, color: '#38bdf8', icon: '🌊', width: 7, height: 7, svgPath: 'assets/buildings/pond.svg', description: 'Водная гладь', satisfies: 'fun', statValue: 3, hidden: true, isAvailableForVisit: false, allowContinuousBuild: true },

    // Служебные здания
    { id: 'parkMaintenance', name: 'Ремонтная мастерская', category: 'service', price: 500, income: 0, color: '#374151', icon: '🛠️', width: 2, height: 2, svgPath: 'assets/buildings/parkMaintenance.svg', description: 'Обслуживание парка', hidden: false, isAvailableForVisit: false },
];
