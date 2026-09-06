import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AlertController, ModalController, ToastController } from '@ionic/angular';
import { CategoriesService, CategoryI } from '@services/categories.service';
import { ProductI, ProductsService, UpdateProductDto } from '@services/products.service';
import { firstValueFrom } from 'rxjs';
import { ProductFormComponent } from 'src/app/components/product-form/product-form.component';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import {
  PersonalizationsService,
  ProductPersonalizationAssignmentDto,
} from '@services/personalizations.service';

@Component({
  selector: 'app-menu-management',
  templateUrl: './menu-management.page.html',
  styleUrls: ['./menu-management.page.scss'],
  standalone: false
})
export class MenuManagementPage implements OnInit {

  allCategories: CategoryI[] = [];
  allProducts: ProductI[] = [];
  // Propiedad para la URL de previsualización (segura)
  selectedImagePreview: SafeResourceUrl | null = null;
  selectedImageFile: File | null = null;
  public protectedImages = new Map<number, string>();


  // Usamos un Map para agrupar los productos por categoría
  public groupedMenu = new Map<string, ProductI[]>();
  public filteredGroupedMenu = new Map<string, ProductI[]>();
  public filteredProductsCount = 0;
  public searchTerm = '';

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private _productService: ProductsService,
    private _categoryService: CategoriesService,
    private personalizationsService: PersonalizationsService,
  ) { }

  ngOnInit() {
    // Inicialización vacía, los datos se cargan en ionViewWillEnter
  }

  async ionViewWillEnter() {
    await this.loadData();
  }

  async loadData() {
    try {
      // Cargar categorías activas
      this.allCategories = await firstValueFrom(this._categoryService.getCategory(true));

      // Cargar todos los productos (con categoryIsActive=1 para solo mostrar productos de categorías activas)
      this.allProducts = await firstValueFrom(this._productService.getProducts(false));

      // Cargar imagen protegida para cada producto que tenga imagen
      this.allProducts.forEach(product => {
        if (product.imageUrl) {
          this.loadProtectedImage(product.id);
        }
      });

      // Agrupar productos por categoría
      this.groupItemsByCategory();
    } catch (error) {
      console.error('Error al cargar los datos:', error);
      this.presentToast('Error al cargar los datos', 'danger');
    }
  }

  // Agrupa los productos por categoría en el Map
  groupItemsByCategory() {
    this.groupedMenu.clear(); // Limpia el mapa antes de reagrupar

    this.allProducts.forEach(product => {
      // 1. Buscamos la categoría correspondiente al producto en el array 'allCategories'
      const category = this.allCategories.find(cat => cat.id === product.categoryId);

      // 2. Usamos el nombre de la categoría encontrada o un valor por defecto
      const categoryName = category ? category.name : 'Sin Categoría';

      if (!this.groupedMenu.has(categoryName)) {
        this.groupedMenu.set(categoryName, []);
      }

      // ?.push() es seguro porque acabamos de crearlo si no existía
      this.groupedMenu.get(categoryName)?.push(product);
    });

    this.applyMenuFilter();
  }

  onSearchTermChange(value: string | null | undefined): void {
    this.searchTerm = value ?? '';
    this.applyMenuFilter();
  }

  private applyMenuFilter(): void {
    const term = this.normalizeSearchText(this.searchTerm);
    const filtered = new Map<string, ProductI[]>();

    this.groupedMenu.forEach((products, category) => {
      const matches = term
        ? products.filter((product) =>
          this.normalizeSearchText(product.name).includes(term),
        )
        : products;

      if (matches.length > 0) {
        filtered.set(category, matches);
      }
    });

    this.filteredGroupedMenu = filtered;
    this.filteredProductsCount = Array.from(filtered.values()).reduce(
      (total, products) => total + products.length,
      0,
    );
  }

  private normalizeSearchText(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  // Cambia el estado de disponibilidad de un producto
  async toggleAvailability(product: ProductI, event: any) {
    const newAvailability = event.detail.checked;

    try {
      // Actualizar en el servidor
      const updatedProduct = await firstValueFrom(
        this._productService.updateProduct(product.id, { isAvailable: newAvailability }, null)
      );

      const statusText = newAvailability ? 'disponible' : 'no disponible';
      this.presentToast(`Producto marcado como ${statusText}`);
      await this.loadData();

    } catch (error) {
      console.error('Error al cambiar disponibilidad:', error);
      // Revertir el toggle en caso de error
      product.isAvailable = !newAvailability;
      this.presentToast('Error al actualizar el producto', 'danger');
    }
  }

  // Abre el modal/página para editar un producto existente
  async editItem(product: ProductI) {
    const modal = await this.modalCtrl.create({
      component: ProductFormComponent, // El componente del modal que creamos
      cssClass: 'cd-product-form-modal',
      componentProps: {
        // Aquí le pasamos los datos que necesita el modal
        'categories': this.allCategories,
        'mode': 'edit',
        product
      }
    });

    await modal.present();

    // Esperamos a que el modal se cierre para recibir los datos
    const { data, role } = await modal.onDidDismiss();

    console.log(`los datos del modal son ${JSON.stringify(data)}`);
    console.log(data);
    

    if (data) {
      // El usuario guardó, y 'data' contiene el objeto del nuevo producto
      await this.updateProduct(
        data.product.id,
        data.product.name,
        data.product.price,
        data.product.cost,
        data.product.description,
        data.product.categoryId,
        data.product.isActive,
        data.file ?? null,
        data.personalizations ?? [],
      );
    }
  }

  // ✅ NUEVO: Función para activar o desactivar productos (soft delete)
  async toggleProductStatus(product: ProductI) {
    // Asumimos que tu ProductI tiene la propiedad `isActive`
    const newStatus = !product.isActive;
    const actionText = newStatus ? 'reactivar' : 'desactivar';
    const pastParticiple = newStatus ? 'reactivado' : 'desactivado';

    const alert = await this.alertCtrl.create({
      header: newStatus ? 'Reactivar producto' : 'Desactivar producto',
      message: `¿Estás seguro de que deseas ${actionText} el producto '${product.name}'?`,
      cssClass: ['confirmation-action-alert'],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'alert-secondary-action',
        },
        {
          text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
          cssClass: 'alert-primary-action',
          handler: async () => {
            // Prepara los datos para la actualización
            const updatedData: UpdateProductDto = { isActive: newStatus };

            try {
              // Llama al servicio para actualizar el producto en el backend
              const updatedProduct = await firstValueFrom(
                this._productService.updateProduct(product.id, updatedData, null)
              );

              this.presentToast(`Producto ${pastParticiple} exitosamente.`);

              // Recargar datos para asegurar consistencia
              await this.loadData();
            } catch (err) {
              console.error(`Error al ${actionText} el producto:`, err);
              this.presentToast(`No se pudo ${actionText} el producto.`, 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async addNewItem() {
    const modal = await this.modalCtrl.create({
      component: ProductFormComponent, // El componente del modal que creamos
      cssClass: 'cd-product-form-modal',
      componentProps: {
        // Aquí le pasamos los datos que necesita el modal
        'categories': this.allCategories,
        'mode': 'new'
      }
    });

    await modal.present();

    // Esperamos a que el modal se cierre para recibir los datos
    const { data, role } = await modal.onDidDismiss();

    console.log(`los datos del modal son ${JSON.stringify(data)}`);

    if (data) {
      // El usuario guardó, y 'data' contiene el objeto del nuevo producto
      await this.createProduct(
        data.product.name,
        data.product.price,
        data.product.cost,
        data.product.description,
        data.product.categoryId,
        data.file ?? null,
        data.personalizations ?? [],
      );
    }
  }


  // Muestra una alerta para seleccionar la categoría del producto
  private async selectCategoryForProduct(name: string, price: number, cost: number, description?: string) {
    const categoryInputs = this.allCategories.map(category => ({
      name: 'selectedCategory',
      type: 'radio' as const,
      label: category.name,
      value: category.id,
      checked: false
    }));

    const alert = await this.alertCtrl.create({
      header: 'Seleccionar Categoría',
      message: `¿A qué categoría pertenece "${name}"?`,
      inputs: categoryInputs,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Continuar',
          handler: async (selectedCategoryId) => {
            if (selectedCategoryId) {
              await this.createProduct(name, price, cost, description, selectedCategoryId, null);
              return true;
            } else {
              this.presentToast('Debes seleccionar una categoría.', 'danger');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // Actualiza el producto usando el servicio
  private async updateProduct(
    id: number,
    name: string,
    price: number,
    cost: number,
    description: string | undefined,
    categoryId: number,
    isActive: boolean,
    file: File | null,
    personalizations: ProductPersonalizationAssignmentDto[],
  ) {
    try {
      const updateProductData = {
        name,
        price: price.toString(),
        cost: cost.toString(),
        description: description || null,
        categoryId,
        isActive,
        isAvailable: true // Por defecto disponible
      };

      console.log(file);
      
      const updatedProduct = await firstValueFrom(
        this._productService.updateProduct(id, updateProductData, file)
      );

      try {
        await firstValueFrom(
          this.personalizationsService.syncProductPersonalizations(
            updatedProduct.id ?? id,
            personalizations,
          ),
        );
      } catch (personalizationError) {
        console.error('El producto se actualizó, pero falló su configuración:', personalizationError);
        this.presentToast(
          'El producto se actualizó, pero no fue posible guardar sus personalizaciones. Intenta editarlo nuevamente.',
          'warning',
        );
        await this.loadData();
        return;
      }

      this.presentToast('Producto y personalizaciones actualizados exitosamente.');

      // Recargar datos para asegurar consistencia
      await this.loadData();

    } catch (error) {
      console.error('Error al actualizar el producto:', error);
      this.presentToast(this.getProductSaveErrorMessage(error), 'danger');
    }
  }

  // Crea el producto usando el servicio
  private async createProduct(
    name: string,
    price: number,
    cost: number,
    description: string | undefined,
    categoryId: number,
    file: File | null,
    personalizations: ProductPersonalizationAssignmentDto[] = [],
  ) {
    try {
      const newProductData = {
        name,
        price: price.toString(),
        cost: cost.toString(),
        description: description || null,
        categoryId,
        isActive: true,
        isAvailable: true // Por defecto disponible
      };

      const createdProduct = await firstValueFrom(
        this._productService.addProduct(newProductData, file)
      );

      try {
        await firstValueFrom(
          this.personalizationsService.syncProductPersonalizations(
            createdProduct.id,
            personalizations,
          ),
        );
      } catch (personalizationError) {
        console.error('El producto se creó, pero falló su configuración:', personalizationError);
        this.presentToast(
          'El producto se creó, pero no fue posible guardar sus personalizaciones. Puedes completarlas al editarlo.',
          'warning',
        );
        await this.loadData();
        return;
      }

      this.presentToast('Producto y personalizaciones guardados exitosamente.');

      // Recargar datos para asegurar consistencia
      await this.loadData();

    } catch (error) {
      console.error('Error al crear el producto:', error);
      this.presentToast(this.getProductSaveErrorMessage(error), 'danger');
    }
  }

  private getProductSaveErrorMessage(error: any): string {
    if (error?.status === 409) {
      return 'Ya existe un producto con ese nombre.';
    }

    if (error?.status === 422) {
      const validationErrors = Array.isArray(error?.error?.errors)
        ? error.error.errors
        : [];
      const fields = validationErrors.map((item: any) => item?.field);

      if (fields.includes('image')) {
        return 'La imagen no es válida. Usa un archivo JPG, PNG o WEBP de máximo 5 MB.';
      }

      if (fields.includes('categoryId')) {
        return 'La categoría seleccionada ya no está disponible. Actualiza la vista y selecciónala nuevamente.';
      }

      if (fields.includes('name')) {
        return 'Revisa el nombre del producto. Debe tener entre 2 y 150 caracteres.';
      }

      if (fields.includes('price') || fields.includes('cost')) {
        return 'Revisa el precio y el costo del producto. Usa valores numéricos válidos.';
      }

      return 'No fue posible guardar el producto. Revisa los datos ingresados e inténtalo nuevamente.';
    }

    return error?.error?.message || 'Hubo un error al guardar el producto.';
  }

  // Muestra una alerta de confirmación para eliminar un producto
  async deleteItem(productToDelete: ProductI) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Estás seguro de que quieres eliminar "${productToDelete.name}"? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              // Eliminar del servidor
              await firstValueFrom(this._productService.deleteProduct(productToDelete.id));

              // Eliminar de la lista local
              this.allProducts = this.allProducts.filter(product => product.id !== productToDelete.id);

              // Reagrupar para actualizar la vista
              this.groupItemsByCategory();

              this.presentToast(`"${productToDelete.name}" fue eliminado exitosamente`);

            } catch (error) {
              console.error('Error al eliminar producto:', error);
              this.presentToast('Error al eliminar el producto', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // Muestra un mensaje temporal (toast)
  async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      color: color
    });
    toast.present();
  }

  // Método para refrescar los datos (pull-to-refresh)
  async doRefresh(event: any) {
    try {
      await this.loadData();
    } finally {
      event.target.complete();
    }
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
