import { GuestTypeId } from './guest-type.model';

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

    constructor(id: number, x: number, y: number, guestType: GuestTypeId = 'casual', spendingPower: number = 1.0, speedModifier: number = 1.0, ownedPremiumSkins: string[] = []) {
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
        this.visualType = this.getRandomVisualType(ownedPremiumSkins);
        this.skin = this.getSkinPath(this.visualType);
        this.isWorker = false;
    }

    private getRandomVisualType(ownedPremiumSkins: string[]): string {
        const standardTypes = Object.keys(Guest.SKINS).filter(key => !Guest.WORKER_SKIN_KEYS.includes(key));
        const allTypes = [...standardTypes, ...ownedPremiumSkins];
        return allTypes[Math.floor(Math.random() * allTypes.length)];
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

    updateNeeds() {
        // Decrease stats slowly
        this.satiety = Math.max(0, this.satiety - 0.05);
        this.hydration = Math.max(0, this.hydration - 0.08);
        this.energy = Math.max(0, this.energy - 0.02);
        this.fun = Math.max(0, this.fun - 0.1);
        this.toilet = Math.max(0, this.toilet - 0.04);

        // Happiness decays slightly
        this.happiness = Math.max(0, this.happiness - 0.05);
    }

    visitAttraction(stats: { fun?: number, satiety?: number, hydration?: number, energy?: number, happiness?: number, toilet?: number }) {
        if (stats.fun) this.fun = Math.min(100, this.fun + stats.fun);
        if (stats.satiety) {
            this.satiety = Math.min(100, this.satiety + stats.satiety);
            this.toilet = Math.max(0, this.toilet - (stats.satiety * 0.2)); // Eating makes you need toilet
        }
        if (stats.hydration) {
            this.hydration = Math.min(100, this.hydration + stats.hydration);
            this.toilet = Math.max(0, this.toilet - (stats.hydration * 0.3)); // Drinking makes you need toilet
        }
        if (stats.energy) this.energy = Math.min(100, this.energy + stats.energy);
        if (stats.toilet) this.toilet = Math.min(100, this.toilet + stats.toilet);

        if (stats.happiness) {
            this.happiness = Math.min(100, this.happiness + stats.happiness);
        } else if (stats.fun) {
            this.happiness = Math.min(100, this.happiness + (stats.fun / 2));
        }
    }

    checkMood() {
        // Returns true if guest wants to leave

        // Check time
        if (this.daysInPark >= this.MAX_DAYS) {
            this.wantsToLeave = true;
            return;
        }

        // Check needs
        // "If all or at least two main needs are below 20"
        let lowNeeds = 0;
        if (this.satiety < 20) lowNeeds++;
        if (this.hydration < 20) lowNeeds++;
        if (this.energy < 20) lowNeeds++;
        if (this.fun < 20) lowNeeds++;
        if (this.toilet < 20) lowNeeds++;

        if (lowNeeds >= 2 || this.happiness < 20) {
            this.emoji = '🤬'; // Angry
            this.wantsToLeave = true;
            return;
        }

        if (this.money <= 5) {
            this.wantsToLeave = true;
            return;
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
