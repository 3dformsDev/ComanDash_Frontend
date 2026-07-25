import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { WaitersPageRoutingModule } from './waiters-routing.module';
import { WaitersPage } from './waiters.page';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { PaidOrderRowComponent } from 'src/app/components/paid-order-row/paid-order-row.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WaitersPageRoutingModule,
    ScrollingModule,
    PaidOrderRowComponent
  ],
  declarations: [WaitersPage]
})
export class WaitersPageModule { }
