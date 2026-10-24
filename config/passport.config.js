import passport from "passport";
import bcrypt from "bcrypt";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import {
    asociarCuentaGoogle,
    asociarCuentaGoogleLegacy,
    buscarUsuarioPorEmail,
    buscarUsuarioPorGoogleId,
    crearUsuario,
    obtenerUsuarioPorId,
} from "../models/usuario.model.js";
import {
    decidirFlujoGoogle,
    puedeVincularCuentaGoogle,
} from "../services/google-auth-flow.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export function configurarPassport() {
    passport.use(
        new GoogleStrategy(
            {
                clientID: GOOGLE_CLIENT_ID,
                clientSecret: GOOGLE_CLIENT_SECRET,
                callbackURL: new URL(
                    "/auth/google/callback",
                    process.env.APP_BASE_URL || "http://localhost:3000",
                ).toString(),
                passReqToCallback: true,
                store: true,
            },
            async (req, accessToken, refreshToken, profile, done) => {
                try {
                    const verifiedEmail = profile.emails?.find(
                        ({ verified, value }) => verified === true && value,
                    );
                    const email = verifiedEmail?.value;

                    if (!email) {
                        return done(
                            new Error(
                                "Google no devolvió un correo verificado.",
                            ),
                        );
                    }

                    const linkingUserId = req.session?.googleLinkUserId;
                    const linkedUser = await buscarUsuarioPorGoogleId(
                        profile.id,
                    );
                    const emailUser = linkedUser
                        ? null
                        : await buscarUsuarioPorEmail(email);
                    const flow = decidirFlujoGoogle({
                        linkedUser,
                        emailUser,
                        linkingUserId,
                    });

                    if (flow === "link") {
                        const usuario = await obtenerUsuarioPorId(
                            linkingUserId,
                        );
                        if (!usuario) {
                            return done(null, false, {
                                code: "google-link-conflict",
                            });
                        }

                        if (
                            !puedeVincularCuentaGoogle({
                                linkedUser,
                                emailUser,
                                userId: usuario._id,
                            })
                        ) {
                            return done(null, false, {
                                code: "google-link-conflict",
                            });
                        }

                        if (!linkedUser) {
                            try {
                                const result = await asociarCuentaGoogle(
                                    usuario._id,
                                    profile.id,
                                );
                                if (result.matchedCount !== 1) {
                                    return done(null, false, {
                                        code: "google-link-conflict",
                                    });
                                }
                            } catch (error) {
                                if (error?.code === 11000) {
                                    return done(null, false, {
                                        code: "google-link-conflict",
                                    });
                                }
                                throw error;
                            }
                        }

                        return done(null, usuario);
                    }

                    if (flow === "login") {
                        return done(null, linkedUser);
                    }

                    if (flow === "email-conflict") {
                        const isLegacyGoogleAccount =
                            !emailUser.authProvider &&
                            typeof emailUser.password === "string" &&
                            (await bcrypt.compare(
                                `google-${profile.id}`,
                                emailUser.password,
                            ));
                        if (!isLegacyGoogleAccount) {
                            return done(null, false, {
                                code: "google-account-exists",
                            });
                        }

                        const result = await asociarCuentaGoogleLegacy(
                            emailUser._id,
                            profile.id,
                        );
                        if (result.matchedCount !== 1) {
                            return done(null, false, {
                                code: "google-account-exists",
                            });
                        }
                        const migratedUser = await buscarUsuarioPorGoogleId(
                            profile.id,
                        );
                        if (!migratedUser) {
                            return done(null, false, {
                                code: "google-account-exists",
                            });
                        }
                        return done(null, migratedUser);
                    }

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
                    const usuario = await obtenerUsuarioPorId(
                        resultado.insertedId,
                    );
                    if (!usuario) {
                        return done(
                            new Error(
                                "No se pudo resolver la cuenta de Google.",
                            ),
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
