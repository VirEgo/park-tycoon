import { Component, inject, OnInit } from '@angular/core';
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
      <div class="flex justify-between items-center mb-8">
        <div class="flex items-center gap-4">
          <h1 class="text-3xl font-bold text-yellow-400">Галерея скинов</h1>
          <div class="bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
            <span class="text-green-400 font-mono font-bold">\${{ money() }}</span>
          </div>
        </div>
        <a routerLink="/"
           class="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors border border-gray-600 font-bold">
          ← Назад в парк
        </a>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
        <!-- Free Skins -->
        <div *ngFor="let skin of skins"
             class="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col items-center hover:border-blue-500/50 transition-all hover:scale-105 shadow-lg">
          <div class="w-24 h-24 bg-gray-700/50 rounded-lg p-2 mb-3 flex items-center justify-center">
             <img [src]="skin.svg" class="w-full h-full object-contain" alt="{{ skin.name }}" />
          </div>
          <div class="text-center">
            <div class="font-mono text-sm text-gray-300 mb-1">{{ skin.name }}</div>
            <span class="text-xs text-blue-400 bg-blue-400/10 px-2 py-1 rounded">Бесплатно</span>
          </div>
        </div>

        <!-- Premium Skins -->
        <div *ngFor="let skin of getPaidSkins"
             class="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col items-center transition-all shadow-lg"
             [class.hover:border-yellow-500]="!isOwned(skin.key)"
             [class.hover:scale-105]="!isOwned(skin.key)"
             [class.opacity-75]="isOwned(skin.key)">

          <div class="w-24 h-24 bg-gray-700/50 rounded-lg p-2 mb-3 flex items-center justify-center relative">
             <img [src]="skin.svg" class="w-full h-full object-contain" alt="{{ skin.name }}" />
             <div *ngIf="isOwned(skin.key)" class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
               <span class="text-2xl">✅</span>
             </div>
          </div>

          <div class="text-center w-full">
            <div class="font-mono text-sm text-gray-300 mb-1">{{ skin.name }}</div>
            
            <button *ngIf="!isOwned(skin.key)" 
                    (click)="buy(skin.key)"
                    [disabled]="money() < skin.cost"
                    [class.opacity-50]="money() < skin.cost"
                    class="w-full px-4 py-2 rounded bg-green-700 hover:bg-green-600 font-medium text-sm transition-colors border border-green-600 flex items-center justify-center gap-2 mt-2">
              Купить: \${{ skin.cost }}
            </button>

            <div *ngIf="isOwned(skin.key)" class="mt-2 text-green-400 font-bold text-sm py-2 border border-green-900/50 bg-green-900/20 rounded">
              Куплено
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class SkinsGalleryComponent implements OnInit {
  private premiumSkinsService = inject(PremiumSkinsService);
  private gameStateService = inject(GameStateService);

  money = this.gameStateService.money;

  ngOnInit() {
    this.gameStateService.loadGame();
  }

  get skins(): Array<{ key: string; svg: string; name: string }> {
    return Object.entries(Guest.SKINS).map(([key, svg]) => ({
      key,
      svg,
      name: this.formatName(key)
    }));
  }

  get getPaidSkins(): Array<{ key: string; svg: string; name: string; cost: number }> {
    return Object.entries(Guest.PremiumSkins).map(([key, cost]) => {
      return ({
        key,
        svg: `assets/guests/paid/${key}.svg`,
        name: this.formatName(key),
        cost
      });
    });
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

  buy(skinKey: string) {
    const result = this.premiumSkinsService.buySkin(skinKey, this.money());

    if (result.success && result.cost) {
      this.gameStateService.deductMoney(result.cost);
      // Optional: Show notification
      alert(result.message);
    } else {
      alert(result.message);
    }
  }
}
