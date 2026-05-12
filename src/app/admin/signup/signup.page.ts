import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
  standalone: false,
})
export class SignupPage implements OnInit {

  signupData: any = {
    name: '',
    email: '',
    password: ''
  };

  showPassword: boolean = false;

  constructor() { }

  ngOnInit() {
  }

  // Función para el botón de registro
  signup() {
    console.log('Signup attempt with:', this.signupData);
    // Aquí conectarías con tu servicio de autenticación para crear la cuenta
  }

  // Función para cambiar la visibilidad de la contraseña
  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  // Función para abrir los términos y condiciones (ej. en un modal)
  openTerms() {
    console.log('Opening terms and conditions...');
    // Aquí puedes usar el ModalController de Ionic para mostrar los términos
  }

}
