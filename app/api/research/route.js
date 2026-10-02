import { NextResponse } from "next/server";
import { mdb } from "@/lib/mongo";
import { requireRole } from "@/lib/auth";

// GET ?search=invasive&kind=HABITAT_SURVEY   -> MongoDB $text search ranked by textScore
export async function GET(req) {
  const { error } = await requireRole(); if (error) return error;
  const p = req.nextUrl.searchParams, db = await mdb();
  const filter = {};
  if (p.get("kind")) filter.kind = p.get("kind");
  if (p.get("search")) filter.$text = { $search: p.get("search") };
  const cursor = db.collection("research_notes").find(filter, p.get("search") ? { projection: { score: { $meta: "textScore" } } } : {});
  const notes = await (p.get("search") ? cursor.sort({ score: { $meta: "textScore" } }) : cursor.sort({ created_at: -1 })).limit(100).toArray();
  return NextResponse.json(notes);
}

export async function POST(req) {
  const { error, user } = await requireRole("RESEARCHER", "ADMIN"); if (error) return error;
  const b = await req.json();
  let survey;
  try { survey = b.survey ? JSON.parse(b.survey) : undefined; }
  catch { return NextResponse.json({ error: "Survey metrics must be valid JSON" }, { status: 400 }); }
  try {
    const doc = { kind: b.kind, title: b.title, body: b.body, author_id: Number(user.id),
      area_id: b.area_id ? Number(b.area_id) : null, species_ids: (b.species_ids || []).map(Number),
      tags: (b.tags || "").split(",").map(t => t.trim()).filter(Boolean), created_at: new Date() };
    if (survey) doc.survey = survey;
    const r = await (await mdb()).collection("research_notes").insertOne(doc);
    return NextResponse.json({ id: r.insertedId });
  } catch (e) {
    return NextResponse.json({ error: "Rejected by MongoDB schema validation: " + e.message }, { status: 400 });
  }
}
