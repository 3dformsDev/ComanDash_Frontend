// 1. Definimos cómo se ve un usuario
export interface User {
    id: number;
    username: string;
    email: string | null;
    fullName: string;
    isActive: boolean | number; // depende si tu backend envía 0/1 o true/false
    lastLoginAt: string | null; // ISO string o null si no ha iniciado sesión
    company: {
        id: number;
        name: string;
    } | null;
    location: {
        id: number;
        name: string;
    } | null; // según tu ejemplo es null, pero lo definí como objeto o null
    role: {
        id: number;
        name: string;
        code: string;
        description: string;
    } | null;
    permissions: string[]; // ajusta el tipo según lo que devuelva tu backend
}

// 2. Definimos la estructura completa de nuestro estado de autenticación
export interface AuthState {
    isAuthenticated: boolean;
    user: User | null; // El usuario puede ser nulo si no está logueado
    error: string | null; // Para manejar errores de login
}

// 3. Creamos el estado inicial
export const initialState: AuthState = {
    isAuthenticated: false,
    user: null,
    error: null,
};
