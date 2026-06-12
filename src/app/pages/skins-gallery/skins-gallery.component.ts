import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Guest } from '../../models/guest.model';
import { PremiumSkinsService } from '../../services/guest/primium-skins';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-skins-gallery',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './skins-gallery.component.html',
  styleUrl: './skins-gallery.component.scss'
})
export class SkinsGalleryComponent implements OnInit {
  private premiumSkinsService = inject(PremiumSkinsService);
  private gameStateService = inject(GameStateService);
  private notificationTimeoutId: ReturnType<typeof setTimeout> | null = null;

  money = this.gameStateService.money;
  filter = signal<'all' | 'owned' | 'active'>('all');
  notification = signal<{ message: string; kind: 'success' | 'error' | 'info' } | null>(null);

  get skins(): Array<{ key: string; svg: string; name: string }> {
    return Object.entries(Guest.SKINS)
      .filter(([key]) => !Guest.WORKER_SKIN_KEYS.includes(key))
      .map(([key, svg]) => ({
        key,
        svg,
        name: this.formatName(key)
      }))
      .sort((a, b) => Number(this.isEnabled(b.key)) - Number(this.isEnabled(a.key)));
  }

  private getAllPaidSkins(): Array<{ key: string; svg: string; name: string; cost: number }> {
    return Object.entries(Guest.PremiumSkins)
      .map(([key, cost]) => ({
        key,
        svg: `assets/guests/paid/${key}.svg`,
        name: this.formatName(key),
        cost
      }))
      .sort((a, b) => {
        const aEnabled = this.isEnabled(a.key) ? 1 : 0;
        const bEnabled = this.isEnabled(b.key) ? 1 : 0;
        const aOwned = this.isOwned(a.key) ? 1 : 0;
        const bOwned = this.isOwned(b.key) ? 1 : 0;

        if (aEnabled !== bEnabled) {
          return bEnabled - aEnabled;
        }

        if (aOwned !== bOwned) {
          return bOwned - aOwned;
        }

        return a.cost - b.cost;
      });
  }

  filteredFreeSkins = computed(() => {
    const filter = this.filter();
    const freeSkins = this.skins;

    if (filter === 'owned') {
      return freeSkins.filter((skin) => this.isOwned(skin.key));
    }

    if (filter === 'active') {
      return freeSkins.filter((skin) => this.isEnabled(skin.key));
    }

    return freeSkins;
  });

  filteredPaidSkins = computed(() => {
    const filter = this.filter();
    const skins = this.getAllPaidSkins();

    if (filter === 'owned') {
      return skins.filter((skin) => this.isOwned(skin.key));
    }

    if (filter === 'active') {
      return skins.filter((skin) => this.isEnabled(skin.key));
    }

    return skins;
  });

  activePoolSkins = computed(() =>
    this.premiumSkinsService.getEnabledSkins().map((skinId) => ({
      key: skinId,
      svg: Guest.SKINS[skinId] ?? `assets/guests/paid/${skinId}.svg`,
      name: this.formatName(skinId)
    }))
  );

  ngOnInit() {
    this.gameStateService.loadGame();
  }

  private formatName(key: string): string {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  isOwned(skinKey: string): boolean {
    return this.premiumSkinsService.isOwned(skinKey);
  }

  isEnabled(skinKey: string): boolean {
    return this.premiumSkinsService.isEnabled(skinKey);
  }

  ownedCount(): number {
    return this.premiumSkinsService.getOwnedSkins().length;
  }

  enabledCount(): number {
    return this.premiumSkinsService.getEnabledSkins().length;
  }

  enableAllSkins() {
    const result = this.premiumSkinsService.enableAllSkins();
    this.persistGalleryState();
    this.showNotification(result.message, 'success');
  }

  disableAllSkins() {
    const result = this.premiumSkinsService.disableAllSkins();
    this.persistGalleryState();
    this.showNotification(result.message, 'info');
  }

  allEnabled(): boolean {
    const allAvailable = this.premiumSkinsService.getAvailableSkins();
    return allAvailable.every(skinId => this.isEnabled(skinId));
  }

  allDisabled(): boolean {
    const allAvailable = this.premiumSkinsService.getAvailableSkins();
    const enabledCount = allAvailable.filter(skinId => this.isEnabled(skinId)).length;
    return enabledCount <= 1;
  }

  setFilter(filter: 'all' | 'owned' | 'active') {
    this.filter.set(filter);
  }

  isFilterActive(filter: 'all' | 'owned' | 'active'): boolean {
    return this.filter() === filter;
  }

  getSkinStateLabel(skinKey: string): string {
    if (this.isEnabled(skinKey)) {
      return Guest.PremiumSkins[skinKey] ? 'Куплен и активен' : 'Бесплатный и активен';
    }

    if (this.isOwned(skinKey)) {
      return 'Куплен, но выключен';
    }

    return 'Бесплатный, но выключен';
  }

  buy(skinKey: string) {
    const result = this.premiumSkinsService.buySkin(skinKey, this.money());

    if (result.success && result.cost) {
      this.gameStateService.deductMoney(result.cost);
      this.persistGalleryState();
      this.showNotification(result.message, 'success');
    } else {
      this.showNotification(result.message, 'error');
    }
  }

  toggleSkin(skinKey: string) {
    const result = this.premiumSkinsService.toggleSkin(skinKey);
    if (result.success) {
      this.persistGalleryState();
    }
    this.showNotification(result.message, result.success ? 'info' : 'error');
  }

  private persistGalleryState() {
    this.gameStateService.patchSave({
      money: this.money(),
      premiumSkinsOwned: this.premiumSkinsService.getOwnedSkins(),
      premiumSkinState: this.premiumSkinsService.exportState()
    });
  }

  private showNotification(message: string, kind: 'success' | 'error' | 'info') {
    this.notification.set({ message, kind });

    if (this.notificationTimeoutId) {
      clearTimeout(this.notificationTimeoutId);
    }

    this.notificationTimeoutId = setTimeout(() => {
      this.notification.set(null);
      this.notificationTimeoutId = null;
    }, 2400);
  }
}
