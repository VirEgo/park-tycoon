import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Cell } from '../models/cell.model';
import { Guest } from '../models/guest.model';
import { ToolType } from '../models/building.model';
import { AttractionUpgradeService } from './attraction-upgrade.service';
import { BuildingService } from './building.service';
import { BuildingStatusService } from './building-status.service';

export interface CanvasRenderParams {
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
  panX: number;
  panY: number;
  dpr: number;
  grid: Cell[];
  guests: Guest[];
  selectedGuestId: number | null;
  hoveredCell: Cell | null;
  gridWidth: number;
  gridHeight: number;
  tileSize: number;
  selectedToolCategory: ToolType | string;
  selectedToolId: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class CanvasRenderService {
  private skinCache: Map<string, HTMLImageElement> = new Map();
  private rawSkins: Map<string, string> = new Map();

  constructor(
    private http: HttpClient,
    private buildingService: BuildingService,
    private buildingStatusService: BuildingStatusService,
    private upgradeService: AttractionUpgradeService
  ) { }

  preloadSkins() {
    Object.entries(Guest.SKINS).forEach(([key, path]) => {
      this.http.get(path, { responseType: 'text' }).subscribe({
        next: (svgContent) => {
          this.rawSkins.set(key, svgContent);
        },
        error: (err) => console.error(`Failed to load skin: ${key}`, err)
      });
    });
  }

  render(ctx: CanvasRenderingContext2D, params: CanvasRenderParams) {
    const {
      canvasWidth,
      canvasHeight,
      scale,
      panX,
      panY,
      dpr,
      grid,
      guests,
      selectedGuestId,
      hoveredCell,
      gridWidth,
      gridHeight,
      tileSize,
      selectedToolCategory,
      selectedToolId,
    } = params;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, panX * dpr, panY * dpr);

    const startX = Math.floor((-panX / scale) / tileSize) * tileSize;
    const startY = Math.floor((-panY / scale) / tileSize) * tileSize;
    const endX = ((canvasWidth / dpr - panX) / scale);
    const endY = ((canvasHeight / dpr - panY) / scale);

    const tileBg = '#3bcf6f';

    for (let y = startY; y < endY + tileSize; y += tileSize) {
      for (let x = startX; x < endX + tileSize; x += tileSize) {
        ctx.fillStyle = tileBg;
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    grid.forEach(cell => {
      const x = cell.x * tileSize;
      const y = cell.y * tileSize;

      if (cell.type === 'grass') {
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(x, y, tileSize, tileSize);
      } else if (cell.type === 'path') {
        const pathImg = this.buildingService.getBuildingImage('path');
        if (pathImg && pathImg.complete && pathImg.naturalWidth > 0) {
          ctx.drawImage(pathImg, x, y, tileSize, tileSize);
        } else {
          ctx.fillStyle = '#9ca3af';
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      } else if (cell.type === 'entrance') {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x, y, tileSize, tileSize);
      } else if (cell.type === 'exit') {
        const exitImg = this.buildingService.getBuildingImage('exit');
        if (exitImg && exitImg.complete && exitImg.naturalWidth > 0) {
          ctx.drawImage(exitImg, x, y, tileSize, tileSize);
        } else {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      } else if (cell.type === 'building') {
        if (cell.isRoot) {
          const bId = cell.buildingId;
          if (bId) {
            const building = this.buildingService.getBuildingById(bId);
            if (building) {
              const img = this.buildingService.getBuildingImage(bId);

              ctx.fillStyle = '#4ade80';
              ctx.fillRect(x, y, tileSize * building.width, tileSize * building.height);

              if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, x, y, tileSize * building.width, tileSize * building.height);
              } else {
                ctx.strokeStyle = '#4ade80';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, tileSize * building.width, tileSize * building.height);

                const icon = building.icon;
                if (icon) {
                  ctx.font = '24px Arial';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = '#000';
                  ctx.fillText(icon, x + (tileSize * building.width) / 2, y + (tileSize * building.height) / 2);
                }
              }

              const level = this.upgradeService.getLevel(bId, cell.x, cell.y);
              const isBroken = this.buildingStatusService.isBroken(cell.x, cell.y);
              if (isBroken) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(x, y, tileSize * building.width, tileSize * building.height);

                ctx.font = '30px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#FFF';
                ctx.fillText('🔧', x + (tileSize * building.width) / 2, y + (tileSize * building.height) / 2);
              }

              if (level === 5) {
                const centerX = x + (tileSize * building.width) / 2;
                const starY = y - 10;
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 15;
                ctx.font = '24px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText('⭐', centerX, starY);
                ctx.shadowBlur = 0;
              } else if (level > 1) {
                const starCount = level - 1;
                const starSize = 12;
                const startX = x + (tileSize * building.width) / 2 - ((starCount - 1) * starSize) / 2;
                const starY = y - 5;

                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                for (let i = 0; i < starCount; i++) {
                  ctx.fillText('⭐', startX + i * starSize, starY);
                }
              }

              const themeIcon = this.upgradeService.getThemeIcon(bId, cell.x, cell.y);
              if (themeIcon) {
                ctx.font = '16px Arial';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                ctx.fillText(themeIcon, x + tileSize * building.width - 2, y + 2);
              }
            }
          }
        }
      }

      if (cell.type !== 'building') {
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.strokeRect(x, y, tileSize, tileSize);
      }

      if (cell.type === 'entrance') {
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.fillText('ENT', x + tileSize / 2, y + tileSize / 2);
      } else if (cell.type === 'exit') {
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'ideographic';
        ctx.fillText('EXIT', x + tileSize / 3, y + tileSize / 3);
      }
    });

    // Рисуем подсветку строительства ПОСЛЕ отрисовки всего грида
    if (hoveredCell && selectedToolId && selectedToolCategory !== 'none' && selectedToolCategory !== 'demolish') {
      const building = this.buildingService.getBuildingById(selectedToolId);
      if (building) {
        const isValid = this.buildingService.checkPlacement(grid, hoveredCell.x, hoveredCell.y, building, gridWidth, gridHeight);
        const baseX = hoveredCell.x * tileSize;
        const baseY = hoveredCell.y * tileSize;

        for (let i = 0; i < building.width; i++) {
          for (let j = 0; j < building.height; j++) {
            const cellX = (hoveredCell.x + i) * tileSize;
            const cellY = (hoveredCell.y + j) * tileSize;
            const cellValid = (hoveredCell.x + i < gridWidth && hoveredCell.y + j < gridHeight);

            ctx.fillStyle = isValid && cellValid ? 'rgba(22, 101, 52, 0.5)' : 'rgba(255, 0, 0, 0.35)';
            ctx.fillRect(cellX, cellY, tileSize, tileSize);

            ctx.strokeStyle = isValid && cellValid ? 'rgba(22, 101, 52, 0.9)' : 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 1;
            ctx.strokeRect(cellX, cellY, tileSize, tileSize);
          }
        }

        ctx.strokeStyle = isValid ? '#166534' : '#ff0000';
        ctx.lineWidth = 3;
        ctx.strokeRect(baseX, baseY, tileSize * building.width, tileSize * building.height);
        ctx.lineWidth = 1;
      }
    } else if (hoveredCell) {
      // Простая подсветка для других инструментов
      const x = hoveredCell.x * tileSize;
      const y = hoveredCell.y * tileSize;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(x, y, tileSize, tileSize);
    }

    guests.forEach(guest => {
      const gx = guest.x * tileSize;
      const gy = guest.y * tileSize;

      if (selectedGuestId === guest.id) {
        ctx.beginPath();
        ctx.arc(gx + tileSize / 2, gy + tileSize / 2, tileSize / 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.fill();
      }

      const img = this.getSkinImage(guest);

      if (img && img.complete) {
        ctx.drawImage(img, gx, gy, tileSize, tileSize);
      } else {
        ctx.fillStyle = guest.color;
        ctx.beginPath();
        ctx.arc(gx + tileSize / 2, gy + tileSize / 2, tileSize / 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(guest.emoji, gx + tileSize / 2, gy + tileSize / 2);
      }

      if (guest.happiness < 30) {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(gx + tileSize - 5, gy + 5, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  getGuestImageSrc(guest: Guest): string {
    const skinKey = guest.visualType;
    const cacheKey = `${skinKey}_${guest.color}`;
    const img = this.skinCache.get(cacheKey);
    if (img) {
      return img.src;
    }
    return guest.skin;
  }

  private getSkinImage(guest: Guest): HTMLImageElement | undefined {
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

    return img;
  }
}
