import { NextResponse } from "next/server";
import { q } from "@/lib/mysql";
import { requireRole, dbError } from "@/lib/auth";

// GET ?search=tiger&status=EN&category=MAMMAL  (full-text search + filters)
export async function GET(req) {
  const { error } = await requireRole(); if (error) return error;
  const p = req.nextUrl.searchParams;
  const where = [], params = [];
  let score = "0";
  if (p.get("search")) {
    score = "MATCH(s.common_name, s.scientific_name, s.description) AGAINST (? IN NATURAL LANGUAGE MODE)";
    where.push(`(${score} OR s.common_name LIKE ?)`);
    params.push(p.get("search"), `%${p.get("search")}%`);
  }
  if (p.get("status"))   { where.push("s.conservation_status = ?"); params.push(p.get("status")); }
  if (p.get("category")) { where.push("s.category = ?"); params.push(p.get("category")); }
  const sql = `SELECT s.*, v.total_population, v.areas_present, ${score} AS relevance
               FROM species s JOIN v_species_population v ON v.species_id = s.species_id
               ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY relevance DESC, FIELD(s.conservation_status,'EX','EW','CR','EN','VU','NT','LC'), s.common_name`;
  const scoreParams = p.get("search") ? [p.get("search")] : [];
  return NextResponse.json(await q(sql, [...scoreParams, ...params]));
}

export async function POST(req) {
  const { error } = await requireRole("ADMIN"); if (error) return error;
  const b = await req.json();
  try {
    const r = await q(`INSERT INTO species(common_name, scientific_name, category, habitat_type, conservation_status, estimated_population, description)
                       VALUES (?,?,?,?,?,?,?)`,
      [b.common_name, b.scientific_name, b.category, b.habitat_type || null, b.conservation_status, b.estimated_population || null, b.description || null]);
    return NextResponse.json({ id: r.insertId });
  } catch (e) { return dbError(e); }
}

// Update conservation status (fires trg_species_audit)
export async function PATCH(req) {
  const { error } = await requireRole("ADMIN"); if (error) return error;
  const b = await req.json();
  try {
    await q("UPDATE species SET conservation_status = ? WHERE species_id = ?", [b.conservation_status, b.species_id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return dbError(e); }
}
