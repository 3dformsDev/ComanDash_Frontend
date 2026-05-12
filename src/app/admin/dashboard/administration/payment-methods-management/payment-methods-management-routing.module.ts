import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PaymentMethodsManagementPage } from './payment-methods-management.page';

const routes: Routes = [
  {
    path: '',
    component: PaymentMethodsManagementPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PaymentMethodsManagementPageRoutingModule {}
