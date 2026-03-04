import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild, WritableSignal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { ExpansionPanelComponent } from './components/expansion-panel/expansion-panel.component';
import { GuestDetailsComponent } from './components/guest-details/guest-details.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { UpgradePanelComponent } from './components/upgrade-panel/upgrade-panel.component';
import { AchievementsPanelComponent } from './components/achievements-panel/achievements-panel.component';
import { LM_STUDIO_CONFIG } from './config/lm-studio.config';
import { BuildingType, ToolType } from './models/building.model';
import { Cell } from './models/cell.model';
import {
  ExpansionState,
  FIXED_GRID_OFFSET_X,
  FIXED_GRID_OFFSET_Y,
  FULL_GRID_HEIGHT,
  FULL_GRID_WIDTH,
  LandPlot,
  PLOT_HEIGHT,
  PLOT_WIDTH,
  TerrainType
} from './models/expansion.model';
import { GameSaveState } from './models/game-state.model';
import { Guest } from './models/guest.model';
import { createInitialLifetimeStats, GamificationSnapshot, ParkLifetimeStats } from './models/achievement.model';
import { AttractionUpgradeService } from './services/attraction-upgrade.service';
import { BuildingStatusService } from './services/building-status.service';
import { BuildingService } from './services/building.service';
import { CasinoService } from './services/casino.service';
import { ExpansionService } from './services/expansion.service';
import { GameStateService } from './services/game-state.service';
import { GRID_H, GRID_W, GridService } from './services/grid.service';
import { GuestService } from './services/guest.service';
import { LmStudioChatMessage, LmStudioModelSummary, LmStudioService } from './services/lm-studio.service';
import { AiDiagnosisHistoryService, DiagnosisHistoryEntry } from './services/ai-diagnosis-history.service';
import { CanvasRenderService } from './services/canvas-render.service';
import { MaintenanceService } from './services/maintenance.service';
import { SpatialHash, FrameRateLimiter, PerformanceMonitor } from './utils/performance.utils';
import { PremiumSkinsService } from './services/guest/primium-skins';
import { GamificationService } from './services/gamification.service';

const TILE_SIZE = 40;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;
const MAX_CANVAS_HEIGHT = 700;
const MAX_CANVAS_WIDTH = 1200;
const HIGH_PERF_TARGET_FPS = 60;
const LOW_PERF_TARGET_FPS = 30;
const GUEST_SIMULATION_FPS = 20;
const MAX_SIMULATION_CATCH_UP_STEPS = 4;

interface AiPanelMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiAdvisorAction {
  id: 'overview' | 'build' | 'income' | 'happiness' | 'needs';
  label: string;
  hint: string;
}

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
  imports: [CommonModule, RouterModule, UpgradePanelComponent, GuestDetailsComponent, SidebarComponent, ExpansionPanelComponent, AchievementsPanelComponent],
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
  private handleResize = () => {
    this.updateViewportState();
    this.resizeCanvas();
  };
  private handleMouseDown = () => this.mouseIsDown = true;
  private handleMouseUp = () => this.mouseIsDown = false;

  GRID_W = signal<number>(FULL_GRID_WIDTH);
  GRID_H = signal<number>(FULL_GRID_HEIGHT);
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
  parkLifetimeStats = signal<ParkLifetimeStats>(createInitialLifetimeStats());

  // Tool Selection
  selectedToolCategory = signal<ToolType | string>('none');
  selectedToolId = signal<string | null>(null);

  // UI Signals
  showGuestStats = signal<boolean>(false);
  selectedGuestId = signal<number | null>(null);
  showExpansionPanel = signal<boolean>(false);
  showUpgradePanel = signal<boolean>(false);
  showAiPanel = signal<boolean>(false);
  showAchievementsPanel = signal<boolean>(false);
  aiPrompt = signal<string>('');
  aiLoading = signal<boolean>(false);
  aiError = signal<string | null>(null);
  aiMessages = signal<AiPanelMessage[]>([]);
  aiDiagnosisReport = signal<string | null>(null);
  aiDiagnosisGeneratedAt = signal<string | null>(null);
  aiDiagnosisHistory = signal<DiagnosisHistoryEntry[]>([]);
  availableLmStudioModels = signal<LmStudioModelSummary[]>([]);
  selectedLmStudioModel = signal<string>(LM_STUDIO_CONFIG.defaultModel);
  readonly aiAdvisorActions: AiAdvisorAction[] = [
    { id: 'overview', label: 'Что делать дальше', hint: '3 шага развития' },
    { id: 'build', label: 'Что строить', hint: 'лучшее следующее здание' },
    { id: 'income', label: 'Как поднять доход', hint: 'окупаемость и деньги' },
    { id: 'happiness', label: 'Почему падает счастье', hint: 'поиск причин и решений' },
    { id: 'needs', label: 'Чего не хватает гостям', hint: 'главный дефицит потребностей' }
  ];

  // Updated to include repair info
  selectedBuildingForUpgrade = signal<{
    building: BuildingType,
    cellX: number,
    cellY: number,
    isBroken: boolean,
    repairCost: number
  } | null>(null);

  showSidebar = signal<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  isMobileViewport = signal<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

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
  private lmStudioService = inject(LmStudioService);
  private aiDiagnosisHistoryService = inject(AiDiagnosisHistoryService);
  private gamificationService = inject(GamificationService);
  readonly getBuildingsByCategory = (cat: string): BuildingType[] => this.buildingService.getBuildingsByCategory(cat);

  achievements = this.gamificationService.achievements;
  achievementLocaleBundle = this.gamificationService.localeBundle;
  achievementUnlockedCount = this.gamificationService.unlockedCount;
  achievementTotalCount = this.gamificationService.totalCount;
  achievementCompletionPercent = this.gamificationService.completionPercent;

  guestStats = computed(() => {
    return this.guestService.calculateAverageStats(this.guests());
  });

  canSendAiPrompt = computed(() => {
    return !this.aiLoading() && !!this.aiPrompt().trim() && !!this.selectedLmStudioModel().trim();
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
  visibleGridBounds = computed(() => {
    const { minPlotX, maxPlotX, minPlotY, maxPlotY } = this.expansionService.getPurchasedBounds(this.expansionState());

    const startX = Math.max(0, FIXED_GRID_OFFSET_X + minPlotX * PLOT_WIDTH);
    const startY = Math.max(0, FIXED_GRID_OFFSET_Y + minPlotY * PLOT_HEIGHT);
    const endX = Math.min(FULL_GRID_WIDTH, FIXED_GRID_OFFSET_X + (maxPlotX + 1) * PLOT_WIDTH);
    const endY = Math.min(FULL_GRID_HEIGHT, FIXED_GRID_OFFSET_Y + (maxPlotY + 1) * PLOT_HEIGHT);

    return { startX, startY, endX, endY };
  });

  // Logic Variables
  private gameLoopSub: Subscription | null = null;
  private saveLoopSub: Subscription | null = null;
  private guestIdCounter = 0;
  private entranceIndex = -1;
  private mouseIsDown = false;
  private tickCounter = 0;
  private casinoLastPayoutDay = 0;
  private lastFrameTime = 0;
  private simulationAccumulator = 0;
  private simulationTick = 0;
  private performanceCheckTimerSec = 0;
  private isPanning = false;
  private panStart = { x: 0, y: 0, panX: 0, panY: 0 };
  private readonly dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  private parkClosedEffectReady = false;

  // Touch handling
  private lastTouchX = 0;
  private lastTouchY = 0;
  private isTouchPanning = false;
  private layoutTouchStartX = 0;
  private layoutTouchStartY = 0;
  private layoutSwipeTracking = false;
  private readonly mobileSidebarEdgePx = 28;
  private readonly sidebarOpenSwipeThreshold = 48;
  private readonly sidebarCloseSwipeThreshold = -48;
  private readonly sidebarVerticalTolerance = 40;
  private bodyOverflowBeforeSidebarLock: string | null = null;
  private bodyTouchActionBeforeSidebarLock: string | null = null;

  // === ОПТИМИЗАЦИЯ: Контроль частоты обновлений ===
  private frameRateLimiter = new FrameRateLimiter(HIGH_PERF_TARGET_FPS);
  private performanceMonitor = new PerformanceMonitor(120);
  lowPerformanceMode = signal<boolean>(false);
  private needsRender = true; // Флаг для отложенного рендера

  constructor() {
    this.updateViewportState();

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

    effect(() => {
      const shouldLockScroll = this.isMobileViewport() && this.showSidebar();
      this.setMobileScrollLock(shouldLockScroll);
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
    this.loadLmStudioModels();
    this.aiDiagnosisHistory.set(this.aiDiagnosisHistoryService.loadHistory());

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
    this.setMobileScrollLock(false);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('keydown', this.handleEscapeListener);
    window.removeEventListener('contextmenu', this.handleContextMenuListener);
    window.removeEventListener('mouseup', this.stopPanListener);
    window.removeEventListener('resize', this.handleResize);
  }

  private startRenderLoop() {
    this.frameRateLimiter.setTargetFPS(HIGH_PERF_TARGET_FPS);

    const loop = (timestamp: number) => {
      if (!this.lastFrameTime) this.lastFrameTime = timestamp;
      let deltaTime = (timestamp - this.lastFrameTime) / 1000;
      this.lastFrameTime = timestamp;
      if (!Number.isFinite(deltaTime) || deltaTime < 0) {
        deltaTime = 0;
      }
      deltaTime = Math.min(deltaTime, 0.25);

      if (!this.isPaused()) {
        this.stepGuestSimulation(deltaTime);
      }

      this.performanceCheckTimerSec += deltaTime;

      if (this.frameRateLimiter.shouldRender(timestamp)) {
        this.performanceMonitor.startFrame();
        this.render();
        this.performanceMonitor.endFrame();
      }

      if (this.performanceCheckTimerSec >= 1.5) {
        this.performanceCheckTimerSec = 0;
        this.updatePerformanceMode();
      }

      this.renderLoopId = requestAnimationFrame(loop);
    };
    this.renderLoopId = requestAnimationFrame(loop);
  }

  private guestSpatialHash = new SpatialHash<Guest>(3);

  private stepGuestSimulation(deltaTime: number) {
    const simulationStep = 1 / GUEST_SIMULATION_FPS;
    this.simulationAccumulator += deltaTime;

    let processedSteps = 0;
    while (this.simulationAccumulator >= simulationStep && processedSteps < MAX_SIMULATION_CATCH_UP_STEPS) {
      this.updateGuestMovement(simulationStep);
      this.simulationAccumulator -= simulationStep;
      this.simulationTick++;
      processedSteps++;
    }

    // Avoid spiral of death on very slow devices.
    if (processedSteps >= MAX_SIMULATION_CATCH_UP_STEPS) {
      this.simulationAccumulator = 0;
    }
  }

  private updatePerformanceMode() {
    const avgFps = this.performanceMonitor.getAverageFPS();
    if (!avgFps) return;

    if (!this.lowPerformanceMode() && avgFps < 45) {
      this.setLowPerformanceMode(true);
      return;
    }

    if (this.lowPerformanceMode() && avgFps > 56) {
      this.setLowPerformanceMode(false);
    }
  }

  private setLowPerformanceMode(enabled: boolean) {
    if (this.lowPerformanceMode() === enabled) return;

    this.lowPerformanceMode.set(enabled);
    this.frameRateLimiter.setTargetFPS(enabled ? LOW_PERF_TARGET_FPS : HIGH_PERF_TARGET_FPS);
    this.showNotification(enabled ? '⚡ Включен режим производительности' : '✨ Включено обычное качество');
  }

  private getViewportGridBounds(): { startX: number; startY: number; endX: number; endY: number } | null {
    const canvas = this.gameCanvas?.nativeElement;
    if (!canvas) return null;

    const purchased = this.visibleGridBounds();
    const scaledTileSize = TILE_SIZE * this.viewScale();
    if (scaledTileSize <= 0) {
      return purchased;
    }

    const canvasWidthCss = canvas.width / this.dpr;
    const canvasHeightCss = canvas.height / this.dpr;

    const startX = Math.max(purchased.startX, Math.floor(-this.panX() / scaledTileSize) - 1);
    const startY = Math.max(purchased.startY, Math.floor(-this.panY() / scaledTileSize) - 1);
    const endX = Math.min(purchased.endX, Math.ceil((canvasWidthCss - this.panX()) / scaledTileSize) + 2);
    const endY = Math.min(purchased.endY, Math.ceil((canvasHeightCss - this.panY()) / scaledTileSize) + 2);

    return { startX, startY, endX, endY };
  }

  private updateGuestMovement(deltaTime: number) {
    const viewportBounds = this.getViewportGridBounds();
    const result = this.guestService.processGuestMovement(
      this.guests(),
      this.grid(),
      this.GRID_W(),
      this.GRID_H(),
      deltaTime,
      (amount) => this.money.update(m => m + amount),
      (msg) => this.showNotification(msg),
      (repairCost) => this.money.update(m => m - repairCost), // Списание за ремонт
      {
        visibleBounds: viewportBounds ?? undefined,
        tick: this.simulationTick,
        offscreenUpdateStride: this.lowPerformanceMode() ? 4 : 2
      }
    );

    if (result.updatedGuests.length !== this.guests().length) {
      this.guests.set(result.updatedGuests);
    }

    if (!this.lowPerformanceMode() || this.simulationTick % 2 === 0) {
      this.guestSpatialHash.insertAll(this.guests());
    }
  }

  private render() {
    if (!this.ctx || !this.gameCanvas?.nativeElement) return;

    const visibleBounds = this.visibleGridBounds();

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
      visibleStartX: visibleBounds.startX,
      visibleStartY: visibleBounds.startY,
      visibleEndX: visibleBounds.endX,
      visibleEndY: visibleBounds.endY,
      showPremiumGlow: !this.lowPerformanceMode(),
      showMoodIndicators: !this.lowPerformanceMode()
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
    const scale = this.viewScale();
    const bounds = this.visibleGridBounds();
    const left = bounds.startX * TILE_SIZE * scale;
    const top = bounds.startY * TILE_SIZE * scale;
    const right = bounds.endX * TILE_SIZE * scale;
    const bottom = bounds.endY * TILE_SIZE * scale;
    const mapW = Math.max(0, right - left);
    const mapH = Math.max(0, bottom - top);

    let clampedX = x;
    let clampedY = y;

    if (mapW <= containerW) {
      clampedX = (containerW - mapW) / 2 - left;
    } else {
      const minX = containerW - right;
      const maxX = -left;
      clampedX = Math.min(maxX, Math.max(minX, x));
    }

    if (mapH <= containerH) {
      clampedY = (containerH - mapH) / 2 - top;
    } else {
      const minY = containerH - bottom;
      const maxY = -top;
      clampedY = Math.min(maxY, Math.max(minY, y));
    }

    return { x: clampedX, y: clampedY };
  }

  private updateViewportState() {
    if (typeof window === 'undefined') return;

    const isMobile = window.innerWidth < 768;
    const wasMobile = this.isMobileViewport();
    this.isMobileViewport.set(isMobile);

    if (!wasMobile && isMobile) {
      // On desktop -> mobile switch, keep viewport clear.
      this.showSidebar.set(false);
    } else if (wasMobile && !isMobile) {
      // On mobile -> desktop switch, restore sidebar.
      this.showSidebar.set(true);
    }
  }

  private setMobileScrollLock(locked: boolean) {
    if (typeof document === 'undefined') return;
    const body = document.body;

    if (locked) {
      if (this.bodyOverflowBeforeSidebarLock === null) {
        this.bodyOverflowBeforeSidebarLock = body.style.overflow;
      }
      if (this.bodyTouchActionBeforeSidebarLock === null) {
        this.bodyTouchActionBeforeSidebarLock = body.style.touchAction;
      }
      body.style.overflow = 'hidden';
      body.style.touchAction = 'pan-y';
      return;
    }

    if (this.bodyOverflowBeforeSidebarLock !== null) {
      body.style.overflow = this.bodyOverflowBeforeSidebarLock;
      this.bodyOverflowBeforeSidebarLock = null;
    } else {
      body.style.removeProperty('overflow');
    }

    if (this.bodyTouchActionBeforeSidebarLock !== null) {
      body.style.touchAction = this.bodyTouchActionBeforeSidebarLock;
      this.bodyTouchActionBeforeSidebarLock = null;
    } else {
      body.style.removeProperty('touch-action');
    }
  }

  private centerPan(canvasWidth?: number, canvasHeight?: number) {
    const canvasEl = this.gameCanvas?.nativeElement;
    if (!canvasEl) return;
    const cssW = canvasWidth ?? canvasEl.width / this.dpr;
    const cssH = canvasHeight ?? canvasEl.height / this.dpr;
    const scale = this.viewScale();
    const bounds = this.visibleGridBounds();
    const left = bounds.startX * TILE_SIZE * scale;
    const top = bounds.startY * TILE_SIZE * scale;
    const mapW = (bounds.endX - bounds.startX) * TILE_SIZE * scale;
    const mapH = (bounds.endY - bounds.startY) * TILE_SIZE * scale;

    const centerX = (cssW - mapW) / 2 - left;
    const centerY = (cssH - mapH) / 2 - top;
    this.setPan(centerX, centerY);
  }

  handleCanvasWheel(event: WheelEvent) {
    event.preventDefault();
    const nextX = this.panX() - event.deltaX;
    const nextY = this.panY() - event.deltaY;
    this.setPan(nextX, nextY);
  }

  handleCanvasTouchStart(event: TouchEvent) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.lastTouchX = touch.clientX;
      this.lastTouchY = touch.clientY;
      this.isTouchPanning = false;
    }
  }

  handleCanvasTouchMove(event: TouchEvent) {
    if (event.touches.length === 1) {
      event.preventDefault();
      const touch = event.touches[0];
      const dx = touch.clientX - this.lastTouchX;
      const dy = touch.clientY - this.lastTouchY;

      if (!this.isTouchPanning && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        this.isTouchPanning = true;
      }

      if (this.isTouchPanning) {
        this.setPan(this.panX() + dx, this.panY() + dy);
        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;
      }
    }
  }

  handleCanvasTouchEnd(event: TouchEvent) {
    if (!this.isTouchPanning && event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      event.preventDefault();
      this.handleInteraction(touch.clientX, touch.clientY, false);
    }
    this.isTouchPanning = false;
  }

  handleLayoutTouchStart(event: TouchEvent) {
    if (!this.isMobileViewport() || event.touches.length !== 1) {
      this.layoutSwipeTracking = false;
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest('canvas')) {
      this.layoutSwipeTracking = false;
      return;
    }

    const touch = event.touches[0];
    const startedFromLeftEdge = touch.clientX <= this.mobileSidebarEdgePx;
    if (!this.showSidebar() && !startedFromLeftEdge) {
      this.layoutSwipeTracking = false;
      return;
    }

    this.layoutTouchStartX = touch.clientX;
    this.layoutTouchStartY = touch.clientY;
    this.layoutSwipeTracking = true;
  }

  handleLayoutTouchEnd(event: TouchEvent) {
    if (!this.layoutSwipeTracking || !this.isMobileViewport() || event.changedTouches.length !== 1) {
      this.layoutSwipeTracking = false;
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - this.layoutTouchStartX;
    const deltaY = Math.abs(touch.clientY - this.layoutTouchStartY);
    this.layoutSwipeTracking = false;

    if (deltaY > this.sidebarVerticalTolerance) {
      return;
    }

    if (!this.showSidebar() && deltaX >= this.sidebarOpenSwipeThreshold) {
      this.showSidebar.set(true);
      return;
    }

    if (this.showSidebar() && deltaX <= this.sidebarCloseSwipeThreshold) {
      this.showSidebar.set(false);
    }
  }

  private handleInteraction(clientX: number, clientY: number, isRightClick: boolean) {
    const rect = this.gameCanvas.nativeElement.getBoundingClientRect();
    const scale = this.viewScale();
    const x = (clientX - rect.left - this.panX()) / scale;
    const y = (clientY - rect.top - this.panY()) / scale;

    const gridX = Math.floor(x / TILE_SIZE);
    const gridY = Math.floor(y / TILE_SIZE);
    const currentTool = this.selectedToolCategory();
    const bounds = this.visibleGridBounds();

    if (isRightClick) {
      this.selectTool('none', null);
      return;
    }

    if (
      gridX < bounds.startX ||
      gridX >= bounds.endX ||
      gridY < bounds.startY ||
      gridY >= bounds.endY
    ) {
      this.selectTool('none', null);
      return;
    }

    if (currentTool === 'none') {
      const guests = this.guests();
      for (let i = guests.length - 1; i >= 0; i--) {
        const g = guests[i];
        if (g.isWorker) continue;
        const gx = g.x * TILE_SIZE;
        const gy = g.y * TILE_SIZE;
        if (x >= gx && x <= gx + TILE_SIZE && y >= gy && y <= gy + TILE_SIZE) {
          this.selectedGuestId.set(g.id);
          this.selectTool('none', null);
          return;
        }
      }
    }

    const cell = this.gridService.getCell(this.grid(), gridX, gridY, this.GRID_W(), this.GRID_H());
    if (cell && !cell.locked) {
      this.onCellClick(cell);
    }
  }

  handleCanvasMouseDown(event: MouseEvent) {
    if (event.button === 1) {
      this.startPanning(event);
      return;
    }
    this.handleInteraction(event.clientX, event.clientY, event.button === 2);
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
    const bounds = this.visibleGridBounds();

    if (
      gridX < bounds.startX ||
      gridX >= bounds.endX ||
      gridY < bounds.startY ||
      gridY >= bounds.endY
    ) {
      this.hoveredCell = null;
      return;
    }

    const cell = this.gridService.getCell(this.grid(), gridX, gridY, this.GRID_W(), this.GRID_H());
    this.hoveredCell = cell && !cell.locked ? cell : null;
  }

  handleCanvasDoubleClick(event: MouseEvent) {
  }

  initNewGame() {
    // Reset all per-building upgrades so new games start from base level
    this.upgradeService.clearAll();
    const initialExpansionState = this.expansionService.getInitialState();
    const { grid, entranceIndex } = this.createInitialParkGrid(initialExpansionState);

    this.expansionState.set(initialExpansionState);
    this.grid.set(grid);
    this.GRID_W.set(FULL_GRID_WIDTH);
    this.GRID_H.set(FULL_GRID_HEIGHT);
    this.entranceIndex = entranceIndex;
    this.money.set(5000);
    this.dayCount.set(1);
    this.guests.set([]);
    this.guestIdCounter = 0;
    this.tickCounter = 0;
    this.simulationTick = 0;
    this.simulationAccumulator = 0;
    this.lastFrameTime = 0;
    this.performanceCheckTimerSec = 0;
    this.setLowPerformanceMode(false);
    this.casinoLastPayoutDay = 1;
    this.isParkClosed.set(false);
    this.parkLifetimeStats.set(createInitialLifetimeStats());
    this.premiumSkinsOwned.set(this.premiumSkinsService.getOwnedSkins());
    this.gamificationService.resetState();
  }

  private createInitialParkGrid(state: ExpansionState): { grid: Cell[]; entranceIndex: number } {
    const newGrid = this.buildExpansionLayoutGrid(state);
    const entryX = FIXED_GRID_OFFSET_X + Math.floor(PLOT_WIDTH / 2);
    const entryY = FIXED_GRID_OFFSET_Y + PLOT_HEIGHT - 1;
    const entryIdx = this.gridService.getCellIndex(entryX, entryY, FULL_GRID_WIDTH);
    newGrid[entryIdx] = { ...newGrid[entryIdx], x: entryX, y: entryY, type: 'entrance', locked: false };

    const pathIdx = this.gridService.getCellIndex(entryX, entryY - 1, FULL_GRID_WIDTH);
    newGrid[pathIdx] = { ...newGrid[pathIdx], x: entryX, y: entryY - 1, type: 'path', locked: false };

    return { grid: newGrid, entranceIndex: entryIdx };
  }

  private buildExpansionLayoutGrid(state: ExpansionState): Cell[] {
    const grid = this.gridService.createEmptyGrid(FULL_GRID_WIDTH, FULL_GRID_HEIGHT).map(cell => ({
      ...cell,
      locked: true,
      terrain: 'grass' as TerrainType
    }));

    this.applyPlotLayout(grid, 0, 0, 'grass', false);
    state.plots.forEach(plot => {
      this.applyPlotLayout(grid, plot.gridX, plot.gridY, plot.terrain, !plot.purchased);
    });

    return grid;
  }

  private applyPlotLayout(
    grid: Cell[],
    plotGridX: number,
    plotGridY: number,
    terrain: TerrainType,
    locked: boolean
  ) {
    const startX = FIXED_GRID_OFFSET_X + plotGridX * PLOT_WIDTH;
    const startY = FIXED_GRID_OFFSET_Y + plotGridY * PLOT_HEIGHT;

    for (let y = startY; y < startY + PLOT_HEIGHT; y++) {
      for (let x = startX; x < startX + PLOT_WIDTH; x++) {
        const idx = this.gridService.getCellIndex(x, y, FULL_GRID_WIDTH);
        grid[idx] = {
          ...grid[idx],
          terrain,
          locked
        };
      }
    }
  }

  private normalizeSavedGridToExpansionLayout(
    savedGrid: Cell[],
    savedWidth: number,
    savedHeight: number,
    state: ExpansionState,
    savedEntranceIndex: number
  ): { grid: Cell[]; entranceIndex: number } {
    if (savedWidth === FULL_GRID_WIDTH && savedHeight === FULL_GRID_HEIGHT) {
      const normalizedGrid = this.buildExpansionLayoutGrid(state);

      savedGrid.forEach(cell => {
        if (cell.x < 0 || cell.x >= FULL_GRID_WIDTH || cell.y < 0 || cell.y >= FULL_GRID_HEIGHT) {
          return;
        }

        const idx = this.gridService.getCellIndex(cell.x, cell.y, FULL_GRID_WIDTH);
        normalizedGrid[idx] = {
          ...normalizedGrid[idx],
          ...cell,
          x: cell.x,
          y: cell.y,
          locked: normalizedGrid[idx].locked,
          terrain: cell.terrain ?? normalizedGrid[idx].terrain
        };
      });

      return {
        grid: normalizedGrid,
        entranceIndex: this.resolveEntranceIndex(normalizedGrid, savedEntranceIndex, savedWidth, savedHeight)
      };
    }

    return this.migrateLegacyGridToExpansionLayout(savedGrid, state, savedEntranceIndex);
  }

  private migrateLegacyGridToExpansionLayout(
    savedGrid: Cell[],
    state: ExpansionState,
    savedEntranceIndex: number
  ): { grid: Cell[]; entranceIndex: number } {
    const migratedGrid = this.buildExpansionLayoutGrid(state);
    const { minPlotX, minPlotY } = this.expansionService.getPurchasedBounds(state);
    let entranceIndex = -1;

    savedGrid.forEach((cell, index) => {
      const worldX = cell.x + minPlotX * PLOT_WIDTH;
      const worldY = cell.y + minPlotY * PLOT_HEIGHT;
      const targetX = worldX + FIXED_GRID_OFFSET_X;
      const targetY = worldY + FIXED_GRID_OFFSET_Y;

      if (targetX < 0 || targetX >= FULL_GRID_WIDTH || targetY < 0 || targetY >= FULL_GRID_HEIGHT) {
        return;
      }

      const targetIdx = this.gridService.getCellIndex(targetX, targetY, FULL_GRID_WIDTH);
      migratedGrid[targetIdx] = {
        ...migratedGrid[targetIdx],
        ...cell,
        x: targetX,
        y: targetY,
        locked: migratedGrid[targetIdx].locked,
        terrain: cell.terrain ?? migratedGrid[targetIdx].terrain
      };

      if (index === savedEntranceIndex || cell.type === 'entrance') {
        entranceIndex = targetIdx;
      }
    });

    return {
      grid: migratedGrid,
      entranceIndex: entranceIndex >= 0
        ? entranceIndex
        : this.resolveEntranceIndex(migratedGrid, savedEntranceIndex, FULL_GRID_WIDTH, FULL_GRID_HEIGHT)
    };
  }

  private resolveEntranceIndex(grid: Cell[], savedEntranceIndex: number, savedWidth: number, savedHeight: number): number {
    if (savedEntranceIndex >= 0 && savedEntranceIndex < savedWidth * savedHeight) {
      const savedEntranceCell = grid.find(cell => cell.type === 'entrance');
      if (savedEntranceCell) {
        return this.gridService.getCellIndex(savedEntranceCell.x, savedEntranceCell.y, FULL_GRID_WIDTH);
      }
    }

    return grid.findIndex(cell => cell.type === 'entrance');
  }

  saveGame() {
    this.premiumSkinsOwned.set(this.premiumSkinsService.getOwnedSkins());
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
      premiumSkinState: this.premiumSkinsService.exportState(),
      achievementProgress: this.gamificationService.exportState(),
      parkLifetimeStats: this.parkLifetimeStats(),
      expansionState: this.expansionState()
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

    const normalizedExpansionState = this.expansionService.normalizeState(
      state.expansionState
      ?? this.expansionService.loadFromStorage()
      ?? this.expansionService.getInitialState()
    );
    const savedWidth = state.gridWidth ?? GRID_W;
    const savedHeight = state.gridHeight ?? GRID_H;
    const normalizedGridState = this.normalizeSavedGridToExpansionLayout(
      state.grid,
      savedWidth,
      savedHeight,
      normalizedExpansionState,
      state.entranceIndex
    );

    this.money.set(state.money);
    this.dayCount.set(state.dayCount);
    this.grid.set(this.normalizeGridBuildingReferences(normalizedGridState.grid, FULL_GRID_WIDTH, FULL_GRID_HEIGHT));
    this.isParkClosed.set(!!state.isParkClosed);
    this.premiumSkinsOwned.set(this.premiumSkinsService.getOwnedSkins());
    this.parkLifetimeStats.set(state.parkLifetimeStats ?? createInitialLifetimeStats());
    this.expansionState.set(normalizedExpansionState);
    this.GRID_W.set(FULL_GRID_WIDTH);
    this.GRID_H.set(FULL_GRID_HEIGHT);

    if (state.guests && Array.isArray(state.guests)) {
      const restored = state.guests.map(g => Guest.fromJSON(g));
      restored.forEach(r => this.normalizeWorkerToHome(r));
      this.guests.set(restored);
      this.maintenanceService.registerWorkers(restored.filter(g => g.isWorker));
    } else {
      this.guests.set([]);
    }
    this.guestIdCounter = state.guestIdCounter;
    this.entranceIndex = normalizedGridState.entranceIndex;
    this.casinoLastPayoutDay = state.casinoLastPayoutDay || 1;
    this.syncBuildingUpgradeEffects();

    this.buildingStatusService.getBrokenPositions().forEach(pos => {
      this.maintenanceService.requestRepair(pos.x, pos.y);
    });

    if (this.refreshGamification() > 0) {
      this.saveGame();
    }

    this.showNotification('Игра загружена!');
    return true;
  }

  resetGame() {
    if (confirm('Вы уверены? Весь прогресс будет потерян.')) {
      this.gameStateService.resetGame();
      this.initNewGame();
      this.showNotification('Новая игра начата');
      this.saveGame();
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

    const calculatedMaxGuests = 5 + (this.cachedAttractionCount * 3);
    const performanceGuestCap = this.lowPerformanceMode() ? 180 : 320;
    const maxGuests = Math.min(calculatedMaxGuests, performanceGuestCap);

    const spawnChance = this.lowPerformanceMode() ? 0.35 : 0.7;
    if (!this.isParkClosed() && this.cachedGuestCount < maxGuests && Math.random() < spawnChance) {
      this.spawnGuest();
    }

    const shouldUpdateNeeds = !this.lowPerformanceMode() || this.tickCounter % 2 === 0;
    if (shouldUpdateNeeds) {
      this.updateGuests();
    }
    if (this.refreshGamification() > 0) {
      this.saveGame();
    }
  }

  spawnGuest() {
    if (this.isParkClosed() || this.entranceIndex === -1) return;
    const entrance = this.grid()[this.entranceIndex];

    const attractionCount = this.grid().filter(c => c.type === 'building').length;
    const newGuest = this.guestService.spawnGuest(this.guestIdCounter++, entrance.x, entrance.y, attractionCount);
    this.guests.update(gs => [...gs, newGuest]);
    this.recordGuestSpawn();
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

  handleToolSelected(selection: { category: ToolType | string; id: string | null }) {
    this.selectTool(selection.category, selection.id);
    if (this.isMobileViewport()) {
      this.showSidebar.set(false);
    }
  }

  toggleGuestStats() {
    this.showGuestStats.update(v => !v);
  }

  openSkinsGallery() {
    this.saveGame();
    this.router.navigate(['/skins']);
  }

  private syncBuildingUpgradeEffects() {
    for (const cell of this.grid()) {
      if (cell.type !== 'building' || !cell.isRoot || !cell.buildingId) {
        continue;
      }

      const building = this.buildingService.getBuildingById(cell.buildingId);
      if (!building) {
        continue;
      }

      const level = this.upgradeService.getLevel(building.id, cell.x, cell.y);
      const maxVisits = this.buildingService.computeMaxUsageLimit(building, level);
      this.buildingStatusService.updateMaxVisits(cell.x, cell.y, maxVisits);
    }
  }

  toggleAiPanel() {
    const next = !this.showAiPanel();
    this.showAiPanel.set(next);

    if (next && this.availableLmStudioModels().length === 0) {
      this.loadLmStudioModels();
    }
  }

  toggleAchievementsPanel() {
    this.showAchievementsPanel.update((value) => !value);
  }

  updateAiPrompt(value: string) {
    this.aiPrompt.set(value);
  }

  updateSelectedLmStudioModel(modelId: string) {
    this.selectedLmStudioModel.set(modelId);
  }

  clearAiConversation() {
    this.aiMessages.set([]);
    this.aiError.set(null);
  }

  loadDiagnosisFromHistory(entry: DiagnosisHistoryEntry) {
    this.aiDiagnosisReport.set(entry.report);
    this.aiDiagnosisGeneratedAt.set(entry.createdAt);
    this.aiError.set(null);
  }

  clearDiagnosisHistory() {
    this.aiDiagnosisHistoryService.clearHistory();
    this.aiDiagnosisHistory.set([]);
  }

  askAiForParkAdvice() {
    this.sendAiPrompt('Проанализируй текущее состояние парка и дай 3 приоритетных следующих шага развития.');
  }

  generateAiDiagnosisReport() {
    if (this.aiLoading()) return;

    const modelId = this.selectedLmStudioModel().trim();
    if (!modelId) {
      this.aiError.set('LM Studio не вернула модель. Загрузите модель в локальном сервере.');
      return;
    }

    this.aiError.set(null);
    this.aiLoading.set(true);
    this.aiDiagnosisReport.set('');
    this.aiDiagnosisGeneratedAt.set(null);

    const createdAt = new Date().toLocaleString();
    const snapshot = this.buildParkSnapshot();

    this.lmStudioService.streamChat(modelId, [
      {
        role: 'system',
        content: this.buildAiSystemPrompt()
      },
      {
        role: 'user',
        content: [
          'Сформируй диагностический отчет по парку.',
          'Структура ответа:',
          '1. Общая оценка состояния парка',
          '2. Критические проблемы',
          '3. Сильные стороны',
          '4. Узкие места по потребностям гостей',
          '5. Экономика и окупаемость',
          '6. Топ-3 действия с приоритетами',
          'Пиши кратко, в формате готового отчета, на русском языке.'
        ].join('\n')
      }
    ]).subscribe({
      next: (chunk) => {
        this.aiDiagnosisReport.update((current) => `${current ?? ''}${chunk}`);
      },
      complete: () => {
        const finalReport = this.aiDiagnosisReport()?.trim() || 'LM Studio вернула пустой диагностический отчет.';
        this.aiDiagnosisReport.set(finalReport);
        this.aiDiagnosisGeneratedAt.set(createdAt);
        this.aiDiagnosisHistory.set(
          this.aiDiagnosisHistoryService.addEntry(finalReport, snapshot, createdAt)
        );
        this.aiLoading.set(false);
      },
      error: () => {
        this.aiError.set('Не удалось сгенерировать диагностику парка. Проверьте доступность LM Studio на 127.0.0.1:1234.');
        this.aiDiagnosisReport.set(null);
        this.aiLoading.set(false);
      }
    });
  }

  runAiAdvisorAction(actionId: AiAdvisorAction['id']) {
    this.sendAiPrompt(this.buildAdvisorPrompt(actionId));
  }

  toggleSidebar() {
    this.showSidebar.update(v => !v);
  }

  closeSidebarOnOutsideClick() {
    if (!this.isMobileViewport()) return;
    this.showSidebar.set(false);
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

  sendAiPrompt(promptOverride?: string) {
    const prompt = (promptOverride ?? this.aiPrompt()).trim();
    if (!prompt || this.aiLoading()) return;

    const modelId = this.selectedLmStudioModel().trim();
    if (!modelId) {
      this.aiError.set('LM Studio не вернула модель. Загрузите модель в локальном сервере.');
      return;
    }

    const userMessage: AiPanelMessage = { role: 'user', content: prompt };
    const assistantPlaceholder: AiPanelMessage = { role: 'assistant', content: '' };
    const conversation = [...this.aiMessages(), userMessage, assistantPlaceholder];

    this.aiMessages.set(conversation);
    this.aiError.set(null);
    this.aiLoading.set(true);

    if (!promptOverride) {
      this.aiPrompt.set('');
    }

    const messages: LmStudioChatMessage[] = [
      {
        role: 'system',
        content: this.buildAiSystemPrompt()
      },
      ...conversation
        .filter((message) => !(message.role === 'assistant' && !message.content))
        .map((message) => ({
        role: message.role,
        content: message.content
      }))
    ];

    this.lmStudioService.streamChat(modelId, messages).subscribe({
      next: (chunk) => {
        this.aiMessages.update((current) => this.appendChunkToLastAssistantMessage(current, chunk));
      },
      complete: () => {
        this.aiMessages.update((current) => this.finalizeLastAssistantMessage(current));
        this.aiLoading.set(false);
      },
      error: () => {
        this.aiError.set('Не удалось получить ответ от LM Studio. Проверьте, что локальный сервер доступен на 127.0.0.1:1234.');
        this.aiMessages.update((current) => this.finalizeLastAssistantMessage(current));
        this.aiLoading.set(false);
      }
    });
  }

  private appendChunkToLastAssistantMessage(messages: AiPanelMessage[], chunk: string): AiPanelMessage[] {
    const next = [...messages];
    for (let i = next.length - 1; i >= 0; i--) {
      if (next[i].role === 'assistant') {
        next[i] = {
          ...next[i],
          content: `${next[i].content}${chunk}`
        };
        break;
      }
    }
    return next;
  }

  private finalizeLastAssistantMessage(messages: AiPanelMessage[]): AiPanelMessage[] {
    const next = [...messages];
    for (let i = next.length - 1; i >= 0; i--) {
      if (next[i].role === 'assistant') {
        next[i] = {
          ...next[i],
          content: next[i].content.trim() || 'LM Studio вернула пустой ответ.'
        };
        break;
      }
    }
    return next;
  }

  private buildAiSystemPrompt(): string {
    return [
      'Ты игровой ассистент для симулятора парка развлечений.',
      'Отвечай кратко, конкретно и по делу на русском языке.',
      'Опирайся только на состояние парка и давай практические советы игроку.',
      `Состояние парка:\n${this.buildParkSnapshot()}`
    ].join('\n\n');
  }

  private loadLmStudioModels() {
    this.lmStudioService.getModels().subscribe({
      next: (models) => {
        this.availableLmStudioModels.set(models);

        if (!models.length) {
          this.aiError.set('LM Studio доступна, но в локальный сервер не загружена ни одна модель.');
          return;
        }

        this.aiError.set(null);

        const currentModelId = this.selectedLmStudioModel();
        const hasCurrentModel = models.some((model) => model.id === currentModelId);
        if (!hasCurrentModel) {
          this.selectedLmStudioModel.set(models[0].id);
        }
      },
      error: () => {
        this.aiError.set('Не удалось подключиться к LM Studio. Убедитесь, что локальный сервер запущен на 127.0.0.1:1234.');
      }
    });
  }

  private buildParkSnapshot(): string {
    const stats = this.guestStats() ?? {
      happiness: 0,
      satiety: 0,
      hydration: 0,
      energy: 0,
      fun: 0,
      toilet: 0,
      money: 0
    };
    const buildings = this.buildingStats();
    const categories = Object.entries(buildings.byCategory)
      .map(([category, count]) => `${category}: ${count}`)
      .join(', ') || 'нет зданий';
    const topTypes = Object.values(buildings.byType)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((item) => `${item.name}: ${item.count}`)
      .join(', ') || 'нет данных';
    const weakestNeed = this.getWeakestGuestNeed(stats);
    const brokenBuildings = this.buildingStatusService.getBrokenPositions().length;

    return [
      `День: ${this.dayCount()}`,
      `Бюджет: ${Math.round(this.money())}`,
      `Гостей всего: ${this.guests().length}`,
      `Парк закрыт: ${this.isParkClosed() ? 'да' : 'нет'}`,
      `Всего зданий: ${buildings.total}`,
      `Категории зданий: ${categories}`,
      `Топ типов зданий: ${topTypes}`,
      `Поврежденных зданий: ${brokenBuildings}`,
      `Среднее счастье гостей: ${stats.happiness.toFixed(0)}%`,
      `Средняя сытость гостей: ${stats.satiety.toFixed(0)}%`,
      `Средняя жажда гостей: ${stats.hydration.toFixed(0)}%`,
      `Средняя энергия гостей: ${stats.energy.toFixed(0)}%`,
      `Среднее веселье гостей: ${stats.fun.toFixed(0)}%`,
      `Средняя потребность в туалете: ${stats.toilet.toFixed(0)}%`,
      `Самая слабая потребность: ${weakestNeed.label} (${weakestNeed.value.toFixed(0)}%)`
    ].join('\n');
  }

  private buildAdvisorPrompt(actionId: AiAdvisorAction['id']): string {
    const stats = this.guestStats() ?? {
      happiness: 0,
      satiety: 0,
      hydration: 0,
      energy: 0,
      fun: 0,
      toilet: 0,
      money: 0
    };
    const weakestNeed = this.getWeakestGuestNeed(stats);

    switch (actionId) {
      case 'overview':
        return 'Проанализируй парк и дай 3 конкретных следующих шага. Для каждого шага укажи приоритет и ожидаемую пользу.';
      case 'build':
        return 'Какое здание лучше построить следующим именно сейчас? Дай 3 варианта с объяснением по влиянию на гостей, доход и стоимости.';
      case 'income':
        return 'Как быстрее увеличить доход парка? Предложи план из 3-5 действий с упором на окупаемость и узкие места.';
      case 'happiness':
        return 'Почему у гостей может падать счастье в текущем состоянии парка? Назови вероятные причины и конкретные исправления.';
      case 'needs':
        return `Сейчас самая слабая потребность гостей: ${weakestNeed.label}. Какие здания или изменения лучше всего исправят именно эту проблему?`;
      default:
        return 'Проанализируй текущее состояние парка и дай практический совет.';
    }
  }

  private getWeakestGuestNeed(stats: {
    happiness: number;
    satiety: number;
    hydration: number;
    energy: number;
    fun: number;
    toilet: number;
    money: number;
  }): { label: string; value: number } {
    const needs = [
      { label: 'счастье', value: stats.happiness },
      { label: 'сытость', value: stats.satiety },
      { label: 'жажда', value: stats.hydration },
      { label: 'энергия', value: stats.energy },
      { label: 'веселье', value: stats.fun },
      { label: 'туалет', value: stats.toilet }
    ];

    return needs.reduce((lowest, current) => current.value < lowest.value ? current : lowest, needs[0]);
  }

  onCellHover(event: MouseEvent) {
  }

  private handleEscape(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (this.showAchievementsPanel()) {
      this.showAchievementsPanel.set(false);
      event.preventDefault();
      return;
    }
    if (this.showAiPanel()) {
      this.showAiPanel.set(false);
      event.preventDefault();
      return;
    }
    if (this.showExpansionPanel()) {
      this.closeExpansionPanel();
      event.preventDefault();
      return;
    }
    if (this.showUpgradePanel()) {
      this.closeUpgradePanel();
      event.preventDefault();
      return;
    }
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

    if (cell.locked) {
      if (cat !== 'none') {
        this.showNotification('Сначала откройте этот участок');
      }
      return;
    }

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
    this.recordBuild(building);
    this.refreshGamification();
    this.saveGame();

    const keepSelected = building.category === 'path' || building.allowContinuousBuild;
    if (!keepSelected) {
      this.selectTool('none', null);
    }
  }

  demolish(cell: Cell) {
    if (cell.locked) {
      this.showNotification('Этот участок ещё не открыт');
      return;
    }

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
    this.parkLifetimeStats.update((stats) => ({
      ...stats,
      totalDemolitions: stats.totalDemolitions + 1
    }));
    this.refreshGamification();
    this.saveGame();

    this.selectTool('none', null);
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
      this.unlockPurchasedPlot(event.plotId);
      this.setPan(this.panX(), this.panY());
      this.showNotification(result.message);
      this.saveGame();
      this.refreshGamification();

      const unlockedBuildings = this.expansionService.getUnlockedBuildings(result.newState);
      if (unlockedBuildings.length > 0) {
        this.showNotification(`🎉 Открыты новые здания: ${unlockedBuildings.join(', ')}`);
      }
    } else {
      this.showNotification(result.message);
    }
  }

  private unlockPurchasedPlot(plotId: string) {
    const plot = this.expansionState().plots.find(currentPlot => currentPlot.id === plotId);
    if (!plot) {
      return;
    }

    const nextGrid = this.grid().map(cell => ({
      ...cell,
      data: cell.data ? { ...cell.data } : cell.data
    }));

    this.applyPlotLayout(nextGrid, plot.gridX, plot.gridY, plot.terrain, false);
    const seededGrid = this.seedTerrainForPlot(
      plot,
      nextGrid,
      FULL_GRID_WIDTH,
      FULL_GRID_HEIGHT,
      FIXED_GRID_OFFSET_X,
      FIXED_GRID_OFFSET_Y
    );
    this.grid.set(seededGrid);
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
    this.recordRepairs(repairs.length);
    this.refreshGamification();
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
    this.refreshGamification();
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
      this.recordRepairs(1);
      this.refreshGamification();
      this.showNotification('🔧 Здание отремонтировано!');
      this.saveGame();
      this.closeUpgradePanel();
    } else {
      this.showNotification('Недостаточно средств!');
    }
  }

  private seedTerrainForPlot(plot: LandPlot, grid: Cell[], gridW: number, gridH: number, offsetX: number, offsetY: number): Cell[] {
    const area = {
      startX: plot.gridX * PLOT_WIDTH + offsetX,
      startY: plot.gridY * PLOT_HEIGHT + offsetY,
      endX: plot.gridX * PLOT_WIDTH + offsetX + plot.size.w,
      endY: plot.gridY * PLOT_HEIGHT + offsetY + plot.size.h
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

  private isValidMaintenanceHome(home: { x: number; y: number } | null): home is { x: number; y: number } {
    if (!home) {
      return false;
    }

    const cell = this.gridService.getCell(this.grid(), home.x, home.y, this.GRID_W(), this.GRID_H());
    return !!cell && cell.type === 'building' && cell.isRoot === true && cell.buildingId === 'parkMaintenance';
  }

  private findNearestMaintenanceHome(originX: number, originY: number): { x: number; y: number; homeKey: string } | null {
    let closest: { x: number; y: number; homeKey: string } | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const cell of this.grid()) {
      if (cell.type !== 'building' || !cell.isRoot || cell.buildingId !== 'parkMaintenance') {
        continue;
      }

      const distance = Math.hypot(cell.x - originX, cell.y - originY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = {
          x: cell.x,
          y: cell.y,
          homeKey: this.buildingService.getMaintenanceHomeKey(cell.x, cell.y)
        };
      }
    }

    return closest;
  }

  private normalizeGridBuildingReferences(grid: Cell[], width: number, height: number): Cell[] {
    const normalized = grid.map((cell) => ({
      ...cell,
      data: cell.data ? { ...cell.data } : cell.data
    }));

    for (const cell of normalized) {
      if (cell.type !== 'building' || !cell.isRoot || !cell.buildingId) {
        continue;
      }

      const building = this.buildingService.getBuildingById(cell.buildingId);
      if (!building) {
        continue;
      }

      for (let offsetY = 0; offsetY < building.height; offsetY++) {
        for (let offsetX = 0; offsetX < building.width; offsetX++) {
          const x = cell.x + offsetX;
          const y = cell.y + offsetY;
          const index = this.gridService.getCellIndex(x, y, width);
          const target = normalized[index];
          if (!target || target.type !== 'building' || target.buildingId !== cell.buildingId) {
            continue;
          }

          normalized[index] = {
            ...target,
            x,
            y,
            isRoot: offsetX === 0 && offsetY === 0,
            rootX: cell.x,
            rootY: cell.y,
            data: target.data ? { ...target.data } : target.data
          };
        }
      }

      if (cell.buildingId === 'parkMaintenance') {
        const rootIndex = this.gridService.getCellIndex(cell.x, cell.y, width);
        normalized[rootIndex] = {
          ...normalized[rootIndex],
          data: {
            ...(normalized[rootIndex].data ?? {}),
            workerHome: this.buildingService.getMaintenanceHomeKey(cell.x, cell.y)
          }
        };
      }
    }

    return normalized;
  }

  private normalizeWorkerToHome(worker: Guest) {
    if (!worker.isWorker) return;
    let home = this.parseMaintenanceHome(worker.workerHome);

    if (!this.isValidMaintenanceHome(home)) {
      const nearestHome = this.findNearestMaintenanceHome(worker.x, worker.y);
      if (!nearestHome) {
        return;
      }
      worker.workerHome = nearestHome.homeKey;
      home = { x: nearestHome.x, y: nearestHome.y };
    }

    worker.x = home.x;
    worker.y = home.y;
    worker.targetX = home.x;
    worker.targetY = home.y;
    worker.workerTask = undefined;
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

      this.refreshGamification();
      this.showNotification(result.message);
      this.saveGame();
    } else {
      this.showNotification(result.message);
    }
  }

  private recordBuild(building: BuildingType) {
    this.parkLifetimeStats.update((stats) => ({
      ...stats,
      totalBuildsPlaced: stats.totalBuildsPlaced + 1,
      totalPathsPlaced: stats.totalPathsPlaced + (building.id === 'path' ? 1 : 0),
      totalAttractionsBuilt: stats.totalAttractionsBuilt + (building.category === 'attraction' ? 1 : 0),
      totalShopsBuilt: stats.totalShopsBuilt + (building.category === 'shop' ? 1 : 0),
      totalDecorationsBuilt: stats.totalDecorationsBuilt + (building.category === 'decoration' ? 1 : 0),
      totalServicesBuilt: stats.totalServicesBuilt + (building.category === 'service' ? 1 : 0)
    }));
  }

  private recordGuestSpawn() {
    this.parkLifetimeStats.update((stats) => ({
      ...stats,
      totalGuestsSpawned: stats.totalGuestsSpawned + 1
    }));
  }

  private recordRepairs(count: number) {
    this.parkLifetimeStats.update((stats) => ({
      ...stats,
      totalRepairsCompleted: stats.totalRepairsCompleted + count
    }));
  }

  private buildGamificationSnapshot(): GamificationSnapshot {
    return {
      money: this.money(),
      dayCount: this.dayCount(),
      grid: this.grid(),
      guests: this.guests(),
      premiumOwnedSkins: this.premiumSkinsService.getOwnedSkins(),
      lifetimeStats: {
        ...this.parkLifetimeStats(),
        highestMoneyReached: Math.max(this.parkLifetimeStats().highestMoneyReached, this.money())
      }
    };
  }

  private refreshGamification(): number {
    const unlocks = this.gamificationService.evaluate(this.buildGamificationSnapshot(), {
      addMoney: (amount) => this.money.update((money) => money + amount),
      unlockSkin: (skinId) => {
        const result = this.premiumSkinsService.grantSkin(skinId);
        this.premiumSkinsOwned.set(this.premiumSkinsService.getOwnedSkins());
        return result.success;
      }
    });

    this.parkLifetimeStats.update((stats) => ({
      ...stats,
      highestMoneyReached: Math.max(stats.highestMoneyReached, this.money())
    }));

    for (const unlock of unlocks) {
      this.showNotification(`🏆 ${unlock.achievement.title}. ${unlock.rewardMessage}`);
    }

    return unlocks.length;
  }
}


