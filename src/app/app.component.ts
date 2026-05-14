import { Component } from '@angular/core';
import { register } from 'swiper/element/bundle';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { NotificationService } from '@services/notification.service';
import { Platform, ToastController } from '@ionic/angular';
import { PwaUpdateService } from '@services/pwa-update.service';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { SessionActivityService } from './core/services/session-activity.service';


register();
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(
  private platform: Platform,
  private toastController: ToastController,
  private swUpdate: SwUpdate,
  private sessionActivityService: SessionActivityService
) { }

  async ngOnInit() {
    // ✅ Unificamos toda la lógica de actualización aquí.
    if (this.swUpdate.isEnabled) {
      // Revisa si hay una actualización en el servidor
      this.swUpdate.checkForUpdate();

      // Escucha las actualizaciones que están listas para ser activadas
      this.swUpdate.versionUpdates.pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      ).subscribe(() => {
        // En lugar de forzar la recarga, mostramos una notificación persistente.
        this.showUpdateToast();
      });
    }

    // El resto de tu inicialización de la app.
    if (Capacitor.isNativePlatform()) {
      await this.initializeApp();
    }
    // this.sessionActivityService.startMonitoring();
  }
  /**
   * Contiene la configuración inicial para plataformas nativas.
   */
  async initializeApp() {
    await this.lockScreenToPortrait();
    await this.configureStatusBar();
  }

  /**
   * Bloquea la orientación de la pantalla a modo vertical (portrait).
   */
  async lockScreenToPortrait() {
    try {
      await ScreenOrientation.lock({ orientation: 'portrait-primary' });
      console.log('Screen orientation locked to portrait.');
    } catch (error) {
      console.error('Error locking screen orientation:', error);
    }
  }

  /**
   * Establece el estilo del texto de la barra de estado.
   * La app usará automáticamente las variables de área segura de Ionic para el espaciado.
   */
  async configureStatusBar() {
    try {
      // Usamos Style.Dark para que el texto (hora, batería) sea blanco.
      await StatusBar.setStyle({ style: Style.Dark });
      console.log('Status bar style set to Dark.');
    } catch (error) {
      console.error('Error setting status bar style:', error);
    }
  }
  /**
    * Muestra una notificación Toast persistente para que el usuario actualice.
    */
  async showUpdateToast() {
    const toast = await this.toastController.create({
      message: 'Hay una nueva versión disponible.',
      // ✅ `duration: 0` hace que el toast sea persistente hasta que se interactúe con él.
      duration: 0,
      position: 'bottom',
      buttons: [
        {
          text: 'ACTUALIZAR',
          role: 'confirm',
          handler: () => {
            // Llama al método para activar la actualización y recargar.
            this.activateUpdate();
          }
        },
        {
          // ✅ Un botón para cerrar es buena práctica de UX.
          text: 'Ahora no',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  /**
  * Activa la nueva versión del Service Worker y recarga la página.
  */
  private activateUpdate() {
    this.swUpdate.activateUpdate().then(() => {
      document.location.reload();
    });
  }

}
