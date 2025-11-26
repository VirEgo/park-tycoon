import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Guest } from '../../models/guest.model';

@Component({
  selector: 'app-skins-gallery',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gray-900 text-white p-8 flex flex-col">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-yellow-400">Галерея скинов</h1>
        <a routerLink="/"
           class="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors border border-gray-600 font-bold">
          ← Назад в парк
        </a>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
        <div *ngFor="let skin of skins"
             class="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col items-center hover:border-yellow-500/50 transition-all hover:scale-105 shadow-lg">

          <div class="w-24 h-24 bg-gray-700/50 rounded-lg p-2 mb-3 flex items-center justify-center">
             <img [src]="skin.svg" class="w-full h-full object-contain" alt="{{ skin.name }}" />
          </div>

          <div class="text-center">
            <div class="font-mono text-sm text-gray-300 mb-1">{{ skin.name }}</div>
            <div class="text-xs text-gray-500">{{ skin.key }}</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class SkinsGalleryComponent {
  get skins() {
    return Object.entries(Guest.SKINS).map(([key, svg]) => ({
      key,
      svg,
      name: this.formatName(key)
    }));
  }

  private formatName(key: string): string {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
