import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter', // <-- OJO: Cámbialo por el ID de tu app (ej: com.tuempresa.app)
  appName: 'frontend',
  webDir: 'www',

  // =======================================================
  // --> AÑADIDO 1: Configuración del servidor para Live Reload
  // =======================================================
  server: {
    androidScheme: 'https'
  },

  // =======================================================
  // --> AÑADIDO 2: Configuración para Push Notifications
  // =======================================================
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Camera: {
      permissions: ['camera', 'photos']
    }
  },
};

export default config;