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
