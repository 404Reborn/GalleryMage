import { ObjectId } from "mongodb";
import { conectarDB } from "../config/db.config.js";

export async function obtenerFotos() {
    const db = await conectarDB();

    const fotos = await db
        .collection("fotos")
        .find()
        .toArray();

    return fotos;
}

export async function crearFoto(titulo, imagen, hashtags, usuarioId) {
    const db = await conectarDB();

    const resultado = await db.collection("fotos").insertOne({
        titulo: titulo,
        imagen: imagen,
        hashtags: hashtags,
        usuarioId: String(usuarioId),
    });

    return resultado;
}

export async function obtenerLikesDeFotos(userId) {
    const db = await conectarDB();

    const coleccionLikes = db.collection("photo_likes");

    const [conteos, likesUsuario] = await Promise.all([
        coleccionLikes
            .aggregate([
                {
                    $group: {
                        _id: "$photoId",
                        total: { $sum: 1 },
                    },
                },
            ])
            .toArray(),

        coleccionLikes
            .find(
                { userId: String(userId) },
                {
                    projection: {
                        photoId: 1,
                    },
                },
            )
            .toArray(),
    ]);

    return {
        conteos: Object.fromEntries(
            conteos.map(({ _id, total }) => [
                String(_id),
                total,
            ]),
        ),

        likesUsuario: likesUsuario.map(({ photoId }) =>
            String(photoId),
        ),
    };
}

export async function actualizarLikeDeFoto(
    photoId,
    userId,
    liked,
) {
    if (!ObjectId.isValid(photoId)) {
        return null;
    }

    const db = await conectarDB();

    const idFoto = new ObjectId(photoId);

    const foto = await db.collection("fotos").findOne(
        { _id: idFoto },
        {
            projection: {
                _id: 1,
            },
        },
    );

    if (!foto) {
        return null;
    }

    const coleccionLikes = db.collection("photo_likes");

    const likeId = `${photoId}:${String(userId)}`;

    if (liked) {
        await coleccionLikes.updateOne(
            { _id: likeId },
            {
                $setOnInsert: {
                    photoId: idFoto,
                    userId: String(userId),
                },
            },
            {
                upsert: true,
            },
        );
    } else {
        await coleccionLikes.deleteOne({
            _id: likeId,
        });
    }

    const [count, existingLike] = await Promise.all([
        coleccionLikes.countDocuments({
            photoId: idFoto,
        }),

        coleccionLikes.findOne(
            { _id: likeId },
            {
                projection: {
                    _id: 1,
                },
            },
        ),
    ]);

    return {
        count,
        isLiked: Boolean(existingLike),
    };
}

export async function eliminarFoto(photoId, usuarioId) {
    if (!ObjectId.isValid(photoId)) {
        return null;
    }

    const db = await conectarDB();

    const idFoto = new ObjectId(photoId);

    const foto = await db.collection("fotos").findOne({
        _id: idFoto,
        usuarioId: String(usuarioId),
    });

    if (!foto) {
        return null;
    }

    await db.collection("fotos").deleteOne({
        _id: idFoto,
        usuarioId: String(usuarioId),
    });

    await db.collection("photo_likes").deleteMany({
        photoId: idFoto,
    });

    return foto;
}