import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CategoryManagementPageRoutingModule } from './category-management-routing.module';

import { CategoryManagementPage } from './category-management.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CategoryManagementPageRoutingModule
  ],
  declarations: [CategoryManagementPage]
})
export class CategoryManagementPageModule {}
