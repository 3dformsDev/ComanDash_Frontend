import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-name-of-client',
  templateUrl: './name-of-client.component.html',
  styleUrls: ['./name-of-client.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class NameOfClientComponent {

  // Parámetro de entrada para decidir si el nombre es obligatorio.
  @Input() isRequired: boolean = false;

  clientName: string = '';
  errorMessage: string = '';

  constructor(private router: Router, private modalCtrl: ModalController) { }

  /**
   * Valida el nombre en tiempo real para limpiar el error.
   */
  validateName() {
    if (this.clientName.trim() !== '') {
      this.errorMessage = '';
    }
  }

  /**
   * Cierra el modal sin devolver datos.
   */
  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  /**
   * Confirma y cierra el modal.
   * Valida el nombre si es requerido.
   */
  confirm() {
    const trimmedName = this.clientName.trim();

    // Si es requerido y está vacío, muestra un error.
    if (this.isRequired && trimmedName === '') {
      this.errorMessage = 'El nombre es obligatorio.';
      return;
    }

    // Si es opcional y está vacío, devuelve un string vacío.
    // Si tiene valor, devuelve el nombre.

    this.router.navigate(['/dashboard/orders']);

    return this.modalCtrl.dismiss(trimmedName, 'confirm');
  }
}

