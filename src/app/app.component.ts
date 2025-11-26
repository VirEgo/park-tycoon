import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { CasinoStatsComponent } from './components/casino-stats/casino-stats.component';
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
  imports: [CommonModule, RouterModule, CasinoStatsComponent, UpgradePanelComponent],
  templateUrl: './app.component.html',
  styleUrl: 'app.component.scss'
})
export class TycoonApp implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('gameCanvas') gameCanvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private renderLoopId: number | null = null;
  private skinCache: Map<string, HTMLImageElement> = new Map();
  private rawSkins: Map<string, string> = new Map();
  private handleEscapeListener = (event: KeyboardEvent) => this.handleEscape(event);
  private handleContextMenuListener = (event: MouseEvent) => this.handleGlobalRightClick(event);
  private stopPanListener = () => this.stopPanning();
  private handleResize = () => this.resizeCanvas();

  GRID_W = signal<number>(GRID_W);
  GRID_H = signal<number>(GRID_H);
  TILE_SIZE = TILE_SIZE;
  viewScale = signal<number>(1);
  panX = signal<number>(0);
  panY = signal<number>(0);

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
  private selectedCasinoCoords = signal<{ x: number, y: number } | null>(null);
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

  showSidebar = signal<boolean>(true);

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
  private buildingStatusService = inject(BuildingStatusService);
  private gameStateService = inject(GameStateService);
  private expansionService = inject(ExpansionService);
  private upgradeService = inject(AttractionUpgradeService);
  private router = inject(Router);
  private http = inject(HttpClient);

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
  private isPanning = false;
  private panStart = { x: 0, y: 0, panX: 0, panY: 0 };
  private readonly dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  constructor() {
    // Effect to resize canvas when grid dimensions or zoom change
    effect(() => {
      this.resizeCanvas();
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
    window.addEventListener('keydown', this.handleEscapeListener);
    window.addEventListener('contextmenu', this.handleContextMenuListener);
    window.addEventListener('mouseup', this.stopPanListener);
    window.addEventListener('resize', this.handleResize);
  }

  ngAfterViewInit() {
    if (this.gameCanvas) {
      this.ctx = this.gameCanvas.nativeElement.getContext('2d')!;
      this.resizeCanvas(); // Initial resize
      this.startRenderLoop();
    }
  }

  ngOnDestroy() {
    if (this.gameLoopSub) this.gameLoopSub.unsubscribe();
    if (this.saveLoopSub) this.saveLoopSub.unsubscribe();
    if (this.renderLoopId !== null) cancelAnimationFrame(this.renderLoopId);
    window.removeEventListener('mousedown', () => this.mouseIsDown = true);
    window.removeEventListener('mouseup', () => this.mouseIsDown = false);
    window.removeEventListener('keydown', this.handleEscapeListener);
    window.removeEventListener('contextmenu', this.handleContextMenuListener);
    window.removeEventListener('mouseup', this.stopPanListener);
    window.removeEventListener('resize', this.handleResize);
  }

  private preloadSkins() {
    Object.entries(Guest.SKINS).forEach(([key, path]) => {
      this.http.get(path, { responseType: 'text' }).subscribe({
        next: (svgContent) => {
          this.rawSkins.set(key, svgContent);
        },
        error: (err) => console.error(`Failed to load skin: ${key}`, err)
      });
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

    if (result.updatedGuests.length !== this.guests().length) {
      this.guests.set(result.updatedGuests);
    }
  }

  private render() {
    if (!this.ctx || !this.gameCanvas?.nativeElement) return;

    const width = this.gameCanvas.nativeElement.width;
    const height = this.gameCanvas.nativeElement.height;
    const scale = this.viewScale();
    const panX = this.panX();
    const panY = this.panY();
    const dpr = this.dpr;
    const grid = this.grid();
    const guests = this.guests();
    const selectedGuestId = this.selectedGuestId();
    const hoveredCell = this.hoveredCell;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.setTransform(scale * dpr, 0, 0, scale * dpr, panX * dpr, panY * dpr);

    const startX = Math.floor((-panX / scale) / TILE_SIZE) * TILE_SIZE;
    const startY = Math.floor((-panY / scale) / TILE_SIZE) * TILE_SIZE;
    const endX = ((width / dpr - panX) / scale);
    const endY = ((height / dpr - panY) / scale);

    const tileBg = '#3bcf6f';

    for (let y = startY; y < endY + TILE_SIZE; y += TILE_SIZE) {
      for (let x = startX; x < endX + TILE_SIZE; x += TILE_SIZE) {
        this.ctx.fillStyle = tileBg;
        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        this.ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }

    // 1. Draw Grid
    grid.forEach(cell => {
      const x = cell.x * TILE_SIZE;
      const y = cell.y * TILE_SIZE;

      if (cell.type === 'grass') {
        this.ctx.fillStyle = '#4ade80';
        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      } else if (cell.type === 'path') {
        const pathImg = this.buildingService.getBuildingImage('path');
        if (pathImg && pathImg.complete && pathImg.naturalWidth > 0) {
          this.ctx.drawImage(pathImg, x, y, TILE_SIZE, TILE_SIZE);
        } else {
          this.ctx.fillStyle = '#9ca3af';
          this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        }
      } else if (cell.type === 'entrance') {
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      } else if (cell.type === 'exit') {
        const exitImg = this.buildingService.getBuildingImage('exit');
        if (exitImg && exitImg.complete && exitImg.naturalWidth > 0) {
          this.ctx.drawImage(exitImg, x, y, TILE_SIZE, TILE_SIZE);
        } else {
          this.ctx.fillStyle = '#ef4444';
          this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        }
      } else if (cell.type === 'building') {
        if (cell.isRoot) {
          const bId = cell.buildingId;
          if (bId) {
            const building = this.buildingService.getBuildingById(bId);
            if (building) {
              const img = this.buildingService.getBuildingImage(bId);

              this.ctx.fillStyle = '#4ade80';
              this.ctx.fillRect(x, y, TILE_SIZE * building.width, TILE_SIZE * building.height);

              if (img && img.complete && img.naturalWidth > 0) {
                this.ctx.drawImage(img, x, y, TILE_SIZE * building.width, TILE_SIZE * building.height);
              } else {
                this.ctx.strokeStyle = '#4ade80';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(x, y, TILE_SIZE * building.width, TILE_SIZE * building.height);

                const icon = building.icon;
                if (icon) {
                  this.ctx.font = '24px Arial';
                  this.ctx.textAlign = 'center';
                  this.ctx.textBaseline = 'middle';
                  this.ctx.fillStyle = '#000';
                  this.ctx.fillText(icon, x + (TILE_SIZE * building.width) / 2, y + (TILE_SIZE * building.height) / 2);
                }
              }

              const level = this.upgradeService.getLevel(bId);

              const isBroken = this.buildingStatusService.isBroken(cell.x, cell.y);
              if (isBroken) {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                this.ctx.fillRect(x, y, TILE_SIZE * building.width, TILE_SIZE * building.height);

                this.ctx.font = '30px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillStyle = '#FFF';
                this.ctx.fillText('🔧', x + (TILE_SIZE * building.width) / 2, y + (TILE_SIZE * building.height) / 2);
              }

              if (level === 5) {
                const centerX = x + (TILE_SIZE * building.width) / 2;
                const starY = y - 10;
                this.ctx.shadowColor = '#FFD700';
                this.ctx.shadowBlur = 15;
                this.ctx.font = '24px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'bottom';
                this.ctx.fillText('⭐', centerX, starY);
                this.ctx.shadowBlur = 0;
              } else if (level > 1) {
                const starCount = level - 1;
                const starSize = 12;
                const startX = x + (TILE_SIZE * building.width) / 2 - ((starCount - 1) * starSize) / 2;
                const starY = y - 5;

                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'bottom';

                for (let i = 0; i < starCount; i++) {
                  this.ctx.fillText('⭐', startX + i * starSize, starY);
                }
              }

              const themeIcon = this.upgradeService.getThemeIcon(bId);
              if (themeIcon) {
                this.ctx.font = '16px Arial';
                this.ctx.textAlign = 'right';
                this.ctx.textBaseline = 'top';
                this.ctx.fillText(themeIcon, x + TILE_SIZE * building.width - 2, y + 2);
              }
            }
          }
        }
      }

      if (cell.type !== 'building') {
        this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        this.ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      }

      if (cell.type === 'entrance') {
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#000';
        this.ctx.fillText('ENT', x + TILE_SIZE / 2, y + TILE_SIZE / 2);
      } else if (cell.type === 'exit') {
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'ideographic';
        this.ctx.fillText('EXIT', x + TILE_SIZE / 3, y + TILE_SIZE / 3);
      }

      if (hoveredCell && hoveredCell.x === cell.x && hoveredCell.y === cell.y) {
        const toolId = this.selectedToolId();
        if (toolId && this.selectedToolCategory() !== 'none' && this.selectedToolCategory() !== 'demolish') {
          const building = this.buildingService.getBuildingById(toolId);
          if (building) {
            const isValid = this.buildingService.checkPlacement(grid, cell.x, cell.y, building, this.GRID_W(), this.GRID_H());

            for (let i = 0; i < building.width; i++) {
              for (let j = 0; j < building.height; j++) {
                const cellX = (cell.x + i) * TILE_SIZE;
                const cellY = (cell.y + j) * TILE_SIZE;
                const cellValid = (cell.x + i < this.GRID_W() && cell.y + j < this.GRID_H());

                this.ctx.fillStyle = isValid && cellValid ? 'rgba(0, 255, 0, 0.35)' : 'rgba(255, 0, 0, 0.35)';
                this.ctx.fillRect(cellX, cellY, TILE_SIZE, TILE_SIZE);

                this.ctx.strokeStyle = isValid && cellValid ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(cellX, cellY, TILE_SIZE, TILE_SIZE);
              }
            }

            this.ctx.strokeStyle = isValid ? '#00ff00' : '#ff0000';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x, y, TILE_SIZE * building.width, TILE_SIZE * building.height);
            this.ctx.lineWidth = 1;
          }
        } else {
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        }
      }
    });

    // 2. Draw Guests
    guests.forEach(guest => {
      const gx = guest.x * TILE_SIZE;
      const gy = guest.y * TILE_SIZE;

      if (selectedGuestId === guest.id) {
        this.ctx.beginPath();
        this.ctx.arc(gx + TILE_SIZE / 2, gy + TILE_SIZE / 2, TILE_SIZE / 1.5, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        this.ctx.fill();
      }

      const skinKey = guest.visualType;
      const cacheKey = `${skinKey}_${guest.color}`;

      let img = this.skinCache.get(cacheKey);

      if (!img) {
        const rawSvg = this.rawSkins.get(skinKey);
        if (rawSvg) {
          const coloredSvg = rawSvg.replace(/#FF00FF/gi, guest.color);
          img = new Image();
          img.src = 'data:image/svg+xml;base64,' + btoa(coloredSvg);
          this.skinCache.set(cacheKey, img);
        }
      }

      if (img && img.complete) {
        this.ctx.drawImage(img, gx, gy, TILE_SIZE, TILE_SIZE);
      } else {
        this.ctx.fillStyle = guest.color;
        this.ctx.beginPath();
        this.ctx.arc(gx + TILE_SIZE / 2, gy + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(guest.emoji, gx + TILE_SIZE / 2, gy + TILE_SIZE / 2);
      }

      if (guest.happiness < 30) {
        this.ctx.fillStyle = 'red';
        this.ctx.beginPath();
        this.ctx.arc(gx + TILE_SIZE - 5, gy + 5, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
  }

  private resizeCanvas() {
    if (!this.gameCanvas?.nativeElement) return;
    const sidebarWidth = this.showSidebar() ? 255 : 0;
    const headerHeight = 70;
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

    const guests = this.guests();
    for (let i = guests.length - 1; i >= 0; i--) {
      const g = guests[i];
      const gx = g.x * TILE_SIZE;
      const gy = g.y * TILE_SIZE;
      if (x >= gx && x <= gx + TILE_SIZE && y >= gy && y <= gy + TILE_SIZE) {
        this.onGuestClick(event, g.id);
        return;
      }
    }

    const cell = this.gridService.getCell(this.grid(), gridX, gridY, this.GRID_W(), this.GRID_H());
    if (cell) {
      if (cell.type === 'building' && cell.buildingId) {
        const bInfo = this.buildingService.getBuildingById(cell.buildingId);
        if (bInfo && bInfo.isGambling) {
          this.onCasinoClick(event, cell);
          return;
        }
      }
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

    if (state.gridWidth && state.gridHeight) {
      this.GRID_W.set(state.gridWidth);
      this.GRID_H.set(state.gridHeight);
    } else {
      this.GRID_W.set(GRID_W);
      this.GRID_H.set(GRID_H);
    }

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

  startGameLoop() {
    this.gameLoopSub = interval(500).subscribe(() => {
      if (this.isPaused()) return;
      this.updateGame();
    });
  }

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

  private executeBuild(cell: Cell, building: import('./models/building.model').BuildingType) {
    if (!this.buildingService.canBuild(building, this.money())) {
      this.showNotification('Недостаточно средств!');
      return;
    }

    this.money.update(m => m - building.price);

    const newGrid = this.buildingService.buildBuilding(this.grid(), cell, building, this.GRID_W());
    this.grid.set(newGrid);
    this.saveGame();

    if (building.category !== 'path') {
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
    const skinKey = guest.visualType;
    const cacheKey = `${skinKey}_${guest.color}`;
    const img = this.skinCache.get(cacheKey);
    if (img) {
      return img.src
    }
    return guest.skin;
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
    let grid: Cell[] = [];
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        grid.push({ x, y, type: 'grass' });
      }
    }

    const build = (id: string, x: number, y: number) => {
      const b = this.buildingService.getBuildingById(id);
      if (b) {
        const cell = grid[y * GRID_W + x];
        grid = this.buildingService.buildBuilding(grid, cell, b, GRID_W);
      }
    };

    for (let y = 0; y < GRID_H; y++) {
      build('path', 10, y);
    }

    for (let x = 5; x <= 15; x++) {
      build('path', x, 3);
      build('path', x, 7);
      build('path', x, 11);
    }

    const entranceIdx = 14 * GRID_W + 10;
    grid[entranceIdx] = { x: 10, y: 14, type: 'entrance' };

    const exitIdx = 0 * GRID_W + 10;
    grid[exitIdx] = { x: 10, y: 0, type: 'exit' };

    build('carousel', 7, 3);
    build('ferris', 13, 3);
    build('castle', 7, 7);
    build('coaster', 13, 7);
    build('slots', 7, 11);
    build('shooting', 13, 11);

    build('burger', 9, 3);
    build('pizza', 11, 3);
    build('soda', 9, 7);
    build('coffee', 11, 7);
    build('popcorn', 9, 11);
    build('icecream', 11, 11);

    build('fountain', 10, 5);
    build('tree', 5, 2);
    build('tree', 15, 2);
    build('tree', 5, 12);
    build('tree', 15, 12);
    build('bench', 10, 9);

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
          const level = this.upgradeService.getLevel(building.id);
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

    // Refresh panel data (e.g. repair cost might change if level up, though unlikely to upgrade while broken)
    const current = this.selectedBuildingForUpgrade();
    if (current) {
      // Re-open to refresh or just update signal if we had granular signals
      // For now, just keeping it open is fine, the component handles internal state updates via service
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
}

