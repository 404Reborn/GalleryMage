import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";

const client = new MongoClient(uri);

export async function conectarDB() {
    await client.connect();

    console.log("Conectado a MongoDB");

    return client.db("gallerymage");
}