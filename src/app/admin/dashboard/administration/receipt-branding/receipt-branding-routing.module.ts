import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../../../../auth/guards/role-guard';
import { ReceiptBrandingPage } from './receipt-branding.page';

const routes: Routes = [
  {
    path: '',
    component: ReceiptBrandingPage,
    canActivate: [roleGuard],
    data: {
      roles: ['super_admin', 'admin', 'manager']
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReceiptBrandingPageRoutingModule {}
