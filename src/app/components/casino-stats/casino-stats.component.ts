import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CasinoStats, CasinoTransaction } from '../../services/casino.service';

@Component({
  selector: 'app-casino-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './casino-stats.component.html',
  styleUrls: ['./casino-stats.component.scss']
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
