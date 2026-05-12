import { createAction } from "@ngrx/store";

// Creamos una acción para cada evento
export const increment = createAction('[Counter Component] Increment');
export const decrement = createAction('[Counter Component] Decrement');
export const reset = createAction('[Counter Component] Reset');