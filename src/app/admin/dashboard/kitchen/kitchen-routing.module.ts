import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { KitchenPage } from './kitchen.page';

const routes: Routes = [
  {
    path: '',
    component: KitchenPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class KitchenPageRoutingModule {}
