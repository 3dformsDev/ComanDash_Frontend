import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PaymentMethodsManagementPageRoutingModule } from './payment-methods-management-routing.module';

import { PaymentMethodsManagementPage } from './payment-methods-management.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PaymentMethodsManagementPageRoutingModule
  ],
  declarations: [PaymentMethodsManagementPage]
})
export class PaymentMethodsManagementPageModule {}
