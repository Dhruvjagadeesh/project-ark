import { NextResponse } from "next/server";
import { q } from "@/lib/mysql";
import { mdb } from "@/lib/mongo";
import { requireRole, dbError } from "@/lib/auth";

export async function GET(req) {
  const { error } = await requireRole(); if (error) return error;
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const [log, doc] = await Promise.all([
      q("SELECT * FROM rescue_status_log WHERE rescue_id = ? ORDER BY changed_at", [id]),
      (await mdb()).collection("rescue_docs").findOne({ rescue_id: Number(id) }),
    ]);
    return NextResponse.json({ log, entries: doc?.entries || [] });
  }
  return NextResponse.json(await q(`SELECT r.*, s.common_name, pa.name AS area, t.team_name, u.full_name AS reporter,
        a.tag_code FROM rescue_operations r
      JOIN species s ON s.species_id = r.species_id JOIN protected_areas pa ON pa.area_id = r.area_id
      JOIN users u ON u.user_id = r.reported_by LEFT JOIN rescue_teams t ON t.team_id = r.team_id
      LEFT JOIN animals a ON a.animal_id = r.animal_id
      ORDER BY FIELD(r.status,'REPORTED','APPROVED','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED'),
               FIELD(r.priority,'CRITICAL','HIGH','MEDIUM','LOW'), r.reported_at DESC`));
}

export async function POST(req) {
  const { error, user } = await requireRole("ADMIN", "FOREST_OFFICER"); if (error) return error;
  const b = await req.json();
  try {
    const r = await q(`INSERT INTO rescue_operations(animal_id, species_id, area_id, reported_by, priority, description)
                       VALUES (?,?,?,?,?,?)`, [b.animal_id || null, b.species_id, b.area_id, user.id, b.priority, b.description]);
    await (await mdb()).collection("rescue_docs").insertOne({ rescue_id: r.insertId,
      entries: [{ at: new Date(), by: Number(user.id), text: "Rescue reported: " + b.description }] });
    return NextResponse.json({ id: r.insertId });
  } catch (e) { return dbError(e); }
}

// action: approve | assign | progress | close | cancel | note
export async function PATCH(req) {
  const b = await req.json();
  const roles = { approve: ["ADMIN"], assign: ["ADMIN","FOREST_OFFICER"], progress: ["ADMIN","FOREST_OFFICER"],
                  close: ["ADMIN","FOREST_OFFICER"], cancel: ["ADMIN"], note: ["ADMIN","FOREST_OFFICER","VET_OFFICER"] };
  const { error, user } = await requireRole(...(roles[b.action] || ["ADMIN"])); if (error) return error;
  try {
    if (b.action === "approve")  await q("UPDATE rescue_operations SET status='APPROVED' WHERE rescue_id=? AND status='REPORTED'", [b.rescue_id]);
    if (b.action === "assign")   await q("CALL sp_assign_rescue_team(?, ?)", [b.rescue_id, b.team_id]);          // transaction + row locks
    if (b.action === "progress") await q("UPDATE rescue_operations SET status='IN_PROGRESS' WHERE rescue_id=? AND status='ASSIGNED'", [b.rescue_id]);
    if (b.action === "close")    await q("CALL sp_close_rescue(?, ?)", [b.rescue_id, b.center_id || null]);     // transaction
    if (b.action === "cancel")   await q("UPDATE rescue_operations SET status='CANCELLED' WHERE rescue_id=?", [b.rescue_id]);
    await (await mdb()).collection("rescue_docs").updateOne({ rescue_id: Number(b.rescue_id) },
      { $push: { entries: { at: new Date(), by: Number(user.id), text: b.text || `Action: ${b.action}` } } }, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch (e) { return dbError(e); }
}
