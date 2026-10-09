const googleButton = document.querySelector("#google-login");
const authScreen = document.querySelector("#auth-screen");
const appShell = document.querySelector("#app-shell");
const form = document.querySelector("#auth-form");
const nameInput = document.querySelector("#auth-name");
const nameLabel = document.querySelector("#auth-name-label");
const emailInput = document.querySelector("#auth-email");
const passwordInput = document.querySelector("#auth-password");
const confirmInput = document.querySelector("#auth-confirm");
const confirmLabel = document.querySelector("#auth-confirm-label");
const heading = document.querySelector("#auth-heading");
const description = document.querySelector("#auth-description");
const submitButton = document.querySelector("#auth-submit");
const switchButton = document.querySelector("#auth-switch");
const switchCopy = document.querySelector("#auth-switch-copy");
const message = document.querySelector("#auth-message");
const forgotLink = document.querySelector("#forgot-password");

googleButton.addEventListener("click", () => {
    window.location.href = "/auth/google";
});
const connectedUser = document.querySelector("#profile-name");
let isRegisterMode = false;

export async function initializeAuth(onAuthenticated) {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessage();
        if (!form.reportValidity()) return;
        if (isRegisterMode && passwordInput.value !== confirmInput.value) {
            showMessage("Las contraseñas no coinciden.", "error");
            confirmInput.focus();
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = isRegisterMode
            ? "Creando cuenta…"
            : "Iniciando sesión…";
        try {
            const payload = {
                email: emailInput.value.trim(),
                password: passwordInput.value,
            };

            if (isRegisterMode) {
                payload.nombre = nameInput.value.trim();
                const registration = await postJson(
                    "/api/usuarios/registro",
                    payload,
                );
                if (!registration.response.ok) {
                    throw new Error(
                        registration.result.mensaje ||
                            "No se pudo crear la cuenta.",
                    );
                }
                payload.email = emailInput.value.trim();
            }

            const login = await postJson("/api/usuarios/login", {
                email: payload.email,
                password: payload.password,
            });
            if (!login.response.ok) {
                throw new Error(
                    login.result.mensaje || "No se pudo iniciar sesión.",
                );
            }
            const user = login.result.usuario;
            if (
                !user ||
                typeof user.nombre !== "string" ||
                typeof user.email !== "string"
            ) {
                throw new Error(
                    "El servidor no devolvió los datos de sesión esperados.",
                );
            }
            form.reset();
            showApplication(user);
            onAuthenticated(user);
        } catch (error) {
            showMessage(
                error instanceof Error
                    ? error.message
                    : "No se pudo completar la autenticación.",
                "error",
            );
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = isRegisterMode
                ? "Crear cuenta"
                : "Iniciar sesión";
        }
    });

    switchButton.addEventListener("click", () =>
        setRegisterMode(!isRegisterMode),
    );
    forgotLink.addEventListener("click", (event) => {
        event.preventDefault();
        showMessage(
            "La recuperación de contraseña estará disponible cuando exista una ruta de recuperación en el backend.",
            "info",
        );
    });

    setRegisterMode(false);

    try {
        const response = await fetch("/api/sesion", {
            credentials: "same-origin",
        });
        if (response.ok) {
            const result = await response.json();
            if (result.usuario) {
                showApplication(result.usuario);
                await onAuthenticated(result.usuario);
                return { logout };
            }
        } else if (response.status !== 401) {
            showMessage(
                "No se pudo validar la sesión actual. Puedes iniciar sesión.",
                "error",
            );
        }
    } catch {
        showMessage(
            "No se pudo conectar con el servidor. Intenta iniciar sesión de nuevo.",
            "error",
        );
    }

    authScreen.hidden = false;
    appShell.hidden = true;
    return { logout };

    async function logout() {
        let response;
        try {
            response = await fetch("/api/usuarios/logout", {
                method: "POST",
                credentials: "same-origin",
            });
        } catch {
            throw new Error(
                "No se pudo conectar con el servidor para cerrar sesión.",
            );
        }

        let result;
        try {
            result = await response.json();
        } catch {
            throw new Error("El servidor devolvió una respuesta no válida.");
        }
        if (!response.ok) {
            throw new Error(result.mensaje || "No se pudo cerrar la sesión.");
        }

        form.reset();
        clearMessage();
        appShell.hidden = true;
        authScreen.hidden = false;
        setRegisterMode(false);
    }
}

async function postJson(url, payload) {
    let response;
    try {
        response = await fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    } catch {
        throw new Error(
            "No se pudo conectar con el servidor. Inténtalo de nuevo.",
        );
    }

    let result;
    try {
        result = await response.json();
    } catch {
        throw new Error("El servidor devolvió una respuesta no válida.");
    }
    return { response, result };
}

function setRegisterMode(register) {
    isRegisterMode = register;
    nameInput.hidden = !register;
    nameLabel.hidden = !register;
    nameInput.required = register;
    confirmInput.hidden = !register;
    confirmLabel.hidden = !register;
    confirmInput.required = register;
    document.querySelector(".auth-forgot").hidden = register;
    document
        .querySelector(".auth-art")
        .classList.toggle("register-mode", register);
    heading.textContent = register ? "Crea tu cuenta" : "Inicia sesión";
    description.textContent = register
        ? "Únete a una comunidad que ve el mundo a través de imágenes."
        : "Descubre, comparte y guarda fotografías que te inspiran.";
    submitButton.textContent = register ? "Crear cuenta" : "Iniciar sesión";
    switchCopy.textContent = register
        ? "¿Ya tienes cuenta?"
        : "¿No tienes cuenta?";
    switchButton.textContent = register ? "Iniciar sesión" : "Crear cuenta";
    passwordInput.autocomplete = register ? "new-password" : "current-password";
    clearMessage();
}

function showApplication(user) {
    authScreen.hidden = true;
    appShell.hidden = false;
    connectedUser.textContent = user.nombre;
}

function showMessage(text, type) {
    message.textContent = text;
    message.dataset.type = type;
    message.hidden = false;
}

function clearMessage() {
    message.textContent = "";
    message.hidden = true;
}
