import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import {
    buscarUsuarioPorEmail,
    crearUsuario,
} from "../models/usuario.model.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export function configurarPassport() {
    passport.use(
        new GoogleStrategy(
            {
                clientID: GOOGLE_CLIENT_ID,
                clientSecret: GOOGLE_CLIENT_SECRET,
                callbackURL: "http://localhost:3000/auth/google/callback",
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    const email = profile.emails?.[0]?.value;

                    if (!email) {
                        return done(new Error("Google no devolvió un email."));
                    }

                    let usuario = await buscarUsuarioPorEmail(email);

                    if (!usuario) {
                        const nombre =
                            profile.displayName ||
                            profile.name?.givenName ||
                            "Usuario de Google";

                        const resultado = await crearUsuario(
                            nombre,
                            email,
                            `google-${profile.id}`,
                        );

                        usuario = await buscarUsuarioPorEmail(email);

                        if (!usuario || !resultado.insertedId) {
                            return done(
                                new Error(
                                    "No se pudo crear el usuario de Google.",
                                ),
                            );
                        }
                    }

                    return done(null, usuario);
                } catch (error) {
                    return done(error);
                }
            },
        ),
    );

    passport.serializeUser((usuario, done) => {
        done(null, usuario._id.toString());
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const usuario = await buscarUsuarioPorEmailPorId(id);
            done(null, usuario);
        } catch (error) {
            done(error);
        }
    });

    return passport;
}

async function buscarUsuarioPorEmailPorId(id) {
    const { conectarDB } = await import("../config/db.config.js");

    const db = await conectarDB();

    const usuario = await db.collection("usuarios").findOne({
        _id: new (await import("mongodb")).ObjectId(id),
    });

    return usuario;
}
