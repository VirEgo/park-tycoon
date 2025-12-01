import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BuildingType, ToolType } from '../../models/building.model';

enum BuildingCategory {
  ATTRACTION = 'attraction',
  SHOP = 'shop',
  DECORATION = 'decoration',
  SERVICE = 'service'
};

const BuildingCategoryLabels: { [key in BuildingCategory]: string } = {
  [BuildingCategory.ATTRACTION]: 'Attractions',
  [BuildingCategory.SHOP]: 'Shops',
  [BuildingCategory.DECORATION]: 'Decorations',
  [BuildingCategory.SERVICE]: 'Services'
};

// Тип для статистики зданий
export interface BuildingStats {
  total: number;
  byCategory: Record<string, number>;
  byType: Record<string, { count: number; name: string; category: string }>;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Input() isParkClosed = false;
  @Input() money = 0;
  @Input() selectedToolId: string | null = null;
  @Input() selectedToolCategory: ToolType | string = 'none';
  @Input() getBuildingsByCategory!: (category: string) => BuildingType[];
  @Input() buildingStats: BuildingStats = { total: 0, byCategory: {}, byType: {} };

  @Output() toolSelected = new EventEmitter<{ category: ToolType | string; id: string | null }>();
  @Output() togglePark = new EventEmitter<void>();
  @Output() reset = new EventEmitter<void>();
  @Output() closeSidebar = new EventEmitter<void>();

  categories: Array<BuildingCategory> = [BuildingCategory.ATTRACTION, BuildingCategory.SHOP, BuildingCategory.DECORATION, BuildingCategory.SERVICE];

  BuildingCategoryLabels = BuildingCategoryLabels;
  onSelectTool(category: ToolType | string, id: string | null) {
    this.toolSelected.emit({ category, id });
  }

  buildings(cat: string): BuildingType[] {
    return this.getBuildingsByCategory ? this.getBuildingsByCategory(cat) : [];
  }

  getBuildingCount(buildingId: string): number {
    return this.buildingStats.byType[buildingId]?.count || 0;
  }

  trackByBuildingId(_: number, item: BuildingType) {
    return item.id;
  }
}
