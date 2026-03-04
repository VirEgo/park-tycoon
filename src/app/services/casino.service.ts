import { Injectable, signal, computed } from '@angular/core';

export interface CasinoTransaction {
    id: number;
    casinoId: string;
    type: 'win' | 'lose' | 'jackpot' | 'bankrupt' | 'payout';
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

export type CasinoOutcome = 'win' | 'lose' | 'jackpot' | 'bankrupt';

export interface CasinoBetResult {
    payout: number;
    extraLoss: number;
    outcome: CasinoOutcome;
    bankAfter: number;
}

@Injectable({
    providedIn: 'root'
})
export class CasinoService {
    // Базовый банк казино (можно вынести в конфиг)
    private readonly INITIAL_BANK = 20;
    private readonly MAX_HISTORY = 50;
    private readonly JACKPOT_CHANCE = 0.01;
    private readonly BANKRUPT_CHANCE = 0.015;
    private readonly REGULAR_WIN_CHANCE = 0.22;
    private readonly JACKPOT_MULTIPLIER = 20;
    private readonly JACKPOT_BANK_SHARE = 0.8;

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
        bet: number,
        guestMoneyAfterBet: number
    ): CasinoBetResult {
        const casinoId = this.getCasinoId(x, y);
        let result: CasinoBetResult = {
            payout: 0,
            extraLoss: 0,
            outcome: 'lose',
            bankAfter: 0
        };

        this.casinos.update(map => {
            const casino = map.get(casinoId);

            if (!casino) {
                const newStats = this.createDefaultStats(x, y, casinoId);
                return this.applyBetLogic(
                    new Map(map).set(casinoId, newStats),
                    casinoId,
                    guestId,
                    bet,
                    guestMoneyAfterBet,
                    r => result = r
                );
            }

            return this.applyBetLogic(
                new Map(map),
                casinoId,
                guestId,
                bet,
                guestMoneyAfterBet,
                r => result = r
            );
        });

        return result;
    }

    private applyBetLogic(
        map: Map<string, CasinoStats>,
        casinoId: string,
        guestId: number,
        bet: number,
        guestMoneyAfterBet: number,
        setResult: (r: CasinoBetResult) => void
    ): Map<string, CasinoStats> {
        const casino = map.get(casinoId)!;

        const updatedCasino: CasinoStats = {
            ...casino,
            transactions: [...casino.transactions]
        };

        // Касса принимает ставку
        updatedCasino.currentBank += bet;
        const roll = Math.random();

        if (roll < this.JACKPOT_CHANCE) {
            const payout = this.calculateJackpotPayout(updatedCasino.currentBank, bet);
            updatedCasino.currentBank -= payout;
            updatedCasino.totalWins++;
            this.pushTransaction(updatedCasino, 'jackpot', payout, guestId);
            setResult({
                payout,
                extraLoss: 0,
                outcome: 'jackpot',
                bankAfter: updatedCasino.currentBank
            });
        } else if (roll < this.JACKPOT_CHANCE + this.BANKRUPT_CHANCE && guestMoneyAfterBet > 0) {
            const extraLoss = guestMoneyAfterBet;
            updatedCasino.currentBank += extraLoss;
            updatedCasino.totalLoses++;
            this.pushTransaction(updatedCasino, 'bankrupt', bet + extraLoss, guestId);
            setResult({
                payout: 0,
                extraLoss,
                outcome: 'bankrupt',
                bankAfter: updatedCasino.currentBank
            });
        } else if (roll < this.JACKPOT_CHANCE + this.BANKRUPT_CHANCE + this.REGULAR_WIN_CHANCE) {
            const desiredPayout = bet * 2;
            const payout = Math.min(desiredPayout, updatedCasino.currentBank);
            updatedCasino.currentBank -= payout;
            updatedCasino.totalWins++;
            this.pushTransaction(updatedCasino, 'win', payout, guestId);
            setResult({
                payout,
                extraLoss: 0,
                outcome: 'win',
                bankAfter: updatedCasino.currentBank
            });
        } else {
            updatedCasino.totalLoses++;
            this.pushTransaction(updatedCasino, 'lose', bet, guestId);
            setResult({
                payout: 0,
                extraLoss: 0,
                outcome: 'lose',
                bankAfter: updatedCasino.currentBank
            });
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

    private calculateJackpotPayout(currentBank: number, bet: number): number {
        const byMultiplier = bet * this.JACKPOT_MULTIPLIER;
        const byBankShare = currentBank * this.JACKPOT_BANK_SHARE;
        return Math.max(0, Math.min(currentBank, Math.max(byMultiplier, byBankShare)));
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
