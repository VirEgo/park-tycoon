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
  template: `
    <div class="min-h-screen bg-gray-900 text-white p-8 flex flex-col">
      <div *ngIf="notification() as notice"
           class="fixed right-6 top-6 z-50 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur"
           [class.border-emerald-500]="notice.kind === 'success'"
           [class.bg-emerald-950]="notice.kind === 'success'"
           [class.border-rose-500]="notice.kind === 'error'"
           [class.bg-rose-950]="notice.kind === 'error'"
           [class.border-sky-500]="notice.kind === 'info'"
           [class.bg-sky-950]="notice.kind === 'info'">
        <div class="text-sm font-semibold">{{ notice.message }}</div>
      </div>

      <div class="flex flex-col gap-4 mb-8 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-4">
            <h1 class="text-3xl font-bold text-yellow-400">Галерея скинов</h1>
            <div class="bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
              <span class="text-green-400 font-mono font-bold">\${{ money() }}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-3 text-sm">
            <div class="bg-gray-800 px-3 py-2 rounded-lg border border-gray-700">
              Куплено: <span class="font-bold text-emerald-400">{{ ownedCount() }}</span>
            </div>
            <div class="bg-gray-800 px-3 py-2 rounded-lg border border-gray-700">
              Активно: <span class="font-bold text-yellow-300">{{ enabledCount() }}</span>
            </div>
            <div class="bg-gray-800 px-3 py-2 rounded-lg border border-gray-700 text-gray-300">
              Включённые скины участвуют в выборе внешности новых гостей
            </div>
          </div>
        </div>
        <a routerLink="/"
           class="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors border border-gray-600 font-bold">
          ← Назад в парк
        </a>
      </div>

      <div class="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div class="rounded-2xl border border-gray-700 bg-gray-800/70 p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <div class="text-sm uppercase tracking-[0.2em] text-gray-400">Фильтр каталога</div>
              <div class="text-lg font-semibold text-white">Показывать нужные скины быстрее</div>
            </div>
            <div class="text-xs text-gray-400">Всего: {{ filteredPaidSkins().length }}</div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button"
                    (click)="setFilter('all')"
                    class="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                    [class.border-yellow-400]="isFilterActive('all')"
                    [class.bg-yellow-400]="isFilterActive('all')"
                    [class.text-gray-950]="isFilterActive('all')"
                    [class.border-gray-600]="!isFilterActive('all')"
                    [class.text-gray-300]="!isFilterActive('all')">
              Все
            </button>
            <button type="button"
                    (click)="setFilter('owned')"
                    class="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                    [class.border-emerald-400]="isFilterActive('owned')"
                    [class.bg-emerald-400]="isFilterActive('owned')"
                    [class.text-gray-950]="isFilterActive('owned')"
                    [class.border-gray-600]="!isFilterActive('owned')"
                    [class.text-gray-300]="!isFilterActive('owned')">
              Купленные
            </button>
            <button type="button"
                    (click)="setFilter('active')"
                    class="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                    [class.border-sky-400]="isFilterActive('active')"
                    [class.bg-sky-400]="isFilterActive('active')"
                    [class.text-gray-950]="isFilterActive('active')"
                    [class.border-gray-600]="!isFilterActive('active')"
                    [class.text-gray-300]="!isFilterActive('active')">
              Активные
            </button>
          </div>
        </div>

        <div class="rounded-2xl border border-gray-700 bg-gray-800/70 p-4">
          <div class="mb-3 text-sm uppercase tracking-[0.2em] text-gray-400">Пул новых гостей</div>
          <div class="mb-3 text-lg font-semibold text-white">Скины, которые сейчас могут выпадать</div>
          <div *ngIf="activePoolSkins().length > 0; else noActiveSkins" class="grid grid-cols-3 gap-3">
            <div *ngFor="let skin of activePoolSkins()"
                 class="rounded-xl border border-yellow-500/30 bg-gray-900/60 p-2 text-center">
              <div class="mb-2 flex h-16 items-center justify-center rounded-lg bg-gray-800/80 p-2">
                <img [src]="skin.svg" class="h-full w-full object-contain" alt="{{ skin.name }}" />
              </div>
              <div class="text-xs font-medium text-yellow-100">{{ skin.name }}</div>
            </div>
          </div>
          <ng-template #noActiveSkins>
            <div class="rounded-xl border border-dashed border-gray-600 bg-gray-900/40 px-4 py-6 text-sm text-gray-400">
              Сейчас нет активных скинов для новых гостей.
            </div>
          </ng-template>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
        <!-- Free Skins -->
        <div *ngFor="let skin of skins"
             class="bg-gray-800 border rounded-xl p-4 flex flex-col items-center transition-all shadow-lg"
             [class.border-yellow-400]="isEnabled(skin.key)"
             [class.ring-2]="isEnabled(skin.key)"
             [class.ring-yellow-400]="isEnabled(skin.key)"
             [class.border-blue-500]="!isEnabled(skin.key)">
          <div class="w-24 h-24 bg-gray-700/50 rounded-lg p-2 mb-3 flex items-center justify-center">
             <img [src]="skin.svg" class="w-full h-full object-contain" alt="{{ skin.name }}" />
          </div>
          <div class="text-center w-full">
            <div class="font-mono text-sm text-gray-300 mb-1">{{ skin.name }}</div>
            <div class="text-xs mb-3"
                 [class.text-yellow-200]="isEnabled(skin.key)"
                 [class.text-blue-300]="!isEnabled(skin.key)">
              {{ getSkinStateLabel(skin.key) }}
            </div>
            <div class="flex items-center justify-between gap-3 mt-2 px-3 py-2 border rounded-lg"
                 [class.border-yellow-500]="isEnabled(skin.key)"
                 [class.bg-yellow-500]="isEnabled(skin.key)"
                 [class.border-blue-500]="!isEnabled(skin.key)"
                 [class.bg-blue-500]="!isEnabled(skin.key)">
              <div class="text-left">
                <div class="text-sm font-semibold"
                     [class.text-yellow-200]="isEnabled(skin.key)"
                     [class.text-blue-300]="!isEnabled(skin.key)">
                  {{ isEnabled(skin.key) ? 'Используется' : 'Выключен' }}
                </div>
              </div>

              <button type="button"
                      (click)="toggleSkin(skin.key)"
                      class="relative inline-flex h-7 w-14 items-center rounded-full border transition-colors"
                      [class.bg-yellow-400]="isEnabled(skin.key)"
                      [class.border-yellow-300]="isEnabled(skin.key)"
                      [class.bg-gray-700]="!isEnabled(skin.key)"
                      [class.border-gray-500]="!isEnabled(skin.key)"
                      [attr.aria-pressed]="isEnabled(skin.key)"
                      [attr.aria-label]="isEnabled(skin.key) ? 'Выключить скин' : 'Включить скин'">
                <span class="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                      [class.translate-x-7]="isEnabled(skin.key)"
                      [class.translate-x-1]="!isEnabled(skin.key)"></span>
              </button>
            </div>
          </div>
        </div>

        <!-- Premium Skins -->
        <div *ngFor="let skin of filteredPaidSkins()"
             class="bg-gray-800 border rounded-xl p-4 flex flex-col items-center transition-all shadow-lg"
             [class.border-gray-700]="!isOwned(skin.key) && !isEnabled(skin.key)"
             [class.border-emerald-500]="isOwned(skin.key) && !isEnabled(skin.key)"
             [class.border-yellow-400]="isEnabled(skin.key)"
             [class.ring-2]="isEnabled(skin.key)"
             [class.ring-yellow-400]="isEnabled(skin.key)">

          <div class="w-24 h-24 bg-gray-700/50 rounded-lg p-2 mb-3 flex items-center justify-center relative">
             <img [src]="skin.svg" class="w-full h-full object-contain" alt="{{ skin.name }}" />
             <div class="absolute left-2 top-2 flex flex-col gap-1">
               <span *ngIf="isOwned(skin.key)"
                     class="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                 Куплен
               </span>
               <span *ngIf="isEnabled(skin.key)"
                     class="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-200 border border-yellow-500/30">
                 Активен
               </span>
             </div>
          </div>

          <div class="text-center w-full">
            <div class="font-mono text-sm text-gray-300 mb-1">{{ skin.name }}</div>
            <div class="text-xs mb-3"
                 [class.text-yellow-200]="isEnabled(skin.key)"
                 [class.text-emerald-300]="isOwned(skin.key) && !isEnabled(skin.key)"
                 [class.text-gray-400]="!isOwned(skin.key)">
              {{ getSkinStateLabel(skin.key) }}
            </div>
            
            <button *ngIf="!isOwned(skin.key)" 
                    (click)="buy(skin.key)"
                    [disabled]="money() < skin.cost"
                    [class.opacity-50]="money() < skin.cost"
                    class="w-full px-4 py-2 rounded bg-green-700 hover:bg-green-600 font-medium text-sm transition-colors border border-green-600 flex items-center justify-center gap-2 mt-2">
              Купить: \${{ skin.cost }}
            </button>

            <div *ngIf="isOwned(skin.key)" class="flex items-center justify-between gap-3 mt-2 px-3 py-2 border rounded-lg"
                 [class.border-yellow-500]="isEnabled(skin.key)"
                 [class.bg-yellow-500]="isEnabled(skin.key)"
                 [class.border-emerald-500]="!isEnabled(skin.key)"
                 [class.bg-emerald-500]="!isEnabled(skin.key)">
              <div class="text-left">
                <div class="text-sm font-semibold" [class.text-yellow-200]="isEnabled(skin.key)" [class.text-emerald-300]="!isEnabled(skin.key)">
                  {{ isEnabled(skin.key) ? 'Используется' : 'Выключен' }}
                </div>
                <div class="text-[11px] text-gray-400">Добавлять в пул новых гостей</div>
              </div>

              <button type="button"
                      (click)="toggleSkin(skin.key)"
                      class="relative inline-flex h-7 w-14 items-center rounded-full border transition-colors"
                      [class.bg-yellow-400]="isEnabled(skin.key)"
                      [class.border-yellow-300]="isEnabled(skin.key)"
                      [class.bg-gray-700]="!isEnabled(skin.key)"
                      [class.border-gray-500]="!isEnabled(skin.key)"
                      [attr.aria-pressed]="isEnabled(skin.key)"
                      [attr.aria-label]="isEnabled(skin.key) ? 'Выключить скин' : 'Включить скин'">
                <span class="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                      [class.translate-x-7]="isEnabled(skin.key)"
                      [class.translate-x-1]="!isEnabled(skin.key)"></span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="filteredPaidSkins().length === 0"
           class="mt-6 rounded-2xl border border-dashed border-gray-600 bg-gray-800/40 px-6 py-8 text-center text-gray-400">
        По текущему фильтру скинов не найдено.
      </div>
    </div>
  `,
  styles: []
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
