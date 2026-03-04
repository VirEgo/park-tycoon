import { Injectable } from '@angular/core';
import { LM_STUDIO_CONFIG } from '../config/lm-studio.config';

export interface DiagnosisHistoryEntry {
  id: string;
  createdAt: string;
  report: string;
  snapshot: string;
}

const STORAGE_KEY = 'park-tycoon-ai-diagnosis-history-v1';

@Injectable({
  providedIn: 'root'
})
export class AiDiagnosisHistoryService {
  loadHistory(): DiagnosisHistoryEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw) as DiagnosisHistoryEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to load AI diagnosis history', error);
      return [];
    }
  }

  addEntry(report: string, snapshot: string, createdAt: string): DiagnosisHistoryEntry[] {
    const current = this.loadHistory();
    const next: DiagnosisHistoryEntry[] = [
      {
        id: crypto.randomUUID(),
        createdAt,
        report,
        snapshot
      },
      ...current
    ].slice(0, LM_STUDIO_CONFIG.diagnosisHistoryLimit);

    this.saveHistory(next);
    return next;
  }

  clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
  }

  private saveHistory(entries: DiagnosisHistoryEntry[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to save AI diagnosis history', error);
    }
  }
}
