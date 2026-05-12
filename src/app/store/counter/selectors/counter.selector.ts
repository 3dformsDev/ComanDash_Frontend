// Los Selectors en NgRx son exactamente como los getters de Vuex. Son funciones para obtener fragmentos del estado.
import { createFeatureSelector, createSelector } from '@ngrx/store';

// 1. Apuntamos a la parte del estado que nos interesa ('counter')
export const selectCounterState = createFeatureSelector<number>('counter');

// 2. Creamos un selector específico para obtener el valor
// (Esto es opcional para un estado simple, pero es buena práctica)
export const selectCount = createSelector(
    selectCounterState,
    (state) => state
);