# Park Tycoon - Architecture Overview

## 📁 Project Structure

```
src/app/
├── components/           # UI Components
│   ├── casino-stats/    # Casino statistics modal
│   └── skins-gallery/   # Character skins gallery
├── models/              # Data Models & Interfaces
│   ├── building.model.ts   # Building types & definitions
│   ├── cell.model.ts       # Grid cell interface
│   ├── game-state.model.ts # Save/load state interfaces
│   └── guest.model.ts      # Guest class & behavior
├── services/            # Business Logic Services
│   ├── building.service.ts  # Building management
│   ├── casino.service.ts    # Casino/gambling logic
│   ├── game-state.service.ts # Save/load system
│   ├── grid.service.ts      # Grid operations
│   └── guest.service.ts     # Guest AI & pathfinding
├── pipes/               # Custom Pipes
│   └── safe-html.pipe.ts   # SVG sanitization
└── app.component.ts     # Main game controller
```

## 🏗️ Service Architecture

### **GridService**
Handles all grid-related operations:
- `createEmptyGrid()` - Initialize new grid
- `getCellIndex(x, y)` - Convert coordinates to array index
- `getCell(grid, x, y)` - Get cell at position
- `updateCell(grid, cell)` - Immutably update cell
- `isWalkable(cell)` - Check if cell is walkable
- `getNeighbors(x, y)` - Get adjacent cells

### **GuestService**
Manages guest behavior and AI:
- `spawnGuest(id, x, y)` - Create new guest
- `updateGuests(guests, grid, callbacks)` - Update all guests (movement, needs, interactions)
- `calculateAverageStats(guests)` - Get average happiness/satiety/etc
- Handles pathfinding, attraction visits, and gambling interactions

### **BuildingService**
Building construction and management:
- `getBuildingsByCategory(cat)` - Filter buildings by type
- `getBuildingById(id)` - Get building definition
- `canBuild(building, money)` - Check if affordable
- `buildBuilding(grid, cell, building)` - Place building
- `demolishBuilding(grid, cell)` - Remove building
- `processCasinoPayout(grid)` - Calculate casino earnings

### **CasinoService**
Casino/gambling mechanics:
- `initCasino(x, y, initialBank)` - Setup new casino
- `processBet(x, y, guestId, bet, won)` - Handle guest gambling
- `processPayout(x, y)` - 10-day payout cycle
- `getCasinoStats(x, y)` - Get statistics
- `saveToStorage()` / `loadFromStorage()` - Persistence

### **GameStateService**
Save/load game state:
- `saveGame(state)` - Save to localStorage
- `loadGame()` - Load from localStorage
- `resetGame()` - Clear saved data

## 📦 Models

### **BuildingType**
```typescript
{
  id: string;
  name: string;
  category: ToolType;
  price: number;
  income: number;
  icon: string;
  satisfies?: 'satiety' | 'hydration' | 'energy' | 'fun';
  isGambling?: boolean;
}
```

### **Cell**
```typescript
{
  x: number;
  y: number;
  type: 'grass' | 'path' | 'building' | 'entrance' | 'exit';
  buildingId?: string;
  data?: any; // Casino bank, etc
}
```

### **Guest** (Class)
Properties:
- Position: `x, y, targetX, targetY`
- Stats: `happiness, satiety, hydration, energy, fun`
- State: `walking, idle, leaving`

Methods:
- `updateNeeds()` - Decrease stats over time
- `checkMood()` - Determine if wants to leave
- `visitAttraction(stats)` - Apply building effects

### **GameSaveState**
```typescript
{
  money: number;
  dayCount: number;
  grid: Cell[];
  guests: Guest[];
  guestIdCounter: number;
  entranceIndex: number;
  casinoLastPayoutDay: number;
  casinoData?: string;
}
```

## 🔄 Data Flow

### Game Loop (500ms interval)
1. **Update Tick Counter** → Advance day every 60 ticks (30s)
2. **Casino Payout** → Every 10 days
3. **Spawn Guests** → Based on attraction count
4. **Update Guests** → via `GuestService.updateGuests()`
   - Update needs (hunger, thirst, energy)
   - Move towards targets
   - Visit attractions
   - Handle gambling
   - Find exits if unhappy

### Building Construction
1. User clicks tool → `selectedToolId` signal updated
2. User clicks cell → `onCellClick(cell)`
3. Validate conditions (money, cell type)
4. Call `BuildingService.buildBuilding()`
5. Update grid signal
6. Save game
7. Reset tool selection

### Guest Interaction Flow
1. Guest reaches building cell
2. Check building type in `BUILDINGS` array
3. If gambling → `CasinoService.processBet()`
4. If normal → Charge guest, add money to player
5. Apply stat boosts (fun, satiety, etc)
6. Find next walkable cell

## 🎯 Key Improvements

✅ **Separation of Concerns** - Each service has single responsibility  
✅ **Testability** - Services can be unit tested independently  
✅ **Reusability** - Services injectable across components  
✅ **Maintainability** - Logic organized by domain  
✅ **Type Safety** - Interfaces for all data structures  
✅ **Immutability** - Services return new arrays instead of mutating  

## 🚀 Future Enhancements

- **PathfindingService** - A* algorithm for smarter guest movement
- **EventService** - Random events, weather, special days
- **StatsService** - Advanced analytics and charts
- **AIService** - Dynamic pricing, difficulty adjustment
- **MultiplayerService** - Leaderboards, friend visits

## 📝 Development Guidelines

1. **Component** - UI only, minimal logic
2. **Service** - Business logic, no DOM manipulation
3. **Model** - Data structures, validation
4. **Signals** - Reactive state management
5. **Pure Functions** - Services should be side-effect free where possible
