import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const storageRoot = path.resolve(process.cwd(), "uploads");
const publicUploadsRoot = path.resolve(process.cwd(), "public", "uploads");
const mediaPattern = /^\/media\/(photos|avatars)\/([0-9a-f-]{36})\.(jpg|png|gif|webp)$/iu;
const legacyPhotoPattern = /^\/uploads\/(.+)$/u;

export class ImageValidationError extends Error {}

export async function guardarImagenSubida(buffer, category) {
    if (!Buffer.isBuffer(buffer) || !["photos", "avatars"].includes(category)) {
        throw new ImageValidationError("La imagen o la ubicación no son válidas.");
    }

    const format = detectarFormatoImagen(buffer);
    if (!format) {
        throw new ImageValidationError(
            "El archivo no contiene una imagen JPEG, PNG, GIF o WebP válida.",
        );
    }

    const filename = `${randomUUID()}.${format.extension}`;
    const directory = path.join(storageRoot, category);
    await mkdir(directory, { recursive: true });
    const absolutePath = path.join(directory, filename);
    await writeFile(absolutePath, buffer, { flag: "wx", mode: 0o640 });

    return {
        absolutePath,
        publicPath: `/media/${category}/${filename}`,
        contentType: format.contentType,
    };
}

export function rutaImagenSubida(reference) {
    const media = mediaPattern.exec(reference ?? "");
    if (media) {
        return {
            absolutePath: path.join(storageRoot, media[1], `${media[2]}.${media[3]}`),
            category: media[1],
        };
    }

    const legacy = legacyPhotoPattern.exec(reference ?? "");
    if (
        legacy &&
        legacy[1] !== "." &&
        legacy[1] !== ".." &&
        !legacy[1].includes("/") &&
        !legacy[1].includes("\\") &&
        !legacy[1].includes("\0") &&
        path.basename(legacy[1]) === legacy[1]
    ) {
        return {
            absolutePath: path.join(publicUploadsRoot, legacy[1]),
            category: "legacy",
        };
    }

    return null;
}

export async function eliminarImagenSubida(reference) {
    const image = rutaImagenSubida(reference);
    if (!image) {
        throw new ImageValidationError("La referencia de imagen no es válida.");
    }
    await unlink(image.absolutePath);
}

export function detectarFormatoImagen(buffer) {
    if (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
    ) {
        return { extension: "jpg", contentType: "image/jpeg" };
    }
    if (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        )
    ) {
        return { extension: "png", contentType: "image/png" };
    }
    if (
        buffer.length >= 6 &&
        ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))
    ) {
        return { extension: "gif", contentType: "image/gif" };
    }
    if (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
        return { extension: "webp", contentType: "image/webp" };
    }
    return null;
}
