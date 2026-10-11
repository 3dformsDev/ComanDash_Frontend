# COMANDASH frontend v1.0.10

Ramas de preparación: `feature/v1.0.10-inventario` y `release/v1.0.10`.
Publicación de código autorizada; despliegue manual previsto para mañana.

Este frontend debe instalarse junto al backend `release/v1.0.10` con la migración
de inventario verificada primero. Plan conjunto y respaldo/reversión:
[Backend — plan v1.0.10](https://github.com/3dformsDev/ComanDash_Backend/blob/release/v1.0.10/docs/RELEASE_v1.0.10.md).

Incluye inventario, alertas, entradas/ajustes, producto/opciones/componentes,
devolución de unidades recuperables, Excel, permisos y precios/costos; mejoras
aceptadas de formularios/caja/mesas/calendarios; cocina sincronizada y protegida;
marcado/desmarcado de productos nuevos y una sola personalización simultánea.

Comprobaciones: `npm run test:release-fixes` (35 pruebas), `npm run build` y
`git diff --check`; aceptación manual de Eduard completada. El build conserva
advertencias conocidas de CommonJS. No hay cambios de dependencias ni instalación
de paquetes nuevos en este release. Los lockfiles existentes se conservan.

`www` es generado e ignorado por Git: construirlo antes de preparar la imagen.
Preservar el Dockerfile/env/montajes productivos del servidor, que no se incluyen
en este repositorio. No instalar los env de desarrollo ni publicar credenciales.

Después de activar ambas imágenes, comprobar `ngsw.json`, assets, actualización
PWA y clientes móvil/desktop, login, sockets, venta/recibo/reporte y cierre. La
PWA anterior no envía la clave de idempotencia requerida y debe actualizarse.
No borrar datos del navegador sin revisar solicitudes/pedidos pendientes.

Los estilos y todas las pruebas funcionales previas están aprobados. Producción
no está modificada por publicar esta rama. Conservar la pareja anterior de
imágenes/commits y seguir el plan de reversión conjunto antes de operar.
