import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ReceiptBrandingPageRoutingModule } from './receipt-branding-routing.module';
import { ReceiptBrandingPage } from './receipt-branding.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReceiptBrandingPageRoutingModule
  ],
  declarations: [ReceiptBrandingPage]
})
export class ReceiptBrandingPageModule {}
