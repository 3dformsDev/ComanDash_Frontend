import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthService } from '@services/auth.service';
import * as AuthActions from '@store/auth/actions/auth.actions'

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {

  loginForm: FormGroup;

  formErrors: any = {
    username: null,
    password: null,
    business_code: null
  };

  showPassword: boolean = false;

  constructor(
    private router: Router,
    private _store: Store,
    private _authService: AuthService,
    private fb: FormBuilder,
  ) {
    // Crea el formulario con sus campos y validadores
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(4)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      business_code: ['', Validators.required]
    });
  }

  ngOnInit() { }

  // Función para el botón de login
  async login() {
    if (!this.validateForm()) {
      // Si el formulario no es válido, no hagas nada.
      // Los mensajes de error ya se están mostrando.
      return;
    }

    // 🚀 La única responsabilidad del componente es despachar la acción
    // El Effect se encargará de llamar al servicio y manejar la respuesta.
    this._store.dispatch(AuthActions.login(this.loginForm.value));
  }

  // Función para cambiar la visibilidad de la contraseña
  togglePassword() {
    this.showPassword = !this.showPassword;
  }
  // Función para validar el formulario antes de enviarlo
  validateForm(): boolean {
    this.formErrors = { username: null, password: null, business_code: null };
    let isValid = true;

    const { username, password, business_code } = this.loginForm.value;

    if (!username) {
      this.formErrors.username = 'El campo de usuario es requerido.';
      isValid = false;
    } else if (username.length < 4) {
      this.formErrors.username = 'El usuario debe tener al menos 4 caracteres.';
      isValid = false;
    }

    if (!password) {
      this.formErrors.password = 'El campo de contraseña es requerido.';
      isValid = false;
    } else if (password.length < 6) {
      this.formErrors.password = 'La contraseña debe tener al menos 6 caracteres.';
      isValid = false;
    }

    if (!business_code) {
      this.formErrors.business_code = 'El código de compañía es requerido.';
      isValid = false;
    }

    return isValid;
  }

}
