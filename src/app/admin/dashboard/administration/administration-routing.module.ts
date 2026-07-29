import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdministrationPage } from './administration.page';

const routes: Routes = [
  {
    path: '',
    component: AdministrationPage
  },
  {
    path: 'menu-management',
    loadChildren: () => import('./menu-management/menu-management.module').then( m => m.MenuManagementPageModule)
  },
  {
    path: 'category-management',
    loadChildren: () => import('./category-management/category-management.module').then( m => m.CategoryManagementPageModule)
  },
  {
    path: 'table-management',
    loadChildren: () => import('./table-management/table-management.module').then( m => m.TableManagementPageModule)
  },
  {
    path: 'payment-methods-management',
    loadChildren: () => import('./payment-methods-management/payment-methods-management.module').then( m => m.PaymentMethodsManagementPageModule)
  },
  {
    path: 'cash-box-management',
    loadChildren: () => import('./cash-box-management/cash-box-management.module').then( m => m.CashBoxManagementPageModule)
  },
  {
    path: 'reports',
    loadChildren: () => import('./reports/reports.module').then( m => m.ReportsPageModule)
  },
  {
    path: 'receipt-branding',
    loadChildren: () => import('./receipt-branding/receipt-branding.module').then(m => m.ReceiptBrandingPageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdministrationPageRoutingModule {}
