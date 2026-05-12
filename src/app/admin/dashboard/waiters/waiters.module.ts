import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { WaitersPageRoutingModule } from './waiters-routing.module';
import { WaitersPage } from './waiters.page';
import { ScrollingModule } from '@angular/cdk/scrolling';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WaitersPageRoutingModule,
    ScrollingModule
  ],
  declarations: [WaitersPage]
})
export class WaitersPageModule { }
