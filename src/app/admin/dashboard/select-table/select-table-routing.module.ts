import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SelectTablePage } from './select-table.page';

const routes: Routes = [
  {
    path: '',
    component: SelectTablePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SelectTablePageRoutingModule {}
