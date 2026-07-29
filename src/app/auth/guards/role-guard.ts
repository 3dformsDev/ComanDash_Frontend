import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectUser } from '@store/auth/selectors/auth.selectors';
import { map, take } from 'rxjs/operators';

export const roleGuard: CanActivateFn = (route) => {
  const store = inject(Store);
  const router = inject(Router);
  const allowedRoles = (route.data?.['roles'] as string[] | undefined) ?? [];

  return store.select(selectUser).pipe(
    take(1),
    map((user) => {
      const roleCode = user?.role?.code;

      return roleCode && allowedRoles.includes(roleCode)
        ? true
        : router.createUrlTree(['/dashboard/administration']);
    }),
  );
};
