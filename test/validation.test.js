import test from "node:test";
import assert from "node:assert/strict";
import {
    normalizarEmail,
    validarEmail,
    validarNombre,
    validarPassword,
} from "../models/usuario.model.js";
import {
    detectarFormatoImagen,
    rutaImagenSubida,
} from "../services/image-storage.service.js";
import {
    decidirFlujoGoogle,
    puedeVincularCuentaGoogle,
} from "../services/google-auth-flow.js";
import { enviarFormularioAutenticacion } from "../public/js/auth-form-flow.js";

test("registering a new email uses only the registration endpoint", async () => {
    const calls = [];
    const expectedUser = {
        nombre: "Ada",
        email: "ada@example.com",
    };
    const result = await enviarFormularioAutenticacion({
        register: true,
        payload: {
            nombre: "Ada",
            email: "ada@example.com",
            password: "password123",
        },
        postJson: async (url, payload) => {
            calls.push({ url, payload });
            return {
                response: { ok: true, status: 201 },
                result: { usuario: expectedUser },
            };
        },
    });

    assert.deepEqual(calls.map(({ url }) => url), [
        "/api/usuarios/registro",
    ]);
    assert.deepEqual(result.usuario, expectedUser);
});

test("duplicate registration reports conflict without attempting login or replacing the account", async () => {
    const existingAccount = {
        email: "ada@example.com",
        password: "unchanged-hash",
    };
    const calls = [];
    await assert.rejects(
        enviarFormularioAutenticacion({
            register: true,
            payload: {
                nombre: "Replacement",
                email: existingAccount.email,
                password: "different-password",
            },
            postJson: async (url) => {
                calls.push(url);
                return {
                    response: { ok: false, status: 409 },
                    result: { mensaje: "Ya existe una cuenta." },
                };
            },
        }),
        (error) =>
            error.message === "Ya existe una cuenta." &&
            error.status === 409,
    );
    assert.deepEqual(calls, ["/api/usuarios/registro"]);
    assert.deepEqual(existingAccount, {
        email: "ada@example.com",
        password: "unchanged-hash",
    });
});

test("local login uses only login endpoint and accepts valid credentials", async () => {
    const calls = [];
    const user = { nombre: "Ada", email: "ada@example.com" };
    const result = await enviarFormularioAutenticacion({
        register: false,
        payload: {
            nombre: "Ignored",
            email: "ada@example.com",
            password: "password123",
        },
        postJson: async (url, payload) => {
            calls.push({ url, payload });
            return {
                response: { ok: true, status: 200 },
                result: { usuario: user },
            };
        },
    });

    assert.deepEqual(calls, [
        {
            url: "/api/usuarios/login",
            payload: {
                email: "ada@example.com",
                password: "password123",
            },
        },
    ]);
    assert.deepEqual(result.usuario, user);
});

test("local login keeps incorrect-password errors distinct from duplicate registration", async () => {
    await assert.rejects(
        enviarFormularioAutenticacion({
            register: false,
            payload: {
                email: "ada@example.com",
                password: "wrong-password",
            },
            postJson: async () => ({
                response: { ok: false, status: 401 },
                result: { mensaje: "Email o contraseña incorrectos." },
            }),
        }),
        { message: "Email o contraseña incorrectos." },
    );
});

test("chooses safe Google authentication and linking flows", () => {
    assert.equal(
        decidirFlujoGoogle({
            linkedUser: null,
            emailUser: null,
            linkingUserId: null,
        }),
        "create",
    );
    assert.equal(
        decidirFlujoGoogle({
            linkedUser: { _id: "user-1" },
            emailUser: null,
            linkingUserId: null,
        }),
        "login",
    );
    assert.equal(
        decidirFlujoGoogle({
            linkedUser: null,
            emailUser: { _id: "user-1" },
            linkingUserId: null,
        }),
        "email-conflict",
    );
    assert.equal(
        decidirFlujoGoogle({
            linkedUser: null,
            emailUser: { _id: "user-1" },
            linkingUserId: "user-2",
        }),
        "link",
    );
    assert.equal(
        puedeVincularCuentaGoogle({
            linkedUser: { _id: "another-user" },
            emailUser: { _id: "current-user" },
            userId: "current-user",
        }),
        false,
    );
    assert.equal(
        puedeVincularCuentaGoogle({
            linkedUser: { _id: "current-user" },
            emailUser: { _id: "current-user" },
            userId: "current-user",
        }),
        true,
    );
});

test("normalizes and validates account fields", () => {
    assert.equal(normalizarEmail("  USER@Example.COM "), "user@example.com");
    assert.equal(validarEmail("user@example.com"), true);
    assert.equal(validarEmail("not-an-email"), false);
    assert.equal(validarNombre("  Ada  "), true);
    assert.equal(validarNombre(" "), false);
    assert.equal(validarNombre("x".repeat(61)), false);
    assert.equal(validarPassword("password123"), true);
    assert.equal(validarPassword("short"), false);
    assert.equal(validarPassword("é".repeat(37)), false);
});

test("recognizes only supported image signatures", () => {
    assert.equal(
        detectarFormatoImagen(
            Buffer.from([0xff, 0xd8, 0xff, 0x00]),
        ).contentType,
        "image/jpeg",
    );
    assert.equal(
        detectarFormatoImagen(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        ).extension,
        "png",
    );
    assert.equal(
        detectarFormatoImagen(Buffer.from("GIF89a")).contentType,
        "image/gif",
    );
    assert.equal(
        detectarFormatoImagen(Buffer.from("RIFF0000WEBP")).extension,
        "webp",
    );
    assert.equal(detectarFormatoImagen(Buffer.from("not an image")), null);
});

test("accepts only safe media references", () => {
    const avatar = rutaImagenSubida(
        "/media/avatars/123e4567-e89b-12d3-a456-426614174000.png",
    );
    assert.equal(avatar.category, "avatars");
    assert.equal(
        rutaImagenSubida("/media/photos/../../private.txt"),
        null,
    );
    assert.equal(
        rutaImagenSubida("/uploads/foto con espacios.jpg").category,
        "legacy",
    );
    assert.equal(rutaImagenSubida("/uploads/../private.txt"), null);
});
