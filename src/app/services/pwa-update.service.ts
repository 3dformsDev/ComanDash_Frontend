import { Injectable } from '@angular/core';
import { Workbox } from 'workbox-window';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PwaUpdateService {
  // Usamos un Subject de RxJS para emitir un evento cuando hay una actualización
  public updateAvailable = new Subject<boolean>();
  private wb: Workbox | undefined;

  constructor() { }

  /**
     * Inicia el listener para detectar actualizaciones de la PWA.
     * Debería ser llamado desde app.component.ts
     */
  public initPwaUpdateListener() {
    if ('serviceWorker' in navigator) {
      this.wb = new Workbox('/ngsw-worker.js'); // O '/service-worker.js' dependiendo de tu config

      // Este evento se dispara cuando un nuevo Service Worker está instalado pero "esperando" para activarse.
      this.wb.addEventListener('waiting', () => {
        this.updateAvailable.next(true);
      });

      // Registra el Service Worker.
      this.wb.register();
    }
  }

  /**
   * Le dice al nuevo Service Worker que se active y tome el control.
   */
  public activateUpdate() {
    if (this.wb) {
      // Workbox se encargará de enviar el mensaje 'SKIP_WAITING'
      // y recargará la página una vez que el nuevo SW esté activo.
      this.wb.messageSkipWaiting();
    }
  }
}
