import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { switchMap, take } from 'rxjs/operators';
import { AppState } from '@capacitor/app';
import { Store } from '@ngrx/store';
import { selectLocationCompany } from '@store/auth/selectors/auth.selectors';
import { TableZoneI } from './table-zones.service';

// Interfaz para la estructura de una mesa, coincidiendo con la API
export interface TableI {
  id: number;
  companyId: number;
  locationId: number;
  tableNumber: string;
  capacity: number;
  zone: string | null;
  zoneId: number | null;
  tableZone?: TableZoneI | null;
  isBussy: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Interfaz para el cuerpo de la respuesta de la API
export interface ApiResponse<T> {
  meta: any; // Puedes detallar la meta si lo necesitas
  data: T;
}

// DTO (Data Transfer Object) para crear una nueva mesa.
// Solo incluye los campos necesarios para la creación.
export interface CreateTableDto {
  tableNumber: string;
  capacity: number;
  zone?: string | null;
  zoneId?: number | null;
  locationId?: number;
  isActive?: boolean;
  // Agrega aquí otros campos que necesites enviar, como locationId
}

// DTO para actualizar una mesa.
// Los campos son opcionales (Partial) porque podrías querer actualizar solo uno.
export type UpdateTableDto = Partial<CreateTableDto>;


@Injectable({
  providedIn: 'root'
})
export class TableService {
  private apiUrl: string = environment.apiUrl;
  private tablesEndpoint = `${this.apiUrl}/v1/tables`;

  constructor(
    private _http: HttpClient,
    private store: Store<AppState>,
  ) { }

  /**
   * Obtiene la lista completa de mesas.
   */
  getTables(applyParams: boolean = false): Observable<TableI[]> {
    const params = applyParams ? 'tableIsActive=1' : '';
    return this._http.get<ApiResponse<TableI[]>>(`${this.tablesEndpoint}?perPage=999999&${params}`)
      .pipe(
        map(response => response.data.map(table => ({
          ...table,
          isBussy: !!table.isBussy,
          isActive: !!table.isActive
        })))
      );
  }

  /**
   * Crea una nueva mesa en el backend.
   * @param tableData - Los datos de la nueva mesa.
   */
  addTable(tableData: CreateTableDto): Observable<TableI> {
    return this.store.select(selectLocationCompany).pipe(
      take(1),
      switchMap((location) => {
        const finalData = {
          ...tableData,
          locationId: location?.id,
        };
        return this._http.post<ApiResponse<TableI>>(this.tablesEndpoint, finalData)
          .pipe(map(response => response.data));
      })
    );
  }

  /**
   * Actualiza una mesa existente en el backend.
   * @param tableId - El ID de la mesa a actualizar.
   * @param tableData - Los nuevos datos para la mesa.
   */
  updateTable(tableId: number, tableData: UpdateTableDto): Observable<TableI> {
    return this._http.put<ApiResponse<TableI>>(`${this.tablesEndpoint}/${tableId}`, tableData)
      .pipe(map(response => response.data));
  }

  /**
   * Elimina una mesa del backend.
   * @param tableId - El ID de la mesa a eliminar.
   */
  deleteTable(tableId: number): Observable<void> {
    // Una petición DELETE exitosa no suele devolver contenido, por eso el tipo es Observable<void>
    return this._http.delete<void>(`${this.tablesEndpoint}/${tableId}`);
  }

  releaseTable(tableId: number, orderId: number): Observable<TableI> {
    return this._http.put<ApiResponse<TableI>>(`${this.tablesEndpoint}/release/${tableId}/${orderId}`, {})
      .pipe(map(response => response.data));
  }

}
