# GalleryMage

Galería de fotografías construida con Node.js, Express, MongoDB y JavaScript
vanilla en módulos ES. La aplicación incluye autenticación local y Google
OAuth, publicación de fotografías, likes, perfiles y preferencias de privacidad.

## Requisitos y puesta en marcha

- Node.js 20 o posterior.
- MongoDB accesible desde la aplicación.
- Copiar `.env.example` a `.env`, completar `SESSION_SECRET` y revisar el resto
  de variables. Genera un secreto de sesión local con:

  ```bash
  node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
  ```

- Añadir ese valor a `SESSION_SECRET` en `.env`. No compartirlo ni subir `.env`.
- Instalar dependencias con `npm install` y arrancar con `node server.js`.
- La aplicación escucha en `http://localhost:3000`.

`MONGODB_URI` puede apuntar a una instancia MongoDB propia. Si no se configura,
se usa MongoDB local en `mongodb://localhost:27017/gallerymage`.

## Imágenes y privacidad

Las imágenes nuevas se guardan fuera de `public/` en `uploads/photos` y
`uploads/avatars`; las referencias y metadatos se guardan en MongoDB. Los
directorios de subida están excluidos de Git. El servidor valida el tipo real
del archivo y limita las fotos a 10 MB y los avatares a 5 MB.

Los perfiles son públicos de forma predeterminada. Un perfil privado oculta
su perfil y todas sus fotografías a otros usuarios; el servidor filtra la API
de la galería y protege también las URL de los medios. El propietario conserva
el acceso. Las imágenes antiguas ubicadas en `public/uploads/` se sirven solo
si corresponden a una fotografía registrada y respetan la privacidad vigente.

La preferencia «Mostrar correo» solo incluye el correo en el perfil público
cuando el usuario también mantiene público su perfil. Los contadores de likes
se calculan desde MongoDB; no dependen únicamente de las fotos visibles en el
navegador.

## Recuperación de contraseña

La recuperación local requiere configurar un servidor SMTP. Completa
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM` y, si el proveedor los
requiere, `SMTP_USER` y `SMTP_PASS`. `APP_BASE_URL` debe ser la dirección
pública correcta de la aplicación. Sin SMTP, la interfaz informa que la
recuperación no está habilitada y no simula el envío de mensajes. Las cuentas
que usan Google no tienen una contraseña local para restablecer.

## OAuth de Google

Configura `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env` y registra la
URL de callback que utiliza `config/passport.config.js`. Las cuentas nuevas de
Google no reciben una contraseña local. Las cuentas Google heredadas solo se
migran al autenticarse si se verifica el valor hash de la credencial interna
que generaba la versión anterior; no se vincula una cuenta local por correo
sin esa prueba.

## Documentos legales

En Configuración → Información se accede a la política de privacidad, aviso
legal y condiciones de uso. Son plantillas con campos pendientes, no una
garantía de cumplimiento normativo. El responsable debe completar los datos
marcados, confirmar proveedores, conservación y tratamientos reales, y obtener
revisión jurídica antes de publicar la aplicación.

## Pruebas

`npm test` ejecuta las pruebas unitarias de validación de cuentas y referencias
de imágenes. Las pruebas de integración requieren MongoDB y una configuración
de sesión; para probar el flujo real de recuperación también se necesita un
proveedor SMTP.
