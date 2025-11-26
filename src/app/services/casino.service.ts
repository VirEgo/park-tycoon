import { Injectable, signal, computed } from '@angular/core';

export interface CasinoTransaction {
    id: number;
    casinoId: string;
    type: 'win' | 'lose' | 'payout';
    amount: number;
    bank: number;
    timestamp: Date; // Важно: при загрузке из JSON нужно восстанавливать
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
    // Константы лучше вынести (можно в отдельный config файл)
    private readonly INITIAL_BANK = 20;
    private readonly MAX_HISTORY = 50;

    private casinos = signal<Map<string, CasinoStats>>(new Map());
    private transactionIdCounter = 0;

    // Computed сигналы (полезно для статистики парка)
    public totalCasinos = computed(() => this.casinos().size);
    public totalBank = computed(() =>
        Array.from(this.casinos().values()).reduce((acc, c) => acc + c.currentBank, 0)
    );

    constructor() { }

    initCasino(x: number, y: number, initialBank: number = this.INITIAL_BANK) {
        const casinoId = this.getCasinoId(x, y);
        // Используем update сразу, чтобы избежать лишних чтений
        this.casinos.update(map => {
            if (map.has(casinoId)) return map; // Если уже есть, не трогаем

            const newMap = new Map(map);
            newMap.set(casinoId, {
                casinoId,
                x,
                y,
                totalVisits: 0,
                totalWins: 0,
                totalLoses: 0,
                currentBank: initialBank,
                transactions: []
            });
            return newMap;
        });
    }

    removeCasino(x: number, y: number) {
        const casinoId = this.getCasinoId(x, y);
        this.casinos.update(map => {
            if (!map.has(casinoId)) return map;
            const newMap = new Map(map);
            newMap.delete(casinoId);
            return newMap;
        });
    }

    processBet(x: number, y: number, guestId: number, bet: number, won: boolean): number {
        const casinoId = this.getCasinoId(x, y);
        let winAmount = 0;

        this.casinos.update(map => {
            const casino = map.get(casinoId);

            // Если казино нет, инициализируем его "на лету" (side-effect внутри update допустим, но лучше вынести)
            if (!casino) {
                // Внимание: рекурсивный вызов внутри update может быть опасен, 
                // но здесь мы просто инициализируем. 
                // Лучше просто создать объект здесь же.
                const newStats = this.createDefaultStats(x, y, casinoId);
                // Повторяем логику для нового казино
                return this.applyBetLogic(new Map(map).set(casinoId, newStats), casinoId, guestId, bet, won, (amount) => winAmount = amount);
            }

            return this.applyBetLogic(new Map(map), casinoId, guestId, bet, won, (amount) => winAmount = amount);
        });

        return winAmount;
    }

    // Вынесена логика обновления конкретного казино для чистоты
    private applyBetLogic(
        map: Map<string, CasinoStats>,
        casinoId: string,
        guestId: number,
        bet: number,
        won: boolean,
        setWinAmount: (n: number) => void
    ): Map<string, CasinoStats> {
        const casino = map.get(casinoId)!;

        // Клонируем объект и массив транзакций (Deep copy для изменяемых полей)
        const updatedCasino = {
            ...casino,
            transactions: [...casino.transactions]
        };

        if (won) {
            const amount = updatedCasino.currentBank;
            updatedCasino.currentBank = this.INITIAL_BANK;
            updatedCasino.totalWins++;
            setWinAmount(amount);

            this.pushTransaction(updatedCasino, 'win', amount, guestId);
        } else {
            updatedCasino.currentBank += bet;
            updatedCasino.totalLoses++;
            setWinAmount(0);

            this.pushTransaction(updatedCasino, 'lose', bet, guestId);
        }

        updatedCasino.totalVisits++;
        map.set(casinoId, updatedCasino);
        return map;
    }

    updateBank(x: number, y: number, newBank: number) {
        const casinoId = this.getCasinoId(x, y);
        this.casinos.update(map => {
            const casino = map.get(casinoId);
            if (!casino) return map;

            const newMap = new Map(map);
            newMap.set(casinoId, { ...casino, currentBank: newBank });
            return newMap;
        });
    }

    processPayout(x: number, y: number): number {
        const casinoId = this.getCasinoId(x, y);
        let payoutAmount = 0;

        this.casinos.update(map => {
            const casino = map.get(casinoId);
            if (!casino) return map;

            const payout = Math.max(0, casino.currentBank - this.INITIAL_BANK);
            if (payout <= 0) return map;

            payoutAmount = payout;

            const updatedCasino = {
                ...casino,
                currentBank: this.INITIAL_BANK,
                transactions: [...casino.transactions] // Копия массива
            };

            this.pushTransaction(updatedCasino, 'payout', payout);

            const newMap = new Map(map);
            newMap.set(casinoId, updatedCasino);
            return newMap;
        });

        return payoutAmount;
    }

    getCasinoStats(x: number, y: number): CasinoStats | undefined {
        return this.casinos().get(this.getCasinoId(x, y));
    }

    getAllCasinos(): CasinoStats[] {
        return Array.from(this.casinos().values());
    }

    saveToStorage(): string {
        // Map нельзя просто так сериализовать, Array.from(entries) - правильный подход
        return JSON.stringify(Array.from(this.casinos().entries()));
    }

    loadFromStorage(jsonData: string) {
        try {
            const parsedArray = JSON.parse(jsonData);

            // Валидация структуры
            if (!Array.isArray(parsedArray)) return;

            // Восстановление Map и типов (особенно Date)
            const map = new Map<string, CasinoStats>();

            parsedArray.forEach(([key, value]: [string, any]) => {
                // Восстанавливаем даты в транзакциях
                const restoredTransactions = (value.transactions || []).map((t: any) => ({
                    ...t,
                    timestamp: new Date(t.timestamp) // Преобразование строки в Date
                }));

                map.set(key, {
                    ...value,
                    transactions: restoredTransactions
                });
            });

            this.casinos.set(map);

            // Восстанавливаем счетчик ID
            const allTransactions = Array.from(map.values()).flatMap(c => c.transactions);
            if (allTransactions.length > 0) {
                this.transactionIdCounter = Math.max(...allTransactions.map(t => t.id)) + 1;
            } else {
                this.transactionIdCounter = 0;
            }
        } catch (e) {
            console.error('Failed to load casino data', e);
        }
    }

    reset() {
        this.casinos.set(new Map());
        this.transactionIdCounter = 0;
    }

    private getCasinoId(x: number, y: number): string {
        return `casino_${x}_${y}`;
    }

    private createDefaultStats(x: number, y: number, id: string): CasinoStats {
        return {
            casinoId: id,
            x, y,
            totalVisits: 0,
            totalWins: 0,
            totalLoses: 0,
            currentBank: this.INITIAL_BANK,
            transactions: []
        };
    }

    // Теперь метод не просто добавляет, а корректно обновляет переданный массив
    private pushTransaction(casino: CasinoStats, type: CasinoTransaction['type'], amount: number, guestId?: number) {
        const transaction: CasinoTransaction = {
            id: this.transactionIdCounter++,
            casinoId: casino.casinoId,
            type,
            amount,
            bank: casino.currentBank, // Банк уже должен быть обновлен к этому моменту
            timestamp: new Date(),
            guestId
        };

        // Добавляем в начало и обрезаем
        casino.transactions.unshift(transaction);
        if (casino.transactions.length > this.MAX_HISTORY) {
            casino.transactions.length = this.MAX_HISTORY; // Укорачиваем массив in-place, так как это копия
        }
    }
}