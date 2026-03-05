import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { Guest } from '../models/guest.model';
import { GuestTypeId } from '../models/guest-type.model';
import { ParkGuestReview } from '../models/park-feedback.model';
import { LmStudioChatMessage, LmStudioService } from './lm-studio.service';

@Injectable({
    providedIn: 'root'
})
export class ParkFeedbackService {
    readonly reviewEveryNthGuest = 50;
    readonly maxStoredReviews = 40;

    private readonly lmStudioService = inject(LmStudioService);

    private readonly positiveReviews: string[] = [
        'Отличный парк! С удовольствием вернусь еще раз.',
        'Прекрасная атмосфера и множество развлечений.',
        'Всё понравилось, время пролетело незаметно!',
        'Замечательное место для отдыха всей семьей.',
        'Аттракционы супер! Остался очень доволен.',
        'Чистота, порядок и куча веселья - всё на высоте.',
        'Рекомендую всем друзьям, парк просто огонь!',
        'Отдохнул душой, обязательно приду снова.',
        'Лучший парк развлечений, что я видел.',
        'Идеально провел день, спасибо организаторам!',
        'Море позитива и радости, очень круто!',
        'Всё продумано до мелочей, высший класс.',
        'Невероятные эмоции от каждого аттракциона!',
        'Парк мечты! Впечатлен до глубины души.',
        'Отличный сервис и прекрасные зоны отдыха.',
    ];

    private readonly neutralReviews: string[] = [
        'В целом неплохо, но есть куда расти.',
        'Нормально, хотя ожидал чуть большего.',
        'Средний уровень, ничего особенного.',
        'Приемлемо для разового визита.',
        'В принципе, можно провести время.',
        'Есть свои плюсы и минусы, в среднем норма.',
        'Не восторг, но и не разочарование.',
        'Обычный парк, всё как везде.',
        'Можно было лучше, но и не плохо.',
        'Нормальный вариант для прогулки.',
    ];

    private readonly negativeReviews: string[] = [
        'Ожидал большего. Много недостатков.',
        'Не впечатлило, не вернусь больше сюда.',
        'Разочарован посещением, слабо всё.',
        'Не стоит своих денег, грустно.',
        'Много очередей, мало удовольствия.',
        'Слабая организация, всё плохо.',
        'Не понравилось абсолютно, полный провал.',
        'Потратил время зря, никому не советую.',
        'Скучно и уныло, не рекомендую.',
        'Плохое впечатление, не ожидал такого.',
        'Неудачный опыт, больше не приду.',
        'Всё старое и убитое, грустно смотреть.',
        'Отвратительное обслуживание и качество.',
        'Худший парк, в котором я был.',
        'Даром не нужен такой отдых.',
    ];

    shouldRequestReview(leaveOrdinal: number): boolean {
        return leaveOrdinal > 0 && leaveOrdinal % this.reviewEveryNthGuest === 0;
    }

    addReview(existing: ParkGuestReview[], review: ParkGuestReview): ParkGuestReview[] {
        return [review, ...existing].slice(0, this.maxStoredReviews);
    }

    normalizeReviews(input: unknown): ParkGuestReview[] {
        if (!Array.isArray(input)) {
            return [];
        }

        return input
            .map((item) => this.normalizeReview(item))
            .filter((item): item is ParkGuestReview => item !== null)
            .slice(0, this.maxStoredReviews);
    }

    generateReview(
        guest: Guest,
        day: number,
        leaveOrdinal: number,
        modelId: string,
        canUseLmStudio: boolean
    ): Observable<ParkGuestReview> {
        const fallback = this.createFallbackReview(guest, day, leaveOrdinal);

        if (!canUseLmStudio || !modelId.trim()) {
            return of(fallback);
        }

        const messages: LmStudioChatMessage[] = [
            {
                role: 'system',
                content: [
                    'You generate one short amusement park guest review in Russian.',
                    'Return only compact JSON with keys: rating, review.',
                    'rating must be an integer from 1 to 5.',
                    'review must be <= 180 characters, no markdown.'
                ].join(' ')
            },
            {
                role: 'user',
                content: this.buildGuestPrompt(guest, day, leaveOrdinal)
            }
        ];

        return this.lmStudioService.chat(modelId, messages).pipe(
            map((rawResponse) => this.mergeLmStudioReview(fallback, rawResponse)),
            catchError(() => of(fallback))
        );
    }

    private createFallbackReview(guest: Guest, day: number, leaveOrdinal: number): ParkGuestReview {
        const rating = this.calculateRating(guest);
        const guestTypeLabel = this.getGuestTypeLabel(guest.guestType);

        // Используем номер гостя для детерминированного выбора отзыва
        const seed = leaveOrdinal;
        const text = this.selectReviewText(rating, seed, guestTypeLabel);

        return {
            id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: new Date().toLocaleString(),
            day,
            leaveOrdinal,
            guestType: guest.guestType,
            rating,
            text: this.sanitizeReviewText(text),
            source: 'template',
            snapshot: {
                happiness: guest.happiness,
                satiety: guest.satiety,
                hydration: guest.hydration,
                energy: guest.energy,
                fun: guest.fun,
                toilet: guest.toilet,
                moneyLeft: guest.money,
                daysInPark: guest.daysInPark
            }
        };
    }

    private buildGuestPrompt(guest: Guest, day: number, leaveOrdinal: number): string {
        const weakestNeed = this.getWeakestNeed(guest);

        return [
            'Create one guest review for an amusement park.',
            `Day: ${day}`,
            `Leaving guest ordinal: ${leaveOrdinal}`,
            `Guest type: ${guest.guestType}`,
            `Happiness: ${guest.happiness.toFixed(0)}`,
            `Satiety: ${guest.satiety.toFixed(0)}`,
            `Hydration: ${guest.hydration.toFixed(0)}`,
            `Energy: ${guest.energy.toFixed(0)}`,
            `Fun: ${guest.fun.toFixed(0)}`,
            `Toilet: ${guest.toilet.toFixed(0)}`,
            `Money left: ${guest.money.toFixed(0)}`,
            `Days in park: ${guest.daysInPark}`,
            `Weakest need: ${weakestNeed.label}`,
            'Language: Russian.',
            'Output JSON only.'
        ].join('\n');
    }

    private mergeLmStudioReview(fallback: ParkGuestReview, rawResponse: string): ParkGuestReview {
        const parsed = this.parseLmStudioResponse(rawResponse);
        if (!parsed) {
            return fallback;
        }

        return {
            ...fallback,
            rating: parsed.rating,
            text: parsed.review,
            source: 'lm-studio'
        };
    }

    private parseLmStudioResponse(rawResponse: string): { rating: number; review: string } | null {
        const trimmed = (rawResponse ?? '').trim();
        if (!trimmed) {
            return null;
        }

        const objectCandidate = this.extractFirstJsonObject(trimmed);
        if (!objectCandidate) {
            return null;
        }

        try {
            const parsed = JSON.parse(objectCandidate) as { rating?: unknown; review?: unknown; text?: unknown };
            const rating = this.clampRating(Number(parsed.rating));
            const textCandidate = typeof parsed.review === 'string'
                ? parsed.review
                : typeof parsed.text === 'string'
                    ? parsed.text
                    : '';
            const review = this.sanitizeReviewText(textCandidate);

            if (!review) {
                return null;
            }

            return { rating, review };
        } catch {
            return null;
        }
    }

    private extractFirstJsonObject(input: string): string | null {
        const cleaned = input
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```$/i, '')
            .trim();

        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');

        if (start === -1 || end === -1 || end <= start) {
            return null;
        }

        return cleaned.slice(start, end + 1);
    }

    private getWeakestNeed(guest: Guest): { key: string; label: string; value: number } {
        const needs = [
            { key: 'satiety', label: 'сытость', value: guest.satiety },
            { key: 'hydration', label: 'жажда', value: guest.hydration },
            { key: 'energy', label: 'энергия', value: guest.energy },
            { key: 'fun', label: 'веселье', value: guest.fun },
            { key: 'toilet', label: 'туалет', value: guest.toilet }
        ];

        return needs.reduce((lowest, current) => (current.value < lowest.value ? current : lowest), needs[0]);
    }

    private selectReviewText(rating: number, seed: number, guestTypeLabel: string): string {
        let reviewPool: string[];

        if (rating >= 4) {
            reviewPool = this.positiveReviews;
        } else if (rating === 3) {
            reviewPool = this.neutralReviews;
        } else {
            reviewPool = this.negativeReviews;
        }

        // Детерминированный выбор отзыва на основе seed
        const index = seed % reviewPool.length;
        const baseReview = reviewPool[index];

        // Добавляем префикс с типом гостя для разнообразия
        const shouldAddPrefix = (seed % 3) === 0;
        if (shouldAddPrefix) {
            return `${guestTypeLabel}: ${baseReview}`;
        }

        return baseReview;
    }

    private sanitizeReviewText(text: string): string {
        return text.replace(/\s+/g, ' ').trim().slice(0, 180);
    }

    private clampRating(value: number): number {
        if (!Number.isFinite(value)) {
            return 3;
        }

        return Math.max(1, Math.min(5, Math.round(value)));
    }

    private calculateRating(guest: Guest): number {
        const composite =
            guest.happiness * 0.35 +
            guest.fun * 0.2 +
            guest.satiety * 0.15 +
            guest.hydration * 0.15 +
            guest.energy * 0.1 +
            guest.toilet * 0.05;

        return this.clampRating(composite / 20);
    }

    private getGuestTypeLabel(type: GuestTypeId): string {
        const labels: Record<GuestTypeId, string> = {
            casual: 'Обычный гость',
            family: 'Семейный гость',
            teen: 'Подросток',
            elder: 'Пожилой гость',
            vip: 'VIP-гость'
        };

        return labels[type] ?? 'Гость';
    }

    private normalizeReview(input: unknown): ParkGuestReview | null {
        if (!input || typeof input !== 'object') {
            return null;
        }

        const value = input as Partial<ParkGuestReview>;
        if (!value.id || !value.text || !value.createdAt) {
            return null;
        }

        if (!value.snapshot) {
            return null;
        }

        return {
            id: String(value.id),
            createdAt: String(value.createdAt),
            day: Number(value.day ?? 1),
            leaveOrdinal: Number(value.leaveOrdinal ?? 0),
            guestType: (value.guestType as GuestTypeId) ?? 'casual',
            rating: this.clampRating(Number(value.rating ?? 3)),
            text: this.sanitizeReviewText(String(value.text)),
            source: value.source === 'lm-studio' ? 'lm-studio' : 'template',
            snapshot: {
                happiness: Number(value.snapshot.happiness ?? 0),
                satiety: Number(value.snapshot.satiety ?? 0),
                hydration: Number(value.snapshot.hydration ?? 0),
                energy: Number(value.snapshot.energy ?? 0),
                fun: Number(value.snapshot.fun ?? 0),
                toilet: Number(value.snapshot.toilet ?? 0),
                moneyLeft: Number(value.snapshot.moneyLeft ?? 0),
                daysInPark: Number(value.snapshot.daysInPark ?? 0)
            }
        };
    }
}
