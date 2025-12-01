import { Routes } from '@angular/router';
import { TycoonApp } from './app.component';
import { SkinsGalleryComponent } from './pages/skins-gallery/skins-gallery.component';

export const routes: Routes = [
  { path: '', component: TycoonApp },
  { path: 'skins', component: SkinsGalleryComponent },
  { path: '**', redirectTo: '' }
];
