import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, ViewChild, ElementRef } from '@angular/core';
import { IonicModule, ModalController, ToastController, Platform } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CategoryI } from '@services/categories.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { ProductsService } from '@services/products.service';
import {
  ModifierGroupI,
  ModifierOptionI,
  PersonalizationsService,
  ProductPersonalizationAssignmentDto,
  ProductModifierOptionPriceDto,
} from '@services/personalizations.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ProductFormComponent implements OnInit {
  private readonly supportedImageExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  private readonly supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];


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
  public modifierGroups: ModifierGroupI[] = [];
  public productPersonalizations: ProductPersonalizationAssignmentDto[] = [];
  public selectedModifierGroupId: number | null = null;
  public personalizationsLoading = false;
  public readonly modifierGroupSelectOptions = {
    cssClass: 'product-group-select-alert',
    header: 'Selecciona un grupo de opciones',
  };
  private readonly pricedOptionIds = new Set<number>();
  private activeOptionsByGroupId = new Map<number, ModifierOptionI[]>();

  constructor(
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private sanitizer: DomSanitizer,
    private platform: Platform,
    private _productService: ProductsService,
    private personalizationsService: PersonalizationsService,
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

    void this.loadPersonalizations();
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
      file: this.selectedImageFile,
      personalizations: this.productPersonalizations.map((assignment, index) => ({
        ...assignment,
        displayOrder: index,
      })),
    }, 'save');
  }

  get availableModifierGroups(): ModifierGroupI[] {
    const assignedIds = new Set(
      this.productPersonalizations.map((assignment) => assignment.modifierGroupId),
    );
    return this.modifierGroups.filter((group) => group.isActive && !assignedIds.has(group.id));
  }

  getModifierGroup(groupId: number): ModifierGroupI | undefined {
    return this.modifierGroups.find((group) => group.id === groupId);
  }

  getActiveOptionsCount(groupId: number): number {
    return this.getModifierGroup(groupId)?.options.filter((option) => option.isActive).length || 0;
  }

  addModifierGroup() {
    if (!this.selectedModifierGroupId) return;
    const group = this.getModifierGroup(this.selectedModifierGroupId);
    if (!group || this.productPersonalizations.some((item) => item.modifierGroupId === group.id)) {
      return;
    }

    this.productPersonalizations = [
      ...this.productPersonalizations,
      {
        modifierGroupId: group.id,
        isRequired: true,
        selectionLimit: 1,
        allowOptionQuantities: false,
        displayOrder: this.productPersonalizations.length,
        options: group.options
          .filter((option) => option.isActive)
          .map((option) => ({ modifierOptionId: option.id, priceAdjustment: 0 })),
      },
    ];
    this.selectedModifierGroupId = null;
  }

  getAssignmentOptions(assignment: ProductPersonalizationAssignmentDto): ModifierOptionI[] {
    return this.activeOptionsByGroupId.get(assignment.modifierGroupId) || [];
  }

  trackModifierOptionById(_index: number, option: ModifierOptionI): number {
    return option.id;
  }

  optionHasPrice(assignment: ProductPersonalizationAssignmentDto, optionId: number): boolean {
    return this.pricedOptionIds.has(optionId) || this.getOptionPrice(assignment, optionId) > 0;
  }

  getOptionPrice(assignment: ProductPersonalizationAssignmentDto, optionId: number): number {
    return Number(
      assignment.options?.find((option) => option.modifierOptionId === optionId)?.priceAdjustment || 0,
    );
  }

  setOptionHasPrice(
    assignment: ProductPersonalizationAssignmentDto,
    optionId: number,
    enabled: boolean,
  ): void {
    if (enabled) {
      this.pricedOptionIds.add(optionId);
      return;
    }

    this.pricedOptionIds.delete(optionId);
    this.setOptionPrice(assignment, optionId, 0);
  }

  updateOptionPrice(
    assignment: ProductPersonalizationAssignmentDto,
    optionId: number,
    event: CustomEvent,
  ): void {
    const rawValue = String(event.detail?.value ?? '').replace(/[^0-9]/g, '');
    this.pricedOptionIds.add(optionId);
    this.setOptionPrice(assignment, optionId, rawValue ? Number(rawValue) : 0);
  }

  private setOptionPrice(
    assignment: ProductPersonalizationAssignmentDto,
    optionId: number,
    priceAdjustment: number,
  ): void {
    const normalizedPrice = Math.max(0, Math.min(99_999_999.99, Number(priceAdjustment) || 0));
    const options = [...(assignment.options || [])];
    const existingIndex = options.findIndex((option) => option.modifierOptionId === optionId);
    const configuredOption: ProductModifierOptionPriceDto = {
      modifierOptionId: optionId,
      priceAdjustment: normalizedPrice,
    };

    if (existingIndex >= 0) {
      options[existingIndex] = configuredOption;
    } else {
      options.push(configuredOption);
    }
    assignment.options = options;
  }

  removeModifierGroup(groupId: number) {
    this.productPersonalizations = this.productPersonalizations
      .filter((item) => item.modifierGroupId !== groupId)
      .map((item, index) => ({ ...item, displayOrder: index }));
  }

  moveModifierGroup(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= this.productPersonalizations.length) return;

    const reordered = [...this.productPersonalizations];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    this.productPersonalizations = reordered.map((item, displayOrder) => ({
      ...item,
      displayOrder,
    }));
  }

  normalizeSelectionLimit(assignment: ProductPersonalizationAssignmentDto) {
    const parsed = Number(assignment.selectionLimit);
    assignment.selectionLimit = Number.isFinite(parsed) ? Math.max(1, Math.min(50, parsed)) : 1;

    if (assignment.selectionLimit <= 1) {
      assignment.allowOptionQuantities = false;
    }

    const activeOptions = this.getModifierGroup(assignment.modifierGroupId)?.options.filter(
      (option) => option.isActive,
    ).length;
    if (!assignment.allowOptionQuantities && activeOptions && assignment.selectionLimit > activeOptions) {
      assignment.selectionLimit = activeOptions;
      void this.presentToast(
        `Este grupo tiene ${activeOptions} opciones activas. Activa “Permitir repetir” para elegir más veces.`,
      );
    }
  }

  private async loadPersonalizations() {
    this.personalizationsLoading = true;
    try {
      this.modifierGroups = await firstValueFrom(this.personalizationsService.getGroups(false));
      this.activeOptionsByGroupId = new Map(
        this.modifierGroups.map((group) => [
          group.id,
          group.options.filter((option) => option.isActive),
        ]),
      );

      if (this.mode === 'edit' && this.product?.id) {
        const configuration = await firstValueFrom(
          this.personalizationsService.getProductPersonalizations(this.product.id, true),
        );
        this.productPersonalizations = configuration.groups
          .filter((group) => group.isActive)
          .map((group) => ({
            modifierGroupId: group.modifierGroupId,
            isRequired: group.isRequired,
            selectionLimit: group.selectionLimit,
            allowOptionQuantities: group.allowOptionQuantities,
            displayOrder: group.displayOrder,
            options: group.options
              .filter((option) => option.isActive)
              .map((option) => ({
                modifierOptionId: option.id,
                priceAdjustment: Number(option.priceAdjustment || 0),
              })),
          }));
        this.productPersonalizations.forEach((assignment) => {
          (assignment.options || []).forEach((option) => {
            if (Number(option.priceAdjustment) > 0) {
              this.pricedOptionIds.add(option.modifierOptionId);
            }
          });
        });
      }
    } catch (error) {
      console.error('Error al cargar personalizaciones del producto:', error);
      await this.presentToast('No fue posible cargar las personalizaciones del producto.');
    } finally {
      this.personalizationsLoading = false;
    }
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
        const selectedFile = await this.uriToFile(image);

        if (!this.isSupportedImage(selectedFile)) {
          this.selectedImagePreview = null;
          this.selectedImageFile = null;
          this.presentToast('Formato no compatible. Usa una imagen JPG, PNG o WEBP.');
          return;
        }

        this.selectedImageFile = selectedFile;
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

    if (file && this.isSupportedImage(file)) {
      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.presentToast('La imagen es muy grande. Selecciona una imagen menor a 5MB.');
        if (event.target) {
          event.target.value = '';
        }
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
      this.presentToast('Formato no compatible. Usa una imagen JPG, PNG o WEBP.');
      if (event.target) {
        event.target.value = '';
      }
    }
  }

  private isSupportedImage(file: File): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const hasSupportedExtension = this.supportedImageExtensions.includes(extension);
    const hasSupportedType = !file.type || this.supportedImageTypes.includes(file.type.toLowerCase());

    return hasSupportedExtension && hasSupportedType;
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
    const arePersonalizationsValid = this.productPersonalizations.every((assignment) => {
      const group = this.getModifierGroup(assignment.modifierGroupId);
      const activeOptions = group?.options.filter((option) => option.isActive).length || 0;
      return (
        assignment.selectionLimit >= 1 &&
        activeOptions > 0 &&
        (assignment.options || []).every((option) => Number(option.priceAdjustment) >= 0) &&
        this.getAssignmentOptions(assignment).every(
          (option) =>
            !this.optionHasPrice(assignment, option.id) ||
            this.getOptionPrice(assignment, option.id) > 0,
        ) &&
        (assignment.allowOptionQuantities || assignment.selectionLimit <= activeOptions)
      );
    });
    return (
      isNameValid &&
      isPriceValid &&
      isCostValid &&
      isCategoryValid &&
      !this.personalizationsLoading &&
      arePersonalizationsValid
    );
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
