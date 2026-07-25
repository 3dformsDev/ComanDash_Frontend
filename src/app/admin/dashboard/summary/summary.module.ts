import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SummaryPageRoutingModule } from './summary-routing.module';

import { SummaryPage } from './summary.page';
import { PaidOrderRowComponent } from 'src/app/components/paid-order-row/paid-order-row.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SummaryPageRoutingModule,
    PaidOrderRowComponent
  ],
  declarations: [SummaryPage]
})
export class SummaryPageModule {}
