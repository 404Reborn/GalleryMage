import "dotenv/config";
import express from "express";
import { conectarDB } from "./config/db.config.js";
import {
    obtenerFotos,
    crearFoto,
    obtenerLikesDeFotos,
    actualizarLikeDeFoto,
    eliminarFoto,
} from "./models/photo.model.js";
import multer from "multer";
import usuarioRoutes from "./routes/usuario.routes.js";
import session from "express-session";
import MongoStore from "connect-mongo";
import passport from "passport";
import { configurarPassport } from "./config/passport.config.js";
import { verificarAutenticacion } from "./middleware/auth.middleware.js";
import { unlink } from "node:fs/promises";
import path from "node:path";

const app = express();
const PORT = 3000;

configurarPassport();

app.use(
    session({
        secret: "gallerymage_secreto",
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: "mongodb://localhost:27017/gallerymage",
        }),
        cookie: {
            maxAge: 1000 * 60 * 60,
        },
    }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static("public"));
app.use(express.json());

app.use("/api/usuarios", usuarioRoutes);

app.get(
    "/auth/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
    }),
);

app.get(
    "/auth/google/callback",
    passport.authenticate("google", {
        failureRedirect: "/",
    }),
    (req, res) => {
        req.session.usuario = {
            id: req.user._id,
            nombre: req.user.nombre,
            email: req.user.email,
        };

        res.redirect("/");
    },
);

app.get("/api/sesion", (req, res) => {
    if (!req.session.usuario) {
        return res.status(401).json({
            mensaje: "No hay ningún usuario conectado",
        });
    }

    res.json({
        mensaje: "Usuario autenticado",
        usuario: req.session.usuario,
    });
});

app.get("/api/photos", async (req, res) => {
    const fotos = await obtenerFotos();
    res.json(fotos);
});

app.get("/api/photos/likes", verificarAutenticacion, async (req, res) => {
    const resultado = await obtenerLikesDeFotos(req.session.usuario.id);

    res.json(resultado);
});

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

const storage = multer.diskStorage({
    destination: "public/uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});

const upload = multer({ storage: storage });

app.post(
    "/api/photos",
    verificarAutenticacion,
    upload.single("imagen"),
    async (req, res) => {
        const titulo = req.body.titulo;
        const hashtags = req.body.hashtags;
        const imagen = "/uploads/" + req.file.filename;

        console.log("IMAGEN:", imagen);

        const resultado = await crearFoto(
            titulo,
            imagen,
            hashtags,
            req.session.usuario.id,
        );

        res.json(resultado);
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

    const nombreArchivo = path.basename(foto.imagen);

    const rutaArchivo = path.join(
        process.cwd(),
        "public",
        "uploads",
        nombreArchivo,
    );

    try {
        await unlink(rutaArchivo);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("No se pudo eliminar el archivo:", error);
        }
    }

    res.json({
        mensaje: "Fotografía eliminada correctamente",
        foto,
    });
});

conectarDB();

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});

