import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CashBoxManagementPageRoutingModule } from './cash-box-management-routing.module';

import { CashBoxManagementPage } from './cash-box-management.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CashBoxManagementPageRoutingModule
  ],
  declarations: [CashBoxManagementPage]
})
export class CashBoxManagementPageModule {}
