import { NextResponse } from "next/server";
import { mdb } from "@/lib/mongo";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const { error } = await requireRole(); if (error) return error;
  return NextResponse.json(await (await mdb()).collection("camera_traps").find().sort({ captured_at: -1 }).limit(100).toArray());
}

export async function POST(req) {
  const { error } = await requireRole("RESEARCHER", "FOREST_OFFICER", "ADMIN"); if (error) return error;
  const b = await req.json();
  try {
    const r = await (await mdb()).collection("camera_traps").insertOne({
      trap_code: b.trap_code, area_id: Number(b.area_id),
      location: { type: "Point", coordinates: [Number(b.longitude), Number(b.latitude)] },
      captured_at: new Date(b.captured_at),
      detections: [{ species_id: Number(b.species_id), count: Number(b.count), confidence: Number(b.confidence || 1) }],
      image_meta: { infrared: !!b.infrared },
    });
    return NextResponse.json({ id: r.insertedId });
  } catch (e) { return NextResponse.json({ error: "Rejected by MongoDB validation: " + e.message }, { status: 400 }); }
}
