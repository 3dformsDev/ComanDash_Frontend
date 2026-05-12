import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CashBoxManagementPage } from './cash-box-management.page';

const routes: Routes = [
  {
    path: '',
    component: CashBoxManagementPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CashBoxManagementPageRoutingModule {}
