# Seguridad y registros de Academia Mirage

## Estado de esta entrega

El cambio visual y de catálogo del HTML no cambia la autenticación ni las reglas de la base de datos. La plataforma **no debe anunciarse como segura para datos de personal o constancias oficiales** hasta terminar la migración y validar sus reglas en Firebase. No publique reglas abiertas en modo de prueba.

## Riesgos comprobados en el código actual

- `getUsers()` descarga la colección de usuarios al navegador para buscar el correo. Los registros contienen contraseñas o hashes y roles.
- La sesión se restaura a partir de un correo guardado localmente, sin prueba de una sesión del servidor.
- Las solicitudes REST a Realtime Database no incluyen credenciales; la disponibilidad y exposición dependen de las reglas actuales, que no están en este repositorio.
- El rol `admin` y las finalizaciones de curso se deciden en el navegador. La interfaz oculta opciones, pero eso no autoriza operaciones.
- El código público incluye cuentas de demostración para el modo local.

## Migración necesaria antes de habilitar a todo Mirage

1. Resguardar la base y exportar una copia privada de `users` y `progress` desde Firebase, con acceso limitado a RH/TI. No colocarla en este repositorio.
2. Configurar Firebase Authentication para las cuentas corporativas. Migrar a cada colaborador a un UID estable, sin trasladar la contraseña ni su hash al navegador. Retirar las cuentas de demostración del despliegue.
3. Vincular los registros de cursos existentes con cada UID; verificar muestra por área y constancias antes de eliminar la estructura anterior.
4. Definir reglas de Realtime Database que permitan a cada persona consultar solo su perfil y avance; RH recibe el acceso de reporte mediante un rol administrado y verificado. Probar explícitamente lectura, escritura y denegación con el emulador.
5. Registrar la aprobación del curso en una función de servidor que valide curso, usuario, evaluación y puntuación. El mensaje `postMessage` del curso puede actualizar la pantalla, pero no debe ser prueba de aprobación.
6. Reemplazar registro abierto por alta corporativa o invitaciones; añadir recuperación de cuenta y procedimiento de baja.
7. Publicar una versión de prueba, comprobar migración, acceso y reporte, y después cambiar producción. Conservar respaldo y plan de reversión.

## Información que debe proporcionar el administrador del proyecto

- Acceso de mantenimiento al proyecto Firebase y a sus reglas actuales; nunca compartir contraseñas en el chat.
- Confirmación de los dominios de correo autorizados y quién aprueba el alta de usuarios.
- Definición por área y puesto de cursos obligatorios y calificación mínima para cada uno.
