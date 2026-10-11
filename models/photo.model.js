import { ObjectId } from "mongodb";
import { conectarDB } from "../config/db.config.js";

export async function obtenerFotos(viewerId = null) {
    const db = await conectarDB();

    const photos = db.collection("fotos");
    const pipeline = [
        {
            $lookup: {
                from: "usuarios",
                let: { ownerId: "$usuarioId" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: [
                                    { $toString: "$_id" },
                                    { $toString: "$$ownerId" },
                                ],
                            },
                        },
                    },
                    { $project: { profilePublic: 1 } },
                ],
                as: "_owner",
            },
        },
        {
            $addFields: {
                _ownerIsPublic: {
                    $ifNull: [{ $arrayElemAt: ["$_owner.profilePublic", 0] }, true],
                },
                _isViewerOwner: viewerId
                    ? {
                          $eq: [
                              { $toString: "$usuarioId" },
                              String(viewerId),
                          ],
                      }
                    : false,
            },
        },
    ];

    if (viewerId) {
        pipeline.push({
            $match: {
                $or: [
                    { _ownerIsPublic: true },
                    { _isViewerOwner: true },
                    { usuarioId: { $exists: false } },
                ],
            },
        });
    } else {
        pipeline.push({
            $match: {
                $or: [
                    { _ownerIsPublic: true },
                    { usuarioId: { $exists: false } },
                ],
            },
        });
    }

    pipeline.push({
        $project: { _owner: 0, _ownerIsPublic: 0, _isViewerOwner: 0 },
    });
    const fotos = await photos.aggregate(pipeline).toArray();

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
    const normalizedUserId = String(userId);

    const [conteos, likesUsuario] = await Promise.all([
        db.collection("fotos")
            .aggregate([
                {
                    $lookup: {
                        from: "usuarios",
                        let: { ownerId: "$usuarioId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: [
                                            { $toString: "$_id" },
                                            { $toString: "$$ownerId" },
                                        ],
                                    },
                                },
                            },
                            { $project: { profilePublic: 1 } },
                        ],
                        as: "_owner",
                    },
                },
                {
                    $addFields: {
                        _ownerIsPublic: {
                            $ifNull: [
                                { $arrayElemAt: ["$_owner.profilePublic", 0] },
                                true,
                            ],
                        },
                    },
                },
                {
                    $addFields: {
                        _isViewerOwner: {
                            $eq: [
                                { $toString: "$usuarioId" },
                                normalizedUserId,
                            ],
                        },
                    },
                },
                {
                    $match: {
                        $or: [
                            { _ownerIsPublic: true },
                            { _isViewerOwner: true },
                            { usuarioId: { $exists: false } },
                        ],
                    },
                },
                {
                    $lookup: {
                        from: "photo_likes",
                        localField: "_id",
                        foreignField: "photoId",
                        as: "likes",
                    },
                },
                {
                    $project: {
                        _id: 1,
                        total: {
                            $size: {
                                $setUnion: [
                                    {
                                        $map: {
                                            input: "$likes",
                                            as: "like",
                                            in: "$$like.userId",
                                        },
                                    },
                                    [],
                                ],
                            },
                        },
                    },
                },
            ])
            .toArray(),
        coleccionLikes
            .aggregate([
                { $match: { userId: normalizedUserId } },
                {
                    $lookup: {
                        from: "fotos",
                        localField: "photoId",
                        foreignField: "_id",
                        as: "_photo",
                    },
                },
                { $match: { "_photo.0": { $exists: true } } },
                {
                    $lookup: {
                        from: "usuarios",
                        let: {
                            ownerId: {
                                $arrayElemAt: ["$_photo.usuarioId", 0],
                            },
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: [
                                            { $toString: "$_id" },
                                            { $toString: "$$ownerId" },
                                        ],
                                    },
                                },
                            },
                            { $project: { profilePublic: 1 } },
                        ],
                        as: "_owner",
                    },
                },
                {
                    $match: {
                        $or: [
                            { "_owner.0.profilePublic": { $ne: false } },
                            {
                                $expr: {
                                    $eq: [
                                        {
                                            $toString: {
                                                $arrayElemAt: [
                                                    "$_photo.usuarioId",
                                                    0,
                                                ],
                                            },
                                        },
                                        normalizedUserId,
                                    ],
                                },
                            },
                        ],
                    },
                },
                { $group: { _id: "$photoId" } },
            ])
            .toArray(),
    ]);

    const estadisticas = await obtenerEstadisticasUsuario(userId);

    return {
        conteos: Object.fromEntries(
            conteos.map(({ _id, total }) => [
                String(_id),
                total,
            ]),
        ),
        likesUsuario: likesUsuario.map(({ _id }) => String(_id)),
        estadisticas,
    };
}

export async function obtenerFotosGuardadas(userId) {
    const db = await conectarDB();
    const coleccionGuardados = db.collection("photo_saves");
    const normalizedUserId = String(userId);

    await coleccionGuardados.createIndex(
        { userId: 1, photoId: 1 },
        { unique: true },
    );

    const registros = await coleccionGuardados
        .find({ userId: normalizedUserId }, { projection: { photoId: 1 } })
        .toArray();

    if (!registros.length) {
        return [];
    }

    const idsGuardados = registros.map(({ photoId }) => photoId);
    const existentes = await db
        .collection("fotos")
        .find(
            { _id: { $in: idsGuardados } },
            { projection: { _id: 1 } },
        )
        .toArray();

    const validPhotoIds = new Set(existentes.map(({ _id }) => String(_id)));
    const invalidPhotoIds = registros
        .filter(({ photoId }) => !validPhotoIds.has(String(photoId)))
        .map(({ photoId }) => photoId);

    if (invalidPhotoIds.length > 0) {
        await coleccionGuardados.deleteMany({
            userId: normalizedUserId,
            photoId: { $in: invalidPhotoIds },
        });
    }

    return existentes.map(({ _id }) => String(_id));
}

export async function actualizarFotoGuardada(photoId, userId, guardar) {
    if (!ObjectId.isValid(photoId)) {
        return null;
    }

    const db = await conectarDB();
    const idFoto = new ObjectId(String(photoId));
    const normalizedPhotoId = String(idFoto);
    const normalizedUserId = String(userId);

    const foto = await db.collection("fotos").findOne(
        { _id: idFoto },
        {
            projection: {
                _id: 1,
                usuarioId: 1,
            },
        },
    );

    if (!foto) {
        return null;
    }

    if (foto.usuarioId) {
        const owner = await db.collection("usuarios").findOne(
            { _id: new ObjectId(String(foto.usuarioId)) },
            { projection: { profilePublic: 1 } },
        );
        if (
            owner?.profilePublic === false &&
            String(foto.usuarioId) !== normalizedUserId
        ) {
            return null;
        }
    }

    const coleccionGuardados = db.collection("photo_saves");
    const saveId = `${normalizedPhotoId}:${normalizedUserId}`;

    if (guardar) {
        await coleccionGuardados.updateOne(
            { _id: saveId },
            {
                $setOnInsert: {
                    photoId: idFoto,
                    userId: normalizedUserId,
                    createdAt: new Date(),
                },
            },
            {
                upsert: true,
            },
        );
    } else {
        await coleccionGuardados.deleteOne({ _id: saveId });
    }

    const guardadoActual = await coleccionGuardados.findOne(
        { _id: saveId },
        { projection: { _id: 1 } },
    );

    return {
        isSaved: Boolean(guardadoActual),
        savedCount: await coleccionGuardados.countDocuments({ photoId: idFoto }),
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

    const idFoto = new ObjectId(String(photoId));
    const normalizedPhotoId = String(idFoto);

    const foto = await db.collection("fotos").findOne(
        { _id: idFoto },
        {
            projection: {
                _id: 1,
                usuarioId: 1,
            },
        },
    );

    if (!foto) {
        return null;
    }

    if (foto.usuarioId) {
        const owner = await db.collection("usuarios").findOne(
            { _id: new ObjectId(String(foto.usuarioId)) },
            { projection: { profilePublic: 1 } },
        );
        if (
            owner?.profilePublic === false &&
            String(foto.usuarioId) !== String(userId)
        ) {
            return null;
        }
    }

    const coleccionLikes = db.collection("photo_likes");

    const likeId = `${normalizedPhotoId}:${String(userId)}`;

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

    const [countRows, existingLike] = await Promise.all([
        coleccionLikes
            .aggregate([
                { $match: { photoId: idFoto } },
                { $group: { _id: "$userId" } },
                { $count: "total" },
            ])
            .toArray(),

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
        count: countRows[0]?.total ?? 0,
        isLiked: Boolean(existingLike),
        estadisticas: await obtenerEstadisticasUsuario(userId),
    };
}

export async function obtenerEstadisticasUsuario(userId) {
    const db = await conectarDB();
    const normalizedUserId = String(userId);

    const [received, given] = await Promise.all([
        db.collection("fotos")
            .aggregate([
                {
                    $match: {
                        $expr: {
                            $eq: [
                                { $toString: "$usuarioId" },
                                normalizedUserId,
                            ],
                        },
                    },
                },
                {
                    $lookup: {
                        from: "photo_likes",
                        localField: "_id",
                        foreignField: "photoId",
                        as: "likes",
                    },
                },
                {
                    $addFields: {
                        _uniqueLikeCount: {
                            $size: {
                                $setUnion: [
                                    {
                                        $map: {
                                            input: "$likes",
                                            as: "like",
                                            in: "$$like.userId",
                                        },
                                    },
                                    [],
                                ],
                            },
                        },
                    },
                },
                {
                    $group: {
                        _id: null,
                        publicaciones: { $sum: 1 },
                        likesRecibidos: { $sum: "$_uniqueLikeCount" },
                    },
                },
            ])
            .toArray(),
        db.collection("photo_likes")
            .aggregate([
                { $match: { userId: normalizedUserId } },
                {
                    $lookup: {
                        from: "fotos",
                        localField: "photoId",
                        foreignField: "_id",
                        as: "_photo",
                    },
                },
                { $match: { "_photo.0": { $exists: true } } },
                { $group: { _id: "$photoId" } },
                { $count: "total" },
            ])
            .toArray(),
    ]);

    return {
        publicaciones: received[0]?.publicaciones ?? 0,
        likesRecibidos: received[0]?.likesRecibidos ?? 0,
        likesDados: given[0]?.total ?? 0,
    };
}

export async function obtenerFotoPorReferencia(imagen) {
    const db = await conectarDB();
    return db.collection("fotos").findOne(
        { imagen },
        { projection: { usuarioId: 1, imagen: 1 } },
    );
}

export async function imagenEnUso(imagen) {
    const db = await conectarDB();
    const [photoCount, avatarCount] = await Promise.all([
        db.collection("fotos").countDocuments({ imagen }),
        db.collection("usuarios").countDocuments({ avatar: imagen }),
    ]);
    return photoCount > 0 || avatarCount > 0;
}

export async function eliminarFoto(photoId, usuarioId) {
    if (!ObjectId.isValid(photoId)) {
        return null;
    }

    const db = await conectarDB();

    const idFoto = new ObjectId(String(photoId));
    const ownedPhotoFilter = {
        _id: idFoto,
        $expr: {
            $eq: [{ $toString: "$usuarioId" }, String(usuarioId)],
        },
    };

    const foto = await db.collection("fotos").findOne(ownedPhotoFilter);

    if (!foto) {
        return null;
    }

    const deletion = await db.collection("fotos").deleteOne(ownedPhotoFilter);
    if (deletion.deletedCount !== 1) {
        return null;
    }

    await db.collection("photo_likes").deleteMany({
        photoId: idFoto,
    });
    await db.collection("photo_saves").deleteMany({
        photoId: idFoto,
    });

    return foto;
}