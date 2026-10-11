import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import { conectarDB } from "../config/db.config.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function normalizarEmail(email) {
    return typeof email === "string" ? email.trim().toLocaleLowerCase("en-US") : "";
}

export function validarNombre(nombre) {
    return typeof nombre === "string" && nombre.trim().length >= 1 && nombre.trim().length <= 60;
}

export function validarEmail(email) {
    const normalized = normalizarEmail(email);
    return normalized.length <= 254 && emailPattern.test(normalized);
}

export function validarPassword(password) {
    return (
        typeof password === "string" &&
        Buffer.byteLength(password, "utf8") >= 8 &&
        Buffer.byteLength(password, "utf8") <= 72
    );
}

export async function obtenerUsuarios() {
    const db = await conectarDB();
    return db.collection("usuarios");
}

export async function prepararIndicesUsuario() {
    const usuarios = await obtenerUsuarios();
    const legacyUsers = await usuarios
        .find({ emailNormalized: { $exists: false } }, { projection: { email: 1 } })
        .toArray();

    for (const usuario of legacyUsers) {
        const emailNormalized = normalizarEmail(usuario.email);
        if (emailNormalized) {
            await usuarios.updateOne(
                { _id: usuario._id },
                { $set: { emailNormalized } },
            );
        }
    }

    await Promise.all([
        usuarios.createIndex(
            { emailNormalized: 1 },
            {
                unique: true,
                partialFilterExpression: {
                    emailNormalized: { $type: "string" },
                },
            },
        ),
        usuarios.createIndex({ googleId: 1 }, { unique: true, sparse: true }),
    ]);
}

export async function crearUsuario(
    nombre,
    email,
    password,
    { authProvider = "local", googleId } = {},
) {
    const usuarios = await obtenerUsuarios();
    const normalizedEmail = normalizarEmail(email);
    const usuario = {
        nombre: nombre.trim(),
        email: normalizedEmail,
        emailNormalized: normalizedEmail,
        authProvider,
        profilePublic: true,
        showEmail: false,
    };

    if (typeof password === "string") {
        usuario.password = await bcrypt.hash(password, 12);
    }
    if (googleId) {
        usuario.googleId = String(googleId);
    }

    return usuarios.insertOne(usuario);
}

export async function buscarUsuarioPorEmail(email) {
    const usuarios = await obtenerUsuarios();
    const normalizedEmail = normalizarEmail(email);

    if (!normalizedEmail) {
        return null;
    }

    return usuarios.findOne({
        $or: [
            { emailNormalized: normalizedEmail },
            { email: normalizedEmail },
        ],
    });
}

export async function buscarUsuarioPorGoogleId(googleId) {
    const usuarios = await obtenerUsuarios();
    return usuarios.findOne({ googleId: String(googleId) });
}

export async function asociarCuentaGoogleLegacy(userId, googleId) {
    const usuarios = await obtenerUsuarios();
    return usuarios.updateOne(
        { _id: userId, authProvider: { $exists: false } },
        {
            $set: { authProvider: "google", googleId: String(googleId) },
            $unset: { password: "" },
        },
    );
}

export async function obtenerUsuarioPorId(userId) {
    if (!ObjectId.isValid(String(userId))) {
        return null;
    }

    const usuarios = await obtenerUsuarios();
    return usuarios.findOne({ _id: new ObjectId(String(userId)) });
}

export async function obtenerUsuarioPorAvatar(avatar) {
    const usuarios = await obtenerUsuarios();
    return usuarios.findOne(
        { avatar },
        { projection: { _id: 1, profilePublic: 1 } },
    );
}

export async function contarReferenciasAvatar(avatar, exceptUserId) {
    const usuarios = await obtenerUsuarios();
    return usuarios.countDocuments({
        avatar,
        _id: { $ne: new ObjectId(String(exceptUserId)) },
    });
}

export async function comprobarPassword(email, password) {
    const usuario = await buscarUsuarioPorEmail(email);

    if (
        !usuario ||
        usuario.authProvider === "google" ||
        typeof usuario.password !== "string"
    ) {
        return null;
    }

    const passwordCorrecta = await bcrypt.compare(password, usuario.password);
    return passwordCorrecta ? usuario : null;
}

export async function actualizarPerfilUsuario(userId, updates, newPassword) {
    const usuarios = await obtenerUsuarios();
    const changes = { ...updates };
    if (newPassword) {
        changes.password = await bcrypt.hash(newPassword, 12);
        changes.authProvider = "local";
    }

    return usuarios.findOneAndUpdate(
        { _id: new ObjectId(String(userId)) },
        { $set: changes },
        { returnDocument: "after", projection: { password: 0 } },
    );
}

export async function actualizarPasswordUsuario(userId, password) {
    const usuarios = await obtenerUsuarios();
    const passwordHash = await bcrypt.hash(password, 12);
    return usuarios.updateOne(
        { _id: new ObjectId(String(userId)) },
        {
            $set: { password: passwordHash, authProvider: "local" },
            $unset: {
                passwordResetTokenHash: "",
                passwordResetExpiresAt: "",
            },
        },
    );
}

export async function guardarTokenRecuperacion(userId, tokenHash, expiresAt) {
    const usuarios = await obtenerUsuarios();
    return usuarios.updateOne(
        { _id: new ObjectId(String(userId)), authProvider: { $ne: "google" } },
        {
            $set: {
                passwordResetTokenHash: tokenHash,
                passwordResetExpiresAt: expiresAt,
            },
        },
    );
}

export async function buscarUsuarioPorTokenRecuperacion(tokenHash) {
    const usuarios = await obtenerUsuarios();
    return usuarios.findOne({
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
        authProvider: { $ne: "google" },
    });
}

export async function limpiarTokenRecuperacion(userId, tokenHash) {
    const usuarios = await obtenerUsuarios();
    return usuarios.updateOne(
        {
            _id: new ObjectId(String(userId)),
            passwordResetTokenHash: tokenHash,
        },
        {
            $unset: {
                passwordResetTokenHash: "",
                passwordResetExpiresAt: "",
            },
        },
    );
}

export async function restablecerPasswordConToken(tokenHash, password) {
    const usuarios = await obtenerUsuarios();
    const passwordHash = await bcrypt.hash(password, 12);
    return usuarios.updateOne(
        {
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: { $gt: new Date() },
            authProvider: { $ne: "google" },
        },
        {
            $set: { password: passwordHash, authProvider: "local" },
            $unset: {
                passwordResetTokenHash: "",
                passwordResetExpiresAt: "",
            },
        },
    );
}
