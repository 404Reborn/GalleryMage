import { initializeAuth } from "./auth.js";
import { initializeProfileSettings } from "./profile-settings.js";
import { initializeTheme } from "./theme.js";

const gallery = document.querySelector(".container-prompt");
const galleryStatus = document.querySelector("#gallery-status");
const searchInput = document.querySelector("#buscador");
const searchButton = document.querySelector(".button-search");
const uploadDialog = document.querySelector("#upload-dialog");
const uploadForm = document.querySelector("#formulario-foto");
const uploadMessage = document.querySelector("#subida-mensaje");
const uploadButton = document.querySelector("#upload-submit");
const photoDialog = document.querySelector("#modal-foto");
const photoDialogImage = document.querySelector("#modal-imagen");
const photoDialogTitle = document.querySelector("#modal-titulo");
const photoDialogInfo = document.querySelector("#modal-informacion");
const photoDialogLike = document.querySelector("#modal-like");
const photoDialogLikeCount = document.querySelector("#modal-like-count");
const likes = new Set(JSON.parse(localStorage.getItem("likes") || "[]"));
const likeCounts = new Map();
let photos = [];
let activePhotoId = null;
let openerElement = null;
let currentUser = null;
let likesAvailable = false;
let authController = null;

initializeTheme();

const profileSettings = initializeProfileSettings({
    getUser: () => currentUser,
    getPhotos: () => photos,
    likes,
    onPhotoSelect: (photo) => openPhoto(photo),
    onLogout: async () => {
        await authController.logout();
        currentUser = null;
        photos = [];
        likes.clear();
        likeCounts.clear();
        likesAvailable = false;
        gallery.replaceChildren();
        galleryStatus.textContent = "";
    },
});

function photoId(photo) {
    return String(photo._id ?? photo.imagen);
}

function setPhotoLike(photo, isLiked) {
    const id = photoId(photo);
    const button = document.querySelector(
        `.photo-like-button[data-photo-id="${CSS.escape(id)}"]`,
    );
    if (button) button.disabled = true;
    if (activePhotoId === id) photoDialogLike.disabled = true;

    fetch(`/api/photos/${encodeURIComponent(id)}/like`, {
        method: isLiked ? "DELETE" : "POST",
        credentials: "same-origin",
    })
        .then(async (response) => {
            let result;
            try {
                result = await response.json();
            } catch {
                throw new Error("El servidor devolvió una respuesta no válida.");
            }
            if (!response.ok) {
                throw new Error(result.mensaje || "No se pudo actualizar el like.");
            }
            if (typeof result.count !== "number" || typeof result.isLiked !== "boolean") {
                throw new Error("La respuesta de likes no tiene el formato esperado.");
            }

            likeCounts.set(id, result.count);
            if (result.isLiked) likes.add(id);
            else likes.delete(id);
            localStorage.setItem("likes", JSON.stringify([...likes]));
            updatePhotoLikeControls(id, result);
            profileSettings.render();
        })
        .catch((error) => {
            galleryStatus.textContent =
                error instanceof Error ? error.message : "No se pudo actualizar el like.";
        })
        .finally(() => {
            if (button?.isConnected) button.disabled = !likesAvailable;
            if (activePhotoId === id) photoDialogLike.disabled = !likesAvailable;
        });
}

function updatePhotoLikeControls(id, result) {
    document.querySelectorAll(".photo-like-button[data-photo-id]").forEach((button) => {
        if (button.dataset.photoId !== id) return;
        button.setAttribute("aria-pressed", String(result.isLiked));
        button.setAttribute("aria-label", result.isLiked ? "Quitar de mis likes" : "Me gusta");
        button.classList.toggle("is-active", result.isLiked);
        button.title = result.isLiked ? "Quitar de mis likes" : "Me gusta";
        const counter = button.querySelector("[data-like-count]");
        if (counter) counter.textContent = formatLikeCount(result.count);
    });
    if (activePhotoId === id) {
        photoDialogLike.setAttribute("aria-pressed", String(result.isLiked));
        photoDialogLike.setAttribute(
            "aria-label",
            result.isLiked ? "Quitar de mis likes" : "Me gusta",
        );
        photoDialogLike.classList.toggle("is-active", result.isLiked);
        photoDialogLikeCount.textContent = formatLikeCount(result.count);
    }
}

function formatLikeCount(count) {
    return new Intl.NumberFormat("es", {
        notation: count >= 10000 ? "compact" : "standard",
        maximumFractionDigits: 1,
    }).format(count);
}

function openPhoto(photo, opener) {
    activePhotoId = photoId(photo);
    openerElement = opener;
    photoDialogImage.src = photo.imagen;
    photoDialogImage.alt = photo.titulo || "Fotografía de GalleryMage";
    photoDialogTitle.textContent = photo.titulo || "Fotografía sin título";
    photoDialogInfo.textContent = photo.hashtags
        ? `#${photo.hashtags.replaceAll(",", " #")}`
        : "Fotografía compartida en GalleryMage";
    const isLiked = likes.has(activePhotoId);
    photoDialogLike.setAttribute("aria-pressed", String(isLiked));
    photoDialogLike.classList.toggle("is-active", isLiked);
    photoDialogLike.disabled = !likesAvailable;
    photoDialogLike.setAttribute("aria-label", isLiked ? "Quitar de mis likes" : "Me gusta");
    photoDialogLikeCount.textContent = formatLikeCount(likeCounts.get(activePhotoId) || 0);
    photoDialog.showModal();
}

function renderPhotos(searchText = "") {
    gallery.replaceChildren();
    const query = searchText.trim().toLocaleLowerCase();
    const filteredPhotos = photos.filter((photo) => {
        const searchable = `${photo.titulo || ""} ${photo.hashtags || ""}`.toLocaleLowerCase();
        return searchable.includes(query);
    });

    galleryStatus.textContent = `${filteredPhotos.length} ${filteredPhotos.length === 1 ? "fotografía" : "fotografías"}`;
    if (!filteredPhotos.length) {
        const empty = document.createElement("p");
        empty.className = "empty-gallery";
        empty.textContent = query
            ? "No encontramos fotografías con esa búsqueda."
            : "Aún no hay fotografías. ¡Sé la primera persona en compartir una!";
        gallery.append(empty);
        return;
    }

    filteredPhotos.forEach((photo) => {
        if (!photo.imagen) return;
        const id = photoId(photo);
        const card = document.createElement("article");
        card.className = "tarjeta-foto";

        const image = document.createElement("img");
        image.src = photo.imagen;
        image.alt = photo.titulo || "Fotografía de la galería";
        image.loading = "lazy";
        image.tabIndex = 0;
        image.setAttribute("role", "button");
        image.setAttribute("aria-label", `Ver fotografía: ${image.alt}`);
        image.addEventListener("click", () => openPhoto(photo, image));
        image.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openPhoto(photo, image);
            }
        });

        const overlay = document.createElement("div");
        overlay.className = "photo-overlay";
        const title = document.createElement("h2");
        title.className = "tarjeta-titulo";
        title.textContent = photo.titulo || "Fotografía sin título";
        const hashtags = document.createElement("p");
        hashtags.className = "photo-hashtags";
        hashtags.textContent = photo.hashtags
            ? `#${photo.hashtags.replaceAll(",", " #")}`
            : "";
        overlay.append(title, hashtags);

        const isLiked = likes.has(id);
        const likeButton = document.createElement("button");
        likeButton.type = "button";
        likeButton.className = "photo-like-button";
        likeButton.setAttribute("aria-label", isLiked ? "Quitar de mis likes" : "Me gusta");
        likeButton.setAttribute("aria-pressed", String(isLiked));
        likeButton.title = isLiked ? "Quitar de mis likes" : "Me gusta";
        likeButton.disabled = !likesAvailable;
        if (isLiked) likeButton.classList.add("is-active");
        likeButton.dataset.photoId = id;
        const heartIcon = document.createElement("span");
        heartIcon.className = "photo-like-icon";
        heartIcon.setAttribute("aria-hidden", "true");
        heartIcon.textContent = "♥";
        const likeCount = document.createElement("span");
        likeCount.className = "photo-like-count";
        likeCount.dataset.likeCount = "";
        likeCount.textContent = formatLikeCount(likeCounts.get(id) || 0);
        likeButton.append(heartIcon, likeCount);
        likeButton.addEventListener("click", () => setPhotoLike(photo, likes.has(id)));

        card.append(image, overlay, likeButton);
        gallery.append(card);
    });
}

async function loadPhotos(searchText = "") {
    galleryStatus.textContent = "Cargando fotografías…";
    try {
        const response = await fetch("/api/photos", { credentials: "same-origin" });
        if (!response.ok) {
            throw new Error("No se pudo cargar la galería.");
        }
        const result = await response.json();
        if (!Array.isArray(result)) {
            throw new Error("La respuesta de la galería no es válida.");
        }
        photos = result;
        const likesResponse = await fetch("/api/photos/likes", {
            credentials: "same-origin",
        });
        if (!likesResponse.ok) {
            throw new Error("No se pudieron sincronizar los likes.");
        }
        const likesResult = await likesResponse.json();
        if (
            !likesResult ||
            typeof likesResult.conteos !== "object" ||
            !Array.isArray(likesResult.likesUsuario)
        ) {
            throw new Error("La respuesta de likes no es válida.");
        }
        likeCounts.clear();
        Object.entries(likesResult.conteos).forEach(([id, count]) => {
            likeCounts.set(id, Number(count));
        });
        likes.clear();
        likesResult.likesUsuario.forEach((id) => likes.add(String(id)));
        localStorage.setItem("likes", JSON.stringify([...likes]));
        likesAvailable = true;
        renderPhotos(searchText);
        profileSettings.render();
    } catch (error) {
        likesAvailable = false;
        likes.clear();
        likeCounts.clear();
        galleryStatus.textContent = "";
        gallery.replaceChildren();
        const message = document.createElement("p");
        message.className = "empty-gallery error";
        message.textContent = error instanceof Error ? error.message : "Error al cargar las fotografías.";
        gallery.append(message);
    }
}

document.querySelector("#abrir-subida").addEventListener("click", () => {
    uploadMessage.hidden = true;
    uploadMessage.textContent = "";
    uploadDialog.showModal();
    document.querySelector("#titulo").focus();
});

document.querySelector("#cerrar-subida").addEventListener("click", () => uploadDialog.close());
uploadDialog.addEventListener("click", (event) => {
    if (event.target === uploadDialog) uploadDialog.close();
});

uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    uploadMessage.hidden = true;
    uploadButton.disabled = true;
    uploadButton.textContent = "Subiendo…";
    try {
        const response = await fetch("/api/photos", {
            method: "POST",
            credentials: "same-origin",
            body: new FormData(uploadForm),
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.mensaje || "No se pudo subir la foto.");
        }
        uploadForm.reset();
        uploadDialog.close();
        await loadPhotos(searchInput.value);
    } catch (error) {
        uploadMessage.textContent = error instanceof Error
            ? error.message
            : "No se pudo subir la foto. Inténtalo de nuevo.";
        uploadMessage.hidden = false;
    } finally {
        uploadButton.disabled = false;
        uploadButton.textContent = "Subir foto";
    }
});

searchButton.addEventListener("click", () => renderPhotos(searchInput.value));
searchInput.addEventListener("input", () => renderPhotos(searchInput.value));
photoDialog.querySelector("#cerrar-modal").addEventListener("click", () => photoDialog.close());
photoDialog.addEventListener("click", (event) => {
    if (event.target === photoDialog) photoDialog.close();
});
photoDialog.addEventListener("close", () => openerElement?.focus());
photoDialogLike.addEventListener("click", () => {
    const photo = photos.find((item) => photoId(item) === activePhotoId);
    if (photo && likesAvailable) setPhotoLike(photo, likes.has(activePhotoId));
});

authController = await initializeAuth(async (user) => {
    currentUser = user;
    document.querySelector("#avatar-iniciales").textContent = initials(user.nombre);
    await loadPhotos();
    profileSettings.render();
});

function initials(name = "") {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "GM";
}
