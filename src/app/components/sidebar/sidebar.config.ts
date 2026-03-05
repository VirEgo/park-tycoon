import { ToolType } from '../../models/building.model';

export type SidebarBuildingCategory = Extract<ToolType, 'attraction' | 'shop' | 'decoration' | 'service'>;

export interface SidebarInfrastructureTool {
  id: string | null;
  category: ToolType | 'demolish';
  name: string;
  price: number;
  svgPath?: string;
  icon?: string;
  danger?: boolean;
}

export const SIDEBAR_BUILDING_CATEGORIES: SidebarBuildingCategory[] = [
  'attraction',
  'shop',
  'decoration',
  'service'
];

export const SIDEBAR_BUILDING_CATEGORY_LABELS: Record<SidebarBuildingCategory, string> = {
  attraction: 'Attractions',
  shop: 'Shops',
  decoration: 'Decorations',
  service: 'Services'
};

export const SIDEBAR_INFRASTRUCTURE_TOOLS: SidebarInfrastructureTool[] = [
  {
    id: 'path',
    category: 'path',
    name: 'Дорожка',
    price: 10,
    svgPath: 'assets/buildings/path.svg'
  },
  {
    id: 'exit',
    category: 'path',
    name: 'Выход',
    price: 0,
    svgPath: 'assets/buildings/exit2.svg'
  },
  {
    id: null,
    category: 'demolish',
    name: 'Снос',
    price: 0,
    icon: '❌',
    danger: true
  }
];

