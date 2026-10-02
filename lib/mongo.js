import { MongoClient, ObjectId } from "mongodb";

// Lazily connect once and reuse the client. URI comes only from env vars.
const g = globalThis;
export async function mdb() {
  if (!g._arkMongo) g._arkMongo = new MongoClient(process.env.MONGODB_URI).connect();
  const client = await g._arkMongo;
  return client.db(process.env.MONGODB_DB);
}
export { ObjectId };
