import { Injectable, signal, computed } from '@angular/core';

export interface CasinoTransaction {
    id: number;
    casinoId: string;
    type: 'win' | 'lose' | 'payout';
    amount: number;
    bank: number;
    timestamp: Date;
    guestId?: number;
}

export interface CasinoStats {
    casinoId: string;
    x: number;
    y: number;
    totalVisits: number;
    totalWins: number;
    totalLoses: number;
    currentBank: number;
    transactions: CasinoTransaction[];
}

@Injectable({
    providedIn: 'root'
})
export class CasinoService {
    private casinos = signal<Map<string, CasinoStats>>(new Map());
    private transactionIdCounter = 0;

    constructor() { }

    // Инициализация казино при постройке
    initCasino(x: number, y: number, initialBank: number = 20) {
        const casinoId = this.getCasinoId(x, y);
        const existing = this.casinos().get(casinoId);

        if (!existing) {
            const stats: CasinoStats = {
                casinoId,
                x,
                y,
                totalVisits: 0,
                totalWins: 0,
                totalLoses: 0,
                currentBank: initialBank,
                transactions: []
            };

            this.casinos.update(map => {
                const newMap = new Map(map);
                newMap.set(casinoId, stats);
                return newMap;
            });
        }
    }

    // Удаление казино при сносе
    removeCasino(x: number, y: number) {
        const casinoId = this.getCasinoId(x, y);
        this.casinos.update(map => {
            const newMap = new Map(map);
            newMap.delete(casinoId);
            return newMap;
        });
    }

    // Обработка ставки гостя
    processBet(x: number, y: number, guestId: number, bet: number, won: boolean): number {
        const casinoId = this.getCasinoId(x, y);
        const casino = this.casinos().get(casinoId);

        if (!casino) {
            this.initCasino(x, y);
            return this.processBet(x, y, guestId, bet, won);
        }

        let winAmount = 0;
        const updatedCasino = { ...casino };

        if (won) {
            // Выигрыш - забирает весь банк
            winAmount = updatedCasino.currentBank;
            updatedCasino.currentBank = 20; // Сброс до начального
            updatedCasino.totalWins++;

            this.addTransaction(updatedCasino, 'win', winAmount, guestId);
        } else {
            // Проигрыш - ставка добавляется к банку
            updatedCasino.currentBank += bet;
            updatedCasino.totalLoses++;

            this.addTransaction(updatedCasino, 'lose', bet, guestId);
        }

        updatedCasino.totalVisits++;

        this.casinos.update(map => {
            const newMap = new Map(map);
            newMap.set(casinoId, updatedCasino);
            return newMap;
        });

        return winAmount;
    }

    // Обновление банка (для внешних изменений)
    updateBank(x: number, y: number, newBank: number) {
        const casinoId = this.getCasinoId(x, y);
        const casino = this.casinos().get(casinoId);

        if (casino) {
            this.casinos.update(map => {
                const newMap = new Map(map);
                newMap.set(casinoId, { ...casino, currentBank: newBank });
                return newMap;
            });
        }
    }

    // Выплата банка в бюджет парка (каждые 10 дней)
    processPayout(x: number, y: number): number {
        const casinoId = this.getCasinoId(x, y);
        const casino = this.casinos().get(casinoId);

        if (!casino) return 0;

        const payout = Math.max(0, casino.currentBank - 20);

        if (payout > 0) {
            const updatedCasino = { ...casino, currentBank: 20 };
            this.addTransaction(updatedCasino, 'payout', payout);

            this.casinos.update(map => {
                const newMap = new Map(map);
                newMap.set(casinoId, updatedCasino);
                return newMap;
            });
        }

        return payout;
    }

    // Получить статистику казино
    getCasinoStats(x: number, y: number): CasinoStats | undefined {
        const casinoId = this.getCasinoId(x, y);
        return this.casinos().get(casinoId);
    }

    // Получить все казино
    getAllCasinos(): CasinoStats[] {
        return Array.from(this.casinos().values());
    }

    // Сохранение в localStorage
    saveToStorage(): string {
        const data = Array.from(this.casinos().entries());
        return JSON.stringify(data);
    }

    // Загрузка из localStorage
    loadFromStorage(jsonData: string) {
        try {
            const data = JSON.parse(jsonData);
            const map = new Map<string, CasinoStats>(data);
            this.casinos.set(map);

            // Восстановить счетчик транзакций
            this.transactionIdCounter = Math.max(
                0,
                ...Array.from(map.values()).flatMap(c => c.transactions.map(t => t.id))
            ) + 1;
        } catch (e) {
            console.error('Failed to load casino data', e);
        }
    }

    // Сброс всех данных
    reset() {
        this.casinos.set(new Map());
        this.transactionIdCounter = 0;
    }

    private getCasinoId(x: number, y: number): string {
        return `casino_${x}_${y}`;
    }

    private addTransaction(casino: CasinoStats, type: CasinoTransaction['type'], amount: number, guestId?: number) {
        const transaction: CasinoTransaction = {
            id: this.transactionIdCounter++,
            casinoId: casino.casinoId,
            type,
            amount,
            bank: casino.currentBank,
            timestamp: new Date(),
            guestId
        };

        // Ограничить историю последними 50 транзакциями
        casino.transactions.unshift(transaction);
        if (casino.transactions.length > 50) {
            casino.transactions.pop();
        }
    }
}
