import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

export interface ReceiptBrandingLogo {
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  checksum: string;
  updatedAt: string;
}

export interface ReceiptBrandingMetadata {
  hasLogo: boolean;
  logo: ReceiptBrandingLogo | null;
}

export interface ReceiptBrandingUpdateResponse {
  message: string;
  logo: ReceiptBrandingLogo;
}

@Injectable({
  providedIn: 'root'
})
export class ReceiptBrandingService {
  private readonly endpoint = `${environment.apiUrl}/v1/receipt-branding`;
  private readonly http = inject(HttpClient);

  getMetadata(): Observable<ReceiptBrandingMetadata> {
    return this.http.get<ReceiptBrandingMetadata>(this.endpoint);
  }

  getLogo(): Observable<Blob> {
    return this.http.get(`${this.endpoint}/logo`, {
      responseType: 'blob'
    });
  }

  updateLogo(file: File): Observable<ReceiptBrandingUpdateResponse> {
    const formData = new FormData();
    formData.append('logo', file, file.name);

    return this.http.put<ReceiptBrandingUpdateResponse>(
      `${this.endpoint}/logo`,
      formData
    );
  }

  deleteLogo(): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/logo`);
  }
}
