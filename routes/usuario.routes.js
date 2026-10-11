import express from "express";
import {
    actualizarCuenta,
    actualizarFotoPerfil,
    cerrarSesion,
    iniciarSesionUsuario,
    obtenerPerfilActual,
    obtenerPerfilPublico,
    registrarUsuario,
    restablecerPassword,
    solicitarRecuperacionPassword,
} from "../controllers/usuario.controller.js";
import { verificarAutenticacion } from "../middleware/auth.middleware.js";
import { uploadAvatar } from "../middleware/image-upload.js";

const router = express.Router();

router.post("/registro", registrarUsuario);
router.post("/login", iniciarSesionUsuario);
router.post("/logout", cerrarSesion);
router.post("/recuperacion", solicitarRecuperacionPassword);
router.post("/restablecer", restablecerPassword);

router.get("/perfil", verificarAutenticacion, obtenerPerfilActual);
router.patch("/perfil", verificarAutenticacion, actualizarCuenta);
router.post(
    "/perfil/avatar",
    verificarAutenticacion,
    uploadAvatar,
    actualizarFotoPerfil,
);
router.get("/:usuarioId/perfil", obtenerPerfilPublico);

export default router;
