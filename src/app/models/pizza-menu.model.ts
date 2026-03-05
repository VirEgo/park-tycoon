export type PizzaRecipeId = 'margherita' | 'pepperoni' | 'hawaiian' | 'bbq' | 'seafood';

export interface PizzaRecipeDefinition {
    id: PizzaRecipeId;
    name: string;
    unlockLevel: number;
    satiety: number;
    defaultPrice: number;
    icon: string;
}

export interface PizzaMenuData {
    prices: Record<PizzaRecipeId, number>;
}

export const PIZZA_MIN_PRICE = 0.1;
export const PIZZA_MAX_PRICE = 9.9;
export const PIZZA_PRICE_STEP = 0.1;

export const PIZZA_RECIPES: ReadonlyArray<PizzaRecipeDefinition> = [
    { id: 'margherita', name: 'Маргарита', unlockLevel: 1, satiety: 38, defaultPrice: 1.0, icon: '🍕' },
    { id: 'pepperoni', name: 'Пепперони', unlockLevel: 2, satiety: 52, defaultPrice: 1.4, icon: '🌶️' },
    { id: 'hawaiian', name: 'Гавайская', unlockLevel: 3, satiety: 60, defaultPrice: 1.7, icon: '🍍' },
    { id: 'bbq', name: 'BBQ', unlockLevel: 4, satiety: 72, defaultPrice: 2.1, icon: '🔥' },
    { id: 'seafood', name: 'Морская', unlockLevel: 5, satiety: 85, defaultPrice: 2.6, icon: '🦐' }
];

export function createDefaultPizzaMenuData(): PizzaMenuData {
    const prices = {} as Record<PizzaRecipeId, number>;

    for (const recipe of PIZZA_RECIPES) {
        prices[recipe.id] = recipe.defaultPrice;
    }

    return { prices };
}

export function getUnlockedPizzaRecipes(level: number): PizzaRecipeDefinition[] {
    return PIZZA_RECIPES.filter(recipe => recipe.unlockLevel <= level);
}

export function readPizzaMenuData(value: unknown): PizzaMenuData {
    const defaults = createDefaultPizzaMenuData();
    const prices = { ...defaults.prices };

    if (!value || typeof value !== 'object') {
        return { prices };
    }

    const record = value as { prices?: Record<string, unknown> };
    if (!record.prices || typeof record.prices !== 'object') {
        return { prices };
    }

    for (const recipe of PIZZA_RECIPES) {
        const candidate = record.prices[recipe.id];
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
            prices[recipe.id] = clampPizzaPrice(candidate);
        }
    }

    return { prices };
}

export function clampPizzaPrice(value: number): number {
    const bounded = Math.min(PIZZA_MAX_PRICE, Math.max(PIZZA_MIN_PRICE, value));
    return Math.round(bounded * 100) / 100;
}
