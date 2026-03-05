import { GUEST_TYPES, GuestTypeDefinition, GuestTypeId } from './guest-type.model';

export type GuestNeedKey = 'satiety' | 'hydration' | 'energy' | 'fun' | 'toilet';
type VisitContext = {
    category?: string;
    satisfies?: GuestNeedKey;
    isGambling?: boolean;
};

export class Guest {
    id: number;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    money: number;
    isWorker: boolean = false;

    // Stats (0-100)
    happiness: number = 100;
    satiety: number = 100;   // Hunger
    hydration: number = 100; // Thirst
    energy: number = 100;    // Rest
    fun: number = 100;       // Entertainment
    toilet: number = 100;    // Bladder
    workerHome: string | null = null;
    workerTask?: {
        targetX: number;
        targetY: number;
        buildingKey: string;
        path?: Array<{ x: number, y: number }>;
        pathIndex?: number;
        isReturnToBase?: boolean;
    };

    state: 'walking' | 'idle' | 'spending' | 'leaving' = 'idle';
    statusMessage: string | null = null;
    color: string;
    emoji: string;
    visualType: string;
    skin: string;

    // New properties for guest types
    guestType: GuestTypeId = 'casual';
    spendingPower: number = 1.0;
    speedModifier: number = 1.0;
    groupId?: number; // Для групповых гостей
    wantsToLeave: boolean = false;

    // Time tracking
    daysInPark: number = 0;
    ticksInPark: number = 0;
    readonly MAX_DAYS = 5;

    // Visit tracking
    visitingBuildingRoot: string | null = null;

    constructor(id: number, x: number, y: number, guestType: GuestTypeId = 'casual', spendingPower: number = 1.0, speedModifier: number = 1.0, availableSkins: string[] = []) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.guestType = guestType;
        this.spendingPower = spendingPower;
        this.speedModifier = speedModifier;
        this.money = Math.floor(Math.random() * 141 * spendingPower) + 10; // 10 to 150, scaled by spending power
        this.color = `hsl(${Math.random() * 360}, 70%, 60%)`;
        this.emoji = this.getRandomEmoji();
        this.visualType = this.getRandomVisualType(availableSkins);
        this.skin = this.getSkinPath(this.visualType);
        this.isWorker = false;
        this.updateHappinessFromNeeds();
    }

    private getRandomVisualType(availableSkins: string[]): string {
        const standardTypes = Object.keys(Guest.SKINS).filter(key => !Guest.WORKER_SKIN_KEYS.includes(key));
        const allowedTypes = Array.from(
            new Set(availableSkins.filter((key) => !Guest.WORKER_SKIN_KEYS.includes(key)))
        );
        const pool = allowedTypes.length > 0 ? allowedTypes : standardTypes;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    private getSkinPath(type: string): string {
        if (Guest.SKINS[type]) {
            return Guest.SKINS[type];
        }
        return `assets/guests/paid/${type}.svg`;
    }

    private getRandomEmoji(): string {
        const emojis = ['👨', '👩', '🧑', '👦', '👧', '👴', '👵', '👱', '👱‍♀️', '🧔', '👮', '👷', '🕵️'];
        return emojis[Math.floor(Math.random() * emojis.length)];
    }

    private getTypeDefinition(): GuestTypeDefinition {
        return GUEST_TYPES.find(type => type.id === this.guestType) || GUEST_TYPES[0];
    }

    private clampStat(value: number): number {
        return Math.max(0, Math.min(100, value));
    }

    private getNeedEntries(): Array<[GuestNeedKey, number]> {
        return [
            ['satiety', this.satiety],
            ['hydration', this.hydration],
            ['energy', this.energy],
            ['fun', this.fun],
            ['toilet', this.toilet]
        ];
    }

    private getDecayProfile(): Record<GuestNeedKey, number> {
        switch (this.guestType) {
            case 'family':
                return { satiety: 0.07, hydration: 0.09, energy: 0.03, fun: 0.08, toilet: 0.06 };
            case 'teen':
                return { satiety: 0.06, hydration: 0.1, energy: 0.025, fun: 0.14, toilet: 0.045 };
            case 'elder':
                return { satiety: 0.045, hydration: 0.07, energy: 0.04, fun: 0.07, toilet: 0.055 };
            case 'vip':
                return { satiety: 0.04, hydration: 0.06, energy: 0.018, fun: 0.085, toilet: 0.035 };
            default:
                return { satiety: 0.05, hydration: 0.08, energy: 0.02, fun: 0.1, toilet: 0.04 };
        }
    }

    private updateHappinessFromNeeds(instantModifier: number = 0) {
        const weightedNeeds =
            this.satiety * 0.22 +
            this.hydration * 0.2 +
            this.energy * 0.18 +
            this.fun * 0.24 +
            this.toilet * 0.16;

        let targetHappiness = weightedNeeds;
        const criticalNeeds = this.getNeedEntries().filter(([, value]) => value < 15).length;
        const lowNeeds = this.getNeedEntries().filter(([, value]) => value < 30).length;

        if (criticalNeeds > 0) {
            targetHappiness -= criticalNeeds * 12;
        }

        if (lowNeeds >= 3) {
            targetHappiness -= 8;
        }

        if (this.money < 10) {
            targetHappiness -= 5;
        }

        if (this.daysInPark >= this.MAX_DAYS - 1) {
            targetHappiness -= 6;
        }

        targetHappiness += instantModifier;
        this.happiness = this.clampStat((this.happiness * 0.6) + (targetHappiness * 0.4));
    }

    private getPreferenceBoost(
        stats: { fun?: number, satiety?: number, hydration?: number, energy?: number, happiness?: number, toilet?: number },
        context?: VisitContext
    ): number {
        const preferences = this.getTypeDefinition().preferences;
        let boost = 1;

        if (stats.fun && context?.category === 'attraction' && preferences.includes('thrill')) {
            boost += 0.25;
        }

        if ((stats.satiety || stats.hydration) && preferences.includes('food')) {
            boost += 0.2;
        }

        if ((stats.energy || stats.toilet) && preferences.includes('relax')) {
            boost += 0.2;
        }

        if (this.guestType === 'family' && !context?.isGambling && stats.fun) {
            boost += 0.1;
        }

        if (this.guestType === 'elder' && context?.isGambling) {
            boost -= 0.1;
        }

        return Math.max(0.75, boost);
    }

    getMostUrgentNeed(): GuestNeedKey | null {
        const urgentNeeds = this.getNeedEntries()
            .filter(([, value]) => value < 45)
            .sort((a, b) => a[1] - b[1]);

        return urgentNeeds[0]?.[0] ?? null;
    }

    getAverageNeeds(): number {
        const needs = this.getNeedEntries();
        return needs.reduce((sum, [, value]) => sum + value, 0) / needs.length;
    }

    updateNeeds() {
        const profile = this.getDecayProfile();
        const movementFactor = 0.9 + (this.speedModifier * 0.15);

        this.satiety = this.clampStat(this.satiety - profile.satiety * movementFactor);
        this.hydration = this.clampStat(this.hydration - profile.hydration * movementFactor);
        this.energy = this.clampStat(this.energy - profile.energy * movementFactor);
        this.fun = this.clampStat(this.fun - profile.fun);
        this.toilet = this.clampStat(this.toilet - profile.toilet * movementFactor);

        this.updateHappinessFromNeeds();
    }

    visitAttraction(
        stats: { fun?: number, satiety?: number, hydration?: number, energy?: number, happiness?: number, toilet?: number },
        context?: VisitContext
    ) {
        const boost = this.getPreferenceBoost(stats, context);

        if (stats.fun) this.fun = this.clampStat(this.fun + stats.fun * boost);
        if (stats.satiety) {
            this.satiety = this.clampStat(this.satiety + stats.satiety * boost);
            this.toilet = this.clampStat(this.toilet - (stats.satiety * 0.2));
        }
        if (stats.hydration) {
            this.hydration = this.clampStat(this.hydration + stats.hydration * boost);
            this.toilet = this.clampStat(this.toilet - (stats.hydration * 0.3));
        }
        if (stats.energy) this.energy = this.clampStat(this.energy + stats.energy * boost);
        if (stats.toilet) this.toilet = this.clampStat(this.toilet + stats.toilet * boost);

        const explicitHappiness = stats.happiness ? stats.happiness * boost : 0;
        const derivedHappiness = stats.fun ? stats.fun * 0.35 * boost : 0;
        this.updateHappinessFromNeeds(explicitHappiness + derivedHappiness);
    }

    checkMood() {
        if (this.daysInPark >= this.MAX_DAYS) {
            this.wantsToLeave = true;
            // this.emoji = '😫';
            return;
        }

        if (this.money <= 0) {
            this.wantsToLeave = true;
            // this.emoji = '😞';
            return;
        }

        const averageNeeds = this.getAverageNeeds();
        const criticalNeeds = this.getNeedEntries().filter(([, value]) => value < 10).length;
        const lowNeeds = this.getNeedEntries().filter(([, value]) => value < 25).length;

        if (criticalNeeds >= 2 || averageNeeds < 15) {
            this.wantsToLeave = true;
            this.emoji = '🤬';
            return;
        }

        if ((criticalNeeds >= 1 && this.happiness < 35) || (lowNeeds >= 3 && this.happiness < 45)) {
            this.wantsToLeave = true;
            this.emoji = criticalNeeds > 0 ? '😫' : '😞';
            return;
        }

        if (this.money <= 1 && averageNeeds < 40) {
            this.wantsToLeave = true;
            this.emoji = '😞';
            return;
        }

        if (criticalNeeds > 0 || lowNeeds >= 2) {
            this.emoji = '😟';
        }
    }

    incrementTime() {
        this.ticksInPark++;
        // Assuming 60 ticks = 1 day (based on app logic)
        if (this.ticksInPark % 60 === 0) {
            this.daysInPark++;
        }
    }

    // Helper to restore from save
    static fromJSON(data: any): Guest {
        const guest = new Guest(data.id, data.x, data.y);
        Object.assign(guest, data);
        return guest;
    }

    static SKINS: Record<string, string> = {
        'boss': 'assets/guests/boss.svg',
        'child': 'assets/guests/child.svg',
        'mechanic': 'assets/guests/mechanic.svg',
        'mascot': 'assets/guests/mascot.svg',
        'visitor': 'assets/guests/visitor.svg',
        'janitor': 'assets/guests/janitor.svg',
        'tourist': 'assets/guests/tourist.svg',
        'elder': 'assets/guests/elder.svg',
        'punk': 'assets/guests/punk.svg',
        'business': 'assets/guests/business.svg',
        'runner': 'assets/guests/runner.svg',
        'lady_red': 'assets/guests/lady_red.svg',
        'student_girl': 'assets/guests/student_girl.svg',
        'grandma': 'assets/guests/grandma.svg',
        'nurse': 'assets/guests/nurse.svg',
        'artist': 'assets/guests/artist.svg',
        'boy_redhead': 'assets/guests/boy_redhead.svg',
        'girl_brunette': 'assets/guests/girl_brunette.svg',
        'boy_brown': 'assets/guests/boy_brown.svg',
        'girl_pigtails_black': 'assets/guests/girl_pigtails_black.svg',
        'girl_blonde_long': 'assets/guests/girl_blonde_long.svg',
        'boy_hat': 'assets/guests/boy_hat.svg',
        'girl_orange': 'assets/guests/girl_orange.svg',
        'boy_grey': 'assets/guests/boy_grey.svg',
        'girl_blonde_curly': 'assets/guests/girl_blonde_curly.svg',
        'girl_pigtails_brown': 'assets/guests/girl_pigtails_brown.svg',
        'cinderella': 'assets/guests/cinderella.svg',
        'moana': 'assets/guests/moana.svg',
        'stitch': 'assets/guests/stitch.svg',
        'maui': 'assets/guests/maui.svg',
        'man_casual_green': 'assets/guests/man_casual_green.svg',
        'woman_casual_purple': 'assets/guests/woman_casual_purple.svg',
        'man_suit': 'assets/guests/man_suit.svg',
        'woman_pink': 'assets/guests/woman_pink.svg',
        'snow_white': 'assets/guests/snow_white.svg',
        'red_riding_hood': 'assets/guests/red_riding_hood.svg',
        'pinocchio': 'assets/guests/pinocchio.svg',
        'peter_pan': 'assets/guests/peter_pan.svg',
        'alice': 'assets/guests/alice.svg',
        'aladdin': 'assets/guests/aladdin.svg',
        'jasmine': 'assets/guests/jasmine.svg',
        'ariel': 'assets/guests/ariel.svg',
        'belle': 'assets/guests/belle.svg',
        'beast': 'assets/guests/beast.svg',
        'rapunzel': 'assets/guests/rapunzel.svg',
        'flynn': 'assets/guests/flynn.svg',
        'elsa': 'assets/guests/elsa.svg',
        'anna': 'assets/guests/anna.svg',
        'winnie': 'assets/guests/winnie.svg',
        'mickey': 'assets/guests/mickey.svg',
        'minnie': 'assets/guests/minnie.svg',
        'donald': 'assets/guests/donald.svg',
        'goofy': 'assets/guests/goofy.svg',
        'shrek': 'assets/guests/shrek.svg',
        'worker1': 'assets/workers/maintenance_worker_hazmat.svg',
        'worker2': 'assets/workers/maintenance_worker_overalls.svg',
        'worker3': 'assets/workers/maintenance_worker_vest.svg',
    };

    static WORKER_SKIN_KEYS: string[] = [
        'worker1',
        'worker2',
        'worker3'
    ];

    static PremiumSkins: Record<string, number> = {
        'ghost': 1000,
        'pickachu': 1500,
        'pacman': 2000,
        'dracula': 2500,
        'zombie': 3000,
        'frankenstein': 3500,
        'witch': 4000,
        'vampire': 4500,
        'mummy': 5000,
        'werewolf': 5500,
        'spongebob': 6000,
        'patrick': 6500,
        'squidward': 7000,
        'minecraft_steve': 7500,
        'minecraft_creeper': 8000,
        'among_us_red': 8500,
        'among_us_blue': 9000,
        'naruto': 9500,
        'goku': 10000,
        'luffy': 10500,
        'sailor_moon': 11000,
        'sonic': 11500,
        'mario': 12000,
        'link': 12500,
        'kirby': 13000,
        'megaman': 13500,
        'zelda': 14000
    };
}
