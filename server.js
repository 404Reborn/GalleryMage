import "dotenv/config";
import express from "express";
import { readFile } from "node:fs/promises";
import { conectarDB } from "./config/db.config.js";
import {
    obtenerFotos,
    crearFoto,
    obtenerLikesDeFotos,
    actualizarLikeDeFoto,
    eliminarFoto,
    obtenerFotoPorReferencia,
    imagenEnUso,
    obtenerFotosGuardadas,
    actualizarFotoGuardada,
} from "./models/photo.model.js";
import usuarioRoutes from "./routes/usuario.routes.js";
import session from "express-session";
import MongoStore from "connect-mongo";
import passport from "passport";
import { configurarPassport } from "./config/passport.config.js";
import { verificarAutenticacion } from "./middleware/auth.middleware.js";
import {
    crearDatosSesion,
    establecerSesion,
} from "./controllers/usuario.controller.js";
import {
    obtenerUsuarioPorAvatar,
    obtenerUsuarioPorId,
    prepararIndicesUsuario,
} from "./models/usuario.model.js";
import { uploadPhoto } from "./middleware/image-upload.js";
import {
    eliminarImagenSubida,
    guardarImagenSubida,
    rutaImagenSubida,
    ImageValidationError,
} from "./services/image-storage.service.js";

const app = express();
const PORT = 3000;
const sessionSecret = process.env.SESSION_SECRET;
const { version: appVersion } = JSON.parse(
    await readFile(new URL("./package.json", import.meta.url), "utf8"),
);

if (!sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
    throw new Error("Configura SESSION_SECRET con al menos 32 bytes antes de iniciar GalleryMage.");
}

configurarPassport();

app.use(
    session({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/gallerymage",
        }),
        cookie: {
            maxAge: 1000 * 60 * 60,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        },
    }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json({ limit: "32kb" }));

app.use("/api/usuarios", usuarioRoutes);

app.get(
    "/auth/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
        prompt: "select_account",
    }),
);

app.get(
    "/auth/google/callback",
    passport.authenticate("google", {
        failureRedirect: "/",
    }),
    async (req, res, next) => {
        try {
            await establecerSesion(req, req.user);
            res.redirect("/");
        } catch (error) {
            next(error);
        }
    },
);

app.get("/api/sesion", verificarAutenticacion, async (req, res) => {
    const usuario = await obtenerUsuarioPorId(req.session.usuario.id);
    if (!usuario) {
        return res.status(401).json({ mensaje: "La cuenta de esta sesión ya no existe." });
    }
    return res.json({ mensaje: "Usuario autenticado", usuario: crearDatosSesion(usuario) });
});

app.get("/api/app-info", (req, res) => {
    return res.json({ name: "GalleryMage", version: appVersion });
});

app.get("/api/photos", async (req, res) => {
    const fotos = await obtenerFotos(req.session.usuario?.id ?? null);
    return res.json(fotos);
});

app.get("/api/photos/likes", verificarAutenticacion, async (req, res) => {
    const resultado = await obtenerLikesDeFotos(req.session.usuario.id);

    return res.json(resultado);
});

app.get("/api/photos/saved", verificarAutenticacion, async (req, res) => {
    const saved = await obtenerFotosGuardadas(req.session.usuario.id);
    return res.json({ saved });
});

app.post(
    "/api/photos/:photoId/save",
    verificarAutenticacion,
    async (req, res) => {
        const resultado = await actualizarFotoGuardada(
            req.params.photoId,
            req.session.usuario.id,
            true,
        );

        if (!resultado) {
            return res.status(404).json({
                mensaje: "Fotografía no encontrada",
            });
        }

        return res.json({
            mensaje: "Fotografía guardada.",
            ...resultado,
        });
    },
);

app.delete(
    "/api/photos/:photoId/save",
    verificarAutenticacion,
    async (req, res) => {
        const resultado = await actualizarFotoGuardada(
            req.params.photoId,
            req.session.usuario.id,
            false,
        );

        if (!resultado) {
            return res.status(404).json({
                mensaje: "Fotografía no encontrada",
            });
        }

        return res.json({
            mensaje: "Guardado eliminado.",
            ...resultado,
        });
    },
);

app.post(
    "/api/photos/:photoId/like",
    verificarAutenticacion,
    async (req, res) => {
        const resultado = await actualizarLikeDeFoto(
            req.params.photoId,
            req.session.usuario.id,
            true,
        );

        if (!resultado) {
            return res.status(404).json({
                mensaje: "Fotografía no encontrada",
            });
        }

        res.json(resultado);
    },
);

app.delete(
    "/api/photos/:photoId/like",
    verificarAutenticacion,
    async (req, res) => {
        const resultado = await actualizarLikeDeFoto(
            req.params.photoId,
            req.session.usuario.id,
            false,
        );

        if (!resultado) {
            return res.status(404).json({
                mensaje: "Fotografía no encontrada",
            });
        }

        res.json(resultado);
    },
);

app.post(
    "/api/photos",
    verificarAutenticacion,
    uploadPhoto,
    async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ mensaje: "Selecciona una fotografía." });
        }

        const titulo = req.body.titulo;
        const hashtags = req.body.hashtags;
        const stored = await guardarImagenSubida(req.file.buffer, "photos");
        try {
            const resultado = await crearFoto(
                titulo,
                stored.publicPath,
                hashtags,
                req.session.usuario.id,
            );
            return res.status(201).json(resultado);
        } catch (error) {
            try {
                await eliminarImagenSubida(stored.publicPath);
            } catch (cleanupError) {
                if (cleanupError.code !== "ENOENT") {
                    throw new AggregateError(
                        [error, cleanupError],
                        "No se pudo guardar la fotografía ni limpiar el archivo subido.",
                    );
                }
            }
            throw error;
        }
    },
);

app.delete("/api/photos/:photoId", verificarAutenticacion, async (req, res) => {
    const foto = await eliminarFoto(req.params.photoId, req.session.usuario.id);

    if (!foto) {
        return res.status(404).json({
            mensaje:
                "Fotografía no encontrada o no tienes permiso para eliminarla.",
        });
    }

    if (!(await imagenEnUso(foto.imagen))) {
        try {
            await eliminarImagenSubida(foto.imagen);
        } catch (error) {
            if (error.code !== "ENOENT") {
                console.error("No se pudo limpiar el archivo de una fotografía eliminada.");
            }
        }
    }

    return res.json({
        mensaje: "Fotografía eliminada correctamente",
        foto,
    });
});

app.get("/media/photos/:filename", async (req, res) => {
    const imagen = `/media/photos/${req.params.filename}`;
    const foto = await obtenerFotoPorReferencia(imagen);
    if (!foto || !(await puedeVerContenido(req, foto.usuarioId))) {
        return res.sendStatus(404);
    }
    return enviarImagen(res, imagen);
});

app.get("/media/avatars/:filename", async (req, res) => {
    const avatar = `/media/avatars/${req.params.filename}`;
    const owner = await obtenerUsuarioPorAvatar(avatar);
    if (
        !owner ||
        (owner.profilePublic === false &&
            String(owner._id) !== String(req.session.usuario?.id ?? ""))
    ) {
        return res.sendStatus(404);
    }
    return enviarImagen(res, avatar);
});

app.use("/uploads", async (req, res) => {
    let filename;
    try {
        filename = decodeURIComponent(req.path.slice(1));
    } catch {
        return res.sendStatus(400);
    }
    const imagen = `/uploads/${filename}`;
    const foto = await obtenerFotoPorReferencia(imagen);
    if (!foto || !(await puedeVerContenido(req, foto.usuarioId))) {
        return res.sendStatus(404);
    }
    return enviarImagen(res, imagen);
});

app.use(express.static("public"));

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    if (error?.code === "LIMIT_FILE_SIZE" || error?.status === 413) {
        return res.status(413).json({ mensaje: "La imagen supera el tamaño máximo permitido." });
    }
    if (error instanceof ImageValidationError || error?.type === "entity.parse.failed") {
        return res.status(400).json({ mensaje: error.message });
    }
    if (error?.code === "LIMIT_UNEXPECTED_FILE" || error?.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({ mensaje: "El formulario incluye un archivo no permitido." });
    }

    console.error("Error al procesar una solicitud de GalleryMage.");
    return res.status(500).json({ mensaje: "No se pudo completar la solicitud." });
});

await conectarDB();
await prepararIndicesUsuario();

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});

async function puedeVerContenido(req, usuarioId) {
    if (!usuarioId) {
        return true;
    }
    const propietario = await obtenerUsuarioPorId(usuarioId);
    if (!propietario) {
        return false;
    }
    return (
        propietario.profilePublic !== false ||
        String(propietario._id) === String(req.session.usuario?.id ?? "")
    );
}

function enviarImagen(res, reference) {
    const image = rutaImagenSubida(reference);
    if (!image) {
        return res.sendStatus(404);
    }
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    return res.sendFile(image.absolutePath);
}
