import { NextResponse } from "next/server";
import { pool, q } from "@/lib/mysql";
import { mdb } from "@/lib/mongo";
import { requireRole, dbError } from "@/lib/auth";

export async function GET(req) {
  const { error } = await requireRole(); if (error) return error;
  const p = req.nextUrl.searchParams, where = [], params = [];
  if (p.get("area"))     { where.push("g.area_id = ?");    params.push(p.get("area")); }
  if (p.get("species"))  { where.push("g.species_id = ?"); params.push(p.get("species")); }
  if (p.get("verified")) { where.push("g.is_verified = ?"); params.push(p.get("verified") === "1"); }
  const rows = await q(`SELECT g.*, s.common_name, pa.name AS area, u.full_name AS reporter
      FROM sightings g JOIN species s ON s.species_id = g.species_id
      JOIN protected_areas pa ON pa.area_id = g.area_id JOIN users u ON u.user_id = g.reported_by
      ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY g.sighted_at DESC LIMIT 200`, params);
  return NextResponse.json(rows);
}

// Hybrid write: structured row in MySQL + rich field report in MongoDB.
// MySQL transaction is committed only after the Mongo document is saved.
export async function POST(req) {
  const { error, user } = await requireRole("ADMIN", "FOREST_OFFICER", "RESEARCHER"); if (error) return error;
  const b = await req.json();
  const conn = await pool.getConnection();
  let mongoId = null;
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(`INSERT INTO sightings(species_id, area_id, reported_by, latitude, longitude, sighted_at, count_seen)
                                  VALUES (?,?,?,?,?,?,?)`,
      [b.species_id, b.area_id, user.id, b.latitude, b.longitude, b.sighted_at, b.count_seen || 1]);
    const db = await mdb();
    const doc = await db.collection("field_reports").insertOne({
      type: "SIGHTING", sighting_id: r.insertId, species_id: Number(b.species_id), area_id: Number(b.area_id),
      reported_by: Number(user.id), location: { type: "Point", coordinates: [Number(b.longitude), Number(b.latitude)] },
      observed_at: new Date(b.sighted_at), notes: b.notes || "No additional notes recorded.",
      weather: b.weather || undefined, tags: (b.tags || "").split(",").map(t => t.trim()).filter(Boolean),
      photos: b.photo ? [{ file_name: b.photo }] : [],
    });
    mongoId = doc.insertedId;
    await conn.query("UPDATE sightings SET mongo_report_id = ? WHERE sighting_id = ?", [mongoId.toString(), r.insertId]);
    await conn.commit();
    return NextResponse.json({ id: r.insertId, report: mongoId });
  } catch (e) {
    await conn.rollback();
    if (mongoId) (await mdb()).collection("field_reports").deleteOne({ _id: mongoId }); // compensate
    return dbError(e);
  } finally { conn.release(); }
}

// Verify a sighting
export async function PATCH(req) {
  const { error, user } = await requireRole("ADMIN", "FOREST_OFFICER"); if (error) return error;
  const b = await req.json();
  await q("UPDATE sightings SET is_verified = TRUE, verified_by = ? WHERE sighting_id = ?", [user.id, b.sighting_id]);
  return NextResponse.json({ ok: true });
}

// Delete an unverified sighting (and its Mongo report)
export async function DELETE(req) {
  const { error } = await requireRole("ADMIN"); if (error) return error;
  const id = req.nextUrl.searchParams.get("id");
  const r = await q("DELETE FROM sightings WHERE sighting_id = ? AND is_verified = FALSE", [id]);
  if (!r.affectedRows) return NextResponse.json({ error: "Only unverified sightings can be deleted" }, { status: 400 });
  await (await mdb()).collection("field_reports").deleteMany({ sighting_id: Number(id) });
  return NextResponse.json({ ok: true });
}
