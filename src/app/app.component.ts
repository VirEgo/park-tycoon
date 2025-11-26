import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal, ViewChild, ElementRef, AfterViewInit, effect } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { CasinoStatsComponent } from './components/casino-stats/casino-stats.component';
import { SkinsGalleryComponent } from './components/skins-gallery/skins-gallery.component';
import { ExpansionPanelComponent } from './components/expansion-panel/expansion-panel.component';
import { UpgradePanelComponent } from './components/upgrade-panel/upgrade-panel.component';
import { Guest } from './models/guest.model';
import { SafeHtmlPipe } from './pipes/safe-html.pipe';
import { CasinoService } from './services/casino.service';
import { GridService, GRID_W, GRID_H } from './services/grid.service';
import { GuestService } from './services/guest.service';
import { BuildingService } from './services/building.service';
import { GameStateService } from './services/game-state.service';
import { ExpansionService } from './services/expansion.service';
import { AttractionUpgradeService } from './services/attraction-upgrade.service';
import { Cell } from './models/cell.model';
import { ToolType, BuildingType } from './models/building.model';
import { GameSaveState } from './models/game-state.model';
import { ExpansionState } from './models/expansion.model';

const TILE_SIZE = 40;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SafeHtmlPipe, SkinsGalleryComponent, CasinoStatsComponent, ExpansionPanelComponent, UpgradePanelComponent],
  templateUrl: './app.component.html',
  styleUrl: 'app.component.scss'
})
export class TycoonApp implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('gameCanvas') gameCanvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private renderLoopId: number | null = null;
  private skinImages: Map<string, HTMLImageElement> = new Map();

  GRID_W = signal<number>(GRID_W);
  GRID_H = signal<number>(GRID_H);
  TILE_SIZE = TILE_SIZE;

  // State Signals
  money = signal<number>(5000);
  grid = signal<Cell[]>([]);
  guests = signal<Guest[]>([]);
  dayCount = signal<number>(1);
  notifications = signal<string[]>([]);
  isPaused = signal<boolean>(false);

  // Tool Selection
  selectedToolCategory = signal<ToolType | string>('none');
  selectedToolId = signal<string | null>(null);

  // UI Signals
  showGuestStats = signal<boolean>(false);
  selectedGuestId = signal<number | null>(null);
  currentView = signal<'game' | 'gallery'>('game');
  private selectedCasinoCoords = signal<{ x: number, y: number } | null>(null);
  showExpansionPanel = signal<boolean>(false);
  showUpgradePanel = signal<boolean>(false);
  selectedBuildingForUpgrade = signal<{ building: BuildingType, cellX: number, cellY: number } | null>(null);

  // Canvas Interaction State
  private hoveredCell: Cell | null = null;

  selectedCasino = computed(() => {
    const coords = this.selectedCasinoCoords();
    if (!coords) return null;
    return this.casinoService.getCasinoStats(coords.x, coords.y) || null;
  });

  // Modal State
  showConfirmModal = signal<boolean>(false);
  pendingBuildCell = signal<Cell | null>(null);
  pendingBuildId = signal<string | null>(null);

  // Services
  private casinoService = inject(CasinoService);
  private gridService = inject(GridService);
  private guestService = inject(GuestService);
  private buildingService = inject(BuildingService);
  private gameStateService = inject(GameStateService);
  private expansionService = inject(ExpansionService);
  private upgradeService = inject(AttractionUpgradeService);

  guestStats = computed(() => {
    return this.guestService.calculateAverageStats(this.guests());
  });

  selectedGuest = computed(() => {
    const id = this.selectedGuestId();
    return this.guests().find(g => g.id === id) || null;
  });

  // Expansion State
  expansionState = signal<ExpansionState>(this.expansionService.getInitialState());

  // Logic Variables
  private gameLoopSub: Subscription | null = null;
  private saveLoopSub: Subscription | null = null;
  private guestIdCounter = 0;
  private entranceIndex = -1;
  private mouseIsDown = false;
  private tickCounter = 0;
  private casinoLastPayoutDay = 0;
  private lastFrameTime = 0;

  constructor() {
    // Effect to resize canvas when grid dimensions change
    effect(() => {
      const w = this.GRID_W();
      const h = this.GRID_H();
      if (this.gameCanvas && this.gameCanvas.nativeElement) {
        this.gameCanvas.nativeElement.width = w * TILE_SIZE;
        this.gameCanvas.nativeElement.height = h * TILE_SIZE;
      }
    });
  }

  ngOnInit() {
    const loaded = this.loadGame();

    if (!loaded) {
      this.initNewGame();
    }

    this.preloadSkins();
    this.startGameLoop();
    this.startAutoSave();

    window.addEventListener('mousedown', () => this.mouseIsDown = true);
    window.addEventListener('mouseup', () => this.mouseIsDown = false);
  }

  ngAfterViewInit() {
    if (this.gameCanvas) {
      this.ctx = this.gameCanvas.nativeElement.getContext('2d')!;
      // Initial resize
      this.gameCanvas.nativeElement.width = this.GRID_W() * TILE_SIZE;
      this.gameCanvas.nativeElement.height = this.GRID_H() * TILE_SIZE;
      this.startRenderLoop();
    }
  }

  ngOnDestroy() {
    if (this.gameLoopSub) this.gameLoopSub.unsubscribe();
    if (this.saveLoopSub) this.saveLoopSub.unsubscribe();
    if (this.renderLoopId !== null) cancelAnimationFrame(this.renderLoopId);
    window.removeEventListener('mousedown', () => this.mouseIsDown = true);
    window.removeEventListener('mouseup', () => this.mouseIsDown = false);
  }

  private preloadSkins() {
    Object.entries(Guest.SKINS).forEach(([key, svg]) => {
      const img = new Image();
      img.src = 'data:image/svg+xml;base64,' + btoa(svg);
      this.skinImages.set(key, img);
    });
  }

  private startRenderLoop() {
    const loop = (timestamp: number) => {
      if (!this.lastFrameTime) this.lastFrameTime = timestamp;
      const deltaTime = (timestamp - this.lastFrameTime) / 1000; // seconds
      this.lastFrameTime = timestamp;

      if (!this.isPaused()) {
        this.updateGuestMovement(deltaTime);
      }

      this.render();
      this.renderLoopId = requestAnimationFrame(loop);
    };
    this.renderLoopId = requestAnimationFrame(loop);
  }

  private updateGuestMovement(deltaTime: number) {
    const result = this.guestService.processGuestMovement(
      this.guests(),
      this.grid(),
      this.GRID_W(),
      this.GRID_H(),
      deltaTime,
      (amount) => this.money.update(m => m + amount),
      (msg) => this.showNotification(msg)
    );

    // We don't need to set the signal every frame if we are just mutating objects for rendering
    // But if we add/remove guests (leaving), we should update the signal
    if (result.updatedGuests.length !== this.guests().length) {
      this.guests.set(result.updatedGuests);
    }
    // Grid updates (casino bank)
    // this.grid.set(result.updatedGrid); // Avoid setting grid signal every frame if possible
  }

  private render() {
    if (!this.ctx) return;

    const width = this.gameCanvas.nativeElement.width;
    const height = this.gameCanvas.nativeElement.height;
    const grid = this.grid();
    const guests = this.guests();
    const selectedGuestId = this.selectedGuestId();
    const hoveredCell = this.hoveredCell;

    // Clear
    this.ctx.clearRect(0, 0, width, height);

    // 1. Draw Grid
    grid.forEach(cell => {
      const x = cell.x * TILE_SIZE;
      const y = cell.y * TILE_SIZE;

      // Background
      if (cell.type === 'grass') {
        this.ctx.fillStyle = '#4ade80'; // green-400
      } else if (cell.type === 'path') {
        this.ctx.fillStyle = '#9ca3af'; // gray-400
      } else if (cell.type === 'entrance') {
        this.ctx.fillStyle = '#fbbf24'; // amber-400
      } else if (cell.type === 'exit') {
        this.ctx.fillStyle = '#ef4444'; // red-500
      } else if (cell.type === 'building') {
        // If building has color, use it, else gray
        const bId = cell.buildingId;
        if (bId) {
          this.ctx.fillStyle = this.getBuildingColor(bId);
        } else {
          this.ctx.fillStyle = '#6b7280';
        }
      }
      this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

      // Border
      this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      this.ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);

      // Building Icon / Text
      if (cell.type === 'building' && cell.buildingId) {
        const icon = this.getBuildingIcon(cell.buildingId);
        if (icon) {
          this.ctx.font = '24px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillStyle = '#000';
          this.ctx.fillText(icon, x + TILE_SIZE / 2, y + TILE_SIZE / 2);
        }
      } else if (cell.type === 'entrance') {
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('ENT', x + TILE_SIZE / 2, y + TILE_SIZE / 2);
      } else if (cell.type === 'exit') {
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('EXIT', x + TILE_SIZE / 2, y + TILE_SIZE / 2);
      }

      // Hover Effect
      if (hoveredCell && hoveredCell.x === cell.x && hoveredCell.y === cell.y) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    });

    // 2. Draw Guests
    guests.forEach(guest => {
      const gx = guest.x * TILE_SIZE;
      const gy = guest.y * TILE_SIZE;

      // Selection Highlight
      if (selectedGuestId === guest.id) {
        this.ctx.beginPath();
        this.ctx.arc(gx + TILE_SIZE / 2, gy + TILE_SIZE / 2, TILE_SIZE / 1.5, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        this.ctx.fill();
      }

      // Skin
      const skinKey = guest.visualType; // or guest.skin if we map it back
      // Actually guest.skin is the SVG string. guest.visualType is the key (e.g. 'visitor')
      // Let's use visualType to lookup image
      const img = this.skinImages.get(guest.visualType);

      if (img && img.complete) {
        this.ctx.drawImage(img, gx, gy, TILE_SIZE, TILE_SIZE);
      } else {
        // Fallback
        this.ctx.fillStyle = guest.color;
        this.ctx.beginPath();
        this.ctx.arc(gx + TILE_SIZE / 2, gy + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(guest.emoji, gx + TILE_SIZE / 2, gy + TILE_SIZE / 2);
      }

      // Mood/Status Indicator (optional)
      if (guest.happiness < 30) {
        this.ctx.fillStyle = 'red';
        this.ctx.beginPath();
        this.ctx.arc(gx + TILE_SIZE - 5, gy + 5, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
  }

  // --- Canvas Interaction ---

  handleCanvasMouseDown(event: MouseEvent) {
    const rect = this.gameCanvas.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const gridX = Math.floor(x / TILE_SIZE);
    const gridY = Math.floor(y / TILE_SIZE);

    // Check if clicked on a guest
    // We iterate backwards to click top-most guest if they overlap
    const guests = this.guests();
    for (let i = guests.length - 1; i >= 0; i--) {
      const g = guests[i];
      const gx = g.x * TILE_SIZE;
      const gy = g.y * TILE_SIZE;
      // Simple bounding box for guest click
      if (x >= gx && x <= gx + TILE_SIZE && y >= gy && y <= gy + TILE_SIZE) {
        this.onGuestClick(event, g.id);
        return;
      }
    }

    // If not guest, check cell
    const cell = this.gridService.getCell(this.grid(), gridX, gridY, this.GRID_W(), this.GRID_H());
    if (cell) {
      // Handle Casino Click
      if (cell.type === 'building' && cell.buildingId) {
        const bInfo = this.buildingService.getBuildingById(cell.buildingId);
        if (bInfo && bInfo.isGambling) {
          this.onCasinoClick(event, cell);
          return;
        }
      }
      // Handle Normal Click
      this.onCellClick(cell);
    }
  }

  handleCanvasMouseMove(event: MouseEvent) {
    const rect = this.gameCanvas.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const gridX = Math.floor(x / TILE_SIZE);
    const gridY = Math.floor(y / TILE_SIZE);

    const cell = this.gridService.getCell(this.grid(), gridX, gridY, this.GRID_W(), this.GRID_H());
    this.hoveredCell = cell || null;
  }

  handleCanvasDoubleClick(event: MouseEvent) {
    // Optional: Implement zoom or other features
  }

  // --- Save / Load System ---

  initNewGame() {
    const newGrid = this.gridService.createEmptyGrid(GRID_W, GRID_H);

    const entryX = Math.floor(GRID_W / 2);
    const entryY = GRID_H - 1;
    const entryIdx = this.gridService.getCellIndex(entryX, entryY, GRID_W);
    newGrid[entryIdx] = { x: entryX, y: entryY, type: 'entrance' };
    this.entranceIndex = entryIdx;

    const pathIdx = this.gridService.getCellIndex(entryX, entryY - 1, GRID_W);
    newGrid[pathIdx] = { x: entryX, y: entryY - 1, type: 'path' };

    this.grid.set(newGrid);
    this.GRID_W.set(GRID_W);
    this.GRID_H.set(GRID_H);
    this.money.set(5000);
    this.dayCount.set(1);
    this.guests.set([]);
    this.guestIdCounter = 0;
    this.tickCounter = 0;
    this.casinoLastPayoutDay = 1;
  }

  saveGame() {
    const state: GameSaveState = {
      money: this.money(),
      dayCount: this.dayCount(),
      grid: this.grid(),
      gridWidth: this.GRID_W(),
      gridHeight: this.GRID_H(),
      guests: this.guests(),
      guestIdCounter: this.guestIdCounter,
      entranceIndex: this.entranceIndex,
      casinoLastPayoutDay: this.casinoLastPayoutDay
    };

    const success = this.gameStateService.saveGame(state);
    if (!success) {
      this.showNotification('Ошибка сохранения!');
    }
  }

  loadGame(): boolean {
    const state = this.gameStateService.loadGame();
    if (!state) return false;

    this.money.set(state.money);
    this.dayCount.set(state.dayCount);
    this.grid.set(state.grid);

    // Restore dimensions if available, otherwise default
    if (state.gridWidth && state.gridHeight) {
      this.GRID_W.set(state.gridWidth);
      this.GRID_H.set(state.gridHeight);
    } else {
      this.GRID_W.set(GRID_W);
      this.GRID_H.set(GRID_H);
    }

    // Преобразуем сохранённых гостей обратно в экземпляры класса Guest,
    // иначе теряются методы и возникает ошибка типов.
    if (state.guests && Array.isArray(state.guests)) {
      const restored = state.guests.map(g => Guest.fromJSON(g));
      this.guests.set(restored);
    } else {
      this.guests.set([]);
    }
    this.guestIdCounter = state.guestIdCounter;
    this.entranceIndex = state.entranceIndex;
    this.casinoLastPayoutDay = state.casinoLastPayoutDay || 1;

    this.showNotification('Игра загружена!');
    return true;
  }

  resetGame() {
    if (confirm('Вы уверены? Весь прогресс будет потерян.')) {
      this.gameStateService.resetGame();
      this.initNewGame();
      this.showNotification('Новая игра начата');
    }
  }

  startAutoSave() {
    this.saveLoopSub = interval(15000).subscribe(() => {
      this.saveGame();
    });
  }

  // --- Game Loop ---

  startGameLoop() {
    this.gameLoopSub = interval(500).subscribe(() => {
      if (this.isPaused()) return;
      this.updateGame();
    });
  }

  updateGame() {
    this.tickCounter++;
    if (this.tickCounter >= 60) { // 30 seconds (60 * 500ms)
      this.dayCount.update(d => d + 1);
      this.tickCounter = 0;

      // Casino payout every 10 days
      const currentDay = this.dayCount();
      if (currentDay - this.casinoLastPayoutDay >= 10) {
        this.processCasinoPayout();
        this.casinoLastPayoutDay = currentDay;
      }
    }

    const attractionCount = this.grid().filter(c => c.type === 'building').length;
    const currentGuests = this.guests().length;
    const maxGuests = 5 + (attractionCount * 3);

    if (currentGuests < maxGuests && Math.random() > 0.3) {
      this.spawnGuest();
    }

    this.updateGuests();
  }

  spawnGuest() {
    if (this.entranceIndex === -1) return;
    const entrance = this.grid()[this.entranceIndex];

    const attractionCount = this.grid().filter(c => c.type === 'building').length;
    const newGuest = this.guestService.spawnGuest(this.guestIdCounter++, entrance.x, entrance.y, attractionCount);
    this.guests.update(gs => [...gs, newGuest]);
  }

  updateGuests() {
    this.guestService.updateGuestNeeds(this.guests());
  }

  selectTool(category: ToolType | string, id: string | null) {
    this.selectedToolCategory.set(category);
    this.selectedToolId.set(id);
    // Deselect guest when selecting a tool

    console.log(category);

    if (category !== 'none') {
      this.selectedGuestId.set(null);
    }
  }

  toggleGuestStats() {
    this.showGuestStats.update(v => !v);
  }

  onGuestClick(event: MouseEvent, id: number) {
    event.stopPropagation();
    event.preventDefault();
    this.selectedGuestId.set(id);

    // Deselect tool when selecting a guest
    this.selectTool('none', null);
  }

  closeGuestDetails() {
    this.selectedGuestId.set(null);
  }

  onCellHover(event: MouseEvent) {
    // Placeholder
  }

  onCellClick(cell: Cell) {
    const cat = this.selectedToolCategory();
    const id = this.selectedToolId();

    // Deselect tool if clicking on grass with no tool selected
    if (cat === 'none' && cell.type === 'grass') {
      return;
    }

    if (cell.type === 'entrance') {
      this.showNotification('Нельзя сносить вход!');
      return;
    }

    if (cat === 'demolish') {
      this.demolish(cell);
      return;
    }

    if (cat === 'none' || !id) {
      return;
    }

    if (id) {
      const building = this.buildingService.getBuildingById(id);
      if (!building) return;

      if (cell.type !== 'grass') {
        // Show modal instead of confirm
        this.pendingBuildCell.set(cell);
        this.pendingBuildId.set(id);
        this.showConfirmModal.set(true);
        return;
      }

      this.executeBuild(cell, building);
    }
  }

  confirmBuild() {
    const cell = this.pendingBuildCell();
    const id = this.pendingBuildId();
    if (cell && id) {
      const building = this.buildingService.getBuildingById(id);
      if (building) {
        this.executeBuild(cell, building);
      }
    }
    this.closeModal();
    // Note: tool is already reset in executeBuild
  }

  cancelBuild() {
    this.closeModal();
  }

  closeModal() {
    this.showConfirmModal.set(false);
    this.pendingBuildCell.set(null);
    this.pendingBuildId.set(null);
  }

  private executeBuild(cell: Cell, building: import('./models/building.model').BuildingType) {
    if (!this.buildingService.canBuild(building, this.money())) {
      this.showNotification('Недостаточно средств!');
      return;
    }

    this.money.update(m => m - building.price);

    const newGrid = this.buildingService.buildBuilding(this.grid(), cell, building, this.GRID_W());
    this.grid.set(newGrid);
    this.saveGame();

    // Reset tool selection after build
    this.selectTool('none', null);
  }

  // Снос зданий и тд
  demolish(cell: Cell) {
    if (cell.type === 'grass') return;

    if (this.money() < 5) {
      this.showNotification('Нет денег на снос!');
      return;
    }

    this.money.update(m => m - 5);

    const newGrid = this.buildingService.demolishBuilding(this.grid(), cell, this.GRID_W());
    this.grid.set(newGrid);
    this.saveGame();

    // Reset tool selection after demolish
    this.selectTool('none', null);
  }

  getBuildingsByCategory(cat: string) {
    return this.buildingService.getBuildingsByCategory(cat);
  }

  getBuildingColor(id: string): string {
    return this.buildingService.getBuildingColor(id);
  }

  getBuildingIcon(id: string): string {
    return this.buildingService.getBuildingIcon(id);
  }

  trackByGuestId(index: number, guest: Guest): number {
    return guest.id;
  }

  processCasinoPayout() {
    const result = this.buildingService.processCasinoPayout(this.grid());

    if (result.totalPayout > 0) {
      this.money.update(m => m + result.totalPayout);
      this.showNotification(`💰 Выплата казино: $${result.totalPayout.toFixed(2)}`);
      this.grid.set(result.updatedGrid);
    }
  }

  onCasinoClick(event: MouseEvent, cell: Cell) {
    event.stopPropagation();
    event.preventDefault();

    if (cell.buildingId) {
      const bInfo = this.buildingService.getBuildingById(cell.buildingId);
      if (bInfo && bInfo.isGambling) {
        const stats = this.casinoService.getCasinoStats(cell.x, cell.y);
        if (stats) {
          this.selectedCasinoCoords.set({ x: cell.x, y: cell.y });
        }
      }
    }
  }

  closeCasinoStats() {
    this.selectedCasinoCoords.set(null);
  }

  loadDemoPark() {
    const demoSave = this.createDemoSave();
    this.gameStateService.saveGame(demoSave);
    window.location.reload();
  }

  private createDemoSave(): GameSaveState {
    // Создаем сетку
    const grid: Cell[] = [];
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        grid.push({ x, y, type: 'grass' });
      }
    }

    // Главная дорожка (вертикальная по центру)
    for (let y = 0; y < GRID_H; y++) {
      const idx = y * GRID_W + 10;
      grid[idx] = { x: 10, y, type: 'path', variant: 1 };
    }

    // Горизонтальные дорожки
    for (let x = 5; x <= 15; x++) {
      const idx1 = 3 * GRID_W + x;
      const idx2 = 7 * GRID_W + x;
      const idx3 = 11 * GRID_W + x;
      grid[idx1] = { x, y: 3, type: 'path', variant: 1 };
      grid[idx2] = { x, y: 7, type: 'path', variant: 1 };
      grid[idx3] = { x, y: 11, type: 'path', variant: 1 };
    }

    // Вход внизу
    const entranceIdx = 14 * GRID_W + 10;
    grid[entranceIdx] = { x: 10, y: 14, type: 'entrance' };

    // Выход вверху
    const exitIdx = 0 * GRID_W + 10;
    grid[exitIdx] = { x: 10, y: 0, type: 'exit' };

    // Аттракционы
    grid[3 * GRID_W + 7] = { x: 7, y: 3, type: 'building', buildingId: 'carousel' };
    grid[3 * GRID_W + 13] = { x: 13, y: 3, type: 'building', buildingId: 'ferris' };
    grid[7 * GRID_W + 7] = { x: 7, y: 7, type: 'building', buildingId: 'castle' };
    grid[7 * GRID_W + 13] = { x: 13, y: 7, type: 'building', buildingId: 'coaster' };
    grid[11 * GRID_W + 7] = { x: 7, y: 11, type: 'building', buildingId: 'slots', data: { bank: 20 } };
    grid[11 * GRID_W + 13] = { x: 13, y: 11, type: 'building', buildingId: 'shooting', data: { bank: 20 } };

    // Магазины
    grid[3 * GRID_W + 9] = { x: 9, y: 3, type: 'building', buildingId: 'burger' };
    grid[3 * GRID_W + 11] = { x: 11, y: 3, type: 'building', buildingId: 'pizza' };
    grid[7 * GRID_W + 9] = { x: 9, y: 7, type: 'building', buildingId: 'soda' };
    grid[7 * GRID_W + 11] = { x: 11, y: 7, type: 'building', buildingId: 'coffee' };
    grid[11 * GRID_W + 9] = { x: 9, y: 11, type: 'building', buildingId: 'popcorn' };
    grid[11 * GRID_W + 11] = { x: 11, y: 11, type: 'building', buildingId: 'icecream' };

    // Декорации
    grid[5 * GRID_W + 10] = { x: 10, y: 5, type: 'building', buildingId: 'fountain' };
    grid[2 * GRID_W + 5] = { x: 5, y: 2, type: 'building', buildingId: 'tree' };
    grid[2 * GRID_W + 15] = { x: 15, y: 2, type: 'building', buildingId: 'tree' };
    grid[12 * GRID_W + 5] = { x: 5, y: 12, type: 'building', buildingId: 'tree' };
    grid[12 * GRID_W + 15] = { x: 15, y: 12, type: 'building', buildingId: 'tree' };
    grid[9 * GRID_W + 10] = { x: 10, y: 9, type: 'building', buildingId: 'bench' };

    // Инициализация казино
    const casinoData = JSON.stringify({
      casino_7_11: {
        totalBank: 0,
        totalVisits: 0,
        totalWins: 0,
        totalLosses: 0,
        lastPayoutDay: 0,
        transactions: []
      },
      casino_13_11: {
        totalBank: 0,
        totalVisits: 0,
        totalWins: 0,
        totalLosses: 0,
        lastPayoutDay: 0,
        transactions: []
      }
    });

    return {
      money: 10000,
      dayCount: 1,
      grid: grid,
      gridWidth: GRID_W,
      gridHeight: GRID_H,
      guests: [],
      guestIdCounter: 1,
      entranceIndex: entranceIdx,
      casinoLastPayoutDay: 0,
      casinoData: casinoData
    };
  }

  showNotification(msg: string) {
    this.notifications.update(n => [...n, msg]);
    setTimeout(() => {
      this.notifications.update(n => n.filter(x => x !== msg));
    }, 2000);
  }

  // --- Expansion Panel Methods ---

  openExpansionPanel() {
    this.showExpansionPanel.set(true);
  }

  closeExpansionPanel() {
    this.showExpansionPanel.set(false);
  }

  handleLandPurchase(event: { plotId: string; cost: number }) {
    const result = this.expansionService.purchasePlot(
      this.expansionState(),
      event.plotId,
      this.money()
    );

    if (result.success && result.newState) {
      this.expansionState.set(result.newState);
      this.money.update(m => m - event.cost);

      // Расширяем сетку
      this.expandGrid(event.plotId);

      this.showNotification(result.message);
      this.saveGame();

      // Проверяем открытые здания
      const unlockedBuildings = this.expansionService.getUnlockedBuildings(result.newState);
      if (unlockedBuildings.length > 0) {
        this.showNotification(`🎉 Открыты новые здания: ${unlockedBuildings.join(', ')}`);
      }
    } else {
      this.showNotification(result.message);
    }
  }

  // --- Upgrade Panel Methods ---

  openUpgradePanel(cell: Cell) {
    if (cell.type === 'building' && cell.buildingId) {
      const building = this.buildingService.getBuildingById(cell.buildingId);
      if (building) {
        this.selectedBuildingForUpgrade.set({ building, cellX: cell.x, cellY: cell.y });
        this.showUpgradePanel.set(true);
      }
    }
  }

  closeUpgradePanel() {
    this.showUpgradePanel.set(false);
    this.selectedBuildingForUpgrade.set(null);
  }

  handleUpgrade(event: { cost: number }) {
    this.money.update(m => m - event.cost);
    this.showNotification('✅ Аттракцион улучшен!');
    this.saveGame();
  }

  handleThemeApplied(event: { cost: number }) {
    this.money.update(m => m - event.cost);
    this.showNotification('🎨 Тема применена!');
    this.saveGame();
  }

  // --- Grid Expansion ---

  private expandGrid(plotId: string) {
    const state = this.expansionState();
    const plot = state.plots.find(p => p.id === plotId);
    if (!plot) return;

    const currentGrid = this.grid();
    const currentW = this.GRID_W();
    const currentH = this.GRID_H();

    // 1. Calculate new bounds based on ALL purchased plots
    // Base grid is always at (0,0) with size 20x15 (GRID_W x GRID_H constants)
    let minX = 0;
    let maxX = 20; // Base width
    let minY = 0;
    let maxY = 15; // Base height

    // Helper to update bounds
    const updateBounds = (p: import('./models/expansion.model').LandPlot) => {
      // Assuming gridX/gridY are multipliers of base size (20x15)
      const pX = p.gridX * 20;
      const pY = p.gridY * 15;

      minX = Math.min(minX, pX);
      maxX = Math.max(maxX, pX + p.size.w);
      minY = Math.min(minY, pY);
      maxY = Math.max(maxY, pY + p.size.h);
    };

    // Iterate all purchased plots
    state.plots.filter(p => p.purchased).forEach(updateBounds);

    const newW = maxX - minX;
    const newH = maxY - minY;

    // 2. Calculate offset needed to shift everything to positive coordinates
    const targetOffsetX = -minX;
    const targetOffsetY = -minY;

    // 3. Calculate OLD offset to map current grid cells to new grid
    let oldMinX = 0;
    let oldMinY = 0;

    const oldPlots = state.plots.filter(p => p.purchased && p.id !== plotId);
    if (oldPlots.length > 0) {
      let oldMaxX = 20;
      let oldMaxY = 15;
      oldPlots.forEach(p => {
        const pX = p.gridX * 20;
        const pY = p.gridY * 15;
        oldMinX = Math.min(oldMinX, pX);
        oldMaxX = Math.max(oldMaxX, pX + p.size.w);
        oldMinY = Math.min(oldMinY, pY);
        oldMaxY = Math.max(oldMaxY, pY + p.size.h);
      });
    }

    const oldOffsetX = -oldMinX;
    const oldOffsetY = -oldMinY;

    // Calculate the shift difference
    const shiftX = targetOffsetX - oldOffsetX;
    const shiftY = targetOffsetY - oldOffsetY;

    // 4. Create new grid
    const newGrid: Cell[] = [];

    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newW; x++) {
        // Convert new grid coord (x,y) to world coord
        // worldX = x - targetOffsetX
        // worldY = y - targetOffsetY

        // Convert world coord to old grid coord
        // oldGridX = worldX + oldOffsetX
        // oldGridY = worldY + oldOffsetY

        // Combined:
        // oldGridX = x - targetOffsetX + oldOffsetX = x - shiftX
        const oldGridX = x - shiftX;
        const oldGridY = y - shiftY;

        if (oldGridX >= 0 && oldGridX < currentW && oldGridY >= 0 && oldGridY < currentH) {
          // Copy old cell
          const oldIdx = oldGridY * currentW + oldGridX;
          const oldCell = currentGrid[oldIdx];
          newGrid.push({ ...oldCell, x, y });

          // Update entrance index
          if (oldIdx === this.entranceIndex) {
            this.entranceIndex = y * newW + x;
          }
        } else {
          // New territory
          newGrid.push({ x, y, type: 'grass' });
        }
      }
    }

    // 5. Update guests
    if (shiftX > 0 || shiftY > 0) {
      this.guests.update(gs => {
        gs.forEach(guest => {
          guest.x += shiftX;
          guest.y += shiftY;
          guest.targetX += shiftX;
          guest.targetY += shiftY;
        });
        return [...gs];
      });
    }

    // 6. Apply changes
    this.GRID_W.set(newW);
    this.GRID_H.set(newH);
    this.grid.set(newGrid);
  }
}