import { Component, OnInit } from '@angular/core';
import { CashRegisterSessionService, DailySummaryI } from '@services/cash-register-session.service';

@Component({
  selector: 'app-summary',
  templateUrl: './summary.page.html',
  styleUrls: ['./summary.page.scss'],
  standalone: false,
})
export class SummaryPage implements OnInit {

  public summaryDate: string = '';

  // Objeto para almacenar todos los datos calculados
  // public summaryData = {
  //   totalOrders: 0,
  //   totalRevenue: 0,
  //   tableOrders: 0,
  //   takeawayOrders: 0,
  //   topProducts: [] as { name: string, count: number }[]
  // };

  summaryData: DailySummaryI = {
    totalOrders: 0,
    totalRevenue: 0,
    tableOrders: 0,
    takeawayOrders: 0,
    ordersInProcess: 0,
    ordersFinished: 0,
    ordersCancelled: 0,
    topProducts: [{
      name: 'Ninguno',
      count: 0
    }]
  };

  // Datos simulados de todas las órdenes del día
  private allDayOrders = [
    {
      status: 'pagado',
      orderInfo: { type: 'mesa' },
      items: [
        { name: 'Hamburguesa Clásica', quantity: 1, price: 25000 },
        { name: 'Limonada Natural', quantity: 2, price: 7000 }
      ],
      totalPaid: 42900 // (25000 + 14000) * 1.1
    },
    {
      status: 'pagado',
      orderInfo: { type: 'llevar' },
      items: [{ name: 'Pizza Pepperoni', quantity: 1, price: 28000 }],
      totalPaid: 30800 // 28000 * 1.1
    },
    {
      status: 'pagado',
      orderInfo: { type: 'mesa' },
      items: [{ name: 'Hamburguesa Clásica', quantity: 2, price: 25000 }],
      totalPaid: 55000 // 50000 * 1.1
    },
    {
      status: 'cancelado', // Esta orden no debe contar
      orderInfo: { type: 'mesa' },
      items: [{ name: 'Aros de Cebolla', quantity: 1, price: 12000 }],
      totalPaid: 0
    },
  ];

  constructor(
    private _cashRegisterSessionService: CashRegisterSessionService
  ) { }

  ngOnInit() {
    this.setFormattedDate();
    this.calculateSummary();
    this.loadDailySummary();
  }

  loadDailySummary() {
    this._cashRegisterSessionService.getDailySessionSummary().subscribe({
      next: (data) => {
        console.log(data);
        console.log('Resumen del día recibido:', data);
        // Asignamos los datos recibidos a la propiedad del componente
        this.summaryData = data;
      },
      error: (err) => {
        // ❌ Este bloque se ejecuta si hay un error en la petición
        console.error('Error al cargar el resumen diario:', err);
        // Aquí podrías mostrar un toast o un mensaje de error al usuario
      }
    }
    )
  }

  setFormattedDate() {
    const today = new Date();
    // Formatea la fecha a un formato legible, ej: "martes, 2 de septiembre de 2025"
    this.summaryDate = today.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  calculateSummary() {
    // const validOrders = this.allDayOrders.filter(order => order.status === 'pagado');

    // // Calcular totales
    // this.summaryData.totalOrders = validOrders.length;
    // this.summaryData.totalRevenue = validOrders.reduce((sum, order) => sum + order.totalPaid, 0);
    // this.summaryData.tableOrders = validOrders.filter(order => order.orderInfo.type === 'mesa').length;
    // this.summaryData.takeawayOrders = validOrders.filter(order => order.orderInfo.type === 'llevar').length;

    // // Calcular productos más vendidos
    // const productCounts = new Map<string, number>();
    // validOrders.forEach(order => {
    //   order.items.forEach(item => {
    //     const currentCount = productCounts.get(item.name) || 0;
    //     productCounts.set(item.name, currentCount + item.quantity);
    //   });
    // });

    // // Convertir el mapa a un array, ordenarlo y tomar los 5 primeros
    // this.summaryData.topProducts = Array.from(productCounts.entries())
    //   .map(([name, count]) => ({ name, count }))
    //   .sort((a, b) => b.count - a.count)
    //   .slice(0, 5);
  }

}
