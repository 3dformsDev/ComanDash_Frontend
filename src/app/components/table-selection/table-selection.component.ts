import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { NameOfClientComponent } from '../name-of-client/name-of-client.component';
import * as OrdersActions from '@store/orders/actions/orders.actions';
import { TableI } from '@services/table.service';
import { Router } from '@angular/router';
import { AppState } from '@capacitor/app';
import { Store } from '@ngrx/store';

@Component({
  selector: 'app-table-selection',
  templateUrl: './table-selection.component.html',
  styleUrls: ['./table-selection.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule] // Simplificamos los imports
})
export class TableSelectionComponent {

  @Input() tables: TableI[] = [];

  // Usamos @Output para enviar eventos al componente padre
  @Output() onTableSelect = new EventEmitter<any>();
  @Output() onCancel = new EventEmitter<void>();

  // El constructor ya no necesita ModalController
  constructor(
    private modalCtrl: ModalController,
    private router: Router,
    private store: Store<AppState>,
  ) { }

  // Ahora, en lugar de cerrar el modal, emitimos un evento con los datos
  async selectT(table: any, isRequired: boolean) {
    this.onTableSelect.emit(table);
    // Creamos el modal usando el ModalController
    const modal = await this.modalCtrl.create({
      component: NameOfClientComponent, // El componente del modal
      componentProps: {
        isRequired: isRequired // Pasamos el parámetro para la validación
      },
      // ¡Esta es la clave! Asignamos el ID para que los estilos del Canvas se apliquen.
      id: 'name-of-client-modal'
    });

    // Presentamos el modal en pantalla
    await modal.present();


    // Esperamos a que el modal se cierre para recibir los datos
    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      console.log('Nombre del cliente:', data);
      this.store.dispatch(OrdersActions.setNameOrder({ customerName: data }));
      this.store.dispatch(OrdersActions.setNumberOrder({ numberTable: table }));
      // Aquí puedes continuar tu lógica, por ejemplo, crear un pedido
      // para llevar con el nombre del cliente que recibiste en 'data'.
    } else {
      console.log('Modal de nombre de cliente cerrado.');
    }
  }

  // Emitimos un evento para cancelar
  closeModal() {
    this.onCancel.emit();
  }

  selectTable(table:any){

  }

  redirectToAddTables(){
    this.router.navigate(['/dashboard/administration/table-management']);
    this.onCancel.emit();
  }
}