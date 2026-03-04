import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CasinoStats, CasinoTransaction } from '../../services/casino.service';

@Component({
  selector: 'app-casino-stats',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
         (click)="close.emit()">
      <div class="bg-gray-800 border border-purple-500 rounded-lg shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
           (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="flex justify-between items-center mb-4 border-b border-gray-700 pb-3">
          <div class="flex items-center gap-3">
            <span class="text-4xl">🎰</span>
            <div>
              <h3 class="text-xl font-bold text-purple-400">Казино - Статистика</h3>
              <div class="text-xs text-gray-400">Позиция: ({{stats().x}}, {{stats().y}})</div>
            </div>
          </div>
          <button (click)="close.emit()" class="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="bg-gray-700/50 rounded-lg p-4">
            <div class="text-xs text-gray-400 mb-1">Текущий банк</div>
            <div class="text-2xl font-bold text-green-400">\${{stats().currentBank.toFixed(2)}}</div>
          </div>
          
          <div class="bg-gray-700/50 rounded-lg p-4">
            <div class="text-xs text-gray-400 mb-1">Всего посещений</div>
            <div class="text-2xl font-bold text-blue-400">{{stats().totalVisits}}</div>
          </div>
          
          <div class="bg-gray-700/50 rounded-lg p-4">
            <div class="text-xs text-gray-400 mb-1">Выигрышей</div>
            <div class="text-2xl font-bold text-yellow-400">{{stats().totalWins}}</div>
          </div>
          
          <div class="bg-gray-700/50 rounded-lg p-4">
            <div class="text-xs text-gray-400 mb-1">Проигрышей</div>
            <div class="text-2xl font-bold text-red-400">{{stats().totalLoses}}</div>
          </div>
        </div>

        <!-- Win Rate -->
        <div class="bg-gray-700/50 rounded-lg p-3 mb-4">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm text-gray-300">Процент выигрышей</span>
            <span class="text-sm font-mono text-purple-400">{{getWinRate()}}%</span>
          </div>
          <div class="w-full h-2 bg-gray-600 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-purple-500 to-pink-500" 
                 [style.width.%]="getWinRate()"></div>
          </div>
        </div>

        <!-- Transaction History -->
        <div class="flex-1 overflow-hidden flex flex-col">
          <h4 class="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <span>📜</span>
            <span>История транзакций</span>
            <span class="text-xs text-gray-500">({{stats().transactions.length}})</span>
          </h4>
          
          <div class="flex-1 overflow-y-auto custom-scrollbar space-y-2">
            <div *ngFor="let tx of stats().transactions; trackBy: trackByTxId"
                 class="bg-gray-700/30 rounded p-2 text-xs border-l-2"
                 [ngClass]="{
                   'border-green-500': tx.type === 'win',
                   'border-red-500': tx.type === 'lose' || tx.type === 'bankrupt',
                   'border-yellow-500': tx.type === 'jackpot',
                   'border-blue-500': tx.type === 'payout',
                   'jackpot-tx': tx.type === 'jackpot'
                 }">
              
              <div class="flex justify-between items-start mb-1">
                <div class="flex items-center gap-2">
                  <span *ngIf="tx.type === 'win'" class="text-green-400">🎉 Выигрыш</span>
                  <span *ngIf="tx.type === 'lose'" class="text-red-400">💸 Проигрыш</span>
                  <span *ngIf="tx.type === 'jackpot'" class="text-yellow-400">💰 Джек-пот</span>
                  <span *ngIf="tx.type === 'bankrupt'" class="text-red-400">🧨 Проиграл всё</span>
                  <span *ngIf="tx.type === 'payout'" class="text-blue-400">
                    <img src="assets/staff/coin.svg" alt="Payout" class="inline w-4 h-4"/>  
                    Выплата
                  </span>
                  
                  <span *ngIf="tx.guestId !== undefined" class="text-gray-500">
                    (Гость #{{tx.guestId}})
                  </span>
                </div>
                
                <span class="font-mono font-bold"
                      [ngClass]="{
                        'text-green-400': tx.type === 'win',
                        'text-red-400': tx.type === 'lose' || tx.type === 'bankrupt',
                        'text-yellow-400': tx.type === 'jackpot',
                        'text-blue-400': tx.type === 'payout'
                      }">
                  {{isPositiveTransaction(tx.type) ? '+' : '-'}} \${{tx.amount.toFixed(2)}}
                </span>
              </div>
              
              <div class="flex justify-between text-[10px] text-gray-500">
                <span>Банк после: \${{tx.bank.toFixed(2)}}</span>
                <span>{{formatTime(tx.timestamp)}}</span>
              </div>
            </div>
            
            <div *ngIf="stats().transactions.length === 0" 
                 class="text-center text-gray-500 py-8">
              Транзакций пока нет
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 8px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #1f2937;
      border-radius: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #4b5563;
      border-radius: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #6b7280;
    }
    .jackpot-tx {
      background: linear-gradient(90deg, rgba(250, 204, 21, 0.18) 0%, rgba(245, 158, 11, 0.10) 50%, rgba(55, 65, 81, 0.35) 100%);
      box-shadow: 0 0 0 1px rgba(250, 204, 21, 0.18), 0 10px 24px rgba(245, 158, 11, 0.12);
    }
  `]
})
export class CasinoStatsComponent {
  stats = input.required<CasinoStats>();
  close = output<void>();

  getWinRate(): number {
    const total = this.stats().totalVisits;
    if (total === 0) return 0;
    return Math.round((this.stats().totalWins / total) * 100);
  }

  formatTime(timestamp: Date): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  trackByTxId(index: number, tx: any): number {
    return tx.id;
  }

  isPositiveTransaction(type: CasinoTransaction['type']): boolean {
    return type === 'win' || type === 'jackpot' || type === 'payout';
  }
}
