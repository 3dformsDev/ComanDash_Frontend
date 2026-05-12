import { NgModule, CUSTOM_ELEMENTS_SCHEMA, LOCALE_ID, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// NgRx
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';

import { AuthEffects } from './store/auth/effects/auth.effects';
import { authReducer } from './store/auth/reducer/auth.reducer';

import { environment } from '../environments/environment';
import { AuthInterceptor } from './auth/interceptors/auth.interceptor';

// Importaciones de localización
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';

// ✅ FIREBASE MODERNO (v9+) - Reemplazar las importaciones compat
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideMessaging, getMessaging } from '@angular/fire/messaging';

import { RouterModule } from '@angular/router';
import { OrdersEffects } from '@store/orders/effects/orders.effects';
import { ordersReducer } from '@store/orders/reducer/orders.reducer';

import { ServiceWorkerModule } from '@angular/service-worker';

// Registrar datos de localización
registerLocaleData(localeEsCo, 'es-CO');

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    RouterModule.forRoot([]),
    AppRoutingModule,
    HttpClientModule,

    // NgRx Configuration
    StoreModule.forRoot(
      {
        auth: authReducer,
        orders: ordersReducer
      },
    ),
    EffectsModule.forRoot([
      AuthEffects,
      OrdersEffects
    ]),

    // Redux DevTools
    StoreDevtoolsModule.instrument({
      maxAge: 25,
      logOnly: environment.production,
    }),
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: environment.production,
      // ...
    }),
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    { provide: LOCALE_ID, useValue: 'es-CO' },

    // ✅ FIREBASE MODERNO - Providers en lugar de imports
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideMessaging(() => getMessaging()),
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule { }