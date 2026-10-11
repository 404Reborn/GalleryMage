import nodemailer from "nodemailer";

export function emailDisponible() {
    const port = Number(process.env.SMTP_PORT);
    const username = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASS?.trim();
    return Boolean(
        process.env.SMTP_HOST?.trim() &&
            Number.isInteger(port) &&
            port >= 1 &&
            port <= 65535 &&
            process.env.SMTP_FROM?.trim() &&
            (Boolean(username) === Boolean(password)),
    );
}

export async function enviarEmailRecuperacion(email, link) {
    if (!emailDisponible()) {
        throw new Error("El servicio de correo no está configurado.");
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST.trim(),
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === "true",
        ...(process.env.SMTP_USER?.trim()
            ? {
                  auth: {
                      user: process.env.SMTP_USER.trim(),
                      pass: process.env.SMTP_PASS.trim(),
                  },
              }
            : {}),
    });

    await transporter.sendMail({
        from: process.env.SMTP_FROM.trim(),
        to: email,
        subject: "Recuperación de contraseña de GalleryMage",
        text: `Se ha solicitado cambiar la contraseña de tu cuenta. Usa este enlace antes de 20 minutos:\n\n${link}\n\nSi no lo solicitaste, ignora este mensaje.`,
    });
}
