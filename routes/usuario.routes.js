import express from "express";

import {
    registrarUsuario,
    obtenerUsuarioPorEmail,
    iniciarSesion,
    cerrarSesion
} from "../controllers/usuario.controller.js";


const router = express.Router();


router.post("/registro", registrarUsuario);

router.post("/buscar", obtenerUsuarioPorEmail);

router.post("/login", iniciarSesion);
router.post("/logout", cerrarSesion);


export default router;