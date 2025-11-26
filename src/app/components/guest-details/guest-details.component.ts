import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Guest } from '../../models/guest.model';

@Component({
    selector: 'app-guest-details',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="absolute bottom-20 right-6 w-64 bg-gray-800/95 backdrop-blur border border-yellow-500/50 rounded-lg shadow-2xl p-4 z-30 animate-pop-in">
      <div class="flex justify-between items-start mb-4">
        <div class="flex items-center gap-3">
          <div class="text-4xl bg-gray-700 rounded-lg p-1 w-12 h-12 flex items-center justify-center">
            <img [src]="guestImageSrc()" class="w-full h-full object-contain" alt="Guest Skin">
          </div>
          <div>
            <div class="font-bold text-yellow-400">Гость #{{guest().id}}</div>
            <div class="text-xs text-gray-400 uppercase">{{guest().state}}</div>
          </div>
        </div>
        <button (click)="close.emit()" class="text-gray-400 hover:text-white">✕</button>
      </div>

      <div class="space-y-2 text-xs">
        <div class="flex justify-between items-center bg-gray-700/50 p-2 rounded">
          <span class="text-gray-300">Бюджет</span>
          <span class="text-green-400 font-bold text-lg">{{guest().money | currency:"USD"}}</span>
        </div>

        <div class="space-y-1">
          <div class="flex justify-between">
            <span>Счастье</span>
            <span [class.text-red-400]="guest().happiness < 30"
              [class.text-green-400]="guest().happiness > 70">{{guest().happiness | number:'1.0-0'}}%</span>
          </div>
          <div class="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full bg-yellow-500 transition-all duration-500" [style.width.%]="guest().happiness"></div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 pt-2">
          <div>
            <div class="flex justify-between text-[10px] text-gray-400">
              <span>Сытость</span>
              <span>{{guest().satiety | number:'1.0-0'}}</span>
            </div>
            <div class="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-orange-500" [style.width.%]="guest().satiety"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-[10px] text-gray-400">
              <span>Жажда</span>
              <span>{{guest().hydration | number:'1.0-0'}}</span>
            </div>
            <div class="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-blue-500" [style.width.%]="guest().hydration"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-[10px] text-gray-400">
              <span>Энергия</span>
              <span>{{guest().energy | number:'1.0-0'}}</span>
            </div>
            <div class="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-green-500" [style.width.%]="guest().energy"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-[10px] text-gray-400">
              <span>Веселье</span>
              <span>{{guest().fun | number:'1.0-0'}}</span>
            </div>
            <div class="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-purple-500" [style.width.%]="guest().fun"></div>
            </div>
          </div>
          <!-- New Toilet Stat -->
          <div>
            <div class="flex justify-between text-[10px] text-gray-400">
              <span>Туалет</span>
              <span>{{guest().toilet | number:'1.0-0'}}</span>
            </div>
            <div class="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-cyan-500" [style.width.%]="guest().toilet"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class GuestDetailsComponent {
    guest = input.required<Guest>();
    guestImageSrc = input.required<string>();
    close = output<void>();
}
