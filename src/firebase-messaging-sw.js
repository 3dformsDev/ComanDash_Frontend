// src/firebase-messaging-sw.js

// 1. Importa las librerías de Firebase necesarias para que el service worker funcione.
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

// 2. Pega aquí TU MISMO objeto de configuración de Firebase (el de environment.ts).
const firebaseConfig = {
  apiKey: "AIzaSyAo6DnRrd5XU_7SCRBAX4QO6FFG4dLsY0E",
  authDomain: "comandash-app.firebaseapp.com",
  projectId: "comandash-app",
  storageBucket: "comandash-app.firebasestorage.app",
  messagingSenderId: "716285244408",
  appId: "1:716285244408:web:9af41141e5e3b8e6f55c0d"
};

// 3. Inicializa Firebase dentro del service worker.
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// 4. (Opcional pero recomendado) Maneja las notificaciones que llegan
//    cuando la app está en segundo plano.
messaging.onBackgroundMessage((payload) => {
    console.log(
        '[firebase-messaging-sw.js] Mensaje recibido en segundo plano: ',
        payload
    );

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/assets/icons/icon-192x192.png', // Asegúrate de que esta ruta a tu ícono sea correcta
        sound: '/assets/sound/notification.mp3',
        vibrate: [200, 100, 200]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
