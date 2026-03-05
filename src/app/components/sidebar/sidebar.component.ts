import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BuildingType, ToolType } from '../../models/building.model';
import {
  SIDEBAR_BUILDING_CATEGORIES,
  SIDEBAR_BUILDING_CATEGORY_LABELS,
  SIDEBAR_INFRASTRUCTURE_TOOLS,
  SidebarBuildingCategory,
  SidebarInfrastructureTool
} from './sidebar.config';

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
  @Input() achievementUnlockedCount = 0;
  @Input() achievementTotalCount = 0;

  @Output() toolSelected = new EventEmitter<{ category: ToolType | string; id: string | null }>();
  @Output() togglePark = new EventEmitter<void>();
  @Output() reset = new EventEmitter<void>();
  @Output() closeSidebar = new EventEmitter<void>();

  readonly categories: SidebarBuildingCategory[] = SIDEBAR_BUILDING_CATEGORIES;
  readonly infrastructureTools: SidebarInfrastructureTool[] = SIDEBAR_INFRASTRUCTURE_TOOLS;
  collapsedSections = new Set<string>();

  readonly BuildingCategoryLabels = SIDEBAR_BUILDING_CATEGORY_LABELS;

  onSelectTool(category: ToolType | string, id: string | null) {
    this.toolSelected.emit({ category, id });
  }

  toggleSection(sectionId: string): void {
    if (this.collapsedSections.has(sectionId)) {
      this.collapsedSections.delete(sectionId);
      return;
    }

    this.collapsedSections.add(sectionId);
  }

  isSectionCollapsed(sectionId: string): boolean {
    return this.collapsedSections.has(sectionId);
  }

  buildings(cat: string): BuildingType[] {
    return this.getBuildingsByCategory ? this.getBuildingsByCategory(cat) : [];
  }

  getBuildingCount(buildingId: string): number {
    return this.buildingStats.byType[buildingId]?.count || 0;
  }

  isInfrastructureToolSelected(tool: SidebarInfrastructureTool): boolean {
    return this.selectedToolCategory === tool.category && this.selectedToolId === tool.id;
  }

  trackByBuildingId(_: number, item: BuildingType) {
    return item.id;
  }
}
