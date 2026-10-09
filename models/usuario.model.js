import { conectarDB } from "../config/db.config.js";
import bcrypt from "bcrypt";

export async function obtenerUsuarios() {

    const db = await conectarDB();

    const usuarios = db.collection("usuarios");

    return usuarios;
}

export async function crearUsuario(nombre, email, password) {

    const usuarios = await obtenerUsuarios();

    const passwordCifrada = await bcrypt.hash(password, 10);

    const resultado = await usuarios.insertOne({
        nombre: nombre,
        email: email,
        password: passwordCifrada
    });

    return resultado;
}

export async function buscarUsuarioPorEmail(email) {

    const usuarios = await obtenerUsuarios();

    const usuario = await usuarios.findOne({
        email: email
    });

    return usuario;
}

export async function comprobarPassword(email, password) {

    const usuario = await buscarUsuarioPorEmail(email);

    if (!usuario) {
        return null;
    }

    const passwordCorrecta = await bcrypt.compare(
        password,
        usuario.password
    );

    if (!passwordCorrecta) {
        return null;
    }

    return usuario;
}
