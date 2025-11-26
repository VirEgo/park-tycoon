import { GuestTypeId } from './guest-type.model';

export class Guest {
    id: number;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    money: number;

    // Stats (0-100)
    happiness: number = 100;
    satiety: number = 100;   // Hunger
    hydration: number = 100; // Thirst
    energy: number = 100;    // Rest
    fun: number = 100;       // Entertainment

    state: 'walking' | 'idle' | 'spending' | 'leaving' = 'idle';
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

    constructor(id: number, x: number, y: number, guestType: GuestTypeId = 'casual', spendingPower: number = 1.0, speedModifier: number = 1.0) {
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
        this.visualType = this.getRandomVisualType();
        this.skin = Guest.SKINS[this.visualType] || Guest.SKINS['visitor'];
    }

    private getRandomVisualType(): string {
        const types = Object.keys(Guest.SKINS);
        return types[Math.floor(Math.random() * types.length)];
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

        // Happiness decays slightly
        this.happiness = Math.max(0, this.happiness - 0.05);
    }

    visitAttraction(stats: { fun?: number, satiety?: number, hydration?: number, energy?: number, happiness?: number }) {
        if (stats.fun) this.fun = Math.min(100, this.fun + stats.fun);
        if (stats.satiety) this.satiety = Math.min(100, this.satiety + stats.satiety);
        if (stats.hydration) this.hydration = Math.min(100, this.hydration + stats.hydration);
        if (stats.energy) this.energy = Math.min(100, this.energy + stats.energy);

        if (stats.happiness) {
            this.happiness = Math.min(100, this.happiness + stats.happiness);
        } else if (stats.fun) {
            // Fun contributes to happiness
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
        'boss': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect width="20" height="20" fill="none" /><rect x="6" y="1" width="8" height="4" fill="#222034" /><rect x="4" y="5" width="12" height="1" fill="#222034" /><rect x="6" y="6" width="8" height="5" fill="#d9a066" /><rect x="7" y="7" width="2" height="2" fill="#222034" /><rect x="11" y="7" width="2" height="2" fill="#222034" /><rect x="7" y="10" width="6" height="1" fill="#663931" /><rect x="4" y="11" width="12" height="8" fill="#323c39" /><rect x="9" y="11" width="2" height="2" fill="#ffffff" /><rect x="9" y="13" width="2" height="4" fill="#ac3232" /></svg>`,
        'child': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="4" width="8" height="3" fill="#663931" /><rect x="7" y="7" width="6" height="4" fill="#d9a066" /><rect x="8" y="8" width="1" height="1" fill="#222034" /><rect x="11" y="8" width="1" height="1" fill="#222034" /><rect x="8" y="10" width="4" height="1" fill="#ac3232" /><rect x="6" y="11" width="8" height="8" fill="#6abe30" /><rect x="1" y="1" width="6" height="7" fill="#d95763" /><rect x="4" y="8" width="1" height="8" fill="#ffffff" /><rect x="4" y="13" width="2" height="2" fill="#d9a066" /></svg>`,
        'mechanic': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="3" fill="#fbf236" /><rect x="5" y="5" width="10" height="1" fill="#fbf236" /><rect x="6" y="6" width="8" height="4" fill="#d9a066" /><rect x="6" y="7" width="8" height="2" fill="#76428a" /><rect x="5" y="10" width="10" height="9" fill="#df7126" /><rect x="1" y="7" width="3" height="2" fill="#9badb7" /><rect x="2" y="9" width="1" height="6" fill="#9badb7" /><rect x="1" y="15" width="3" height="2" fill="#9badb7" /><rect x="2" y="11" width="2" height="2" fill="#d9a066" /></svg>`,
        'mascot': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="4" y="2" width="3" height="3" fill="#4b2d26" /><rect x="13" y="2" width="3" height="3" fill="#4b2d26" /><rect x="4" y="5" width="12" height="8" fill="#8f563b" /><rect x="7" y="8" width="6" height="4" fill="#d9a066" /><rect x="9" y="9" width="2" height="1" fill="#222034" /><rect x="6" y="7" width="1" height="1" fill="#222034" /><rect x="13" y="7" width="1" height="1" fill="#222034" /><rect x="5" y="13" width="10" height="7" fill="#8f563b" /><rect x="8" y="14" width="4" height="4" fill="#d9a066" /></svg>`,
        'visitor': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="4" width="8" height="3" fill="#663931" /><rect x="7" y="7" width="6" height="4" fill="#d9a066" /><rect x="8" y="8" width="1" height="1" fill="#222034" /><rect x="11" y="8" width="1" height="1" fill="#222034" /><rect x="8" y="10" width="4" height="1" fill="#ac3232" /><rect x="6" y="11" width="8" height="8" fill="#6abe30" /><rect x="1" y="1" width="6" height="7" fill="#d95763" /><rect x="4" y="8" width="1" height="8" fill="#ffffff" /><rect x="4" y="13" width="2" height="2" fill="#d9a066" /></svg>`,
        'janitor': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="2" fill="#306082" /><rect x="6" y="4" width="10" height="1" fill="#306082" /><rect x="7" y="5" width="6" height="4" fill="#d9a066" /><rect x="8" y="6" width="1" height="1" fill="#222034" /><rect x="11" y="6" width="1" height="1" fill="#222034" /><rect x="6" y="9" width="8" height="10" fill="#5b6ee1" /><rect x="7" y="9" width="1" height="3" fill="#4b5bab" /><rect x="12" y="9" width="1" height="3" fill="#4b5bab" /><rect x="16" y="4" width="2" height="10" fill="#663931" /><rect x="15" y="14" width="4" height="5" fill="#fbf236" /></svg>`,
        'tourist': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="7" y="5" width="6" height="4" fill="#d9a066" /><rect x="5" y="3" width="10" height="2" fill="#eec39a" /><rect x="6" y="2" width="8" height="1" fill="#eec39a" /><rect x="6" y="9" width="8" height="6" fill="#45a1ff" /><rect x="8" y="11" width="4" height="3" fill="#333" /><rect x="9" y="12" width="2" height="1" fill="#555" /><rect x="7" y="15" width="2" height="4" fill="#d9a066" /><rect x="11" y="15" width="2" height="4" fill="#d9a066" /></svg>`,
        'elder': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="3" fill="#d3d3d3" /><rect x="5" y="4" width="1" height="2" fill="#d3d3d3" /><rect x="14" y="4" width="1" height="2" fill="#d3d3d3" /><rect x="6" y="5" width="8" height="4" fill="#d9a066" /><rect x="6" y="6" width="3" height="1" fill="#333" /><rect x="11" y="6" width="3" height="1" fill="#333" /><rect x="5" y="9" width="10" height="7" fill="#5d4037" /><rect x="14" y="11" width="1" height="8" fill="#8d6e63" /></svg>`,
        'punk': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="9" y="1" width="2" height="5" fill="#ff00ff" /><rect x="7" y="5" width="6" height="4" fill="#d9a066" /><rect x="6" y="9" width="8" height="6" fill="#222" /><rect x="7" y="15" width="2" height="4" fill="#444" /><rect x="11" y="15" width="2" height="4" fill="#444" /></svg>`,
        'business': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="3" fill="#5d4037" /><rect x="5" y="4" width="1" height="6" fill="#5d4037" /><rect x="14" y="4" width="1" height="6" fill="#5d4037" /><rect x="6" y="5" width="8" height="4" fill="#d9a066" /><rect x="6" y="9" width="8" height="6" fill="#37474f" /><rect x="9" y="9" width="2" height="4" fill="#fff" /></svg>`,
        'runner': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="4" width="8" height="1" fill="#ffeb3b" /><rect x="6" y="3" width="8" height="5" fill="#d9a066" /><rect x="7" y="8" width="6" height="7" fill="#f44336" /><rect x="7" y="15" width="2" height="4" fill="#2196f3" /><rect x="11" y="15" width="2" height="4" fill="#2196f3" /></svg>`,

        // New Female Skins
        'lady_red': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="3" fill="#5d4037" /><rect x="5" y="3" width="1" height="4" fill="#5d4037" /><rect x="14" y="3" width="1" height="4" fill="#5d4037" /><rect x="6" y="5" width="8" height="4" fill="#d9a066" /><rect x="7" y="9" width="6" height="10" fill="#d32f2f" /><rect x="6" y="9" width="1" height="4" fill="#d32f2f" /><rect x="13" y="9" width="1" height="4" fill="#d32f2f" /><rect x="6" y="13" width="1" height="2" fill="#d9a066" /><rect x="13" y="13" width="1" height="2" fill="#d9a066" /></svg>`,
        'student_girl': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="3" fill="#fdd835" /><rect x="5" y="3" width="1" height="3" fill="#fdd835" /><rect x="14" y="3" width="1" height="3" fill="#fdd835" /><rect x="6" y="5" width="8" height="4" fill="#d9a066" /><rect x="6" y="9" width="8" height="5" fill="#1976d2" /><rect x="6" y="14" width="8" height="5" fill="#424242" /><rect x="5" y="9" width="1" height="4" fill="#1976d2" /><rect x="14" y="9" width="1" height="4" fill="#1976d2" /></svg>`,
        'grandma': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="4" fill="#9e9e9e" /><rect x="8" y="1" width="4" height="1" fill="#9e9e9e" /><rect x="6" y="6" width="8" height="3" fill="#d9a066" /><rect x="6" y="7" width="8" height="1" fill="#333" opacity="0.5" /><rect x="6" y="9" width="8" height="6" fill="#8e24aa" /><rect x="6" y="15" width="8" height="4" fill="#616161" /></svg>`,
        'nurse': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="3" width="8" height="3" fill="#5d4037" /><rect x="7" y="1" width="6" height="2" fill="#fff" /><rect x="9" y="1" width="2" height="2" fill="#f44336" /><rect x="6" y="6" width="8" height="3" fill="#d9a066" /><rect x="6" y="9" width="8" height="10" fill="#fff" /><rect x="9" y="11" width="2" height="2" fill="#f44336" /></svg>`,
        'artist': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="5" y="2" width="10" height="2" fill="#d32f2f" /><rect x="6" y="4" width="8" height="2" fill="#333" /><rect x="6" y="6" width="8" height="3" fill="#d9a066" /><rect x="6" y="9" width="8" height="10" fill="#fff" /><rect x="7" y="12" width="2" height="2" fill="#f44336" /><rect x="11" y="14" width="2" height="2" fill="#2196f3" /><rect x="8" y="16" width="2" height="2" fill="#ffeb3b" /></svg>`,

        // New Pixel Art Skins
        'boy_redhead': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="3" fill="#d32f2f" /><rect x="5" y="3" width="1" height="2" fill="#d32f2f" /><rect x="14" y="3" width="1" height="2" fill="#d32f2f" /><rect x="6" y="5" width="8" height="4" fill="#d9a066" /><rect x="6" y="9" width="8" height="6" fill="#fbc02d" /><rect x="5" y="9" width="1" height="4" fill="#1976d2" /><rect x="14" y="9" width="1" height="4" fill="#1976d2" /><rect x="7" y="15" width="2" height="4" fill="#1a237e" /><rect x="11" y="15" width="2" height="4" fill="#1a237e" /></svg>`,
        'girl_brunette': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="4" fill="#5d4037" /><rect x="5" y="3" width="1" height="5" fill="#5d4037" /><rect x="14" y="3" width="1" height="5" fill="#5d4037" /><rect x="6" y="5" width="8" height="4" fill="#d9a066" /><rect x="6" y="9" width="8" height="8" fill="#00897b" /><rect x="5" y="9" width="1" height="4" fill="#00897b" /><rect x="14" y="9" width="1" height="4" fill="#00897b" /><rect x="6" y="17" width="2" height="2" fill="#e91e63" /><rect x="12" y="17" width="2" height="2" fill="#e91e63" /></svg>`,
        'boy_brown': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="3" fill="#795548" /><rect x="6" y="5" width="8" height="4" fill="#d9a066" /><rect x="6" y="9" width="8" height="6" fill="#2196f3" /><rect x="5" y="9" width="1" height="6" fill="#2196f3" /><rect x="14" y="9" width="1" height="6" fill="#2196f3" /><rect x="7" y="15" width="2" height="4" fill="#512da8" /><rect x="11" y="15" width="2" height="4" fill="#512da8" /></svg>`,
        'girl_pigtails_black': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="3" fill="#212121" /><rect x="4" y="3" width="2" height="4" fill="#212121" /><rect x="14" y="3" width="2" height="4" fill="#212121" /><rect x="4" y="2" width="2" height="1" fill="#f44336" /><rect x="14" y="2" width="2" height="1" fill="#f44336" /><rect x="6" y="5" width="8" height="4" fill="#d9a066" /><rect x="6" y="9" width="8" height="6" fill="#009688" /><rect x="7" y="9" width="1" height="6" fill="#d32f2f" /><rect x="12" y="9" width="1" height="6" fill="#d32f2f" /><rect x="7" y="15" width="2" height="4" fill="#d32f2f" /><rect x="11" y="15" width="2" height="4" fill="#d32f2f" /></svg>`,
        'girl_blonde_long': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="3" fill="#fdd835" /><rect x="5" y="3" width="1" height="10" fill="#fdd835" /><rect x="14" y="3" width="1" height="10" fill="#fdd835" /><rect x="6" y="5" width="8" height="4" fill="#d9a066" /><rect x="6" y="9" width="8" height="10" fill="#81d4fa" /></svg>`,
        'boy_hat': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="1" width="8" height="2" fill="#1565c0" /><rect x="5" y="3" width="10" height="1" fill="#1565c0" /><rect x="6" y="4" width="8" height="5" fill="#d9a066" /><rect x="6" y="9" width="8" height="6" fill="#0d47a1" /><rect x="7" y="15" width="2" height="4" fill="#0d47a1" /><rect x="11" y="15" width="2" height="4" fill="#0d47a1" /><rect x="5" y="9" width="1" height="4" fill="#90caf9" /><rect x="14" y="9" width="1" height="4" fill="#90caf9" /></svg>`,
        'girl_orange': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="4" fill="#e64a19" /><rect x="5" y="4" width="1" height="3" fill="#e64a19" /><rect x="14" y="4" width="1" height="3" fill="#e64a19" /><rect x="6" y="5" width="8" height="4" fill="#d9a066" /><rect x="6" y="9" width="8" height="6" fill="#c62828" /><rect x="7" y="9" width="1" height="6" fill="#fbc02d" /><rect x="12" y="9" width="1" height="6" fill="#fbc02d" /><rect x="7" y="15" width="2" height="4" fill="#4527a0" /><rect x="11" y="15" width="2" height="4" fill="#4527a0" /></svg>`,
        'boy_grey': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="3" fill="#757575" /><rect x="6" y="5" width="8" height="4" fill="#d9a066" /><rect x="6" y="9" width="8" height="6" fill="#388e3c" /><rect x="5" y="9" width="1" height="4" fill="#388e3c" /><rect x="14" y="9" width="1" height="4" fill="#388e3c" /><rect x="7" y="15" width="2" height="4" fill="#5d4037" /><rect x="11" y="15" width="2" height="4" fill="#5d4037" /></svg>`,
        'girl_blonde_curly': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="5" y="2" width="10" height="5" fill="#fbc02d" /><rect x="4" y="3" width="1" height="6" fill="#fbc02d" /><rect x="15" y="3" width="1" height="6" fill="#fbc02d" /><rect x="6" y="5" width="8" height="4" fill="#d9a066" /><rect x="6" y="9" width="8" height="6" fill="#42a5f5" /><rect x="6" y="15" width="8" height="4" fill="#f48fb1" /></svg>`,
        'girl_pigtails_brown': `<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="6" y="2" width="8" height="3" fill="#3e2723" /><rect x="4" y="3" width="2" height="4" fill="#3e2723" /><rect x="14" y="3" width="2" height="4" fill="#3e2723" /><rect x="4" y="2" width="2" height="1" fill="#00bcd4" /><rect x="14" y="2" width="2" height="1" fill="#00bcd4" /><rect x="6" y="5" width="8" height="4" fill="#d9a066" /><rect x="6" y="9" width="8" height="8" fill="#ff9800" /><rect x="6" y="17" width="2" height="2" fill="#d32f2f" /><rect x="12" y="17" width="2" height="2" fill="#d32f2f" /></svg>`,
    }
}
