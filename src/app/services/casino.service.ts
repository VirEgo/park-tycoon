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
    // Базовый банк казино (можно вынести в конфиг)
    private readonly INITIAL_BANK = 20;
    private readonly MAX_HISTORY = 50;
    // Рулетка (ставка на красное: 18 красных, 18 черных, 0 зеленый)
    private readonly ROULETTE_NUMBERS = {
        red: new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]),
        black: new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35])
    };

    private casinos = signal<Map<string, CasinoStats>>(new Map());
    private transactionIdCounter = 0;

    public totalCasinos = computed(() => this.casinos().size);
    public totalBank = computed(() =>
        Array.from(this.casinos().values()).reduce((acc, c) => acc + c.currentBank, 0)
    );

    constructor() { }

    initCasino(x: number, y: number, initialBank: number = this.INITIAL_BANK) {
        const casinoId = this.getCasinoId(x, y);
        this.casinos.update(map => {
            if (map.has(casinoId)) return map;

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

    /**
     * Проигрыш/выигрыш гостя. Возвращает информацию о результате.
     */
    processBet(
        x: number,
        y: number,
        guestId: number,
        bet: number
    ): { payout: number; outcome: 'win' | 'lose'; bankAfter: number } {
        const casinoId = this.getCasinoId(x, y);
        let result: { payout: number; outcome: 'win' | 'lose'; bankAfter: number } = { payout: 0, outcome: 'lose', bankAfter: 0 };

        this.casinos.update(map => {
            const casino = map.get(casinoId);

            if (!casino) {
                const newStats = this.createDefaultStats(x, y, casinoId);
                return this.applyBetLogic(new Map(map).set(casinoId, newStats), casinoId, guestId, bet, r => result = r);
            }

            return this.applyBetLogic(new Map(map), casinoId, guestId, bet, r => result = r);
        });

        return result;
    }

    // Рулетка: ставка на красное, шанс 18/37, выплата 2x (ставка + выигрыш)
    private applyBetLogic(
        map: Map<string, CasinoStats>,
        casinoId: string,
        guestId: number,
        bet: number,
        setResult: (r: { payout: number; outcome: 'win' | 'lose'; bankAfter: number }) => void
    ): Map<string, CasinoStats> {
        const casino = map.get(casinoId)!;

        const updatedCasino: CasinoStats = {
            ...casino,
            transactions: [...casino.transactions]
        };

        const spin = Math.floor(Math.random() * 37); // 0..36
        const isRed = this.ROULETTE_NUMBERS.red.has(spin);
        const won = isRed; // ставка всегда на красное

        // Касса принимает ставку
        updatedCasino.currentBank += bet;

        if (won) {
            const desiredPayout = bet * 2;
            const payout = Math.min(desiredPayout, updatedCasino.currentBank);
            updatedCasino.currentBank -= payout;
            updatedCasino.totalWins++;
            this.pushTransaction(updatedCasino, 'win', payout, guestId);
            setResult({ payout, outcome: 'win', bankAfter: updatedCasino.currentBank });
        } else {
            updatedCasino.totalLoses++;
            this.pushTransaction(updatedCasino, 'lose', bet, guestId);
            setResult({ payout: 0, outcome: 'lose', bankAfter: updatedCasino.currentBank });
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
                transactions: [...casino.transactions]
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
        return JSON.stringify(Array.from(this.casinos().entries()));
    }

    loadFromStorage(jsonData: string) {
        try {
            const parsedArray = JSON.parse(jsonData);
            if (!Array.isArray(parsedArray)) return;

            const map = new Map<string, CasinoStats>();

            parsedArray.forEach(([key, value]: [string, any]) => {
                const restoredTransactions = (value.transactions || []).map((t: any) => ({
                    ...t,
                    timestamp: new Date(t.timestamp)
                }));

                map.set(key, {
                    ...value,
                    transactions: restoredTransactions
                });
            });

            this.casinos.set(map);

            const allTransactions = Array.from(map.values()).flatMap(c => c.transactions);
            this.transactionIdCounter = allTransactions.length > 0 ? Math.max(...allTransactions.map(t => t.id)) + 1 : 0;
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

    private pushTransaction(casino: CasinoStats, type: CasinoTransaction['type'], amount: number, guestId?: number) {
        const transaction: CasinoTransaction = {
            id: this.transactionIdCounter++,
            casinoId: casino.casinoId,
            type,
            amount,
            bank: casino.currentBank,
            timestamp: new Date(),
            guestId
        };

        casino.transactions.unshift(transaction);
        if (casino.transactions.length > this.MAX_HISTORY) {
            casino.transactions.length = this.MAX_HISTORY;
        }
    }
}
