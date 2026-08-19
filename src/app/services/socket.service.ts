import { Injectable } from '@angular/core';
import { environment } from '@environments/environment'; // Asumo que usas environments
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  // CAMBIO 1: El socket se declara pero no se inicializa aquí.
  private socket?: Socket;
  private socketUrl: string = environment.socketUrl; // ¡Perfecto que uses environments!
  private currentToken: string = '';

  // Observable para el estado de conexión
  private connectionStatus = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.connectionStatus.asObservable();
  constructor() {
    // El constructor ahora está vacío. No nos conectamos automáticamente.
  }

  // CAMBIO 2: Nuevo método para establecer la conexión.
  connect(authToken: string) {
    console.log('Iniciando conexión segura al socket.');

    // Guardar token actual
    this.currentToken = authToken;

    /// ✅ LÓGICA CORREGIDA:
    // Si ya existe una instancia de socket (conectada o no),
    // la desconectamos y la eliminamos para asegurar un inicio limpio.
    if (this.socket) {
      console.log('Socket anterior encontrado, desconectando...');
      this.socket.disconnect();
      // this.socket = undefined; // Opcional, pero buena práctica para limpiar.
    }

    // Inicializamos la conexión pasando la URL y el token para la autenticación.
    this.socket = io(this.socketUrl, {
      // CAMBIO 3: Objeto 'auth' para que tu middleware lo valide.
      auth: {
        token: authToken
      },
      path: '/comandapp-sockets/',
      extraHeaders: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    // ✅ Escuchar conexión exitosa
    this.socket.on('connect', () => {
      console.log('✅ Socket conectado:', this.socket?.id);
      this.connectionStatus.next(true);
    });

    // ✅ Escuchar desconexión
    this.socket.on('disconnect', () => {
      console.log('❌ Socket desconectado');
      this.connectionStatus.next(false);
    });

    // ✅ CRÍTICO: Escuchar expiración de token
    this.socket.on('token_expired', (data) => {
      console.log('🚫 Token expirado:', data.message);
      this.connectionStatus.next(false);

      // Emitir evento para que la app maneje la renovación
      this.socket?.emit('request_token_renewal');
    });

    // Error de conexión
    this.socket.on('connect_error', (err) => {
      console.error('[Socket.IO] Error de conexión:', err.message);
      this.connectionStatus.next(false);

      // Si es error de autenticación, solicitar renovación
      if (err.message.includes('Token')) {
        this.socket?.emit('request_token_renewal');
      }
    });
  }

  // ✅ Método para renovar token sin desconectar
  renewToken(newToken: string) {
    console.log('🔄 Renovando token...');
    this.currentToken = newToken;

    if (this.socket) {
      // La próxima reconexión usará el token actualizado sin perder listeners.
      this.socket.auth = { token: newToken };

      if (!this.socket.connected) {
        this.socket.connect();
      }

      return;
    }

    this.connect(newToken);
  }

  // MÉTODO PARA EMITIR EVENTOS
  // CAMBIO 5: Usamos optional chaining (?) por si se llama antes de conectar.
  emit(eventName: string, data: any) {
    if (this.socket?.connected) {
      // Incluir token actualizado en cada emit
      const dataWithAuth = {
        ...data,
        __auth_token: this.currentToken
      };
      this.socket?.emit(eventName, dataWithAuth);
    } else {
      console.warn('⚠️ Socket no conectado. No se puede emitir:', eventName);
    }
  }

  // MÉTODO PARA ESCUCHAR EVENTOS
  listen(eventName: string): Observable<any> {
    return new Observable((subscriber) => {
      // Si no hay socket, no hacemos nada (o podríamos emitir un error)
      if (!this.socket) {
        return;
      }

      // Definimos la función que manejará los datos
      const handler = (data: any) => {
        subscriber.next(data);
      };

      // Añadimos el listener
      this.socket.on(eventName, handler);

      // ✅ ESTA ES LA MAGIA:
      // Devolvemos una función que se ejecutará cuando el suscriptor
      // se dé de baja (ej. cuando un componente se destruye).
      return () => {
        console.log(`Limpiando listener para el evento: ${eventName}`);
        this.socket?.off(eventName, handler);
      };
    });
  }

  // ✅ Método para verificar si está conectado
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ✅ Obtener ID del socket
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  // MÉTODO PARA DESCONECTAR EL SOCKET
  disconnect() {
    this.socket?.disconnect();
  }

  // ✅ Método para reconectar con el token actual
  reconnect() {
    if (this.currentToken) {
      console.log('🔄 Reconectando...');
      this.connect(this.currentToken);
    }
  }
}
