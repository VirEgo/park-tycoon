import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { GameSettingsService } from '../../services/game-settings.service';
import { GameStateService } from '../../services/game-state.service';
import { ExpansionService } from '../../services/expansion.service';

@Component({
  selector: 'app-game-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './game-settings.component.html',
  styleUrl: './game-settings.component.scss'
})
export class GameSettingsComponent {
  private settingsService = inject(GameSettingsService);
  private gameStateService = inject(GameStateService);
  private expansionService = inject(ExpansionService);

  settings = this.settingsService.settings;
  notification = signal<{ message: string; kind: 'success' | 'error' } | null>(null);
  exportData = signal<string | null>(null);

  readonly categories: Array<'building' | 'finance' | 'guests' | 'achievements' | 'repair'> = [
    'building', 'finance', 'guests', 'achievements', 'repair'
  ];

  readonly categoryLabels: Record<string, string> = {
    building: 'Строительство',
    finance: 'Финансы',
    guests: 'Гости',
    achievements: 'Достижения',
    repair: 'Ремонт'
  };

  updateSetting(key: string, value: any) {
    this.settingsService.update({ [key]: value });
  }

  updateCategory(category: string, value: boolean) {
    this.settingsService.updateCategories({ [category]: value });
  }

  resetSettings() {
    if (confirm('Сбросить все настройки к значениям по умолчанию?')) {
      this.settingsService.reset();
      this.showNotification('Настройки сброшены', 'success');
    }
  }

  exportSave() {
    const state = this.gameStateService.loadGame();
    if (!state) {
      this.showNotification('Нет данных для экспорта', 'error');
      return;
    }
    const json = this.settingsService.exportSave(
      state.grid, state.guests, state.money, state.dayCount,
      state.expansionState ?? this.expansionService.getInitialState()
    );

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `park-tycoon-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.showNotification('Сохранение экспортировано', 'success');
  }

  importSave(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = this.settingsService.importSave(reader.result as string);
      if (result.success && result.data) {
        this.gameStateService.saveGame(result.data);
        if (result.data.settings) {
          this.settingsService.update(result.data.settings);
        }
        this.showNotification('Сохранение импортировано! Перезагрузите страницу.', 'success');
      } else {
        this.showNotification(result.error || 'Ошибка импорта', 'error');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  private showNotification(message: string, kind: 'success' | 'error') {
    this.notification.set({ message, kind });
    setTimeout(() => this.notification.set(null), 3000);
  }
}
