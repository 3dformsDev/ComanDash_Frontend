import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.comandash.app', // <-- OJO: Cámbialo por el ID de tu app (ej: com.tuempresa.app)
  appName: 'COMANDASH', // <-- OJO: Cámbialo por el nombre de tu app
  webDir: 'www',

  // =======================================================
  // --> AÑADIDO 1: Configuración del servidor para Live Reload
  // =======================================================
  server: {
    androidScheme: 'https',
  },

  // =======================================================
  // --> AÑADIDO 2: Configuración para Push Notifications
  // =======================================================
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Camera: {
      permissions: ['camera', 'photos'],
    },
  },
};

export default config;
