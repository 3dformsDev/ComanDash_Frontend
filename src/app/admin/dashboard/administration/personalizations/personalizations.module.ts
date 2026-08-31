import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PersonalizationsPageRoutingModule } from './personalizations-routing.module';
import { PersonalizationsPage } from './personalizations.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, PersonalizationsPageRoutingModule],
  declarations: [PersonalizationsPage],
})
export class PersonalizationsPageModule {}
