import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ReportsPageRoutingModule } from './reports-routing.module';

import { ReportsPage } from './reports.page';
import { IfRoleDirective } from '../../../../directives/if-role';
import { PaidOrderRowComponent } from '../../../../components/paid-order-row/paid-order-row.component';
import { DesktopWheelDragDirective } from '../../../../directives/desktop-wheel-drag.directive';

@NgModule({
  imports: [
    CommonModule,
    IfRoleDirective,
    FormsModule,
    IonicModule,
    ReportsPageRoutingModule,
    PaidOrderRowComponent,
    DesktopWheelDragDirective
  ],
  declarations: [ReportsPage]
})
export class ReportsPageModule {}
