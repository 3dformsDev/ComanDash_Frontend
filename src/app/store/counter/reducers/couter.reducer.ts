import { createReducer, on } from '@ngrx/store';
import { increment, decrement, reset } from '../actions/counter.actions';

// 1. Definimos el estado inicial, como el 'state' de Vuex
export const initialState = 0;

// 2. Creamos el reducer, que escucha las acciones
export const counterReducer = createReducer(
    initialState,
    // Para cada acción, definimos cómo cambia el estado
    on(increment, (state) => state++),
    on(decrement, (state) => state--),
    on(reset, (state) => 0)
)