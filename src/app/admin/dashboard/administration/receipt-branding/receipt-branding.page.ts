import {
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import {
  ReceiptBrandingLogo,
  ReceiptBrandingService
} from '@services/receipt-branding.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-receipt-branding',
  templateUrl: './receipt-branding.page.html',
  styleUrls: ['./receipt-branding.page.scss'],
  standalone: false
})
export class ReceiptBrandingPage implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  private readonly brandingService = inject(ReceiptBrandingService);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);

  metadata: ReceiptBrandingLogo | null = null;
  previewUrl: string | null = null;
  selectedFile: File | null = null;
  isLoading = true;
  isSaving = false;

  async ngOnInit(): Promise<void> {
    await this.loadBranding();
  }

  ngOnDestroy(): void {
    this.revokePreview();
  }

  openFilePicker(): void {
    this.fileInput?.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      input.value = '';
      await this.presentToast('Selecciona una imagen PNG o JPEG.', 'warning');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      input.value = '';
      await this.presentToast('La imagen no puede superar 2 MB.', 'warning');
      return;
    }

    this.selectedFile = file;
    this.setPreview(URL.createObjectURL(file));
  }

  async saveLogo(): Promise<void> {
    if (!this.selectedFile || this.isSaving) {
      return;
    }

    this.isSaving = true;

    try {
      await firstValueFrom(this.brandingService.updateLogo(this.selectedFile));
      this.selectedFile = null;
      this.resetFileInput();
      await this.loadBranding();
      await this.presentToast('Logo del recibo actualizado.', 'success');
    } catch (error: any) {
      await this.presentToast(
        error.error?.message ?? 'No fue posible guardar el logo.',
        'danger'
      );
    } finally {
      this.isSaving = false;
    }
  }

  async confirmDelete(): Promise<void> {
    if (!this.metadata || this.isSaving) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Eliminar logo',
      message: 'Los recibos volveran a generarse sin logo.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            void this.deleteLogo();
          }
        }
      ]
    });

    await alert.present();
  }

  formatBytes(bytes: number): string {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  private async loadBranding(): Promise<void> {
    this.isLoading = true;

    try {
      const response = await firstValueFrom(this.brandingService.getMetadata());
      this.metadata = response.logo;

      if (response.hasLogo) {
        const logo = await firstValueFrom(this.brandingService.getLogo());
        this.setPreview(URL.createObjectURL(logo));
      } else {
        this.setPreview(null);
      }
    } catch (error: any) {
      this.metadata = null;
      this.setPreview(null);
      await this.presentToast(
        error.error?.message ?? 'No fue posible consultar el logo.',
        'danger'
      );
    } finally {
      this.isLoading = false;
    }
  }

  private async deleteLogo(): Promise<void> {
    this.isSaving = true;

    try {
      await firstValueFrom(this.brandingService.deleteLogo());
      this.metadata = null;
      this.selectedFile = null;
      this.resetFileInput();
      this.setPreview(null);
      await this.presentToast('Logo eliminado.', 'success');
    } catch (error: any) {
      await this.presentToast(
        error.error?.message ?? 'No fue posible eliminar el logo.',
        'danger'
      );
    } finally {
      this.isSaving = false;
    }
  }

  private setPreview(url: string | null): void {
    this.revokePreview();
    this.previewUrl = url;
  }

  private revokePreview(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }

  private resetFileInput(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  private async presentToast(
    message: string,
    color: 'success' | 'danger' | 'warning'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 2500,
      position: 'bottom'
    });

    await toast.present();
  }
}
