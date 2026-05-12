import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';
import { ToastController } from '@ionic/angular';

@Injectable({
    providedIn: 'root'
})
export class ToastService {

    constructor(
        private toastController: ToastController
    ) { }

    async presentToast(message: string, color: 'success' | 'danger') {
        const toast = await this.toastController.create({
            message: message,    // El mensaje de error que viene de tu API
            duration: 3000,      // Duración en milisegundos
            position: 'bottom',     // Posición ('top', 'bottom', 'middle')
            color: color,        // Color del toast ('success' para éxito, 'danger' para error)
        });
        await toast.present();
    }
}