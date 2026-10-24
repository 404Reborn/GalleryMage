export async function enviarFormularioAutenticacion({
    register,
    payload,
    postJson,
}) {
    const url = register
        ? "/api/usuarios/registro"
        : "/api/usuarios/login";
    const requestPayload = register
        ? payload
        : { email: payload.email, password: payload.password };
    const { response, result } = await postJson(url, requestPayload);

    if (!response.ok) {
        const error = new Error(
            result.mensaje ||
                (register
                    ? "No se pudo crear la cuenta."
                    : "No se pudo iniciar sesión."),
        );
        error.status = response.status;
        throw error;
    }

    return result;
}
