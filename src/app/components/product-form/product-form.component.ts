import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, ViewChild, ElementRef } from '@angular/core';
import { IonicModule, ModalController, ToastController, Platform } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CategoryI } from '@services/categories.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { ProductsService } from '@services/products.service';

@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ProductFormComponent implements OnInit {

  @Input() categories: CategoryI[] = [];
  @Input() mode: 'new' | 'edit' = 'new';
  @Input() product: any = {
    name: '',
    price: null,
    cost: null,
    description: '',
    categoryId: null,
    imageUrl: null
  };

  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;

  selectedImagePreview: SafeResourceUrl | null = null;
  selectedImageFile: File | null = null;
  isNative: boolean = false;
  public protectedImages = new Map<number, string>();

  constructor(
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private sanitizer: DomSanitizer,
    private platform: Platform,
    private _productService: ProductsService,
  ) { }

  ngOnInit() {
    // Detectar si estamos en nativo o web
    this.isNative = this.platform.is('hybrid');

    // Si estamos en modo 'edit' y el producto ya tiene una imagen, la mostramos
    if (this.mode === 'edit' && this.product.imageUrl) {
      // Cargar imagen protegida para cada producto que tenga imagen
      
        if (this.product.imageUrl) {
          this.loadProtectedImage(this.product.id);
        }
      this.selectedImagePreview = this.product.imageUrl;
    }
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async save() {
    if (!this.isFormValid()) {
      this.presentToast('Por favor, completa todos los campos obligatorios (*).');
      return;
    }

    const productData = {
      ...this.product,
      price: this.product.price.toString(),
      cost: this.product.cost.toString()
    };

    delete productData.imageUrl;

    this.modalCtrl.dismiss({
      product: productData,
      file: this.selectedImageFile
    }, 'save');
  }

  /**
   * Método principal para seleccionar imagen - detecta si es web o nativo
   */
  async selectImage() {
    if (this.isNative) {
      await this.selectImageNative();
    } else {
      this.selectImageWeb();
    }
  }

  /**
   * Selección de imagen para dispositivos nativos usando Capacitor Camera
   */
  private async selectImageNative() {
    try {
      // Verificar permisos
      const permissions = await Camera.checkPermissions();

      if (permissions.camera !== 'granted' || permissions.photos !== 'granted') {
        const requestResult = await Camera.requestPermissions();

        if (requestResult.camera !== 'granted' || requestResult.photos !== 'granted') {
          this.presentToast('Se necesitan permisos de cámara y fotos para continuar.');
          return;
        }
      }

      const image: Photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        promptLabelHeader: 'Elegir imagen',
        promptLabelPhoto: 'Desde la galería',
        promptLabelPicture: 'Tomar foto',
        width: 1000,
        height: 1000,
        saveToGallery: false
      });

      if (image && image.webPath) {
        this.selectedImagePreview = this.sanitizer.bypassSecurityTrustResourceUrl(image.webPath);
        this.selectedImageFile = await this.uriToFile(image);
      }
    } catch (error) {
      console.error('Error al seleccionar imagen (nativo):', error);
      if (error instanceof Error && !error.message.includes('cancelled')) {
        this.presentToast('Error al acceder a la cámara. Verifica los permisos.');
      }
    }
  }

  /**
   * Selección de imagen para web usando input file HTML
   */
  private selectImageWeb() {
    // Crear un input file dinámicamente si no existe
    if (!this.fileInput) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';

      input.addEventListener('change', (event: any) => {
        this.handleWebFileSelection(event);
      });

      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    } else {
      this.fileInput.nativeElement.click();
    }
  }

  /**
   * Maneja la selección de archivos en web
   */
  handleWebFileSelection(event: any) {
    const file = event.target?.files?.[0];

    if (file && file.type.startsWith('image/')) {
      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.presentToast('La imagen es muy grande. Selecciona una imagen menor a 5MB.');
        return;
      }

      // Crear preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.selectedImagePreview = this.sanitizer.bypassSecurityTrustResourceUrl(e.target.result);
      };
      reader.readAsDataURL(file);

      // Guardar archivo
      this.selectedImageFile = file;
    } else {
      this.presentToast('Por favor, selecciona un archivo de imagen válido.');
    }
  }

  /**
   * Convierte la respuesta de Capacitor Camera a un objeto File (solo para nativo)
   */
  private async uriToFile(photo: Photo): Promise<File> {
    const response = await fetch(photo.webPath!);
    const blob = await response.blob();
    const fileName = photo.path?.split('/').pop() || `image-${new Date().getTime()}.${photo.format}`;
    return new File([blob], fileName, { type: blob.type });
  }

  /**
   * Elimina la imagen seleccionada
   */
  clearImage() {
    this.selectedImagePreview = null;
    this.selectedImageFile = null;

    // Limpiar input file si existe (web)
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }

    if (this.product) {
      this.product.imageUrl = null;
    }
  }

  // Método para obtener el texto del botón según la plataforma
  getSelectImageButtonText(): string {
    if (this.selectedImagePreview) {
      return 'Cambiar Imagen';
    }

    return this.isNative ? 'Seleccionar/Tomar Foto' : 'Seleccionar Imagen';
  }

  // Método para obtener el ícono según la plataforma
  getSelectImageIcon(): string {
    if (this.selectedImagePreview) {
      return 'repeat-outline';
    }

    return this.isNative ? 'camera-outline' : 'image-outline';
  }

  isFormValid(): boolean {
    const { name, price, cost, categoryId } = this.product;
    const isNameValid = name && name.trim().length > 0;
    const isPriceValid = price !== null && price > 0;
    const isCostValid = cost !== null;
    const isCategoryValid = categoryId !== null;
    return isNameValid && isPriceValid && isCostValid && isCategoryValid;
  }

  async presentToast(message: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2500,
      position: 'top',
      color: 'danger',
      icon: 'alert-circle-outline'
    });
    toast.present();
  }

  formatValue(event: any, field: 'price' | 'cost') {
    let rawValue = event.target.value.replace(/[^0-9]/g, '');
    if (!rawValue) {
      this.product[field] = null;
      return;
    }
    this.product[field] = parseInt(rawValue, 10);
    const formattedValue = new Intl.NumberFormat('es-CO').format(this.product[field]);
    setTimeout(() => {
      event.target.value = formattedValue;
    }, 0);
  }

  loadProtectedImage(productId: number) {
    this._productService.getProtectedImageBlob(productId).subscribe({
      next: (imageUrl: string) => {
        this.protectedImages.set(productId, imageUrl);
      },
      error: (error) => {
        console.error(`Error al cargar la imagen protegida para el producto ${productId}:`, error);
      }
    });
  }
}