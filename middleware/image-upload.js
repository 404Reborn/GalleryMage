import multer from "multer";
import { ImageValidationError } from "../services/image-storage.service.js";

const acceptedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
]);

function imageUpload(maxFileSize) {
    return multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxFileSize, files: 1 },
        fileFilter(req, file, callback) {
            if (!acceptedMimeTypes.has(file.mimetype)) {
                callback(
                    new ImageValidationError(
                        "Solo se permiten imágenes JPEG, PNG, GIF o WebP.",
                    ),
                );
                return;
            }
            callback(null, true);
        },
    });
}

export const uploadPhoto = imageUpload(10 * 1024 * 1024).single("imagen");
export const uploadAvatar = imageUpload(5 * 1024 * 1024).single("avatar");
