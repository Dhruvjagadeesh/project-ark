import { NextResponse } from "next/server";
import { q } from "@/lib/mysql";
import { requireRole, dbError } from "@/lib/auth";

export async function GET(req) {
  const { error } = await requireRole(); if (error) return error;
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const [records, treatments, vaccinations] = await Promise.all([
      q("SELECT h.*, u.full_name AS vet FROM health_records h JOIN users u ON u.user_id=h.vet_id WHERE animal_id=? ORDER BY exam_date DESC, record_id DESC", [id]),
      q("SELECT t.* FROM treatments t JOIN health_records h ON h.record_id=t.record_id WHERE h.animal_id=? ORDER BY start_date DESC", [id]),
      q("SELECT * FROM vaccinations WHERE animal_id=? ORDER BY given_on DESC", [id]),
    ]);
    return NextResponse.json({ records, treatments, vaccinations });
  }
  return NextResponse.json(await q(`SELECT a.*, s.common_name, vc.name AS center,
      (SELECT condition_level FROM health_records h WHERE h.animal_id=a.animal_id ORDER BY exam_date DESC, record_id DESC LIMIT 1) AS latest_condition
      FROM animals a JOIN species s ON s.species_id=a.species_id LEFT JOIN veterinary_centers vc ON vc.center_id=a.center_id
      ORDER BY FIELD(a.status,'IN_RESCUE','UNDER_TREATMENT','REHABILITATING','WILD','RELEASED','DECEASED')`));
}

export async function POST(req) {
  const { error } = await requireRole("ADMIN", "FOREST_OFFICER", "VET_OFFICER"); if (error) return error;
  const b = await req.json();
  try {
    const r = await q("INSERT INTO animals(species_id, tag_code, sex, est_age_years, status) VALUES (?,?,?,?,?)",
      [b.species_id, b.tag_code, b.sex || "UNKNOWN", b.est_age_years || null, b.status || "WILD"]);
    return NextResponse.json({ id: r.insertId });
  } catch (e) { return dbError(e); }
}

// Status change: rehabilitating / release (triggers enforce vet approval + fitness + center capacity)
export async function PATCH(req) {
  const { error, user } = await requireRole("VET_OFFICER", "ADMIN"); if (error) return error;
  const b = await req.json();
  try {
    if (b.status === "RELEASED")
      await q("UPDATE animals SET status='RELEASED', release_approved_by=? WHERE animal_id=?", [user.role === "VET_OFFICER" ? user.id : null, b.animal_id]);
    else if (b.center_id)
      await q("UPDATE animals SET status=?, center_id=? WHERE animal_id=?", [b.status, b.center_id, b.animal_id]);
    else
      await q("UPDATE animals SET status=? WHERE animal_id=?", [b.status, b.animal_id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return dbError(e); }
}
