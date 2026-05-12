// src/app/auth/guards/auth.guard.ts

import { inject } from '@angular/core'; // 👈 Importa 'inject'
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs/operators';
import { AppState } from '@capacitor/app'; // Ajusta la ruta si es necesario
import { selectIsAuthenticated } from '@store/auth/selectors/auth.selectors';

export const authGuard: CanActivateFn = (route, state) => {

  // 1. Usa inject() para obtener las dependencias en lugar de un constructor
  const store = inject(Store<AppState>);
  const router = inject(Router);

  // 2. La lógica de RxJS es exactamente la misma
  return store.select(selectIsAuthenticated).pipe(
    take(1),
    map(isAuthenticated => {
      if (isAuthenticated) {
        return true; // Permite el acceso
      } else {
        router.navigate(['/login']); // Redirige al login
        return false; // Bloquea el acceso
      }
    })
  );
};