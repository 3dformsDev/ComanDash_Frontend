import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AppState } from '@capacitor/app';
import { environment } from '@environments/environment';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { ApiResponse } from './table.service'; // Asumo que esta interfaz es compartida

/**
 * Interfaz para la estructura de un Producto, basada en la respuesta de la API.
 */
export interface ProductI {
  id: number;
  categoryId: number;
  name: string;
  price: number;
  cost: number;
  isAvailable: boolean;
  isActive: boolean;
  category?: {
    name?: string;
  },
  companyId: number;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string;
  protectedImageUrl?: string;
  description?: string | null;
  hasPersonalizations?: boolean;
}

/**
 * DTO (Data Transfer Object) para crear un nuevo producto.
 * Contiene solo los campos necesarios para la petición POST.
 */
export interface CreateProductDto {
  name: string;
  price: string;
  cost: string;
  isAvailable: boolean;
  isActive: boolean;
  categoryId: number;
  companyId?: number;
}

/**
 * DTO para actualizar un producto.
 * Usa Partial<> para hacer todos los campos opcionales.
 */
export type UpdateProductDto = Partial<CreateProductDto>;

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private apiUrl: string = environment.apiUrl;
  private productsEndpoint = `${this.apiUrl}/v1/products`;

  constructor(
    private _http: HttpClient,
    private store: Store<AppState>,
  ) { }

  /**
  * Obtiene la lista completa de productos desde la API.
  */
  getProducts(applyParams: boolean = false): Observable<ProductI[]> {
    const params = applyParams ? 'categoryIsActive=1&productIsActive=1' : '';
    return this._http.get<ApiResponse<ProductI[]>>(`${this.productsEndpoint}?perPage=999999&${params}`)
      .pipe(
        map(response => response.data) // Extraemos solo el arreglo de productos de la respuesta
      );
  }

  /**
   * Crea un nuevo producto en el backend.
   * @param productData - Los datos del nuevo producto a crear.
   * @param imageFile - El archivo de imagen (opcional).
   */
  addProduct(productData: CreateProductDto, imageFile: File | null): Observable<ProductI> {
    const formData = new FormData();

    // 1. Añadir todos los campos de texto/números/booleanos al FormData
    // FormData convierte todos los valores a string automáticamente.
    Object.entries(productData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, value.toString());
      }
    });

    // 2. Añadir el archivo de imagen SÓLO si existe
    if (imageFile) {
      formData.append('image', imageFile, imageFile.name);
    }

    // Hacemos la petición POST y extraemos el producto creado de la propiedad 'data'
    return this._http.post<ApiResponse<ProductI>>(this.productsEndpoint, formData)
      .pipe(map((response: any) => response?.data ?? response));
  }

  /**
   * Actualiza un producto existente en el backend.
   * @param productId - El ID del producto a actualizar.
   * @param productData - Los nuevos datos para el producto.
   * @param imageFile - El nuevo archivo de imagen (opcional) o null para borrar la existente.
   */
  updateProduct(productId: number, productData: UpdateProductDto, imageFile: File | null): Observable<ProductI> {
    const formData = new FormData();

    // 1. Añadir los campos de texto/números/booleanos
    Object.entries(productData).forEach(([key, value]) => {
      if (key !== 'image' && value !== null && value !== undefined) {
        formData.append(key, value.toString());
      }
    });

    // 2. Manejar la imagen
    if (imageFile) {
      // Si se proporciona un nuevo archivo, se añade
      formData.append('image', imageFile, imageFile.name);
    } else if (imageFile === null) {
      // Si se envía 'null', es una señal para borrar la imagen existente.
      // Enviamos un campo 'image' vacío que el backend puede interpretar.
      formData.append('image', '');
    }

    // 3. Simular un método PUT usando POST (más compatible con FormData)
    // AdonisJS entiende esto automáticamente y tratará la petición como un PUT.
    formData.append('_method', 'POST');

    return this._http.post<ApiResponse<ProductI>>(`${this.productsEndpoint}/${productId}`, formData)
      .pipe(map((response: any) => response?.data ?? response));
  }

  /**
   * Elimina un producto del backend.
   * @param productId - El ID del producto a eliminar.
   */
  deleteProduct(productId: number): Observable<void> {
    return this._http.delete<void>(`${this.productsEndpoint}/${productId}`);
  }

  getProtectedImageBlob(productId: number): Observable<string> {
    return this._http.get(`${this.productsEndpoint}/${productId}/image`, {
      responseType: 'blob',
    }).pipe(
      map(blob => URL.createObjectURL(blob))
    )
  }
}
