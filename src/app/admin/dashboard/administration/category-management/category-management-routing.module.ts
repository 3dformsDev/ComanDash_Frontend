import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CategoryManagementPage } from './category-management.page';

const routes: Routes = [
  {
    path: '',
    component: CategoryManagementPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CategoryManagementPageRoutingModule {}
