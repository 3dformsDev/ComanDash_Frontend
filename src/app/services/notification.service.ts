import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Platform, ToastController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { take, filter, Subscription } from 'rxjs';

// Dependencias para Nativo (Capacitor)
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

// ✅ API MODERNA de Firebase v9+
import { Messaging, getToken, onMessage } from '@angular/fire/messaging';

import { environment } from '@environments/environment';
import { selectLocationId } from '@store/auth/selectors/auth.selectors';
import { deleteToken } from 'firebase/messaging';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private tokenSent = false;
  private locationSubscription: Subscription | undefined;

  // Inyección de dependencias moderna
  private http = inject(HttpClient);
  private store = inject(Store);
  private router = inject(Router);
  private toastController = inject(ToastController);
  private platform = inject(Platform);
  private messaging = inject(Messaging);
  private injector = inject(Injector);

  public init() {

    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe();
    }

    // 2. Creamos la nueva suscripción SIN take(1) y la guardamos en nuestra propiedad.
    this.locationSubscription = this.store.select(selectLocationId).pipe(
      filter((locationId): locationId is number => !!locationId),
      // take(1)  <-- ELIMINA ESTA LÍNEA
    ).subscribe(locationId => {
      console.log(`LocationId [${locationId}] detectado. Iniciando registro de notificaciones.`);
      if (!this.tokenSent) {
        if (this.platform.is('capacitor')) {
          this.registerNativePush(locationId);
        } else {
          this.ensureServiceWorkerRegistered()
            .then(() => this.registerWebPush(locationId))
            .catch(err => {
              console.error("Fallo al registrar SW:", err);
              this.showErrorToast('Error al configurar notificaciones');
            });
        }
      }
    })



    // this.store.select(selectLocationId).pipe(
    //   filter((locationId): locationId is number => !!locationId),
    // ).subscribe(locationId => {
    //   console.log(`LocationId [${locationId}] detectado. Iniciando registro de notificaciones.`);

    //   if (!this.tokenSent) {
    //     if (this.platform.is('capacitor')) {
    //       this.registerNativePush(locationId);
    //     } else {
    //       // Asegurar que el service worker esté registrado antes
    //       this.ensureServiceWorkerRegistered()
    //         .then(() => this.registerWebPush(locationId))
    //         .catch(err => {
    //           console.error("Fallo al registrar SW:", err);
    //           this.showErrorToast('Error al configurar notificaciones');
    //         });
    //     }
    //   }
    // });
  }

  // =======================================================
  // LÓGICA PARA LA APP NATIVA (CAPACITOR)
  // =======================================================
  private async registerNativePush(locationId: number) {
    try {
      // Solicitar permisos
      await PushNotifications.requestPermissions();

      // Registrar para notificaciones push
      await PushNotifications.register();

      // Listener para cuando se obtiene el token
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('✅ Token NATIVO obtenido:', token.value);
        this.sendTokenToBackend(token.value, locationId);
      });

      // Listener para errores de registro
      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('💥 Error en registro de notificaciones NATIVAS:', error);
        this.showErrorToast('Error al registrar notificaciones nativas');
      });

      // Listener para notificaciones recibidas cuando la app está abierta
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('📱 Notificación recibida en primer plano:', notification);
        this.showInAppNotification(notification.title, notification.body);
      });

      // Listener para cuando el usuario toca una notificación
      PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        console.log('👆 Notificación tocada:', notification);
        const orderId = notification.notification.data?.orderId;
        if (orderId) {
          this.router.navigate(['/kitchen']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      });

    } catch (error) {
      console.error('💥 Error al registrar notificaciones nativas:', error);
      this.showErrorToast('Error al configurar notificaciones nativas');
    }
  }

  // =======================================================
  // LÓGICA WEB CON API MODERNA ✨
  // =======================================================
  private registerWebPush(locationId: number) {
    // ✅ Envolver TODA la lógica en el contexto de inyección
    runInInjectionContext(this.injector, async () => {
      try {
        // Verificar soporte del navegador
        if (!('serviceWorker' in navigator) || !('Notification' in window)) {
          console.error('❌ Notificaciones Push no soportadas.');
          this.showErrorToast('Notificaciones no soportadas');
          return;
        }

        // Solicitar permisos
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('❌ Permisos de notificación no concedidos.');
          this.showErrorToast('Permisos de notificación denegados');
          return;
        }

        console.log('🔄 Solicitando token FCM...');

        const serviceWorkerRegistration = await navigator.serviceWorker.ready;

        const fcmToken = await getToken(this.messaging, {
          serviceWorkerRegistration,
          vapidKey: environment.firebase.vapidKey,
        });

        if (fcmToken) {
          console.log('✅ ¡Token WEB de notificación obtenido exitosamente!:', fcmToken);
          this.sendTokenToBackend(fcmToken, locationId);
        } else {
          console.log('❌ No se pudo obtener el token WEB.');
          this.showErrorToast('No se pudo obtener token de notificación');
        }

        // Escuchar mensajes en primer plano con API moderna
        onMessage(this.messaging, (payload) => {
          console.log('📬 Mensaje recibido en primer plano:', payload);
          const audio = new Audio('/assets/sound/notification.mp3'); // <-- Misma ruta al sonido
          audio.play();
          this.showInAppNotification(payload.notification?.title, payload.notification?.body);
        });

      } catch (error) {
        console.error('💥 Error final en registerWebPush:', error);
        this.handleWebPushError(error);
      }
    });
  }

  // =======================================================
  // SERVICE WORKER MANAGEMENT
  // =======================================================
  private async ensureServiceWorkerRegistered(): Promise<void> {
    try {
      // Verificar si ya hay una registration activa
      const existingRegistration = await navigator.serviceWorker.getRegistration();

      if (existingRegistration) {
        console.log('✅ Service Worker ya está registrado:', existingRegistration);
        // Asegurar que esté completamente activo
        await navigator.serviceWorker.ready;
        return;
      }

      // Registrar el service worker si no existe
      console.log('🔄 Registrando Service Worker...');
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });

      console.log('✅ Service Worker registrado exitosamente:', registration);

      // Esperar a que esté completamente listo
      await navigator.serviceWorker.ready;
      console.log('✅ Service Worker está listo para usar');

    } catch (error) {
      console.error('💥 Error al registrar Service Worker:', error);
      throw error;
    }
  }

  private handleWebPushError(error: any) {
    const errorMessage = error?.message || error?.toString() || 'Error desconocido';
    console.error('💥 Error detallado en notificaciones web:', error);

    let userMessage = 'Error al configurar notificaciones web';

    if (errorMessage.includes('Registration failed')) {
      console.error('🔧 Posibles soluciones:');
      console.error('1. Verificar que firebase-messaging-sw.js esté en /src/');
      console.error('2. Comprobar configuración de Firebase en environment');
      console.error('3. Verificar HTTPS o localhost');
      console.error('4. Revisar manifest.json');
      console.error('5. Verificar clave VAPID en Firebase Console');
      userMessage = 'Error de registro. Verifica la configuración.';
    } else if (errorMessage.includes('permission')) {
      userMessage = 'Permisos de notificación requeridos';
    } else if (errorMessage.includes('messaging/token-unsubscribe-failed')) {
      userMessage = 'Error al obtener token de notificación';
    }

    this.showErrorToast(userMessage);
  }

    // =======================================================
  // LÓGICA COMPARTIDA
  // =======================================================
  private sendTokenToBackend(token: string, locationId: number) {

    if (this.tokenSent) {
      console.log('⚠️ Token ya fue enviado anteriormente');
      return;
    }

    if (!locationId) {
      console.error('❌ Intento de enviar token sin locationId.');
      return;
    }

    const url = `${environment.apiUrl}/v1/notifications/store-token`;

    const payload = {
      token,
      locationId,
      platform: this.platform.is('capacitor') ? 'mobile' : 'web',
      timestamp: new Date().toISOString()
    };

    console.log(
      '📤 Enviando token al backend:',
      {
        locationId,
        platform: payload.platform
      }
    );

    this.http.post(url, payload).subscribe({

      next: (response) => {

        console.log(
          '✅ Token del dispositivo enviado al backend exitosamente:',
          response
        );

        this.tokenSent = true;

        this.showSuccessToast(
          'Notificaciones configuradas correctamente'
        );
      },

      error: (err) => {

        console.error(
          '💥 Error al enviar el token al backend:',
          err
        );

        // Si el usuario ya perdió autenticación,
        // evitamos mostrar un toast innecesario.
        if (err?.status === 401) {

          console.warn(
            '⚠️ Registro de notificaciones cancelado por sesión expirada.'
          );

          return;
        }

        this.showErrorToast(
          'Error al registrar dispositivo para notificaciones'
        );
      }
    });
  }

  private async showInAppNotification(title: string | undefined, body: string | undefined) {

    if (!title || !body) return;

    const toast = await this.toastController.create({
      message: `${title}: ${body}`,
      duration: 5000,
      position: 'top',
      color: 'success',
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }

  private async showErrorToast(message: string) {

    const toast = await this.toastController.create({
      message,
      duration: 4000,
      position: 'top',
      color: 'danger',
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }

  private async showSuccessToast(message: string) {

    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color: 'success'
    });

    await toast.present();
  }

  // =======================================================
  // MÉTODOS PÚBLICOS ADICIONALES
  // =======================================================

  /**
   * Método público para reiniciar el registro de notificaciones
   */
  public async reinitialize() {
    this.tokenSent = false;
    this.init();
  }

  /**
   * Verificar si las notificaciones están habilitadas
   */
  public async areNotificationsEnabled(): Promise<boolean> {
    if (this.platform.is('capacitor')) {
      // Para nativo, verificar permisos de Capacitor
      try {
        const result = await PushNotifications.checkPermissions();
        return result.receive === 'granted';
      } catch {
        return false;
      }
    } else {
      // Para web, verificar permisos del navegador
      return Notification.permission === 'granted';
    }
  }


  /**
  * ✅ NUEVO: Reinicia el estado del servicio y limpia los listeners activos.
  * Se debe llamar desde AuthEffects durante el proceso de logout.
  */
  public async shutdown(): Promise<void> {
    console.log('🔌 Apagando el servicio de notificaciones y reiniciando su estado.');


    try {
      // ✅ PASO 3: Llama a deleteToken y espera a que termine.
      // Esto limpia el estado interno de Firebase Messaging.
      console.log('🗑️ Intentando borrar el token de FCM...');
      await deleteToken(this.messaging);
      console.log('✅ Token de FCM borrado exitosamente.');
    } catch (error) {
      console.error('💥 Error al borrar el token de FCM:', error);
    }

    // 1. Reinicia la bandera de estado para permitir que el próximo usuario se registre.
    this.tokenSent = false;

    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe();
    }

    // 2. Si estamos en un dispositivo nativo, es CRÍTICO eliminar los listeners
    // para evitar fugas de memoria y que se dupliquen al iniciar sesión de nuevo.
    if (this.platform.is('capacitor')) {
      PushNotifications.removeAllListeners();
    }

    // Nota: Para la web, el listener onMessage de Firebase es gestionado
    // por el ciclo de vida del servicio y no requiere una limpieza manual explícita aquí.
  }

}
