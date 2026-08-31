import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type TableZoneIconType = 'table' | 'bar' | 'terrace' | 'special';

export interface TableZoneI {
  id: number;
  companyId: number;
  locationId: number;
  name: string;
  iconType: TableZoneIconType;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTableZoneDto {
  name: string;
  iconType: TableZoneIconType;
  displayOrder?: number;
  isActive?: boolean;
}

interface ApiResponse<T> {
  data: T;
}

@Injectable({ providedIn: 'root' })
export class TableZonesService {
  private readonly endpoint = `${environment.apiUrl}/v1/table-zones`;

  constructor(private http: HttpClient) { }

  getZones(onlyActive: boolean = true): Observable<TableZoneI[]> {
    const activeParam = onlyActive ? '&zoneIsActive=1' : '';
    return this.http
      .get<ApiResponse<TableZoneI[]>>(`${this.endpoint}?perPage=999${activeParam}`)
      .pipe(
        map(response => response.data.map(zone => ({
          ...zone,
          isActive: !!zone.isActive,
        }))),
      );
  }

  addZone(payload: CreateTableZoneDto): Observable<TableZoneI> {
    return this.http
      .post<ApiResponse<TableZoneI>>(this.endpoint, payload)
      .pipe(map(response => response.data));
  }

  updateZone(id: number, payload: Partial<CreateTableZoneDto>): Observable<TableZoneI> {
    return this.http
      .put<ApiResponse<TableZoneI>>(`${this.endpoint}/${id}`, payload)
      .pipe(map(response => response.data));
  }

  removeZone(id: number): Observable<TableZoneI> {
    return this.http
      .delete<ApiResponse<TableZoneI>>(`${this.endpoint}/${id}`)
      .pipe(map(response => response.data));
  }
}
