import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { TycoonApp } from './app/app.component';

bootstrapApplication(TycoonApp, appConfig)
  .catch((err) => console.error(err));
