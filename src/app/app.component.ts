import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild, WritableSignal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { ExpansionPanelComponent } from './components/expansion-panel/expansion-panel.component';
import { GuestDetailsComponent } from './components/guest-details/guest-details.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { UpgradePanelComponent } from './components/upgrade-panel/upgrade-panel.component';
import { BuildingType, ToolType } from './models/building.model';
import { Cell } from './models/cell.model';
import { ExpansionState, LandPlot } from './models/expansion.model';
import { GameSaveState } from './models/game-state.model';
import { Guest } from './models/guest.model';
import { AttractionUpgradeService } from './services/attraction-upgrade.service';
import { BuildingStatusService } from './services/building-status.service';
import { BuildingService } from './services/building.service';
import { CasinoService } from './services/casino.service';
import { ExpansionService } from './services/expansion.service';
import { GameStateService } from './services/game-state.service';
import { GRID_H, GRID_W, GridService } from './services/grid.service';
import { GuestService } from './services/guest.service';
import { CanvasRenderService } from './services/canvas-render.service';
import { MaintenanceService } from './services/maintenance.service';
import { SpatialHash, FrameRateLimiter } from './utils/performance.utils';
import { PremiumSkinsService } from './services/guest/primium-skins';

const TILE_SIZE = 40;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;
const MAX_CANVAS_HEIGHT = 700;
const MAX_CANVAS_WIDTH = 1200;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  template: `<router-outlet></router-outlet>`
})
export class AppComponent {
  title = 'park-tycoon';
}

@Component({
  selector: 'app-tycoon',
  standalone: true,
  imports: [CommonModule, RouterModule, UpgradePanelComponent, GuestDetailsComponent, SidebarComponent, ExpansionPanelComponent],
  templateUrl: './app.component.html',
  styleUrl: 'app.component.scss'
})
export class TycoonApp implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('gameCanvas') gameCanvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private renderLoopId: number | null = null;
  private handleEscapeListener = (event: KeyboardEvent) => this.handleEscape(event);
  private handleContextMenuListener = (event: MouseEvent) => this.handleGlobalRightClick(event);
  private stopPanListener = () => this.stopPanning();
  private handleResize = () => this.resizeCanvas();
  private handleMouseDown = () => this.mouseIsDown = true;
  private handleMouseUp = () => this.mouseIsDown = false;

  GRID_W = signal<number>(GRID_W);
  GRID_H = signal<number>(GRID_H);
  TILE_SIZE = TILE_SIZE;
  viewScale = signal<number>(1);
  panX = signal<number>(0);
  panY = signal<number>(0);

  // State Signals
  money = inject(GameStateService).money;
  grid = signal<Cell[]>([]);
  guests = signal<Guest[]>([]);
  dayCount = signal<number>(1);
  notifications = signal<string[]>([]);
  isPaused = signal<boolean>(false);
  isParkClosed = signal<boolean>(false);
  premiumSkinsOwned = signal<string[]>([]);

  // Tool Selection
  selectedToolCategory = signal<ToolType | string>('none');
  selectedToolId = signal<string | null>(null);

  // UI Signals
  showGuestStats = signal<boolean>(false);
  selectedGuestId = signal<number | null>(null);
  showExpansionPanel = signal<boolean>(false);
  showUpgradePanel = signal<boolean>(false);

  // Updated to include repair info
  selectedBuildingForUpgrade = signal<{
    building: BuildingType,
    cellX: number,
    cellY: number,
    isBroken: boolean,
    repairCost: number
  } | null>(null);

  showSidebar = signal<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

  // Canvas Interaction State
  private hoveredCell: Cell | null = null;

  // Modal State
  showConfirmModal = signal<boolean>(false);
  pendingBuildCell = signal<Cell | null>(null);
  pendingBuildId = signal<string | null>(null);

  // Services
  private casinoService = inject(CasinoService);
  private gridService = inject(GridService);
  private guestService = inject(GuestService);
  private buildingService = inject(BuildingService);
  private buildingStatusService = inject(BuildingStatusService);
  private gameStateService = inject(GameStateService);
  private expansionService = inject(ExpansionService);
  private upgradeService = inject(AttractionUpgradeService);
  private router = inject(Router);
  private canvasRenderService = inject(CanvasRenderService);
  private maintenanceService = inject(MaintenanceService);
  private premiumSkinsService = inject(PremiumSkinsService);

  guestStats = computed(() => {
    return this.guestService.calculateAverageStats(this.guests());
  });

  selectedGuest = computed(() => {
    const id = this.selectedGuestId();
    return this.guests().find(g => g.id === id) || null;
  });

  // Статистика зданий по категориям и типам
  buildingStats = computed(() => {
    const grid = this.grid();
    const stats: {
      total: number;
      byCategory: Record<string, number>;
      byType: Record<string, { count: number; name: string; category: string }>;
    } = {
      total: 0,
      byCategory: {},
      byType: {}
    };

    grid.forEach(cell => {
      if (cell.type === 'building' && cell.isRoot && cell.buildingId) {
        stats.total++;

        const building = this.buildingService.getBuildingById(cell.buildingId);
        if (building) {
          // По категориям
          const cat = building.category;
          stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

          // По типам зданий
          if (!stats.byType[cell.buildingId]) {
            stats.byType[cell.buildingId] = { count: 0, name: building.name, category: cat };
          }
          stats.byType[cell.buildingId].count++;
        }
      }
    });

    return stats;
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
  private isPanning = false;
  private panStart = { x: 0, y: 0, panX: 0, panY: 0 };
  private readonly dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  private parkClosedEffectReady = false;

  // === ОПТИМИЗАЦИЯ: Контроль частоты обновлений ===
  private frameRateLimiter = new FrameRateLimiter(60);
  private needsRender = true; // Флаг для отложенного рендера

  constructor() {
    effect(() => {
      this.resizeCanvas();
    });

    effect(() => {
      const closed = this.isParkClosed();
      if (!this.parkClosedEffectReady) {
        this.parkClosedEffectReady = true;
        return;
      }
      this.saveGame();
    });

    this.premiumSkinsOwned.set(this.premiumSkinsService.getOwnedSkins());
  }

  ngOnInit() {
    const loaded = this.loadGame();

    if (!loaded) {
      this.initNewGame();
    }

    this.canvasRenderService.preloadSkins();
    this.startGameLoop();
    this.startAutoSave();

    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('keydown', this.handleEscapeListener);
    window.addEventListener('contextmenu', this.handleContextMenuListener);
    window.addEventListener('mouseup', this.stopPanListener);
    window.addEventListener('resize', this.handleResize);
  }

  ngAfterViewInit() {
    if (this.gameCanvas) {
      this.ctx = this.gameCanvas.nativeElement.getContext('2d')!;
      this.resizeCanvas();
      this.startRenderLoop();
    }
  }

  ngOnDestroy() {
    this.saveGame();
    if (this.gameLoopSub) this.gameLoopSub.unsubscribe();
    if (this.saveLoopSub) this.saveLoopSub.unsubscribe();
    if (this.renderLoopId !== null) cancelAnimationFrame(this.renderLoopId);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('keydown', this.handleEscapeListener);
    window.removeEventListener('contextmenu', this.handleContextMenuListener);
    window.removeEventListener('mouseup', this.stopPanListener);
    window.removeEventListener('resize', this.handleResize);
  }

  private startRenderLoop() {
    const loop = (timestamp: number) => {
      if (!this.frameRateLimiter.shouldRender(timestamp)) {
        this.renderLoopId = requestAnimationFrame(loop);
        return;
      }

      if (!this.lastFrameTime) this.lastFrameTime = timestamp;
      const deltaTime = (timestamp - this.lastFrameTime) / 1000;
      this.lastFrameTime = timestamp;

      if (!this.isPaused()) {
        this.updateGuestMovement(deltaTime);
      }

      this.render();
      this.renderLoopId = requestAnimationFrame(loop);
    };
    this.renderLoopId = requestAnimationFrame(loop);
  }

  private guestSpatialHash = new SpatialHash<Guest>(3);

  private updateGuestMovement(deltaTime: number) {
    const result = this.guestService.processGuestMovement(
      this.guests(),
      this.grid(),
      this.GRID_W(),
      this.GRID_H(),
      deltaTime,
      (amount) => this.money.update(m => m + amount),
      (msg) => this.showNotification(msg),
      (repairCost) => this.money.update(m => m - repairCost) // Списание за ремонт
    );

    if (result.updatedGuests.length !== this.guests().length) {
      this.guests.set(result.updatedGuests);
    }

    this.guestSpatialHash.insertAll(this.guests());
  }

  private render() {
    if (!this.ctx || !this.gameCanvas?.nativeElement) return;

    this.canvasRenderService.render(this.ctx, {
      canvasWidth: this.gameCanvas.nativeElement.width,
      canvasHeight: this.gameCanvas.nativeElement.height,
      scale: this.viewScale(),
      panX: this.panX(),
      panY: this.panY(),
      dpr: this.dpr,
      grid: this.grid(),
      guests: this.guests(),
      selectedGuestId: this.selectedGuestId(),
      hoveredCell: this.hoveredCell,
      gridWidth: this.GRID_W(),
      gridHeight: this.GRID_H(),
      tileSize: TILE_SIZE,
      selectedToolCategory: this.selectedToolCategory(),
      selectedToolId: this.selectedToolId(),
    });
  }

  private resizeCanvas() {
    if (!this.gameCanvas?.nativeElement) return;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const sidebarWidth = (this.showSidebar() && !isMobile) ? 255 : 0;

    let headerHeight = 70;
    if (typeof document !== 'undefined') {
      const header = document.querySelector('header');
      if (header) {
        headerHeight = header.offsetHeight;
      }
    }

    const viewportW = typeof window !== 'undefined' ? window.innerWidth : MAX_CANVAS_WIDTH;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : MAX_CANVAS_HEIGHT;

    const pxW = Math.max(0, viewportW - sidebarWidth);
    const pxH = Math.max(0, viewportH - headerHeight);

    const el = this.gameCanvas.nativeElement;
    el.width = pxW * this.dpr;
    el.height = pxH * this.dpr;
    el.style.width = `${pxW}px`;
    el.style.height = `${pxH}px`;
    this.centerPan(pxW, pxH);
  }

  private startPanning(event: MouseEvent) {
    this.isPanning = true;
    this.panStart = { x: event.clientX, y: event.clientY, panX: this.panX(), panY: this.panY() };
    event.preventDefault();
  }

  private updatePanFromPointer(event: MouseEvent) {
    const dx = event.clientX - this.panStart.x;
    const dy = event.clientY - this.panStart.y;
    this.setPan(this.panStart.panX + dx, this.panStart.panY + dy);
  }

  private stopPanning() {
    this.isPanning = false;
  }

  private setPan(x: number, y: number) {
    const clamped = this.clampPan(x, y);
    this.panX.set(clamped.x);
    this.panY.set(clamped.y);
  }

  private clampPan(x: number, y: number): { x: number, y: number } {
    const canvasEl = this.gameCanvas?.nativeElement;
    if (!canvasEl) {
      return { x: 0, y: 0 };
    }
    const parent = canvasEl.parentElement;
    const containerW = parent?.getBoundingClientRect().width ?? canvasEl?.width ?? 0;
    const containerH = parent?.getBoundingClientRect().height ?? canvasEl?.height ?? 0;
    const mapW = this.GRID_W() * TILE_SIZE * this.viewScale();
    const mapH = this.GRID_H() * TILE_SIZE * this.viewScale();

    if (mapW <= containerW) {
      x = (containerW - mapW) / 2;
    }
    if (mapH <= containerH) {
      y = (containerH - mapH) / 2;
    }

    const minX = Math.min(0, containerW - mapW);
    const minY = Math.min(0, containerH - mapH);
    const clampedX = Math.min(0, Math.max(minX, x));
    const clampedY = Math.min(0, Math.max(minY, y));

    return { x: clampedX, y: clampedY };
  }

  private centerPan(canvasWidth?: number, canvasHeight?: number) {
    const canvasEl = this.gameCanvas?.nativeElement;
    if (!canvasEl) return;
    const cssW = canvasWidth ?? canvasEl.width / this.dpr;
    const cssH = canvasHeight ?? canvasEl.height / this.dpr;
    const mapW = this.GRID_W() * TILE_SIZE * this.viewScale();
    const mapH = this.GRID_H() * TILE_SIZE * this.viewScale();

    const centerX = (cssW - mapW) / 2;
    const centerY = (cssH - mapH) / 2;
    this.setPan(centerX, centerY);
  }

  handleCanvasWheel(event: WheelEvent) {
    event.preventDefault();
    const nextX = this.panX() - event.deltaX;
    const nextY = this.panY() - event.deltaY;
    this.setPan(nextX, nextY);
  }

  handleCanvasMouseDown(event: MouseEvent) {
    const rect = this.gameCanvas.nativeElement.getBoundingClientRect();
    const scale = this.viewScale();
    const x = (event.clientX - rect.left - this.panX()) / scale;
    const y = (event.clientY - rect.top - this.panY()) / scale;

    const gridX = Math.floor(x / TILE_SIZE);
    const gridY = Math.floor(y / TILE_SIZE);
    const currentTool = this.selectedToolCategory();

    if (event.button === 1) {
      this.startPanning(event);
      return;
    }

    if (event.button === 2) {
      this.selectTool('none', null);
      return;
    }

    if (gridX < 0 || gridX >= this.GRID_W() || gridY < 0 || gridY >= this.GRID_H()) {
      this.selectTool('none', null);
      return;
    }

    // Only allow guest selection when no tool is active, so demolish/build always works
    if (currentTool === 'none') {
      const guests = this.guests();
      for (let i = guests.length - 1; i >= 0; i--) {
        const g = guests[i];
        if (g.isWorker) continue;
        const gx = g.x * TILE_SIZE;
        const gy = g.y * TILE_SIZE;
        if (x >= gx && x <= gx + TILE_SIZE && y >= gy && y <= gy + TILE_SIZE) {
          this.onGuestClick(event, g.id);
          return;
        }
      }
    }

    const cell = this.gridService.getCell(this.grid(), gridX, gridY, this.GRID_W(), this.GRID_H());
    if (cell) {
      this.onCellClick(cell);
    }
  }

  handleCanvasMouseMove(event: MouseEvent) {
    if (this.isPanning) {
      this.updatePanFromPointer(event);
      return;
    }

    const rect = this.gameCanvas.nativeElement.getBoundingClientRect();
    const scale = this.viewScale();
    const x = (event.clientX - rect.left - this.panX()) / scale;
    const y = (event.clientY - rect.top - this.panY()) / scale;

    const gridX = Math.floor(x / TILE_SIZE);
    const gridY = Math.floor(y / TILE_SIZE);

    const cell = this.gridService.getCell(this.grid(), gridX, gridY, this.GRID_W(), this.GRID_H());
    this.hoveredCell = cell || null;
  }

  handleCanvasDoubleClick(event: MouseEvent) {
  }

  initNewGame() {
    // Reset all per-building upgrades so new games start from base level
    this.upgradeService.clearAll();

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
    this.isParkClosed.set(false);
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
      casinoLastPayoutDay: this.casinoLastPayoutDay,
      isParkClosed: this.isParkClosed(),
      premiumSkinsOwned: this.premiumSkinsOwned(),
    };

    const success = this.gameStateService.saveGame(state);
    if (!success) {
      this.showNotification('Ошибка сохранения!');
    }
  }

  loadGame(): boolean {
    this.isParkClosed.set(false);
    const state = this.gameStateService.loadGame();
    if (!state) return false;

    this.money.set(state.money);
    this.dayCount.set(state.dayCount);
    this.grid.set(state.grid);
    this.isParkClosed.set(!!state.isParkClosed);

    if (state.gridWidth && state.gridHeight) {
      this.GRID_W.set(state.gridWidth);
      this.GRID_H.set(state.gridHeight);
    } else {
      this.GRID_W.set(GRID_W);
      this.GRID_H.set(GRID_H);
    }

    if (state.guests && Array.isArray(state.guests)) {
      const restored = state.guests.map(g => Guest.fromJSON(g));
      restored.forEach(r => this.normalizeWorkerToHome(r));
      this.guests.set(restored);
      this.maintenanceService.registerWorkers(restored.filter(g => g.isWorker));
    } else {
      this.guests.set([]);
    }
    this.guestIdCounter = state.guestIdCounter;
    this.entranceIndex = state.entranceIndex;
    this.casinoLastPayoutDay = state.casinoLastPayoutDay || 1;

    this.buildingStatusService.getBrokenPositions().forEach(pos => {
      this.maintenanceService.requestRepair(pos.x, pos.y);
    });

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
    this.saveLoopSub = interval(30000).subscribe(() => {
      this.saveGame();
    });
  }

  startGameLoop() {
    this.gameLoopSub = interval(750).subscribe(() => {
      if (this.isPaused()) return;
      this.updateGame();
    });
  }

  toggleParkState() {
    if (this.isParkClosed()) {
      this.isParkClosed.set(false);
      this.showNotification('Парк открыт!');
    } else {
      this.isParkClosed.set(true);
      this.showNotification('Парк закрыт!');
    }
  }

  private cachedAttractionCount = 0;
  private cachedGuestCount = 0;
  private cacheUpdateCounter = 0;

  updateGame() {
    this.tickCounter++;
    if (this.tickCounter >= 60) {
      this.dayCount.update(d => d + 1);
      this.tickCounter = 0;

      const currentDay = this.dayCount();
      if (currentDay - this.casinoLastPayoutDay >= 10) {
        this.processCasinoPayout();
        this.casinoLastPayoutDay = currentDay;
      }
    }

    // Обновляем кэш подсчетов каждые 3 тика вместо каждого
    this.cacheUpdateCounter++;
    if (this.cacheUpdateCounter >= 3) {
      this.cacheUpdateCounter = 0;
      this.cachedAttractionCount = this.grid().filter(c => c.type === 'building').length;
      this.cachedGuestCount = this.guests().filter(g => !g.isWorker).length;
    }

    const maxGuests = 5 + (this.cachedAttractionCount * 3);

    if (!this.isParkClosed() && this.cachedGuestCount < maxGuests && Math.random() > 0.3) {
      this.spawnGuest();
    }

    this.updateGuests();
  }

  spawnGuest() {
    if (this.isParkClosed() || this.entranceIndex === -1) return;
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

    if (category !== 'none') {
      this.selectedGuestId.set(null);
    }
  }

  toggleGuestStats() {
    this.showGuestStats.update(v => !v);
  }

  openSkinsGallery() {
    this.saveGame();
    this.router.navigate(['/skins']);
  }

  toggleSidebar() {
    this.showSidebar.update(v => !v);
  }

  zoomIn() {
    this.adjustZoom(ZOOM_STEP);
  }

  zoomOut() {
    this.adjustZoom(-ZOOM_STEP);
  }

  resetZoom() {
    this.viewScale.set(1);
    this.centerPan();
  }

  private adjustZoom(delta: number) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.viewScale() + delta));
    this.viewScale.set(next);
    this.centerPan();
  }

  onGuestClick(event: MouseEvent, id: number) {
    event.stopPropagation();
    event.preventDefault();
    this.selectedGuestId.set(id);
    this.selectTool('none', null);
  }

  closeGuestDetails() {
    this.selectedGuestId.set(null);
  }

  onCellHover(event: MouseEvent) {
  }

  private handleEscape(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (this.shouldCancelTool()) {
      this.selectTool('none', null);
      event.preventDefault();
    }
  }

  private handleGlobalRightClick(event: MouseEvent) {
    if (event.button !== 2) return;
    if (this.shouldCancelTool()) {
      this.selectTool('none', null);
      event.preventDefault();
    }
  }

  private shouldCancelTool(): boolean {
    const cat = this.selectedToolCategory();
    return cat === 'path' || cat === 'decoration';
  }

  onCellClick(cell: Cell) {
    const cat = this.selectedToolCategory();
    const id = this.selectedToolId();

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
      if (cell.type === 'building' && cat === 'none') {
        this.openUpgradePanel(cell);
      }
      return;
    }

    if (id) {
      const building = this.buildingService.getBuildingById(id);
      if (!building) return;

      if (!this.buildingService.checkPlacement(this.grid(), cell.x, cell.y, building, this.GRID_W(), this.GRID_H())) {
        this.showNotification('Здесь нельзя строить!');
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
  }

  cancelBuild() {
    this.closeModal();
  }

  closeModal() {
    this.showConfirmModal.set(false);
    this.pendingBuildCell.set(null);
    this.pendingBuildId.set(null);
  }

  private createMaintenanceWorkers(spawns: Array<{ x: number; y: number; homeKey: string }>): Guest[] {
    if (!spawns.length) return [];

    const workerSkins = Guest.WORKER_SKIN_KEYS;

    return spawns.map((spawn, index) => {
      const worker = new Guest(this.guestIdCounter++, spawn.x, spawn.y);
      worker.isWorker = true;
      worker.workerHome = spawn.homeKey;
      worker.money = 0;
      worker.happiness = worker.satiety = worker.hydration = worker.energy = worker.fun = worker.toilet = 100;
      worker.targetX = spawn.x;
      worker.targetY = spawn.y;
      worker.state = 'idle';

      const skinKey = workerSkins[index % workerSkins.length];
      worker.visualType = skinKey;
      worker.skin = Guest.SKINS[skinKey] || worker.skin;
      worker.emoji = '🛠';

      const home = this.parseMaintenanceHome(spawn.homeKey);
      if (home) {
        worker.x = home.x;
        worker.y = home.y;
        worker.targetX = home.x;
        worker.targetY = home.y;
      }
      return worker;
    });
  }

  private executeBuild(cell: Cell, building: import('./models/building.model').BuildingType) {
    if (!this.buildingService.canBuild(building, this.money())) {
      this.showNotification('Недостаточно средств!');
      return;
    }

    this.money.update(m => m - building.price);

    let newGrid: Cell[] = this.grid();
    let spawnedWorkers: Guest[] = [];

    if (building.id === 'parkMaintenance') {
      const result = this.buildingService.buildMaintenanceWorkerBuilding(this.grid(), cell, this.GRID_W());
      newGrid = result.grid;
      spawnedWorkers = this.createMaintenanceWorkers(result.workerSpawns);
    } else {
      newGrid = this.buildingService.buildBuilding(this.grid(), cell, building, this.GRID_W());
    }

    this.grid.set(newGrid);
    if (spawnedWorkers.length) {
      spawnedWorkers.forEach(w => this.normalizeWorkerToHome(w));
      this.guests.update(gs => [...gs, ...spawnedWorkers]);
      this.maintenanceService.registerWorkers(spawnedWorkers);
    }
    this.saveGame();

    const keepSelected = building.category === 'path' || building.allowContinuousBuild;
    if (!keepSelected) {
      this.selectTool('none', null);
    }
  }

  demolish(cell: Cell) {
    if (cell.buildingId === 'mountain' || cell.buildingId === 'pond' || cell.terrain === 'water' || cell.terrain === 'mountain') {
      this.showNotification('Этот участок нельзя изменить');
      return;
    }
    if (cell.type === 'grass') return;

    if (this.money() < 5) {
      this.showNotification('Нет денег на снос!');
      return;
    }

    this.money.update(m => m - 5);

    const rootX = cell.isRoot ? cell.x : (cell.rootX ?? cell.x);
    const rootY = cell.isRoot ? cell.y : (cell.rootY ?? cell.y);
    if (cell.buildingId === 'parkMaintenance') {
      const homeKey = this.buildingService.getMaintenanceHomeKey(rootX, rootY);
      this.guests.update(gs => gs.filter(g => g.workerHome !== homeKey));
      this.maintenanceService.unregisterWorkersByHome(homeKey);
    }
    this.maintenanceService.markBuildingRepaired(rootX, rootY);

    const newGrid = this.buildingService.demolishBuilding(this.grid(), cell, this.GRID_W());
    this.grid.set(newGrid);
    this.saveGame();

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

  getGuestImageSrc(guest: Guest): string {
    return this.canvasRenderService.getGuestImageSrc(guest);
  }

  trackByGuestId(index: number, guest: Guest): number {
    return guest.id;
  }

  processCasinoPayout() {
    const result = this.buildingService.processCasinoPayout(this.grid());

    if (result.totalPayout > 0) {
      this.money.update(m => m + result.totalPayout);
      this.showNotification(`Выплата казино: $${result.totalPayout.toFixed(2)}`);
      this.grid.set(result.updatedGrid);
    }
  }

  showNotification(msg: string) {
    this.notifications.update(n => [...n, msg]);
    setTimeout(() => {
      this.notifications.update(n => n.filter(x => x !== msg));
    }, 2000);
  }

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
      this.expandGrid(event.plotId);
      this.showNotification(result.message);
      this.saveGame();

      const unlockedBuildings = this.expansionService.getUnlockedBuildings(result.newState);
      if (unlockedBuildings.length > 0) {
        this.showNotification(`🎉 Открыты новые здания: ${unlockedBuildings.join(', ')}`);
      }
    } else {
      this.showNotification(result.message);
    }
  }


  repairAllBroken() {
    const broken = this.buildingStatusService.getBrokenPositions();
    if (!broken.length) {
      this.showNotification('Поврежденных зданий нет');
      return;
    }

    const repairs: Array<{ x: number; y: number; cost: number }> = [];
    let totalCost = 0;

    broken.forEach(({ x, y }) => {
      const idx = this.gridService.getCellIndex(x, y, this.GRID_W());
      const cell = this.grid()[idx];
      if (!cell || !cell.buildingId) return;
      const building = this.buildingService.getBuildingById(cell.buildingId);
      if (!building) return;
      const level = this.upgradeService.getLevel(building.id, x, y);
      const cost = this.buildingStatusService.getRepairCost(building.price, level);
      totalCost += cost;
      repairs.push({ x, y, cost });
    });

    if (!repairs.length) {
      this.showNotification('Нет доступных к ремонту зданий');
      return;
    }

    if (this.money() < totalCost) {
      this.showNotification('Недостаточно средств для ремонта всех зданий');
      return;
    }

    this.money.update(m => m - totalCost);
    repairs.forEach(r => {
      this.buildingStatusService.repair(r.x, r.y);
      this.maintenanceService.markBuildingRepaired(r.x, r.y);
    });
    this.showNotification(`Отремонтировано: ${repairs.length}, затраты: $${totalCost}`);
    this.saveGame();
  }

  openUpgradePanel(cell: Cell) {
    if (cell.type === 'building' && cell.buildingId) {
      const building = this.buildingService.getBuildingById(cell.buildingId);
      if (building) {
        // Determine root coordinates
        const rootX = cell.isRoot ? cell.x : (cell.rootX ?? cell.x);
        const rootY = cell.isRoot ? cell.y : (cell.rootY ?? cell.y);

        // Check broken status on the root cell (or current cell if root not found, but should be root)
        const isBroken = this.buildingStatusService.isBroken(rootX, rootY);
        let repairCost = 0;

        if (isBroken) {
          const level = this.upgradeService.getLevel(building.id, rootX, rootY);
          repairCost = this.buildingStatusService.getRepairCost(building.price, level);
        }

        this.selectedBuildingForUpgrade.set({
          building,
          cellX: rootX,
          cellY: rootY,
          isBroken,
          repairCost
        });
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

    const current = this.selectedBuildingForUpgrade();
    if (current) {
      // авто-ремонт после улучшения
      this.buildingStatusService.repair(current.cellX, current.cellY);
      this.maintenanceService.markBuildingRepaired(current.cellX, current.cellY);

      const maxVisits = this.buildingService.computeMaxUsageLimit(
        current.building,
        this.upgradeService.getLevel(current.building.id, current.cellX, current.cellY)
      );
      this.buildingStatusService.updateMaxVisits(current.cellX, current.cellY, maxVisits);

      // обновим локальное состояние модалки, чтобы убрать баннер
      this.selectedBuildingForUpgrade.set({
        ...current,
        isBroken: false,
        repairCost: 0
      });
    }
  }

  handleThemeApplied(event: { cost: number }) {
    this.money.update(m => m - event.cost);
    this.showNotification('🎨 Тема применена!');
    this.saveGame();
  }

  handleRepair(event: { cost: number }) {
    const current = this.selectedBuildingForUpgrade();
    if (current && this.money() >= event.cost) {
      this.money.update(m => m - event.cost);
      this.buildingStatusService.repair(current.cellX, current.cellY);
      this.maintenanceService.markBuildingRepaired(current.cellX, current.cellY);
      this.showNotification('🔧 Здание отремонтировано!');
      this.saveGame();
      this.closeUpgradePanel();
    } else {
      this.showNotification('Недостаточно средств!');
    }
  }

  private expandGrid(plotId: string) {
    const state = this.expansionState();
    const plot = state.plots.find(p => p.id === plotId);
    if (!plot) return;

    const currentGrid = this.grid();
    const currentW = this.GRID_W();
    const currentH = this.GRID_H();

    let minX = 0;
    let maxX = 20;
    let minY = 0;
    let maxY = 15;

    const updateBounds = (p: import('./models/expansion.model').LandPlot) => {
      const pX = p.gridX * 20;
      const pY = p.gridY * 15;

      minX = Math.min(minX, pX);
      maxX = Math.max(maxX, pX + p.size.w);
      minY = Math.min(minY, pY);
      maxY = Math.max(maxY, pY + p.size.h);
    };

    state.plots.filter(p => p.purchased).forEach(updateBounds);

    const newW = maxX - minX;
    const newH = maxY - minY;

    const targetOffsetX = -minX;
    const targetOffsetY = -minY;

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

    const shiftX = targetOffsetX - oldOffsetX;
    const shiftY = targetOffsetY - oldOffsetY;

    const newGrid: Cell[] = [];

    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newW; x++) {
        const oldGridX = x - shiftX;
        const oldGridY = y - shiftY;

        if (oldGridX >= 0 && oldGridX < currentW && oldGridY >= 0 && oldGridY < currentH) {
          const oldIdx = oldGridY * currentW + oldGridX;
          const oldCell = currentGrid[oldIdx];
          newGrid.push({ ...oldCell, x, y });

          if (oldIdx === this.entranceIndex) {
            this.entranceIndex = y * newW + x;
          }
        } else {
          newGrid.push({ x, y, type: 'grass', terrain: plot.terrain });
        }
      }
    }

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

    this.GRID_W.set(newW);
    this.GRID_H.set(newH);
    const seededGrid = this.seedTerrainForPlot(plot, newGrid, newW, newH, targetOffsetX, targetOffsetY);
    this.grid.set(seededGrid);
  }

  private seedTerrainForPlot(plot: LandPlot, grid: Cell[], gridW: number, gridH: number, offsetX: number, offsetY: number): Cell[] {
    const area = {
      startX: plot.gridX * 20 + offsetX,
      startY: plot.gridY * 15 + offsetY,
      endX: plot.gridX * 20 + offsetX + plot.size.w,
      endY: plot.gridY * 15 + offsetY + plot.size.h
    };

    if (plot.terrain === 'forest') {
      const treeCount = 20 + Math.floor(Math.random() * 31);
      return this.placeFeatures('tree', treeCount, area, grid, gridW, gridH);
    }

    if (plot.terrain === 'mountain') {
      const mountainCount = 2 + Math.floor(Math.random() * 2);
      return this.placeFeatures('mountain', mountainCount, area, grid, gridW, gridH);
    }

    if (plot.terrain === 'water') {
      const pondCount = 2 + Math.floor(Math.random() * 2);
      return this.placeFeatures('pond', pondCount, area, grid, gridW, gridH);
    }

    return grid;
  }

  private placeFeatures(buildingId: string, count: number, area: { startX: number; startY: number; endX: number; endY: number }, grid: Cell[], gridW: number, gridH: number): Cell[] {
    const building = this.buildingService.getBuildingById(buildingId);
    if (!building) return grid;

    let updatedGrid = grid;
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 10;

    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const x = area.startX + Math.floor(Math.random() * (area.endX - area.startX - building.width + 1));
      const y = area.startY + Math.floor(Math.random() * (area.endY - area.startY - building.height + 1));

      if (x < area.startX || y < area.startY || x + building.width > area.endX || y + building.height > area.endY) {
        continue;
      }

      if (!this.buildingService.checkPlacement(updatedGrid, x, y, building, gridW, gridH)) {
        continue;
      }

      const idx = y * gridW + x;
      updatedGrid = this.buildingService.buildBuilding(updatedGrid, updatedGrid[idx], building, gridW);
      placed++;
    }

    return updatedGrid;
  }

  private parseMaintenanceHome(homeKey: string | null): { x: number; y: number } | null {
    if (!homeKey) return null;
    const parts = homeKey.split('_');
    if (parts.length < 3) return null;
    const x = Number(parts[1]);
    const y = Number(parts[2]);
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
    return { x, y };
  }

  private normalizeWorkerToHome(worker: Guest) {
    if (!worker.isWorker) return;
    const home = this.parseMaintenanceHome(worker.workerHome);
    if (!home) return;
    worker.x = home.x;
    worker.y = home.y;
    worker.targetX = home.x;
    worker.targetY = home.y;
  }

  // 2. Метод обработки покупки (вызывается из SkinsGalleryComponent)
  handleSkinPurchase(skinId: string) {
    const result = this.premiumSkinsService.buySkin(skinId, this.money());

    if (result.success) {
      // Обновляем деньги
      this.money.update(m => m - result.cost!);

      // Обновляем список владений (сигнал)
      if (result.updatedOwnedList) {
        this.premiumSkinsOwned.set(result.updatedOwnedList);
      }

      this.showNotification(result.message);
      this.saveGame();
    } else {
      this.showNotification(result.message);
    }
  }
}


