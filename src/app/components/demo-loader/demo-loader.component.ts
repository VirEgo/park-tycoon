import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'app-demo-loader',
    standalone: true,
    template: `
    <div class="demo-loader">
      <button (click)="loadDemo()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        Загрузить демо-парк
      </button>
      <p class="text-sm text-gray-600 mt-2">Готовый парк с аттракционами, магазинами и гостями</p>
    </div>
  `,
    styles: [`
    .demo-loader {
      padding: 1rem;
      text-align: center;
    }
  `]
})
export class DemoLoaderComponent implements OnInit {
    ngOnInit() { }

    loadDemo() {
        const demoSave = this.createDemoSave();
        localStorage.setItem('angular-park-save-v1', JSON.stringify(demoSave));
        window.location.reload();
    }

    private createDemoSave() {
        // Создаем сетку
        const grid = [];
        for (let y = 0; y < 15; y++) {
            for (let x = 0; x < 20; x++) {
                grid.push({ x, y, type: 'grass' as const });
            }
        }

        // Главная дорожка (вертикальная по центру)
        for (let y = 0; y < 15; y++) {
            const idx = y * 20 + 10;
            grid[idx] = { x: 10, y, type: 'path' as const, variant: 1 };
        }

        // Горизонтальные дорожки
        for (let x = 5; x <= 15; x++) {
            const idx1 = 3 * 20 + x;
            const idx2 = 7 * 20 + x;
            const idx3 = 11 * 20 + x;
            grid[idx1] = { x, y: 3, type: 'path' as const, variant: 1 };
            grid[idx2] = { x, y: 7, type: 'path' as const, variant: 1 };
            grid[idx3] = { x, y: 11, type: 'path' as const, variant: 1 };
        }

        // Вход внизу
        const entranceIdx = 14 * 20 + 10;
        grid[entranceIdx] = { x: 10, y: 14, type: 'entrance' as const };

        // Выход вверху
        const exitIdx = 0 * 20 + 10;
        grid[exitIdx] = { x: 10, y: 0, type: 'exit' as const };

        // Аттракционы
        grid[3 * 20 + 7] = { x: 7, y: 3, type: 'building' as const, buildingId: 'carousel' }; // Карусель
        grid[3 * 20 + 13] = { x: 13, y: 3, type: 'building' as const, buildingId: 'ferris' }; // Колесо обозрения
        grid[7 * 20 + 7] = { x: 7, y: 7, type: 'building' as const, buildingId: 'castle' }; // Замок
        grid[7 * 20 + 13] = { x: 13, y: 7, type: 'building' as const, buildingId: 'coaster' }; // Горки
        grid[11 * 20 + 7] = { x: 7, y: 11, type: 'building' as const, buildingId: 'slots' }; // Казино
        grid[11 * 20 + 13] = { x: 13, y: 11, type: 'building' as const, buildingId: 'shooting' }; // Тир

        // Магазины
        grid[3 * 20 + 9] = { x: 9, y: 3, type: 'building' as const, buildingId: 'burger' }; // Бургеры
        grid[3 * 20 + 11] = { x: 11, y: 3, type: 'building' as const, buildingId: 'pizza' }; // Пицца
        grid[7 * 20 + 9] = { x: 9, y: 7, type: 'building' as const, buildingId: 'soda' }; // Газировка
        grid[7 * 20 + 11] = { x: 11, y: 7, type: 'building' as const, buildingId: 'coffee' }; // Кофе
        grid[11 * 20 + 9] = { x: 9, y: 11, type: 'building' as const, buildingId: 'popcorn' }; // Попкорн
        grid[11 * 20 + 11] = { x: 11, y: 11, type: 'building' as const, buildingId: 'icecream' }; // Мороженое

        // Декорации
        grid[5 * 20 + 10] = { x: 10, y: 5, type: 'building' as const, buildingId: 'fountain' }; // Фонтан в центре
        grid[2 * 20 + 5] = { x: 5, y: 2, type: 'building' as const, buildingId: 'tree' }; // Деревья
        grid[2 * 20 + 15] = { x: 15, y: 2, type: 'building' as const, buildingId: 'tree' };
        grid[12 * 20 + 5] = { x: 5, y: 12, type: 'building' as const, buildingId: 'tree' };
        grid[12 * 20 + 15] = { x: 15, y: 12, type: 'building' as const, buildingId: 'tree' };
        grid[9 * 20 + 10] = { x: 10, y: 9, type: 'building' as const, buildingId: 'bench' }; // Скамейка

        // Инициализация казино в сервисе (будет создано автоматически при первом посещении)
        const casinoData = JSON.stringify({
            casino_7_11: {
                totalBank: 0,
                totalVisits: 0,
                totalWins: 0,
                totalLosses: 0,
                lastPayoutDay: 0,
                transactions: []
            }
        });

        return {
            money: 10000, // Даем больше денег для экспериментов
            dayCount: 1,
            grid: grid,
            guests: [], // Гости будут создаваться автоматически
            guestIdCounter: 1,
            entranceIndex: entranceIdx,
            casinoLastPayoutDay: 0,
            casinoData: casinoData
        };
    }
}
