const form = document.querySelector("#reset-form");
const password = document.querySelector("#reset-password");
const confirmation = document.querySelector("#reset-password-confirm");
const submit = document.querySelector("#reset-submit");
const message = document.querySelector("#reset-message");
const token = new URLSearchParams(location.search).get("token");

history.replaceState(null, "", location.pathname);
if (!token) {
    form.hidden = true;
    message.textContent = "El enlace no es válido o ha caducado.";
    message.dataset.type = "error";
    message.hidden = false;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;
    if (password.value !== confirmation.value) {
        message.textContent = "Las contraseñas no coinciden.";
        message.dataset.type = "error";
        message.hidden = false;
        confirmation.focus();
        return;
    }

    submit.disabled = true;
    submit.textContent = "Guardando…";
    try {
        const response = await fetch("/api/usuarios/restablecer", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password: password.value }),
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.mensaje || "No se pudo cambiar la contraseña.");
        }
        form.reset();
        message.textContent = result.mensaje;
        message.dataset.type = "success";
        message.hidden = false;
        submit.disabled = true;
    } catch (error) {
        message.textContent =
            error instanceof Error
                ? error.message
                : "No se pudo cambiar la contraseña.";
        message.dataset.type = "error";
        message.hidden = false;
    } finally {
        if (!submit.disabled) {
            submit.textContent = "Cambiar contraseña";
        }
    }
});
