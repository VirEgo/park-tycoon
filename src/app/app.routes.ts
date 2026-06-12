import { Routes } from '@angular/router';
import { TycoonApp } from './app.component';
import { SkinsGalleryComponent } from './pages/skins-gallery/skins-gallery.component';
import { GameSettingsComponent } from './pages/game-settings/game-settings.component';

export const routes: Routes = [
  { path: '', component: TycoonApp },
  { path: 'skins', component: SkinsGalleryComponent },
  { path: 'settings', component: GameSettingsComponent },
  { path: '**', redirectTo: '' }
];
