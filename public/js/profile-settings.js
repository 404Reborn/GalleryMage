const profileDialog = document.querySelector("#profile-dialog");
const settingsDialog = document.querySelector("#settings-dialog");
const profileContent = document.querySelector("#profile-content");
const profileName = document.querySelector("#profile-name");
const profileEmail = document.querySelector("#profile-email");
const profileAvatar = document.querySelector("#profile-avatar");
const profileTabs = [...document.querySelectorAll("[data-profile-tab]")];
const settingsTabs = [...document.querySelectorAll("[data-settings-tab]")];
const settingsPanels = [
    ...document.querySelectorAll(
        "[data-settings-panel], .settings-section[role='tabpanel']",
    ),
];

export function initializeProfileSettings({
    getUser,
    getPhotos,
    likes,
    getStats,
    onPhotoSelect,
    onLogout,
    onLogoutComplete,
    onUserUpdate,
    onPrivacyChange,
}) {
    let selectedTab = "posts";
    let previewUrl = null;
    let cropImage = null;
    let cropZoom = 1;
    let cropOffsetX = 0;
    let cropOffsetY = 0;
    let dragState = null;
    let avatarSaving = false;

    document
        .querySelector("#abrir-perfil")
        .addEventListener("click", () => openProfile());

    document
        .querySelector("#abrir-ajustes")
        .addEventListener("click", () => openSettings());

    const logoutButton = document.querySelector("#logout-button");
    const logoutStatus = document.querySelector("#logout-status");

    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        logoutButton.textContent = "Cerrando sesión…";
        logoutStatus.textContent = "";

        try {
            await onLogout();
            selectSettingsTab("settings-account");
            settingsDialog.close();
            settingsDialog.classList.remove("open", "is-open", "visible");
            settingsDialog.hidden = true;
            await onLogoutComplete();
            logoutStatus.textContent =
                "Cerrarás tu sesión actual de GalleryMage.";
        } catch (error) {
            logoutStatus.textContent =
                error instanceof Error
                    ? error.message
                    : "No se pudo cerrar la sesión.";
        } finally {
            logoutButton.disabled = false;
            logoutButton.textContent = "Cerrar sesión";
        }
    });

    document.querySelectorAll("[data-close-dialog]").forEach((button) => {
        button.addEventListener("click", () => {
            button.closest("dialog").close();
        });
    });

    [profileDialog, settingsDialog].forEach((dialog) => {
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) {
                dialog.close();
            }
        });
    });

    profileTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            selectedTab = tab.dataset.profileTab;
            render();
        });
    });

    settingsTabs.forEach((tab) => {
        tab.addEventListener("click", () =>
            selectSettingsTab(tab.dataset.settingsTab),
        );
        tab.addEventListener("keydown", (event) => {
            const currentIndex = settingsTabs.indexOf(tab);
            let nextIndex = currentIndex;

            if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                nextIndex = (currentIndex + 1) % settingsTabs.length;
            } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                nextIndex =
                    (currentIndex - 1 + settingsTabs.length) %
                    settingsTabs.length;
            } else if (event.key === "Home") {
                nextIndex = 0;
            } else if (event.key === "End") {
                nextIndex = settingsTabs.length - 1;
            } else {
                return;
            }

            event.preventDefault();
            const nextTab = settingsTabs[nextIndex];
            nextTab.focus();
            selectSettingsTab(nextTab.dataset.settingsTab);
        });
    });

    document.querySelectorAll("[data-open-profile]").forEach((button) => {
        button.addEventListener("click", () => {
            selectedTab = button.dataset.profileTab || "posts";
            settingsDialog.close();
            openProfile();
        });
    });

    function openProfile() {
        const user = getUser();

        if (!user) {
            return;
        }

        if (!avatarSaving) avatarStatus.hidden = true;
        profileName.textContent = user.nombre || "Usuario de GalleryMage";

        profileEmail.textContent = user.email || "";

        const initials = (user.nombre || "GM")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase();

        profileAvatar.textContent = initials || "GM";
        renderAvatar(user);
        document.querySelector("#profile-name-input").value = user.nombre || "";
        document.querySelector("#profile-email-input").value = user.email || "";
        const passwordFields = document.querySelector("#password-edit-fields");
        passwordFields.hidden = user.authProvider === "google";
        if (user.authProvider === "google") {
            document.querySelector("#profile-edit-message").textContent =
                "La contraseña de esta cuenta se gestiona mediante Google.";
            document.querySelector("#profile-edit-message").hidden = false;
        } else {
            document.querySelector("#profile-edit-message").hidden = true;
        }

        render();

        profileDialog.showModal();
    }

    function openSettings() {
        const user = getUser();
        if (user) {
            document.querySelector("#privacy-profile-public").checked =
                user.profilePublic !== false;
            document.querySelector("#privacy-show-email").checked =
                user.showEmail === true;
        }
        selectSettingsTab("settings-account");
        settingsDialog.hidden = false;
        settingsDialog.showModal();
        loadAppInfo();
    }

    function selectSettingsTab(panelId) {
        settingsTabs.forEach((tab) => {
            const active = tab.dataset.settingsTab === panelId;
            tab.classList.toggle("active", active);
            tab.setAttribute("aria-selected", String(active));
            tab.tabIndex = active ? 0 : -1;
        });
        settingsPanels.forEach((panel) => {
            panel.hidden = panel.id !== panelId;
        });
    }

    async function loadAppInfo() {
        const version = document.querySelector("#app-version");
        try {
            const response = await fetch("/api/app-info", {
                credentials: "same-origin",
            });
            if (!response.ok) {
                throw new Error("No se pudo cargar la versión de GalleryMage.");
            }
            const result = await response.json();
            version.textContent = result.version;
        } catch (error) {
            version.textContent = "No disponible";
            version.title =
                error instanceof Error
                    ? error.message
                    : "No se pudo consultar la versión.";
        }
    }

    function renderAvatar(user) {
        profileAvatar.replaceChildren();
        if (user.avatar) {
            const image = document.createElement("img");
            image.src = user.avatar;
            image.alt = "";
            profileAvatar.append(image);
        } else {
            profileAvatar.textContent =
                (user.nombre || "GM")
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase() || "GM";
        }
    }

    document
        .querySelector("#profile-edit-form")
        .addEventListener("submit", async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const saveButton = document.querySelector("#profile-save");
            const status = document.querySelector("#profile-edit-message");
            const newPassword =
                document.querySelector("#profile-new-password").value;
            const currentPassword = document.querySelector(
                "#profile-current-password",
            ).value;
            status.hidden = true;

            if (newPassword && !currentPassword) {
                status.textContent =
                    "Introduce tu contraseña actual para cambiarla.";
                status.hidden = false;
                return;
            }

            saveButton.disabled = true;
            saveButton.textContent = "Guardando…";
            try {
                const response = await fetch("/api/usuarios/perfil", {
                    method: "PATCH",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        nombre: document.querySelector("#profile-name-input").value,
                        email: document.querySelector("#profile-email-input").value,
                        currentPassword,
                        newPassword,
                    }),
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.mensaje || "No se pudieron guardar los cambios.");
                }
                await onUserUpdate(result.usuario);
                profileName.textContent = result.usuario.nombre;
                profileEmail.textContent = result.usuario.email;
                renderAvatar(result.usuario);
                document.querySelector("#profile-current-password").value = "";
                document.querySelector("#profile-new-password").value = "";
                status.textContent = result.mensaje;
                status.hidden = false;
            } catch (error) {
                status.textContent =
                    error instanceof Error
                        ? error.message
                        : "No se pudieron guardar los cambios.";
                status.hidden = false;
            } finally {
                saveButton.disabled = false;
                saveButton.replaceChildren(
                    createIcon("edit"),
                    document.createTextNode("Guardar cambios"),
                );
            }
        });

    const avatarForm = document.querySelector("#profile-avatar-form");
    const avatarInput = document.querySelector("#profile-avatar-file");
    const cropEditor = document.querySelector("#profile-avatar-crop-editor");
    const cropWindow = document.querySelector("#profile-avatar-crop-window");
    const cropPreview = document.querySelector("#profile-avatar-preview");
    const cropZoomInput = document.querySelector("#profile-avatar-zoom");
    const avatarSaveButton = document.querySelector("#profile-avatar-save");
    const avatarStatus = document.querySelector("#profile-avatar-message");
    const avatarEditButton = document.querySelector("#profile-avatar-edit");
    const cropResetButton = document.querySelector("#profile-avatar-reset");
    const cropCancelButton = document.querySelector("#profile-avatar-cancel");
    const cropSize = 512;

    avatarEditButton.addEventListener("click", () => {
        if (!avatarSaving) {
            avatarStatus.hidden = true;
            avatarInput.click();
        }
    });

    profileDialog.addEventListener("close", () => {
        if (avatarSaving) return;
        avatarForm.reset();
        clearAvatarPreview();
        avatarStatus.hidden = true;
    });

    avatarInput.addEventListener("change", async () => {
        const file = avatarInput.files[0];
        clearAvatarPreview();
        avatarStatus.hidden = true;
        if (!file) return;

        previewUrl = URL.createObjectURL(file);
        cropPreview.src = previewUrl;
        try {
            await cropPreview.decode();
            cropImage = cropPreview;
            cropZoom = 1;
            cropOffsetX = 0;
            cropOffsetY = 0;
            cropZoomInput.value = "1";
            cropEditor.hidden = false;
            updateCropPreview();
            cropWindow.focus();
        } catch {
            clearAvatarPreview();
            showAvatarMessage(
                "No se pudo abrir esta imagen. Prueba con un archivo JPEG, PNG, GIF o WebP válido.",
                "error",
            );
        }
    });

    cropZoomInput.addEventListener("input", () => {
        cropZoom = Number(cropZoomInput.value);
        updateCropPreview();
    });

    cropResetButton.addEventListener("click", () => {
        cropZoom = 1;
        cropOffsetX = 0;
        cropOffsetY = 0;
        cropZoomInput.value = "1";
        updateCropPreview();
    });

    cropCancelButton.addEventListener("click", () => {
        if (avatarSaving) return;
        avatarForm.reset();
        clearAvatarPreview();
        avatarStatus.hidden = true;
    });

    cropWindow.addEventListener("pointerdown", (event) => {
        if (!cropImage || avatarSaving || event.button !== 0) return;
        dragState = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            offsetX: cropOffsetX,
            offsetY: cropOffsetY,
        };
        cropWindow.setPointerCapture(event.pointerId);
    });

    cropWindow.addEventListener("pointermove", (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) return;
        cropOffsetX = dragState.offsetX + event.clientX - dragState.x;
        cropOffsetY = dragState.offsetY + event.clientY - dragState.y;
        updateCropPreview();
    });

    cropWindow.addEventListener("pointerup", (event) => {
        if (dragState?.pointerId === event.pointerId) dragState = null;
    });
    cropWindow.addEventListener("pointercancel", () => {
        dragState = null;
    });
    window.addEventListener("resize", updateCropPreview);

    cropWindow.addEventListener("keydown", (event) => {
        const step = event.shiftKey ? 10 : 2;
        if (event.key === "ArrowLeft") cropOffsetX -= step;
        else if (event.key === "ArrowRight") cropOffsetX += step;
        else if (event.key === "ArrowUp") cropOffsetY -= step;
        else if (event.key === "ArrowDown") cropOffsetY += step;
        else return;
        event.preventDefault();
        updateCropPreview();
    });

    avatarForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (avatarSaving || !cropImage) return;
        avatarSaving = true;
        avatarSaveButton.disabled = true;
        avatarInput.disabled = true;
        avatarEditButton.disabled = true;
        cropResetButton.disabled = true;
        cropCancelButton.disabled = true;
        cropZoomInput.disabled = true;
        showAvatarMessage("Guardando la fotografía de perfil…", "info");

        try {
            const croppedFile = await createCroppedAvatar();
            const formData = new FormData();
            formData.append("avatar", croppedFile);
            const response = await fetch("/api/usuarios/perfil/avatar", {
                method: "POST",
                credentials: "same-origin",
                body: formData,
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(
                    result.mensaje || "No se pudo actualizar la fotografía.",
                );
            }
            await onUserUpdate(result.usuario);
            renderAvatar(result.usuario);
            avatarForm.reset();
            clearAvatarPreview();
            showAvatarMessage(
                result.mensaje || "Fotografía de perfil actualizada.",
                "success",
            );
        } catch (error) {
            showAvatarMessage(
                error instanceof Error
                    ? error.message
                    : "No se pudo actualizar la fotografía.",
                "error",
            );
        } finally {
            avatarSaving = false;
            avatarSaveButton.disabled = false;
            avatarInput.disabled = false;
            avatarEditButton.disabled = false;
            cropResetButton.disabled = false;
            cropCancelButton.disabled = false;
            cropZoomInput.disabled = false;
            avatarSaveButton.textContent = "Guardar encuadre";
        }
    });

    function updateCropPreview() {
        if (!cropImage) return;
        const size = cropWindow.clientWidth;
        if (!size) return;
        const baseScale = Math.max(
            size / cropImage.naturalWidth,
            size / cropImage.naturalHeight,
        );
        const width = cropImage.naturalWidth * baseScale * cropZoom;
        const height = cropImage.naturalHeight * baseScale * cropZoom;
        cropOffsetX = clamp(cropOffsetX, -(width - size) / 2, (width - size) / 2);
        cropOffsetY = clamp(cropOffsetY, -(height - size) / 2, (height - size) / 2);
        cropPreview.style.width = `${width}px`;
        cropPreview.style.height = `${height}px`;
        cropPreview.style.left = `${(size - width) / 2 + cropOffsetX}px`;
        cropPreview.style.top = `${(size - height) / 2 + cropOffsetY}px`;
    }

    async function createCroppedAvatar() {
        const size = cropWindow.clientWidth;
        const scale = cropSize / size;
        const baseScale = Math.max(
            size / cropImage.naturalWidth,
            size / cropImage.naturalHeight,
        );
        const width = cropImage.naturalWidth * baseScale * cropZoom;
        const height = cropImage.naturalHeight * baseScale * cropZoom;
        const x = ((size - width) / 2 + cropOffsetX) * scale;
        const y = ((size - height) / 2 + cropOffsetY) * scale;
        const canvas = document.createElement("canvas");
        canvas.width = cropSize;
        canvas.height = cropSize;
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("No se pudo preparar el encuadre de la fotografía.");
        }
        context.drawImage(
            cropImage,
            x,
            y,
            width * scale,
            height * scale,
        );
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(
                (result) =>
                    result
                        ? resolve(result)
                        : reject(
                              new Error(
                                  "No se pudo procesar la fotografía seleccionada.",
                              ),
                          ),
                "image/png",
            );
        });
        return new File([blob], "profile-avatar.png", {
            type: "image/png",
            lastModified: Date.now(),
        });
    }

    function clearAvatarPreview() {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        cropImage = null;
        dragState = null;
        cropEditor.hidden = true;
        cropPreview.removeAttribute("src");
        cropPreview.removeAttribute("style");
    }

    function showAvatarMessage(message, type) {
        avatarStatus.textContent = message;
        avatarStatus.dataset.type = type;
        avatarStatus.hidden = false;
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    const profilePublic = document.querySelector("#privacy-profile-public");
    const showEmail = document.querySelector("#privacy-show-email");
    let privacySaving = false;
    [profilePublic, showEmail].forEach((control) => {
        control.addEventListener("change", async () => {
            if (privacySaving) return;
            privacySaving = true;
            const user = getUser();
            const status = document.querySelector("#privacy-message");
            status.hidden = true;
            profilePublic.disabled = true;
            showEmail.disabled = true;
            try {
                const response = await fetch("/api/usuarios/perfil", {
                    method: "PATCH",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        profilePublic: profilePublic.checked,
                        showEmail: showEmail.checked,
                    }),
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.mensaje || "No se pudo guardar la privacidad.");
                }
                await onUserUpdate(result.usuario);
                await onPrivacyChange();
                status.textContent = result.mensaje;
                status.hidden = false;
            } catch (error) {
                profilePublic.checked = user.profilePublic !== false;
                showEmail.checked = user.showEmail === true;
                status.textContent =
                    error instanceof Error
                        ? error.message
                        : "No se pudo guardar la privacidad.";
                status.hidden = false;
            } finally {
                privacySaving = false;
                profilePublic.disabled = false;
                showEmail.disabled = false;
            }
        });
    });

    function render() {
        profileTabs.forEach((tab) => {
            const active = tab.dataset.profileTab === selectedTab;

            tab.classList.toggle("active", active);

            tab.setAttribute("aria-selected", String(active));
        });

        profileContent.replaceChildren();

        const user = getUser();

        if (!user) {
            const message = document.createElement("p");

            message.className = "feature-note";

            message.textContent = "Debes iniciar sesión para ver tu perfil.";

            profileContent.append(message);

            return;
        }

        const stats = getStats();
        document.querySelector("#profile-photo-count").textContent =
            formatCount(stats.publicaciones);
        document.querySelector("#profile-like-count").textContent =
            formatCount(stats.likesRecibidos);
        document.querySelector("#profile-likes-given").textContent =
            formatCount(stats.likesDados);

        if (selectedTab === "posts") {
            renderUserPosts(user);
            return;
        }

        renderLikedPhotos();
    }

    function renderUserPosts(user) {
        const userPhotos = getPhotos().filter((photo) => {
            return String(photo.usuarioId) === String(user.id);
        });

        if (!userPhotos.length) {
            const empty = document.createElement("p");

            empty.className = "feature-note";

            empty.textContent = "Todavía no has publicado ninguna fotografía.";

            profileContent.append(empty);

            return;
        }

        const list = document.createElement("div");

        list.className = "profile-photo-grid";

        userPhotos.forEach((photo) => {
            const item = document.createElement("button");

            item.type = "button";
            item.className = "profile-photo";

            item.setAttribute(
                "aria-label",
                `Abrir ${photo.titulo || "fotografía"}`,
            );

            const image = document.createElement("img");

            image.src = photo.imagen;
            image.alt = photo.titulo || "Fotografía publicada";
            image.loading = "lazy";

            item.append(image);

            item.addEventListener("click", () => {
                onPhotoSelect(photo);
            });

            list.append(item);
        });

        profileContent.append(list);
    }

    function renderLikedPhotos() {
        const likedPhotos = getPhotos().filter((photo) =>
            likes.has(String(photo._id ?? photo.imagen)),
        );

        if (!likedPhotos.length) {
            const empty = document.createElement("p");

            empty.className = "feature-note";

            empty.textContent =
                "Todavía no tienes fotografías marcadas con Me gusta.";

            profileContent.append(empty);

            return;
        }

        const list = document.createElement("div");

        list.className = "profile-photo-grid";

        likedPhotos.forEach((photo) => {
            const item = document.createElement("button");

            item.type = "button";
            item.className = "profile-photo";

            item.setAttribute(
                "aria-label",
                `Abrir ${photo.titulo || "fotografía"}`,
            );

            const image = document.createElement("img");

            image.src = photo.imagen;
            image.alt = photo.titulo || "Fotografía que te gusta";
            image.loading = "lazy";

            item.append(image);

            item.addEventListener("click", () => {
                onPhotoSelect(photo);
            });

            list.append(item);
        });

        profileContent.append(list);
    }

    return {
        render,
    };
}

function formatCount(count) {
    return Number.isFinite(count) ? new Intl.NumberFormat("es").format(count) : "—";
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
