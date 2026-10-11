import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
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
import { InventoryComponent, InventoryService, InventoryProduct } from '@services/inventory.service';
import { InventoryFieldsComponent, InventoryDraft, inventoryDraft, inventoryDraftValid } from '../inventory-fields/inventory-fields.component';

export interface ProductFormSubmission {
  product: any;
  file: File | null;
  inventory?: InventoryDraft;
  personalizations: ProductPersonalizationAssignmentDto[];
}

@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, InventoryFieldsComponent]
})
export class ProductFormComponent implements OnInit {
  private inventory = inject(InventoryService);
  inventoryDraft?: InventoryDraft;
  inventoryProducts: InventoryProduct[] = [];
  inventoryComponents: InventoryComponent[] = [];
  inventoryPickerOpen = false;
  inventoryPickerSearch = '';
  inventoryPickerProducts: InventoryProduct[] = [];
  private pickerComponent?: InventoryComponent;
  inventoryError = '';
  private readonly supportedImageExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  private readonly supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];


  @Input() categories: CategoryI[] = [];
  @Input() mode: 'new' | 'edit' = 'new';
  @Input() onSave?: (data: ProductFormSubmission) => Promise<boolean>;
  isSaving = false;
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
  public expandedGroupIds = new Set<number>();
  public expandedOptionKeys = new Set<string>();
  public readonly modifierGroupSelectOptions = {
    cssClass: 'product-group-select-alert',
    header: 'Selecciona un grupo de opciones',
  };
  public readonly categorySelectOptions = {
    cssClass: 'product-group-select-alert',
    header: 'Selecciona una categoría',
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
    this.product = { ...this.product };
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
    void this.loadInventory();
  }

  private async loadInventory() {
    try {
      const snapshot = await firstValueFrom(this.inventory.balances());
      if (!snapshot.canManage) return;
      this.inventoryProducts = snapshot.data;
      this.inventoryComponents = snapshot.components;
      this.inventoryDraft = inventoryDraft(snapshot.data.find((p) => p.productId === this.product.id), snapshot.components.filter((c) => c.productId === this.product.id));
      if (!this.inventoryDraft.wasEnabled) this.inventoryDraft.unitCost = this.product.cost;
    } catch { this.inventoryError = 'No se pudo cargar el inventario. Podrás configurarlo desde Inventario.'; }
  }

  dismiss() {
    if (this.isSaving) return;
    this.modalCtrl.dismiss(null, 'cancel');
  }

  openInventory() {
    if (this.isSaving) return;
    void this.modalCtrl.dismiss({ productId: this.product?.id }, 'inventory');
  }

  inventoryDependencyLabels(): string[] {
    if (!this.product?.id) return [];
    return [...new Set(this.inventoryComponents
      .filter((component) => component.componentProductId === this.product.id)
      .map((component) => this.inventoryProducts.find((product) => product.productId === component.productId)?.name)
      .filter((name): name is string => !!name))];
  }

  async save() {
    if (this.isSaving) return;
    if (this.selectedImageFile && !this.isSupportedImage(this.selectedImageFile)) {
      this.presentToast('Usa una imagen JPG, PNG o WEBP de máximo 5 MB.'); return;
    }
    if (this.inventoryDraft && !this.inventoryDraft.wasEnabled) this.inventoryDraft.unitCost = this.product.cost;
    if (this.inventoryDraft && !inventoryDraftValid(this.inventoryDraft)) {
      this.presentToast('Revisa las cantidades y el costo del inventario.'); return;
    }
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

    const submission: ProductFormSubmission = {
      product: productData,
      file: this.selectedImageFile,
      inventory: this.inventoryDraft ? { ...this.inventoryDraft, components: this.inventoryDraft.components.filter((c) => this.productPersonalizations.some((a) => a.modifierGroupId === c.modifierGroupId)) } : undefined,
      personalizations: this.productPersonalizations.map((assignment, index) => ({
        ...assignment,
        displayOrder: index,
      })),
    };
    this.isSaving = true;
    try {
      if (this.onSave) {
        if (await this.onSave(submission)) {
          this.isSaving = false;
          await this.modalCtrl.dismiss(null, 'saved');
        }
      } else {
        this.isSaving = false;
        await this.modalCtrl.dismiss(submission, 'save');
      }
    } catch {
      this.presentToast('No se pudo guardar. Tus datos siguen aquí; vuelve a intentarlo.');
    } finally {
      this.isSaving = false;
    }
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

  toggleModifierGroup(groupId: number): void {
    this.expandedGroupIds.has(groupId) ? this.expandedGroupIds.delete(groupId) : this.expandedGroupIds.add(groupId);
  }

  optionKey(groupId: number, optionId: number): string { return `${groupId}:${optionId}`; }

  toggleModifierOption(groupId: number, optionId: number): void {
    const key = this.optionKey(groupId, optionId);
    this.expandedOptionKeys.has(key) ? this.expandedOptionKeys.delete(key) : this.expandedOptionKeys.add(key);
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

  trackInventoryProductById(_index: number, product: InventoryProduct): number {
    return product.productId;
  }

  trackInventoryComponent(_index: number, component: InventoryComponent): InventoryComponent {
    return component;
  }

  optionUsesInventory(groupId: number, optionId: number): boolean {
    return !!this.inventoryDraft?.components.some((component) => component.modifierGroupId === groupId && component.modifierOptionId === optionId);
  }

  setOptionUsesInventory(groupId: number, optionId: number, enabled: boolean): void {
    if (!this.inventoryDraft) return;
    if (!enabled) {
      this.inventoryDraft.components = this.inventoryDraft.components.filter(
        (component) => component.modifierGroupId !== groupId || component.modifierOptionId !== optionId,
      );
      return;
    }
    if (!this.optionUsesInventory(groupId, optionId)) {
      this.inventoryDraft.components.push({ modifierGroupId: groupId, modifierOptionId: optionId, componentProductId: 0, units: 1 });
    }
  }

  addInventoryComponent(groupId: number, optionId: number): void {
    this.inventoryDraft?.components.push({ modifierGroupId: groupId, modifierOptionId: optionId, componentProductId: 0, units: 1 });
  }

  removeInventoryComponent(index: number): void {
    this.inventoryDraft?.components.splice(index, 1);
  }

  inventoryProductName(component: InventoryComponent): string {
    return this.inventoryProducts.find((product) => product.productId === component.componentProductId)?.name || 'Elegir producto';
  }

  openInventoryProductPicker(component: InventoryComponent): void {
    this.pickerComponent = component;
    this.inventoryPickerSearch = '';
    this.updateInventoryPickerProducts();
    this.inventoryPickerOpen = true;
  }

  updateInventoryPickerProducts(): void {
    const current = this.pickerComponent;
    const term = (this.inventoryPickerSearch || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
    this.inventoryPickerProducts = this.inventoryProducts.filter((product) => {
      if (!current || (!product.enabled && product.productId !== current.componentProductId)) return false;
      if (this.inventoryDraft?.components.some((item) => item !== current && item.modifierGroupId === current.modifierGroupId
        && item.modifierOptionId === current.modifierOptionId && item.componentProductId === product.productId)) return false;
      return !term || product.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(term);
    });
  }

  selectInventoryProduct(product: InventoryProduct): void {
    if (!this.pickerComponent) return;
    this.pickerComponent.componentProductId = product.productId;
    this.closeInventoryProductPicker();
  }

  closeInventoryProductPicker(): void {
    this.inventoryPickerOpen = false;
    this.pickerComponent = undefined;
    this.inventoryPickerSearch = '';
    this.inventoryPickerProducts = [];
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
    this.expandedGroupIds.delete(groupId);
    for (const key of this.expandedOptionKeys) if (key.startsWith(`${groupId}:`)) this.expandedOptionKeys.delete(key);
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
        this.presentToast('Usa una imagen JPG, PNG o WEBP de máximo 5 MB.');
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
      this.presentToast('Usa una imagen JPG, PNG o WEBP de máximo 5 MB.');
      if (event.target) {
        event.target.value = '';
      }
    }
  }

  private isSupportedImage(file: File): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const hasSupportedExtension = this.supportedImageExtensions.includes(extension);
    const hasSupportedType = !file.type || this.supportedImageTypes.includes(file.type.toLowerCase());

    return hasSupportedExtension && hasSupportedType && file.size <= 5 * 1024 * 1024;
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
      if (field === 'cost' && this.inventoryDraft && !this.inventoryDraft.wasEnabled) this.inventoryDraft.unitCost = null;
      return;
    }
    this.product[field] = parseInt(rawValue, 10);
    if (field === 'cost' && this.inventoryDraft && !this.inventoryDraft.wasEnabled) this.inventoryDraft.unitCost = this.product.cost;
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
        this.protectedImages.delete(productId);
        if (this.product?.id === productId) this.selectedImagePreview = null;
        console.warn(`No se encontró la imagen del producto ${productId}. Se mostrará el marcador predeterminado.`, error?.status || '');
      }
    });
  }
}
