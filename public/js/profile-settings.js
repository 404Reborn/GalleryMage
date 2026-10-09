const profileDialog = document.querySelector("#profile-dialog");
const settingsDialog = document.querySelector("#settings-dialog");
const profileContent = document.querySelector("#profile-content");
const profileName = document.querySelector("#profile-name");
const profileEmail = document.querySelector("#profile-email");
const profileAvatar = document.querySelector("#profile-avatar");
const profileTabs = [...document.querySelectorAll("[data-profile-tab]")];

export function initializeProfileSettings({
    getUser,
    getPhotos,
    likes,
    onPhotoSelect,
    onLogout,
}) {
    let selectedTab = "posts";

    document
        .querySelector("#abrir-perfil")
        .addEventListener("click", () => openProfile());

    document
        .querySelector("#abrir-ajustes")
        .addEventListener("click", () => settingsDialog.showModal());

    const logoutButton = document.querySelector("#logout-button");
    const logoutStatus = document.querySelector("#logout-status");

    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        logoutButton.textContent = "Cerrando sesión…";
        logoutStatus.textContent = "";

        try {
            await onLogout();
            settingsDialog.close();
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

        render();

        profileDialog.showModal();
    }

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
