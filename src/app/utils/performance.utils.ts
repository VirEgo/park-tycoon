/**
 * Утилиты для оптимизации производительности игры
 */

/**
 * Throttle функция - ограничивает частоту вызовов
 * @param func Функция для throttle
 * @param limit Минимальный интервал между вызовами (мс)
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): T {
    let inThrottle = false;
    let lastResult: ReturnType<T>;

    return function (this: any, ...args: Parameters<T>): ReturnType<T> {
        if (!inThrottle) {
            lastResult = func.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
        return lastResult;
    } as T;
}

/**
 * Debounce функция - откладывает выполнение до окончания серии вызовов
 * @param func Функция для debounce
 * @param wait Время ожидания после последнего вызова (мс)
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): T {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return function (this: any, ...args: Parameters<T>): void {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    } as unknown as T;
}

/**
 * Пул объектов для переиспользования и снижения нагрузки на GC
 */
export class ObjectPool<T> {
    private pool: T[] = [];
    private createFn: () => T;
    private resetFn: (obj: T) => void;
    private maxSize: number;

    constructor(
        createFn: () => T,
        resetFn: (obj: T) => void,
        initialSize = 10,
        maxSize = 100
    ) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.maxSize = maxSize;

        for (let i = 0; i < initialSize; i++) {
            this.pool.push(createFn());
        }
    }

    acquire(): T {
        return this.pool.pop() || this.createFn();
    }

    release(obj: T): void {
        this.resetFn(obj);
        if (this.pool.length < this.maxSize) {
            this.pool.push(obj);
        }
    }

    get size(): number {
        return this.pool.length;
    }
}

/**
 * Простой spatial hash для быстрого поиска объектов по позиции
 * Полезно для определения близких гостей/зданий
 */
export class SpatialHash<T extends { x: number; y: number }> {
    private cellSize: number;
    private buckets: Map<string, T[]> = new Map();

    constructor(cellSize: number = 5) {
        this.cellSize = cellSize;
    }

    private getKey(x: number, y: number): string {
        const bx = Math.floor(x / this.cellSize);
        const by = Math.floor(y / this.cellSize);
        return `${bx},${by}`;
    }

    clear(): void {
        this.buckets.clear();
    }

    insert(obj: T): void {
        const key = this.getKey(obj.x, obj.y);
        let bucket = this.buckets.get(key);
        if (!bucket) {
            bucket = [];
            this.buckets.set(key, bucket);
        }
        bucket.push(obj);
    }

    insertAll(objects: T[]): void {
        this.clear();
        for (const obj of objects) {
            this.insert(obj);
        }
    }

    getNearby(x: number, y: number, radius: number = 1): T[] {
        const results: T[] = [];
        const cellRadius = Math.ceil(radius / this.cellSize);
        const centerBx = Math.floor(x / this.cellSize);
        const centerBy = Math.floor(y / this.cellSize);

        for (let bx = centerBx - cellRadius; bx <= centerBx + cellRadius; bx++) {
            for (let by = centerBy - cellRadius; by <= centerBy + cellRadius; by++) {
                const bucket = this.buckets.get(`${bx},${by}`);
                if (bucket) {
                    results.push(...bucket);
                }
            }
        }

        return results;
    }

    getInCell(x: number, y: number): T[] {
        const key = this.getKey(x, y);
        return this.buckets.get(key) || [];
    }
}

/**
 * Простой кэш с TTL (Time To Live)
 */
export class TTLCache<K, V> {
    private cache: Map<K, { value: V; expiry: number }> = new Map();
    private defaultTTL: number;

    constructor(defaultTTL: number = 5000) {
        this.defaultTTL = defaultTTL;
    }

    set(key: K, value: V, ttl?: number): void {
        const expiry = Date.now() + (ttl ?? this.defaultTTL);
        this.cache.set(key, { value, expiry });
    }

    get(key: K): V | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return undefined;
        }

        return entry.value;
    }

    has(key: K): boolean {
        return this.get(key) !== undefined;
    }

    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    // Очистка устаревших записей
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiry) {
                this.cache.delete(key);
            }
        }
    }

    get size(): number {
        return this.cache.size;
    }
}

/**
 * Ограничитель частоты кадров
 */
export class FrameRateLimiter {
    private lastFrameTime = 0;
    private targetFrameTime: number;

    constructor(targetFPS: number = 30) {
        this.targetFrameTime = 1000 / targetFPS;
    }

    shouldRender(currentTime: number): boolean {
        const elapsed = currentTime - this.lastFrameTime;
        if (elapsed >= this.targetFrameTime) {
            this.lastFrameTime = currentTime;
            return true;
        }
        return false;
    }

    setTargetFPS(fps: number): void {
        this.targetFrameTime = 1000 / fps;
    }
}

/**
 * Измеритель производительности для отладки
 */
export class PerformanceMonitor {
    private samples: number[] = [];
    private maxSamples: number;
    private lastTime = 0;

    constructor(maxSamples: number = 60) {
        this.maxSamples = maxSamples;
    }

    startFrame(): void {
        this.lastTime = performance.now();
    }

    endFrame(): void {
        const frameTime = performance.now() - this.lastTime;
        this.samples.push(frameTime);
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
    }

    getAverageFrameTime(): number {
        if (this.samples.length === 0) return 0;
        return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    }

    getAverageFPS(): number {
        const avgFrameTime = this.getAverageFrameTime();
        return avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
    }

    getStats(): { avgFPS: number; avgFrameTime: number; minFPS: number; maxFPS: number } {
        if (this.samples.length === 0) {
            return { avgFPS: 0, avgFrameTime: 0, minFPS: 0, maxFPS: 0 };
        }

        const avgFrameTime = this.getAverageFrameTime();
        const minFrameTime = Math.min(...this.samples);
        const maxFrameTime = Math.max(...this.samples);

        return {
            avgFPS: avgFrameTime > 0 ? 1000 / avgFrameTime : 0,
            avgFrameTime,
            minFPS: maxFrameTime > 0 ? 1000 / maxFrameTime : 0,
            maxFPS: minFrameTime > 0 ? 1000 / minFrameTime : 0
        };
    }
}
