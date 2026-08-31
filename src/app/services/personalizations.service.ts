import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from './table.service';

export interface ModifierOptionI {
  id: number;
  companyId: number;
  modifierGroupId: number;
  name: string;
  priceAdjustment: number;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ModifierGroupI {
  id: number;
  companyId: number;
  name: string;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
  options: ModifierOptionI[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductPersonalizationGroupI {
  id: number;
  modifierGroupId: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  isRequired: boolean;
  selectionLimit: number;
  allowOptionQuantities: boolean;
  displayOrder: number;
  options: ModifierOptionI[];
}

export interface ProductPersonalizationsI {
  productId: number;
  productName: string;
  hasPersonalizations: boolean;
  groups: ProductPersonalizationGroupI[];
}

export interface ProductPersonalizationAssignmentDto {
  modifierGroupId: number;
  isRequired: boolean;
  selectionLimit: number;
  allowOptionQuantities: boolean;
  displayOrder?: number;
}

export interface OrderLineModifierSelectionI {
  modifierGroupId: number;
  modifierOptionId: number;
  groupName: string;
  optionName: string;
  quantity: number;
  priceAdjustment: 0;
}

export interface ModifierGroupDto {
  name: string;
  description?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface ModifierOptionDto {
  modifierGroupId: number;
  name: string;
  displayOrder?: number;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PersonalizationsService {
  private readonly apiUrl = environment.apiUrl;
  private readonly groupsEndpoint = `${this.apiUrl}/v1/modifier-groups`;
  private readonly optionsEndpoint = `${this.apiUrl}/v1/modifier-options`;
  private readonly productsEndpoint = `${this.apiUrl}/v1/products`;

  constructor(private http: HttpClient) {}

  getGroups(activeOnly = false): Observable<ModifierGroupI[]> {
    const activeParam = activeOnly ? '&isActive=1' : '';
    return this.http
      .get<ApiResponse<ModifierGroupI[]>>(`${this.groupsEndpoint}?perPage=999999${activeParam}`)
      .pipe(map((response: any) => response?.data ?? response));
  }

  createGroup(payload: ModifierGroupDto): Observable<ModifierGroupI> {
    return this.http
      .post<ApiResponse<ModifierGroupI>>(this.groupsEndpoint, payload)
      .pipe(map((response: any) => response?.data ?? response));
  }

  updateGroup(groupId: number, payload: Partial<ModifierGroupDto>): Observable<ModifierGroupI> {
    return this.http
      .put<ApiResponse<ModifierGroupI>>(`${this.groupsEndpoint}/${groupId}`, payload)
      .pipe(map((response: any) => response?.data ?? response));
  }

  deactivateGroup(groupId: number): Observable<void> {
    return this.http.delete<void>(`${this.groupsEndpoint}/${groupId}`);
  }

  createOption(payload: ModifierOptionDto): Observable<ModifierOptionI> {
    return this.http
      .post<ApiResponse<ModifierOptionI>>(this.optionsEndpoint, payload)
      .pipe(map((response: any) => response?.data ?? response));
  }

  updateOption(optionId: number, payload: Partial<ModifierOptionDto>): Observable<ModifierOptionI> {
    return this.http
      .put<ApiResponse<ModifierOptionI>>(`${this.optionsEndpoint}/${optionId}`, payload)
      .pipe(map((response: any) => response?.data ?? response));
  }

  deactivateOption(optionId: number): Observable<void> {
    return this.http.delete<void>(`${this.optionsEndpoint}/${optionId}`);
  }

  getProductPersonalizations(
    productId: number,
    includeInactive = false,
  ): Observable<ProductPersonalizationsI> {
    const params = includeInactive ? '?includeInactive=true' : '';
    return this.http
      .get<ApiResponse<ProductPersonalizationsI>>(
        `${this.productsEndpoint}/${productId}/personalizations${params}`,
      )
      .pipe(map((response: any) => response?.data ?? response));
  }

  syncProductPersonalizations(
    productId: number,
    groups: ProductPersonalizationAssignmentDto[],
  ): Observable<ProductPersonalizationsI> {
    return this.http
      .put<ApiResponse<ProductPersonalizationsI>>(
        `${this.productsEndpoint}/${productId}/personalizations`,
        { groups },
      )
      .pipe(map((response: any) => response?.data ?? response));
  }
}
