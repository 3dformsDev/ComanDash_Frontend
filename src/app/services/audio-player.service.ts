import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioPlayerService {
  public audioContext: AudioContext | null = null;
  private notificationSound: HTMLAudioElement;

  constructor() {
    // Pre-cargamos el audio para que esté listo para usarse
    this.notificationSound = new Audio('/assets/sound/notification.mp3');
    this.notificationSound.load();
  }

  // Este método debe ser llamado DESPUÉS de un clic del usuario
  public unlockAudio() {
    if (this.audioContext === null) {
      this.audioContext = new AudioContext();
      console.log('Audio context desbloqueado por interacción del usuario.');
      // Opcional: reproduce un sonido silencioso para asegurar el "desbloqueo"
      this.notificationSound.muted = true;
      this.notificationSound.play().catch(e => console.error("Unlock play failed", e));
      this.notificationSound.muted = false;
    }
  }

  public playNotificationSound(): void {
    // Si el audio no ha sido desbloqueado, no se podrá reproducir
    if (this.audioContext && this.audioContext.state === 'running') {
      this.notificationSound.currentTime = 0; // Reinicia el audio por si se llama rápidamente
      this.notificationSound.play().catch(e => console.error("Playback failed", e));
    } else {
      console.warn('El audio no ha sido desbloqueado por el usuario todavía.');
    }
  }
}
