import {
    crearUsuario,
    buscarUsuarioPorEmail,
    comprobarPassword,
} from "../models/usuario.model.js";

export async function registrarUsuario(req, res) {
    const { nombre, email, password } = req.body;

    const resultado = await crearUsuario(nombre, email, password);

    res.json(resultado);
}

export async function obtenerUsuarioPorEmail(req, res) {
    const { email } = req.body;

    const usuario = await buscarUsuarioPorEmail(email);

    res.json(usuario);
}

export async function iniciarSesion(req, res) {

    const { email, password } = req.body;

    const usuario = await comprobarPassword(
        email,
        password
    );

    if (!usuario) {

        return res.status(401).json({
            mensaje: "Email o contraseña incorrectos"
        });

    }

    req.session.usuario = {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email
    };

    res.json({
        mensaje: "Inicio de sesión correcto",
        usuario: {
            id: usuario._id,
            nombre: usuario.nombre,
            email: usuario.email
        }
    });

}

export function cerrarSesion(req, res, next) {
    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }

        res.clearCookie("connect.sid");
        res.json({ mensaje: "Sesión cerrada correctamente" });
    });
}