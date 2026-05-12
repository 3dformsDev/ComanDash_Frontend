import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AppState } from '@capacitor/app';
import { environment } from '@environments/environment';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from './table.service';

export interface CategoryI {
  id: number;
  companyId: number;
  name: string;
  displayOrder: number;
  isActive: boolean; // Si prefieres boolean, puedes transformarlo en el servicio
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

/**
 * DTO para crear una nueva categoría.
 * Solo contiene el nombre, que es lo requerido.
 */
export interface CreateCategoryDto {
  name: string;
}

/**
 * DTO para actualizar una categoría.
 * Partial<> hace que todas las propiedades sean opcionales.
 */
export interface UpdateCategoryDto {
  name?: string;
  isActive?: boolean; // <-- ¡Asegúrate de que esta propiedad exista!
}

export interface MetaI {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  firstPage: number;
  firstPageUrl: string;
  lastPageUrl: string;
  nextPageUrl: string | null;
  previousPageUrl: string | null;
}

export interface CategoriesResponse {
  meta: MetaI;
  data: CategoryI[];
}


@Injectable({
  providedIn: 'root'
})
export class CategoriesService {
  private apiUrl: string = environment.apiUrl;
  private categoriesEndpoint = `${this.apiUrl}/v1/categories`;

  constructor(
    private _http: HttpClient,
    private store: Store<AppState>,
  ) { }

  /**
  * Obtiene la lista completa de productos desde la API.
  */
  getCategory(applyParams: boolean = false): Observable<CategoryI[]> {
    const params = applyParams ? 'isActive=1' : '';
    return this._http.get<ApiResponse<CategoryI[]>>(`${this.categoriesEndpoint}?perPage=999999&${params}`)
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Crea una nueva categoría en el backend.
   * @param categoryData - Los datos de la nueva categoría.
   */
  addCategory(categoryData: CreateCategoryDto): Observable<CategoryI> {
    return this._http.post<ApiResponse<CategoryI>>(this.categoriesEndpoint, categoryData)
      .pipe(
        map(response => response.data) // Extraemos la categoría creada de la respuesta
      );
  }

  /**
   * Actualiza una categoría existente en el backend.
   * @param categoryId - El ID de la categoría a actualizar.
   * @param categoryData - Los nuevos datos para la categoría.
   */
  updateCategory(categoryId: number, categoryData: UpdateCategoryDto): Observable<CategoryI> {
    return this._http.put<ApiResponse<CategoryI>>(`${this.categoriesEndpoint}/${categoryId}`, categoryData)
      .pipe(
        map(response => response.data) // Extraemos la categoría actualizada de la respuesta
      );
  }

  /**
   * Elimina una categoría del backend.
   * @param categoryId - El ID de la categoría a eliminar.
   */
  deleteCategory(categoryId: number): Observable<void> {
    return this._http.delete<void>(`${this.categoriesEndpoint}/${categoryId}`);
  }
}
