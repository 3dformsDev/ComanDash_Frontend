import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TableManagementPage } from './table-management.page';

const routes: Routes = [
  {
    path: '',
    component: TableManagementPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TableManagementPageRoutingModule {}
