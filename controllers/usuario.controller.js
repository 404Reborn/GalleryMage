import { createHash, randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import {
    actualizarPasswordUsuario,
    actualizarPerfilUsuario,
    buscarUsuarioPorEmail,
    buscarUsuarioPorTokenRecuperacion,
    comprobarPassword,
    crearUsuario,
    guardarTokenRecuperacion,
    limpiarTokenRecuperacion,
    normalizarEmail,
    contarReferenciasAvatar,
    obtenerUsuarioPorId,
    validarEmail,
    validarNombre,
    validarPassword,
    restablecerPasswordConToken,
} from "../models/usuario.model.js";
import { enviarEmailRecuperacion, emailDisponible } from "../services/email.service.js";
import {
    eliminarImagenSubida,
    guardarImagenSubida,
} from "../services/image-storage.service.js";
import { obtenerEstadisticasUsuario } from "../models/photo.model.js";

const recuperarUrl = "/reset-password.html";

export async function registrarUsuario(req, res) {
    const nombre = req.body?.nombre;
    const email = normalizarEmail(req.body?.email);
    const password = req.body?.password;

    if (!validarNombre(nombre) || !validarEmail(email) || !validarPassword(password)) {
        return res.status(400).json({
            mensaje: "Revisa el nombre, el correo y la contraseña (mínimo 8 caracteres).",
        });
    }

    try {
        const resultado = await crearUsuario(nombre, email, password);
        const usuario = await obtenerUsuarioPorId(resultado.insertedId);
        await iniciarSesion(req, usuario);

        return res.status(201).json({
            mensaje: "Cuenta creada correctamente.",
            usuario: crearDatosSesion(usuario),
        });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({
                mensaje: "Ya existe una cuenta con ese correo electrónico.",
            });
        }
        throw error;
    }
}

export async function iniciarSesionUsuario(req, res) {
    const email = normalizarEmail(req.body?.email);
    const password = req.body?.password;

    if (!validarEmail(email) || typeof password !== "string") {
        return res.status(400).json({ mensaje: "Introduce un correo y contraseña válidos." });
    }

    const usuario = await comprobarPassword(email, password);
    if (!usuario) {
        return res.status(401).json({ mensaje: "Email o contraseña incorrectos." });
    }

    await iniciarSesion(req, usuario);
    return res.json({
        mensaje: "Inicio de sesión correcto.",
        usuario: crearDatosSesion(usuario),
    });
}

export async function obtenerPerfilActual(req, res) {
    const usuario = await obtenerUsuarioPorId(req.session.usuario.id);
    if (!usuario) {
        return res.status(401).json({ mensaje: "La cuenta de esta sesión ya no existe." });
    }
    return res.json({ usuario: crearDatosSesion(usuario) });
}

export async function actualizarCuenta(req, res) {
    const usuario = await obtenerUsuarioPorId(req.session.usuario.id);
    if (!usuario) {
        return res.status(401).json({ mensaje: "La cuenta de esta sesión ya no existe." });
    }

    const body = req.body ?? {};
    const updates = {};
    const email = Object.hasOwn(body, "email")
        ? normalizarEmail(body.email)
        : usuario.email;
    const nombre = Object.hasOwn(body, "nombre") ? body.nombre : usuario.nombre;

    if (!validarNombre(nombre) || !validarEmail(email)) {
        return res.status(400).json({ mensaje: "El nombre o el correo no son válidos." });
    }

    if (email !== usuario.emailNormalized) {
        const duplicate = await buscarUsuarioPorEmail(email);
        if (duplicate && String(duplicate._id) !== String(usuario._id)) {
            return res.status(409).json({
                mensaje: "Ya existe una cuenta con ese correo electrónico.",
            });
        }
    }

    const changesPassword = Object.hasOwn(body, "newPassword") && body.newPassword !== "";
    if (changesPassword) {
        if (usuario.authProvider === "google" || typeof usuario.password !== "string") {
            return res.status(409).json({
                mensaje: "Esta cuenta usa Google y no tiene una contraseña local que cambiar.",
            });
        }
        if (typeof body.currentPassword !== "string") {
            return res.status(400).json({ mensaje: "Introduce tu contraseña actual." });
        }
        const verified = await comprobarPassword(usuario.email, body.currentPassword);
        if (!verified) {
            return res.status(401).json({ mensaje: "La contraseña actual no es correcta." });
        }
        if (!validarPassword(body.newPassword)) {
            return res.status(400).json({
                mensaje: "La nueva contraseña debe tener entre 8 y 72 bytes.",
            });
        }
    } else if (body.currentPassword) {
        return res.status(400).json({
            mensaje: "Introduce una nueva contraseña para cambiar la contraseña actual.",
        });
    }

    if (Object.hasOwn(body, "profilePublic")) {
        if (typeof body.profilePublic !== "boolean") {
            return res.status(400).json({ mensaje: "La opción de privacidad no es válida." });
        }
        updates.profilePublic = body.profilePublic;
    }
    if (Object.hasOwn(body, "showEmail")) {
        if (typeof body.showEmail !== "boolean") {
            return res.status(400).json({ mensaje: "La opción de correo no es válida." });
        }
        updates.showEmail = body.showEmail;
    }

    updates.nombre = nombre.trim();
    updates.email = email;
    updates.emailNormalized = email;

    let changed;
    try {
        changed = await actualizarPerfilUsuario(
            usuario._id,
            updates,
            changesPassword ? body.newPassword : undefined,
        );
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({
                mensaje: "Ya existe una cuenta con ese correo electrónico.",
            });
        }
        throw error;
    }
    if (!changed) {
        return res.status(404).json({ mensaje: "No se encontró la cuenta." });
    }

    req.session.usuario = crearDatosSesion({
        ...usuario,
        ...changed,
        ...updates,
    });
    await guardarSesion(req);

    return res.json({
        mensaje: "Los datos de la cuenta se han actualizado.",
        usuario: req.session.usuario,
    });
}

export async function actualizarFotoPerfil(req, res) {
    if (!req.file) {
        return res.status(400).json({ mensaje: "Selecciona una imagen de perfil." });
    }

    const usuario = await obtenerUsuarioPorId(req.session.usuario.id);
    if (!usuario) {
        return res.status(401).json({ mensaje: "La cuenta de esta sesión ya no existe." });
    }

    const stored = await guardarImagenSubida(req.file.buffer, "avatars");
    let persisted = false;
    try {
        const changed = await actualizarPerfilUsuario(usuario._id, {
            avatar: stored.publicPath,
        });
        if (!changed) {
            throw new Error("No se pudo guardar la fotografía de perfil.");
        }
        persisted = true;

        req.session.usuario = crearDatosSesion({
            ...usuario,
            avatar: stored.publicPath,
        });
        await guardarSesion(req);

        if (
            usuario.avatar?.startsWith("/media/avatars/") &&
            (await contarReferenciasAvatar(usuario.avatar, usuario._id)) === 0
        ) {
            try {
                await eliminarImagenSubida(usuario.avatar);
            } catch (error) {
                if (error.code !== "ENOENT") {
                    console.error("No se pudo limpiar la foto de perfil anterior:", error);
                }
            }
        }

        return res.json({
            mensaje: "La fotografía de perfil se ha actualizado.",
            usuario: req.session.usuario,
        });
    } catch (error) {
        if (persisted) {
            throw error;
        }
        try {
            await unlink(stored.absolutePath);
        } catch (cleanupError) {
            if (cleanupError.code !== "ENOENT") {
                throw new AggregateError(
                    [error, cleanupError],
                    "No se pudo guardar el avatar ni limpiar el archivo generado.",
                );
            }
        }
        throw error;
    }
}

export async function obtenerPerfilPublico(req, res) {
    const usuario = await obtenerUsuarioPorId(req.params.usuarioId);
    if (!usuario) {
        return res.status(404).json({ mensaje: "Perfil no encontrado." });
    }

    const owner = String(usuario._id) === String(req.session.usuario?.id ?? "");
    const profilePublic = usuario.profilePublic !== false;
    if (!owner && !profilePublic) {
        return res.status(404).json({ mensaje: "Perfil no encontrado." });
    }

    const stats = await obtenerEstadisticasUsuario(usuario._id);
    const publicUser = {
        id: String(usuario._id),
        nombre: usuario.nombre,
        avatar: usuario.avatar ?? null,
        publicaciones: stats.publicaciones,
        likesDados: stats.likesDados,
        likesRecibidos: stats.likesRecibidos,
    };
    if (owner || usuario.showEmail === true) {
        publicUser.email = usuario.email;
    }

    return res.json({ usuario: publicUser });
}

export async function solicitarRecuperacionPassword(req, res) {
    if (!emailDisponible()) {
        return res.status(503).json({
            mensaje: "La recuperación no está activa: falta configurar el servicio de correo.",
        });
    }

    const email = normalizarEmail(req.body?.email);
    if (!validarEmail(email)) {
        return res.status(400).json({ mensaje: "Introduce un correo electrónico válido." });
    }

    const usuario = await buscarUsuarioPorEmail(email);
    if (
        usuario &&
        usuario.authProvider !== "google" &&
        typeof usuario.password === "string"
    ) {
        const token = randomBytes(32).toString("base64url");
        const tokenHash = createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
        const storedToken = await guardarTokenRecuperacion(
            usuario._id,
            tokenHash,
            expiresAt,
        );
        if (storedToken.matchedCount !== 1) {
            return res.json({
                mensaje: "Si existe una cuenta local asociada, recibirás instrucciones para recuperar el acceso.",
            });
        }

        try {
            const baseUrl = new URL(
                process.env.APP_BASE_URL || "http://localhost:3000",
            );
            if (
                !["http:", "https:"].includes(baseUrl.protocol) ||
                baseUrl.username ||
                baseUrl.password
            ) {
                throw new Error("APP_BASE_URL debe ser una URL HTTP(S) válida.");
            }
            const link = new URL(recuperarUrl, baseUrl);
            link.searchParams.set("token", token);
            await enviarEmailRecuperacion(usuario.email, link.toString());
        } catch (error) {
            await limpiarTokenRecuperacion(usuario._id, tokenHash);
            throw error;
        }
    }

    return res.json({
        mensaje: "Si existe una cuenta local asociada, recibirás instrucciones para recuperar el acceso.",
    });
}

export async function restablecerPassword(req, res) {
    const token = req.body?.token;
    const password = req.body?.password;
    if (typeof token !== "string" || token.length > 128 || !validarPassword(password)) {
        return res.status(400).json({
            mensaje: "El enlace no es válido o la nueva contraseña no cumple los requisitos.",
        });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const usuario = await buscarUsuarioPorTokenRecuperacion(tokenHash);
    if (!usuario) {
        return res.status(400).json({ mensaje: "El enlace no es válido o ha caducado." });
    }

    const changed = await restablecerPasswordConToken(tokenHash, password);
    if (changed.modifiedCount !== 1) {
        return res.status(400).json({ mensaje: "El enlace ya se ha utilizado o ha caducado." });
    }

    return res.json({ mensaje: "La contraseña se ha cambiado. Ya puedes iniciar sesión." });
}

export function cerrarSesion(req, res, next) {
    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }
        res.clearCookie("connect.sid");
        return res.json({ mensaje: "Sesión cerrada correctamente." });
    });
}

function iniciarSesion(req, usuario) {
    return establecerSesion(req, usuario);
}

export function crearDatosSesion(usuario) {
    return {
        id: String(usuario._id ?? usuario.id),
        nombre: usuario.nombre,
        email: usuario.email,
        avatar: usuario.avatar ?? null,
        profilePublic: usuario.profilePublic !== false,
        showEmail: usuario.showEmail === true,
        authProvider: usuario.authProvider ?? "local",
    };
}

export function establecerSesion(req, usuario) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((error) => {
            if (error) {
                reject(error);
                return;
            }
            req.session.usuario = crearDatosSesion(usuario);
            req.session.save((saveError) => {
                if (saveError) reject(saveError);
                else resolve();
            });
        });
    });
}

function guardarSesion(req) {
    return new Promise((resolve, reject) => {
        req.session.save((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}
