import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ReportsPageRoutingModule } from './reports-routing.module';

import { ReportsPage } from './reports.page';
import { PaidOrderRowComponent } from '../../../../components/paid-order-row/paid-order-row.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReportsPageRoutingModule,
    PaidOrderRowComponent
  ],
  declarations: [ReportsPage]
})
export class ReportsPageModule {}
