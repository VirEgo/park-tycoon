import { Injectable } from '@angular/core';
import { Guest } from '../../models/guest.model'; // Импорт модели, где лежат цены

export interface SkinTransactionResult {
  success: boolean;
  cost?: number;
  message: string;
  updatedOwnedList?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class PremiumSkinsService {
  private readonly STORAGE_KEY = 'park-tycoon-skins-v1';
  private ownedSkins: Set<string> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  buySkin(skinId: string, currentMoney: number): SkinTransactionResult {
    const price = Guest.PremiumSkins[skinId];
    if (price === undefined) {
      return { success: false, message: 'Скин не найден в каталоге.' };
    }

    if (this.ownedSkins.has(skinId)) {
      return { success: false, message: 'Этот скин у вас уже есть.' };
    }

    if (currentMoney < price) {
      return { success: false, message: `Недостаточно денег. Цена: $${price}` };
    }

    this.ownedSkins.add(skinId);
    this.saveToStorage();

    return {
      success: true,
      cost: price,
      message: `Скин успешно куплен за $${price}!`,
      updatedOwnedList: Array.from(this.ownedSkins)
    };
  }


  isOwned(skinId: string): boolean {
    return this.ownedSkins.has(skinId);
  }

  getOwnedSkins(): string[] {
    return Array.from(this.ownedSkins);
  }

  getPrice(skinId: string): number {
    return Guest.PremiumSkins[skinId] || 0;
  }

  // Private storage methods 
  private saveToStorage(): void {
    try {
      const data = Array.from(this.ownedSkins);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save skins:', e);
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.ownedSkins = new Set(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load skins:', e);
      this.ownedSkins = new Set();
    }
  }
 
  reset(): void {
    this.ownedSkins.clear();
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
