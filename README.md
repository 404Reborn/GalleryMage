# 🖼️ GalleryMage

Una galería de imágenes desarrollada con **HTML**, **CSS** y **JavaScript**, utilizando la **API de Unsplash** para obtener fotografías de alta calidad de forma dinámica.

El proyecto fue creado como práctica de consumo de APIs REST, manipulación del DOM y desarrollo Front-End moderno.

---

# ✨ Características

- 🖼️ Carga fotografías desde la API local `GET /api/photos`.
- 🔍 Barra de búsqueda preparada para realizar búsquedas personalizadas.
- 🔐 Inicio de sesión y registro mediante la sesión del backend.
- ❤️ Likes de interfaz guardados localmente en el navegador; aún no son likes compartidos.
- 🎨 Tema claro, oscuro o del sistema con preferencia guardada en LocalStorage.
- 🧑‍💻 Pantallas de perfil y configuración preparadas para futuras APIs.
- 📤 Subida de fotografías protegida por la sesión del usuario.
- 📱 Responsive para dispositivos móviles.
- ⚡ Frontend con JavaScript vanilla y módulos ES.

## Estado de las funciones sociales

La interfaz de registro usa `POST /api/usuarios/registro`, el login usa
`POST /api/usuarios/login` y la sesión se consulta con `GET /api/sesion`.
La galería conserva `GET /api/photos` y la subida usa `POST /api/photos`.

Google OAuth, recuperación de contraseña y cierre de sesión todavía no tienen
rutas implementadas. Las publicaciones no guardan todavía la identidad de su
autor, y likes, perfil editable, comentarios, guardados y preferencias de
privacidad tampoco tienen persistencia en el backend. La interfaz señala esas
funciones como pendientes en lugar de simular respuestas de API.

El frontend está organizado en `public/js/auth.js` (autenticación),
`public/js/main.js` (galería y subida), `public/js/profile-settings.js`
(perfil y configuración) y `public/js/theme.js` (tema).

---

# 📸 Vista previa

![Preview](preview.png)

> Reemplaza `preview.png` por una captura real del proyecto.

---

# 🚀 Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript (ES6+)
- Fetch API
- Async / Await
- LocalStorage
- Unsplash API
- Google Fonts

---

# 📁 Estructura del proyecto

```text
GalleryMage/
│
├── index.html
├── css/
│   └── style.css
│
├── js/
│   ├── config.js
│   └── main.js
│
├── preview.png
└── README.md
```

---

# ⚙️ Instalación

Clona el repositorio:

```bash
git clone https://github.com/SyntaxError404undefined/GalleryMage.git
```

Entra en la carpeta:

```bash
cd GalleryMage
```

Abre el proyecto utilizando **Live Server** o cualquier servidor local.

---

# 🔑 Configuración

El proyecto utiliza la API oficial de Unsplash.

En `main.js` encontrarás una petición similar a esta:

```javascript
const response = await fetch(
`https://api.unsplash.com/search/photos?query=nature&per_page=30&client_id=TU_API_KEY`
);
```

Sustituye `TU_API_KEY` por tu propia API Key.

Puedes obtener una creando una aplicación gratuita en:

https://unsplash.com/developers

---

# ❤️ Sistema de favoritos

Cada imagen posee un botón de favorito.

Cuando una imagen es marcada:

- Se colorea el corazón.
- Se incrementa el contador.
- Su ID se almacena en LocalStorage.

Al volver a abrir la página:

- Los favoritos permanecen guardados.
- El contador conserva el valor correcto.

---

# 🔍 Buscador

La interfaz incluye un buscador para realizar búsquedas de imágenes directamente desde la aplicación.

Actualmente permite introducir una consulta y está preparado para integrarse con la API de Unsplash para obtener resultados dinámicamente.

---

# 🎨 Diseño

La interfaz fue desarrollada siguiendo un estilo moderno:

- Cards con sombras.
- Hover con efecto de elevación.
- Zoom suave en las imágenes.
- Animaciones de aparición.
- Animación del corazón al dar "Me gusta".
- Barra de búsqueda integrada.
- Tipografía personalizada mediante Google Fonts.

---

# 📚 Lo que aprendí

Durante este proyecto practiqué:

- Consumo de APIs REST.
- Fetch API.
- Async / Await.
- Manipulación del DOM.
- Creación dinámica de elementos HTML.
- Event Listeners.
- Manejo de clases con `classList`.
- Persistencia de datos usando LocalStorage.
- Programación asíncrona.
- Responsive Design.
- Organización de proyectos Front-End.

---

# 🚀 Próximas mejoras

- [ ] Búsqueda dinámica de cualquier temática.
- [ ] Modal para visualizar imágenes en tamaño completo.
- [ ] Descargar imágenes.
- [ ] Mostrar información del fotógrafo.
- [ ] Paginación infinita (Infinite Scroll).
- [ ] Filtrar únicamente imágenes favoritas.
- [ ] Cambiar entre modo claro y oscuro.

---

# 📄 Licencia

Este proyecto fue desarrollado con fines educativos como parte de mi formación en desarrollo Full Stack.

---

# 👨‍💻 Autor

**Daniel Porras**

GitHub:

https://github.com/SyntaxError404undefined