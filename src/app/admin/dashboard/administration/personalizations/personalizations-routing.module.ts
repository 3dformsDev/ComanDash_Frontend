import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PersonalizationsPage } from './personalizations.page';

const routes: Routes = [{ path: '', component: PersonalizationsPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PersonalizationsPageRoutingModule {}
