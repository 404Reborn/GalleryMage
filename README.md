# 🖼️ GalleryMage

Una galería de imágenes desarrollada con **HTML**, **CSS** y **JavaScript**, utilizando la API de **Unsplash** para obtener fotografías de naturaleza.

## ✨ Características

- 🌿 Obtiene imágenes desde la API de Unsplash.
- ❤️ Sistema de "Me gusta".
- 🔢 Contador global de likes.
- 🎨 Diseño moderno y responsive.
- ⚡ Consumo de API usando `fetch()` y `async/await`.

## 📸 Vista previa

![Preview](preview.png)

> Puedes reemplazar `preview.png` por una captura de pantalla de tu proyecto.

---

## 🚀 Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript (ES6)
- Fetch API
- Async / Await
- Unsplash API

---

## 📁 Estructura del proyecto

```text
GalleryMage/
│
├── index.html
├── style.css
├── js/
│   └── main.js
└── README.md
```

---

## ⚙️ Instalación

Clona el repositorio.

```bash
git clone https://github.com/TU_USUARIO/GalleryMage.git
```

Entra a la carpeta.

```bash
cd GalleryMage
```

Abre el proyecto con Live Server o cualquier servidor local.

---

## 🔑 Configuración

El proyecto utiliza la API de Unsplash.

Dentro de `main.js` encontrarás:

```javascript
const response = await fetch(
"https://api.unsplash.com/search/photos?query=nature&per_page=30&client_id=TU_API_KEY"
);
```

Reemplaza `TU_API_KEY` por tu propia API Key de Unsplash.

---

## 📚 Lo que aprendí

Durante este proyecto practiqué:

- Consumo de APIs REST.
- Manipulación del DOM.
- Eventos.
- Creación dinámica de elementos.
- Manejo de clases con `classList`.
- Contadores usando JavaScript.
- Programación asíncrona.

---

## 📄 Licencia

Este proyecto fue desarrollado con fines educativos.

---

## 👨‍💻 Autor

Daniel Porras
