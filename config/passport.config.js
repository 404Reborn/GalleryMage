import passport from "passport";
import bcrypt from "bcrypt";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import {
    asociarCuentaGoogleLegacy,
    buscarUsuarioPorEmail,
    buscarUsuarioPorGoogleId,
    crearUsuario,
    obtenerUsuarioPorId,
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
                    const verifiedEmail = profile.emails?.find(
                        ({ verified, value }) => verified === true && value,
                    );
                    const email = verifiedEmail?.value;

                    if (!email) {
                        return done(
                            new Error("Google no devolvió un correo verificado."),
                        );
                    }

                    let usuario = await buscarUsuarioPorGoogleId(profile.id);

                    if (!usuario) {
                        usuario = await buscarUsuarioPorEmail(email);

                        if (usuario) {
                            const isLegacyGoogleAccount =
                                !usuario.authProvider &&
                                typeof usuario.password === "string" &&
                                (await bcrypt.compare(
                                    `google-${profile.id}`,
                                    usuario.password,
                                ));
                            if (!isLegacyGoogleAccount) {
                                return done(
                                    new Error(
                                        "No se puede vincular este acceso de Google a esa cuenta.",
                                    ),
                                );
                            }

                            await asociarCuentaGoogleLegacy(
                                usuario._id,
                                profile.id,
                            );
                            usuario = await buscarUsuarioPorGoogleId(profile.id);
                        } else {
                            const nombre =
                                profile.displayName ||
                                profile.name?.givenName ||
                                "Usuario de Google";
                            const resultado = await crearUsuario(
                                nombre,
                                email,
                                null,
                                {
                                    authProvider: "google",
                                    googleId: profile.id,
                                },
                            );
                            usuario = await obtenerUsuarioPorId(
                                resultado.insertedId,
                            );
                        }
                    }

                    if (!usuario) {
                        return done(
                            new Error("No se pudo resolver la cuenta de Google."),
                        );
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
            const usuario = await obtenerUsuarioPorId(id);
            done(null, usuario);
        } catch (error) {
            done(error);
        }
    });

    return passport;
}
