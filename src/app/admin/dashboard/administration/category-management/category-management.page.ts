import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { CategoriesService, CategoryI, CreateCategoryDto, UpdateCategoryDto } from '@services/categories.service';

@Component({
  selector: 'app-category-management',
  templateUrl: './category-management.page.html',
  styleUrls: ['./category-management.page.scss'],
  standalone: false,
})
export class CategoryManagementPage implements OnInit {

  allCategories: CategoryI[] = [];

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private _categoryService: CategoriesService
  ) { }

  ngOnInit() {
  }

  // Se ejecuta cuando la página está a punto de mostrarse
  ionViewWillEnter() {
    this._categoryService.getCategory().subscribe({
      next: (categories) => {
        this.allCategories = categories;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
    });
  }

  // Muestra una alerta con un campo de texto para AÑADIR una nueva categoría
  async addCategory() {
    const alert = await this.alertCtrl.create({
      header: 'Nueva Categoría',
      message: 'Crea una sección para organizar tus productos, por ejemplo Bebidas, Cócteles, Hamburguesas o Postres.',
      cssClass: ['management-form-alert'],
      inputs: [
        {
          name: 'categoryName',
          type: 'text',
          placeholder: 'Ej: Sopas'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'alert-secondary-action' },
        {
          text: 'Guardar',
          cssClass: 'alert-primary-action',
          handler: (data) => {
            const categoryName = data.categoryName.trim();
            if (categoryName) {
              const newCategoryData: CreateCategoryDto = { name: categoryName };

              // ✅ Llama al servicio para crear la categoría
              this._categoryService.addCategory(newCategoryData).subscribe({
                next: (createdCategory) => {
                  // Añade la categoría devuelta por la API (con el ID real) a la lista local
                  this.allCategories.push(createdCategory);
                  this.presentToast('Categoría añadida exitosamente.');
                  this._categoryService.getCategory().subscribe({
                    next: (categories) => {
                      this.allCategories = categories;
                    },
                    error: (error) => {
                      console.error('Error loading categories:', error);
                    }
                  });
                },
                error: (error) => {
                  console.error('Error al crear la categoría:', error);
                  this.presentToast('Hubo un error al guardar la categoría.', 'danger');
                }
              });
              return true;
            } else {
              this.presentToast('El nombre no puede estar vacío.', 'danger');
              return false; // Evita que la alerta se cierre si el campo está vacío
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async editCategory(categoryToEdit: CategoryI) {
    const alert = await this.alertCtrl.create({
      header: 'Editar Categoría',
      cssClass: ['management-form-alert'],
      inputs: [
        {
          name: 'categoryName',
          type: 'text',
          value: categoryToEdit.name
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'alert-secondary-action' },
        {
          text: 'Actualizar',
          cssClass: 'alert-primary-action',
          handler: (data) => {
            const newName = data.categoryName.trim();
            const newStatus = data.isActive; // Obtenemos el valor del checkbox

            // 1. Validar si el campo de nombre está vacío
            if (!newName) {
              this.presentToast('El nombre no puede estar vacío.', 'danger');
              return false;
            }

            // 2. Validar si NADA ha cambiado (ni el nombre, ni el estado)
            const hasNameChanged = newName !== categoryToEdit.name;
            const hasStatusChanged = newStatus !== categoryToEdit.isActive;

            if (!hasNameChanged && !hasStatusChanged) {
              return true; // No hay cambios, solo cierra la alerta
            }

            // 3. Si hay cambios, proceder con la actualización
            // Asegúrate que tu DTO acepte 'isActive'
            const updatedData: UpdateCategoryDto = {
              name: newName,
              isActive: newStatus
            };

            this._categoryService.updateCategory(categoryToEdit.id, updatedData).subscribe({
              next: (updatedCategory) => {
                // Actualiza la categoría en la lista local para reflejar los cambios al instante
                const index = this.allCategories.findIndex(cat => cat.id === categoryToEdit.id);
                if (index !== -1) {
                  this.allCategories[index] = updatedCategory;
                }
                this.presentToast('Categoría actualizada exitosamente.');
                this._categoryService.getCategory().subscribe({
                  next: (categories) => {
                    this.allCategories = categories;
                  },
                  error: (error) => {
                    console.error('Error loading categories:', error);
                  }
                });
              },
              error: (err) => {
                console.error('Error al actualizar la categoría:', err);
                this.presentToast('No se pudo actualizar la categoría.', 'danger');
              }
            });

            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  // Muestra una alerta de confirmación para ELIMINAR una categoría
  async deleteCategory(categoryToDelete: CategoryI) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Seguro que quieres eliminar la categoría: ${categoryToDelete.name}? Esta acción no se puede deshacer.`, // Usamos <strong> para semántica
      cssClass: ['confirmation-action-alert'],
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'alert-secondary-action' },
        {
          text: 'Eliminar',
          cssClass: 'alert-primary-action',
          handler: () => {
            // ✅ Llama al servicio para eliminar
            this._categoryService.deleteCategory(categoryToDelete.id).subscribe({
              next: () => {
                // Si el servidor confirma, elimina la categoría de la lista local
                this.allCategories = this.allCategories.filter(cat => cat.id !== categoryToDelete.id);
                this.presentToast(`Categoría "${categoryToDelete.name}" eliminada.`);
                this._categoryService.getCategory().subscribe({
                  next: (categories) => {
                    this.allCategories = categories;
                  },
                  error: (error) => {
                    console.error('Error loading categories:', error);
                  }
                });
              },
              error: (err) => {
                console.error('Error al eliminar la categoría:', err);
                this.presentToast('No se pudo eliminar la categoría. Es posible que tenga productos asociados.', 'danger');
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // Muestra un mensaje temporal (toast)
  async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      color: color,
    });
    toast.present();
  }


  /**
   * Activa o desactiva una categoría mostrando una alerta de confirmación.
   */
  async toggleCategoryStatus(category: CategoryI) {
    const newStatus = !category.isActive;
    const actionText = newStatus ? 'reactivar' : 'desactivar';
    const pastParticiple = newStatus ? 'reactivada' : 'desactivada';

    const alert = await this.alertCtrl.create({
      header: newStatus ? 'Reactivar categoría' : 'Desactivar categoría',
      message: `¿Estás seguro de que deseas ${actionText} la categoría '${category.name}'?`,
      cssClass: ['confirmation-action-alert'],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'alert-secondary-action',
        },
        {
          text: actionText.charAt(0).toUpperCase() + actionText.slice(1), // Pone la primera letra en mayúscula
          cssClass: 'alert-primary-action',
          handler: () => {
            const updatedData: UpdateCategoryDto = { isActive: newStatus };

            this._categoryService.updateCategory(category.id, updatedData).subscribe({
              next: (updatedCategory) => {
                // Actualiza la lista local para que el cambio se vea al instante
                const index = this.allCategories.findIndex(c => c.id === category.id);
                if (index !== -1) {
                  this.allCategories[index] = updatedCategory;
                }
                this.presentToast(`Categoría ${pastParticiple}da exitosamente.`);
                this._categoryService.getCategory().subscribe({
                  next: (categories) => {
                    this.allCategories = categories;
                  },
                  error: (error) => {
                    console.error('Error loading categories:', error);
                  }
                });
              },
              error: (err) => {
                console.error(`Error al ${pastParticiple} la categoría:`, err);
                this.presentToast(`No se pudo ${pastParticiple} la categoría.`, 'danger');
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }
}
