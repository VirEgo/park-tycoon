export type ToolType = 'none' | 'demolish' | 'path' | 'attraction' | 'shop' | 'decoration';

export interface BuildingType {
    id: string;
    name: string;
    category: ToolType;
    price: number;
    income: number;
    color: string;
    icon: string;
    size: number;
    description: string;
    allowedOnPath?: boolean;
    satisfies?: 'satiety' | 'hydration' | 'energy' | 'fun';
    statValue?: number;
    isGambling?: boolean;
}

export const BUILDINGS: BuildingType[] = [
    // Инфраструктура
    { id: 'path', name: 'Дорожка', category: 'path', price: 10, income: 0, color: '#9ca3af', icon: '', size: 1, description: 'По ней ходят гости' },
    { id: 'exit', name: 'Выход', category: 'path', price: 0, income: 0, color: '#ef4444', icon: '🚪', size: 1, description: 'Гости уходят здесь' },

    // Аттракционы
    { id: 'carousel', name: 'Карусель', category: 'attraction', price: 400, income: 1.5, color: '#fbbf24', icon: '🎠', size: 3, description: 'Классическое веселье', satisfies: 'fun', statValue: 30 },
    { id: 'ferris', name: 'Колесо', category: 'attraction', price: 1200, income: 0.4, color: '#f87171', icon: '🎡', size: 1, description: 'Вид на весь парк', satisfies: 'fun', statValue: 50 },
    { id: 'coaster', name: 'Горки', category: 'attraction', price: 3000, income: 1, color: '#ef4444', icon: '🎢', size: 1, description: 'Только для смелых', satisfies: 'fun', statValue: 80 },
    { id: 'castle', name: 'Замок', category: 'attraction', price: 5000, income: 2, color: '#c084fc', icon: '🏰', size: 1, description: 'Сказочный дворец', satisfies: 'fun', statValue: 100 },
    { id: 'slots', name: 'Автоматы', category: 'attraction', price: 600, income: 0.25, color: '#818cf8', icon: '🎰', size: 1, description: 'Испытай удачу (Ставка 0.25)', satisfies: 'fun', statValue: 15, isGambling: true },
    { id: 'shooting', name: 'Тир', category: 'attraction', price: 800, income: 0.5, color: '#4ade80', icon: '🎯', size: 1, description: 'Меткий глаз (Ставка 0.5)', satisfies: 'fun', statValue: 20, isGambling: true },

    // Магазины
    { id: 'burger', name: 'Бургеры', category: 'shop', price: 300, income: 1, color: '#f59e0b', icon: '🍔', size: 1, description: 'Вкусно и сытно', satisfies: 'satiety', statValue: 50 },
    { id: 'pizza', name: 'Пицца', category: 'shop', price: 350, income: 1.2, color: '#f59e0b', icon: '🍕', size: 1, description: 'Итальянская классика', satisfies: 'satiety', statValue: 60 },
    { id: 'icecream', name: 'Мороженое', category: 'shop', price: 200, income: 0.8, color: '#60a5fa', icon: '🍦', size: 1, description: 'Освежает', satisfies: 'fun', statValue: 10 },
    { id: 'popcorn', name: 'Попкорн', category: 'shop', price: 150, income: 0.6, color: '#fcd34d', icon: '🍿', size: 1, description: 'Легкий перекус', satisfies: 'satiety', statValue: 20 },
    { id: 'soda', name: 'Газировка', category: 'shop', price: 150, income: 0.5, color: '#ef4444', icon: '🥤', size: 1, description: 'Жажда нипочем', satisfies: 'hydration', statValue: 40 },
    { id: 'coffee', name: 'Кофе', category: 'shop', price: 180, income: 0.7, color: '#78350f', icon: '☕', size: 1, description: 'Бодрость (+Энергия)', satisfies: 'energy', statValue: 30 },
    { id: 'gifts', name: 'Сувениры', category: 'shop', price: 400, income: 1.5, color: '#ec4899', icon: '🎁', size: 1, description: 'Память о парке', satisfies: 'fun', statValue: 25 },
    { id: 'balloons', name: 'Шарики', category: 'shop', price: 100, income: 0.3, color: '#ef4444', icon: '🎈', size: 1, description: 'Радость детям', satisfies: 'fun', statValue: 15 },

    // Декор
    { id: 'fountain', name: 'Фонтан', category: 'decoration', price: 400, income: 0, color: '#3b82f6', icon: '⛲', size: 1, description: 'Красота спасет мир', satisfies: 'fun', statValue: 5 },
    { id: 'tree', name: 'Дерево', category: 'decoration', price: 50, income: 0, color: '#166534', icon: '🌳', size: 1, description: 'Природа', allowedOnPath: false },
    { id: 'bench', name: 'Скамейка', category: 'decoration', price: 50, income: 0, color: '#8B4513', icon: '🪑', size: 1, description: 'Отдых (+Энергия)', satisfies: 'energy', statValue: 40 },
];
