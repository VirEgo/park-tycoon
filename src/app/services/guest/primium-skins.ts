import { Injectable } from '@angular/core';
import { Guest } from '../../models/guest.model'; // Импорт модели, где лежат цены

export interface SkinTransactionResult {
  success: boolean;
  cost?: number;
  message: string;
  updatedOwnedList?: string[];
  updatedEnabledList?: string[];
  enabled?: boolean;
}

export interface PremiumSkinStorageData {
  ownedSkins: string[];
  enabledSkins: string[];
}

@Injectable({
  providedIn: 'root'
})
export class PremiumSkinsService {
  private readonly STORAGE_KEY = 'park-tycoon-skins-v1';
  private ownedSkins: Set<string> = new Set();
  private enabledSkins: Set<string> = new Set();

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
    this.enabledSkins.add(skinId);
    this.saveToStorage();

    return {
      success: true,
      cost: price,
      message: `Скин успешно куплен за $${price}!`,
      updatedOwnedList: Array.from(this.ownedSkins),
      updatedEnabledList: Array.from(this.enabledSkins),
      enabled: true
    };
  }

  toggleSkin(skinId: string): SkinTransactionResult {
    if (!this.isAvailable(skinId)) {
      return { success: false, message: 'Скин недоступен.' };
    }

    const isEnabled = this.enabledSkins.has(skinId);

    if (isEnabled && this.getEnabledSkins().length <= 1) {
      return { success: false, message: 'Нельзя выключить последний активный скин.' };
    }

    if (isEnabled) {
      this.enabledSkins.delete(skinId);
    } else {
      this.enabledSkins.add(skinId);
    }

    this.saveToStorage();

    return {
      success: true,
      message: isEnabled ? 'Скин выключен.' : 'Скин включён.',
      updatedOwnedList: Array.from(this.ownedSkins),
      updatedEnabledList: Array.from(this.enabledSkins),
      enabled: !isEnabled
    };
  }

  isOwned(skinId: string): boolean {
    return this.ownedSkins.has(skinId);
  }

  isAvailable(skinId: string): boolean {
    return this.isStandardSkin(skinId) || this.ownedSkins.has(skinId);
  }

  isEnabled(skinId: string): boolean {
    return this.isAvailable(skinId) && this.enabledSkins.has(skinId);
  }

  getAvailableSkins(): string[] {
    return [...this.getStandardGuestSkins(), ...Array.from(this.ownedSkins)];
  }

  getOwnedSkins(): string[] {
    return Array.from(this.ownedSkins);
  }

  getEnabledSkins(): string[] {
    return this.getAvailableSkins().filter((skinId) => this.enabledSkins.has(skinId));
  }

  getPrice(skinId: string): number {
    return Guest.PremiumSkins[skinId] || 0;
  }

  exportState(): PremiumSkinStorageData {
    return {
      ownedSkins: Array.from(this.ownedSkins),
      enabledSkins: Array.from(this.enabledSkins)
    };
  }

  importState(state: PremiumSkinStorageData | null | undefined) {
    if (!state) {
      this.ownedSkins.clear();
      this.enabledSkins = new Set(this.getDefaultEnabledSkins([]));
      this.saveToStorage();
      return;
    }

    this.ownedSkins = new Set(Array.isArray(state.ownedSkins) ? state.ownedSkins : []);
    this.enabledSkins = new Set(
      Array.isArray(state.enabledSkins) && state.enabledSkins.length > 0
        ? state.enabledSkins.filter((skinId) => this.isStandardSkin(skinId) || this.ownedSkins.has(skinId))
        : this.getDefaultEnabledSkins(Array.from(this.ownedSkins))
    );
    this.ensureAtLeastOneEnabled();
    this.saveToStorage();
  }

  grantSkin(skinId: string): SkinTransactionResult {
    if (!(skinId in Guest.PremiumSkins)) {
      return { success: false, message: 'Неизвестный премиум-скин.' };
    }

    if (this.ownedSkins.has(skinId)) {
      return {
        success: false,
        message: 'Скин уже открыт.',
        updatedOwnedList: Array.from(this.ownedSkins),
        updatedEnabledList: Array.from(this.enabledSkins)
      };
    }

    this.ownedSkins.add(skinId);
    this.enabledSkins.add(skinId);
    this.saveToStorage();

    return {
      success: true,
      message: `Скин "${skinId}" открыт как награда!`,
      updatedOwnedList: Array.from(this.ownedSkins),
      updatedEnabledList: Array.from(this.enabledSkins),
      enabled: true
    };
  }

  // Private storage methods 
  private saveToStorage(): void {
    try {
      const data = this.exportState();
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
          this.enabledSkins = new Set(this.getDefaultEnabledSkins(Array.from(this.ownedSkins)));
        } else if (parsed && Array.isArray(parsed.ownedSkins)) {
          this.ownedSkins = new Set(parsed.ownedSkins);
          this.enabledSkins = new Set(
            Array.isArray(parsed.enabledSkins)
              ? parsed.enabledSkins.filter((skinId: string) => this.isStandardSkin(skinId) || this.ownedSkins.has(skinId))
              : this.getDefaultEnabledSkins(parsed.ownedSkins)
          );
        }
      } else {
        this.enabledSkins = new Set(this.getDefaultEnabledSkins([]));
      }

      this.ensureAtLeastOneEnabled();
    } catch (e) {
      console.error('Failed to load skins:', e);
      this.ownedSkins = new Set();
      this.enabledSkins = new Set(this.getDefaultEnabledSkins([]));
    }
  }
 
  reset(): void {
    this.ownedSkins.clear();
    this.enabledSkins = new Set(this.getDefaultEnabledSkins([]));
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private getDefaultEnabledSkins(ownedPremiumSkins: string[]): string[] {
    return [...this.getStandardGuestSkins(), ...ownedPremiumSkins];
  }

  private getStandardGuestSkins(): string[] {
    return Object.keys(Guest.SKINS).filter((skinId) => !Guest.WORKER_SKIN_KEYS.includes(skinId));
  }

  private isStandardSkin(skinId: string): boolean {
    return this.getStandardGuestSkins().includes(skinId);
  }

  private ensureAtLeastOneEnabled(): void {
    if (this.getEnabledSkins().length > 0) {
      return;
    }

    const fallbackSkin = this.getAvailableSkins()[0];
    if (fallbackSkin) {
      this.enabledSkins.add(fallbackSkin);
    }
  }
}
