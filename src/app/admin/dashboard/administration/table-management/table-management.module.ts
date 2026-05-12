import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TableManagementPageRoutingModule } from './table-management-routing.module';

import { TableManagementPage } from './table-management.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TableManagementPageRoutingModule
  ],
  declarations: [TableManagementPage]
})
export class TableManagementPageModule {}
