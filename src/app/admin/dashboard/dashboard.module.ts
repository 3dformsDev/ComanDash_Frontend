import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DashboardPageRoutingModule } from './dashboard-routing.module';

import { DashboardPage } from './dashboard.page';
import { TableSelectionComponent } from 'src/app/components/table-selection/table-selection.component';
import { IfRoleDirective } from 'src/app/directives/if-role';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DashboardPageRoutingModule,
    TableSelectionComponent,
    IfRoleDirective
  ],
  declarations: [DashboardPage]
})
export class DashboardPageModule {}
