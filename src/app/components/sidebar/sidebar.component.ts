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

  @Output() toolSelected = new EventEmitter<{ category: ToolType | string; id: string | null }>();
  @Output() loadDemo = new EventEmitter<void>();
  @Output() togglePark = new EventEmitter<void>();
  @Output() reset = new EventEmitter<void>();

  categories: Array<BuildingCategory> = [BuildingCategory.ATTRACTION, BuildingCategory.SHOP, BuildingCategory.DECORATION, BuildingCategory.SERVICE];
  BuildingCategoryLabels = BuildingCategoryLabels;
  onSelectTool(category: ToolType | string, id: string | null) {
    this.toolSelected.emit({ category, id });
  }

  buildings(cat: string): BuildingType[] {
    return this.getBuildingsByCategory ? this.getBuildingsByCategory(cat) : [];
  }

  trackByBuildingId(_: number, item: BuildingType) {
    return item.id;
  }
}
