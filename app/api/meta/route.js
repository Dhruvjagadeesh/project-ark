import { NextResponse } from "next/server";
import { q } from "@/lib/mysql";
import { requireRole } from "@/lib/auth";

// Lookup lists for dropdowns
export async function GET() {
  const { error } = await requireRole(); if (error) return error;
  const [species, areas, teams, centers] = await Promise.all([
    q("SELECT species_id, common_name FROM species ORDER BY common_name"),
    q("SELECT area_id, name FROM protected_areas ORDER BY name"),
    q("SELECT team_id, team_name, is_available FROM rescue_teams ORDER BY team_name"),
    q("SELECT center_id, name, capacity FROM veterinary_centers ORDER BY name"),
  ]);
  return NextResponse.json({ species, areas, teams, centers });
}
