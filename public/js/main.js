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
const photoDialogSave = document.querySelector("#modal-save");
const photoDialogSaveText = document.querySelector("#modal-save-text");
const photoDialogDelete = document.querySelector("#modal-delete");
const photoDialogLikeCount = document.querySelector("#modal-like-count");
const likes = new Set(JSON.parse(localStorage.getItem("likes") || "[]"));
const savedPhotos = new Set();
const likeCounts = new Map();
let photos = [];
let profileStats = {
    publicaciones: 0,
    likesDados: 0,
    likesRecibidos: 0,
};
let activePhotoId = null;
let openerElement = null;
let currentUser = null;
let likesAvailable = false;
let authController = null;
const deletingPhotoIds = new Set();

initializeTheme();

const profileSettings = initializeProfileSettings({
    getUser: () => currentUser,
    getPhotos: () => photos,
    likes,
    getStats: () => profileStats,
    onPhotoSelect: (photo) => openPhoto(photo),
    onUserUpdate: async (user) => {
        currentUser = user;
        renderHeaderAvatar(user);
    },
    onPrivacyChange: async () => loadPhotos(searchInput.value),
    onLogout: async () => authController.logout(),
    onLogoutComplete: () => {
        currentUser = null;
        photos = [];
        likes.clear();
        localStorage.removeItem("likes");
        savedPhotos.clear();
        likeCounts.clear();
        likesAvailable = false;
        gallery.replaceChildren();
        galleryStatus.textContent = "";
        profileStats = {
            publicaciones: 0,
            likesDados: 0,
            likesRecibidos: 0,
        };
        renderHeaderAvatar(null);
    },
});

function photoId(photo) {
    return String(photo._id ?? photo.imagen);
}

async function deletePhoto(photo) {
    // Comprobar que la fotografía pertenece al usuario conectado.
    if (
        !currentUser?.id ||
        !photo.usuarioId ||
        String(photo.usuarioId) !== String(currentUser.id)
    ) {
        return;
    }

    // Pedir confirmación antes de eliminar.
    const id = photoId(photo);
    if (deletingPhotoIds.has(id)) return;

    const confirmed = window.confirm(
        "¿Seguro que quieres eliminar esta fotografía?",
    );

    if (!confirmed) return;

    deletingPhotoIds.add(id);
    photoDialogDelete.disabled = true;
    try {
        const response = await fetch(
            `/api/photos/${encodeURIComponent(photoId(photo))}`,
            {
                method: "DELETE",
                credentials: "same-origin",
            },
        );

        const result = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(
                result?.mensaje || "No se pudo eliminar la fotografía.",
            );
        }
        if (!result) {
            throw new Error("El servidor devolvió una respuesta no válida.");
        }

        // Actualizar la galería después de eliminarla.
        const removedLikeCount = likeCounts.get(id) || 0;
        const removedLikedPhoto = likes.has(id);

        photos = photos.filter((item) => photoId(item) !== id);

        likes.delete(id);
        savedPhotos.delete(id);
        likeCounts.delete(id);
        profileStats = {
            publicaciones: Math.max(0, profileStats.publicaciones - 1),
            likesDados: Math.max(
                0,
                profileStats.likesDados - (removedLikedPhoto ? 1 : 0),
            ),
            likesRecibidos: Math.max(
                0,
                profileStats.likesRecibidos - removedLikeCount,
            ),
        };

        localStorage.setItem("likes", JSON.stringify([...likes]));

        renderPhotos(searchInput.value);
        profileSettings.render();
        if (activePhotoId === id) {
            photoDialog.close();
        }
    } catch (error) {
        window.alert(
            error instanceof Error
                ? error.message
                : "Ocurrió un error al eliminar la fotografía.",
        );
    } finally {
        deletingPhotoIds.delete(id);
        if (
            activePhotoId === id &&
            photos.some((item) => photoId(item) === id)
        ) {
            photoDialogDelete.disabled = false;
        }
    }
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
                throw new Error(
                    "El servidor devolvió una respuesta no válida.",
                );
            }
            if (!response.ok) {
                throw new Error(
                    result.mensaje || "No se pudo actualizar el like.",
                );
            }
            if (
                typeof result.count !== "number" ||
                typeof result.isLiked !== "boolean" ||
                !result.estadisticas
            ) {
                throw new Error(
                    "La respuesta de likes no tiene el formato esperado.",
                );
            }

            likeCounts.set(id, result.count);
            if (result.isLiked) likes.add(id);
            else likes.delete(id);
            profileStats = result.estadisticas;
            localStorage.setItem("likes", JSON.stringify([...likes]));
            updatePhotoLikeControls(id, result);
            profileSettings.render();
        })
        .catch((error) => {
            galleryStatus.textContent =
                error instanceof Error
                    ? error.message
                    : "No se pudo actualizar el like.";
        })
        .finally(() => {
            if (button?.isConnected) button.disabled = !likesAvailable;
            if (activePhotoId === id)
                photoDialogLike.disabled = !likesAvailable;
        });
}

function setPhotoSaved(photo, isSaved) {
    const id = photoId(photo);
    if (!currentUser) {
        galleryStatus.textContent = "Inicia sesión para guardar fotografías.";
        return;
    }

    if (photoDialogSave.disabled) return;

    photoDialogSave.disabled = true;

    fetch(`/api/photos/${encodeURIComponent(id)}/save`, {
        method: isSaved ? "DELETE" : "POST",
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
                throw new Error(result?.mensaje || "No se pudo guardar la fotografía.");
            }

            if (typeof result.isSaved !== "boolean") {
                throw new Error("La respuesta de guardado no tiene el formato esperado.");
            }

            if (result.isSaved) savedPhotos.add(id);
            else savedPhotos.delete(id);

            updatePhotoSaveState(id, result.isSaved);
            galleryStatus.textContent = result.isSaved
                ? "Fotografía guardada."
                : "Guardado eliminado.";
        })
        .catch((error) => {
            galleryStatus.textContent =
                error instanceof Error
                    ? error.message
                    : "No se pudo actualizar el guardado.";
        })
        .finally(() => {
            if (photoDialogSave?.isConnected) {
                photoDialogSave.disabled = !currentUser;
            }
        });
}

function updatePhotoSaveState(id, isSaved = savedPhotos.has(id)) {
    if (!photoDialogSave) return;
    const saved = Boolean(isSaved);
    photoDialogSave.classList.toggle("is-saved", saved);
    photoDialogSave.setAttribute("aria-pressed", String(saved));
    photoDialogSave.setAttribute(
        "aria-label",
        saved ? "Quitar de mis guardados" : "Guardar fotografía",
    );
    photoDialogSave.title = saved ? "Quitar de mis guardados" : "Guardar fotografía";
    if (photoDialogSaveText) {
        photoDialogSaveText.textContent = saved ? "Guardada" : "Guardar";
    }
}

function updatePhotoLikeControls(id, result) {
    document
        .querySelectorAll(".photo-like-button[data-photo-id]")
        .forEach((button) => {
            if (button.dataset.photoId !== id) return;
            button.setAttribute("aria-pressed", String(result.isLiked));
            button.setAttribute(
                "aria-label",
                result.isLiked ? "Quitar de mis likes" : "Me gusta",
            );
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
    photoDialogLike.setAttribute(
        "aria-label",
        isLiked ? "Quitar de mis likes" : "Me gusta",
    );
    photoDialogLikeCount.textContent = formatLikeCount(
        likeCounts.get(activePhotoId) || 0,
    );

    updatePhotoSaveState(activePhotoId, savedPhotos.has(activePhotoId));
    if (photoDialogSave) {
        photoDialogSave.disabled = !currentUser;
    }
    const isOwner =
        currentUser?.id &&
        photo.usuarioId &&
        String(photo.usuarioId) === String(currentUser.id);
    photoDialogDelete.hidden = !isOwner;
    photoDialogDelete.setAttribute(
        "aria-label",
        `Eliminar fotografía: ${photo.titulo || "Sin título"}`,
    );
    photoDialogDelete.disabled = deletingPhotoIds.has(activePhotoId);
    photoDialog.showModal();
}

function renderPhotos(searchText = "") {
    gallery.replaceChildren();
    const query = searchText.trim().toLocaleLowerCase();
    const filteredPhotos = photos.filter((photo) => {
        const searchable =
            `${photo.titulo || ""} ${photo.hashtags || ""}`.toLocaleLowerCase();
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
        likeButton.setAttribute(
            "aria-label",
            isLiked ? "Quitar de mis likes" : "Me gusta",
        );
        likeButton.setAttribute("aria-pressed", String(isLiked));
        likeButton.title = isLiked ? "Quitar de mis likes" : "Me gusta";
        likeButton.disabled = !likesAvailable;
        if (isLiked) likeButton.classList.add("is-active");
        likeButton.dataset.photoId = id;
        const heartIcon = document.createElement("span");
        heartIcon.className = "photo-like-icon";
        heartIcon.setAttribute("aria-hidden", "true");
        heartIcon.append(createIcon("heart"));
        const likeCount = document.createElement("span");
        likeCount.className = "photo-like-count";
        likeCount.dataset.likeCount = "";
        likeCount.textContent = formatLikeCount(likeCounts.get(id) || 0);
        likeButton.append(heartIcon, likeCount);
        likeButton.addEventListener("click", () =>
            setPhotoLike(photo, likes.has(id)),
        );

        card.append(image, overlay, likeButton);
        gallery.append(card);
    });
}

async function loadPhotos(searchText = "") {
    galleryStatus.textContent = "Cargando fotografías…";
    try {
        const response = await fetch("/api/photos", {
            credentials: "same-origin",
        });
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
        profileStats = likesResult.estadisticas;
        localStorage.setItem("likes", JSON.stringify([...likes]));

        const savedResponse = await fetch("/api/photos/saved", {
            credentials: "same-origin",
        });
        if (savedResponse.status === 401) {
            savedPhotos.clear();
        } else if (!savedResponse.ok) {
            throw new Error("No se pudieron sincronizar los guardados.");
        } else {
            const savedResult = await savedResponse.json();
            if (!savedResult || !Array.isArray(savedResult.saved)) {
                throw new Error("La respuesta de guardados no es válida.");
            }
            savedPhotos.clear();
            savedResult.saved.forEach((id) => savedPhotos.add(String(id)));
        }

        likesAvailable = true;
        if (activePhotoId) {
            updatePhotoSaveState(activePhotoId, savedPhotos.has(activePhotoId));
        }
        renderPhotos(searchText);
        profileSettings.render();
    } catch (error) {
        likesAvailable = false;
        likes.clear();
        savedPhotos.clear();
        likeCounts.clear();
        galleryStatus.textContent = "";
        gallery.replaceChildren();
        const message = document.createElement("p");
        message.className = "empty-gallery error";
        message.textContent =
            error instanceof Error
                ? error.message
                : "Error al cargar las fotografías.";
        gallery.append(message);
    }
}

document.querySelector("#abrir-subida").addEventListener("click", () => {
    uploadMessage.hidden = true;
    uploadMessage.textContent = "";
    uploadDialog.showModal();
    document.querySelector("#titulo").focus();
});

document
    .querySelector("#cerrar-subida")
    .addEventListener("click", () => uploadDialog.close());
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
        uploadMessage.textContent =
            error instanceof Error
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
photoDialog
    .querySelector("#cerrar-modal")
    .addEventListener("click", () => photoDialog.close());
photoDialog.addEventListener("click", (event) => {
    if (event.target === photoDialog) photoDialog.close();
});
photoDialog.addEventListener("close", () => {
    if (openerElement?.isConnected) {
        openerElement.focus();
    } else {
        searchInput.focus();
    }
});
photoDialogLike.addEventListener("click", () => {
    const photo = photos.find((item) => photoId(item) === activePhotoId);
    if (photo && likesAvailable) setPhotoLike(photo, likes.has(activePhotoId));
});
photoDialogSave.addEventListener("click", () => {
    const photo = photos.find((item) => photoId(item) === activePhotoId);
    if (photo && currentUser) {
        setPhotoSaved(photo, savedPhotos.has(activePhotoId));
    }
});
photoDialogDelete.addEventListener("click", (event) => {
    event.stopPropagation();
    const photo = photos.find((item) => photoId(item) === activePhotoId);
    if (photo) deletePhoto(photo);
});

authController = await initializeAuth(async (user) => {
    currentUser = user;
    renderHeaderAvatar(user);
    await loadPhotos();
    profileSettings.render();
});

function renderHeaderAvatar(user) {
    const button = document.querySelector("#abrir-perfil");
    const initialsElement = document.querySelector("#avatar-iniciales");
    button.replaceChildren();

    if (user?.avatar) {
        const image = document.createElement("img");
        image.className = "avatar-image";
        image.src = user.avatar;
        image.alt = "";
        image.addEventListener("error", () => {
            const fallback = document.createElement("span");
            fallback.id = "avatar-iniciales";
            fallback.textContent = initials(user.nombre);
            button.replaceChildren(fallback);
        }, { once: true });
        button.append(image);
    } else {
        initialsElement.textContent = initials(user?.nombre);
        button.append(initialsElement);
    }
    button.setAttribute(
        "aria-label",
        user ? `Abrir perfil de ${user.nombre}` : "Abrir mi perfil",
    );
}

function createIcon(name) {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    icon.classList.add("icon");
    icon.setAttribute("aria-hidden", "true");
    use.setAttribute("href", `#icon-${name}`);
    icon.append(use);
    return icon;
}

function initials(name = "") {
    return (
        name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase() || "GM"
    );
}
