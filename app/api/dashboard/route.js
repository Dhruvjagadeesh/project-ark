import { NextResponse } from "next/server";
import { q } from "@/lib/mysql";
import { mdb } from "@/lib/mongo";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const { error } = await requireRole(); if (error) return error;
  try {
    const db = await mdb();
    const [counts, rescueByStatus, population, monthly, areaReport, inCare, cameraAgg, reportAgg] = await Promise.all([
      q(`SELECT (SELECT COUNT(*) FROM species) species,
                (SELECT COUNT(*) FROM species WHERE conservation_status IN ('CR','EN')) threatened,
                (SELECT COUNT(*) FROM rescue_operations WHERE status NOT IN ('COMPLETED','CANCELLED')) open_rescues,
                (SELECT COUNT(*) FROM v_animals_in_care) in_care,
                (SELECT COUNT(*) FROM sightings WHERE is_verified = FALSE) pending_sightings`),
      q("SELECT status, SUM(total) AS total FROM v_rescue_stats GROUP BY status"),
      q("SELECT * FROM v_species_population ORDER BY total_population DESC"),
      q(`SELECT month, SUM(reports) AS reports, SUM(individuals) AS individuals
         FROM v_monthly_sightings GROUP BY month ORDER BY month`),
      q(`SELECT pa.name, pa.area_type, COUNT(DISTINCT d.species_id) AS species_count,
                COALESCE(SUM(d.population_count),0) AS population, fn_avg_rescue_hours(pa.area_id) AS avg_rescue_hours
         FROM protected_areas pa LEFT JOIN species_distribution d ON d.area_id = pa.area_id
         GROUP BY pa.area_id, pa.name, pa.area_type ORDER BY population DESC`),
      q("SELECT * FROM v_animals_in_care"),
      db.collection("camera_traps").aggregate([
        { $unwind: "$detections" },
        { $group: { _id: "$detections.species_id", captures: { $sum: 1 }, individuals: { $sum: "$detections.count" }, avg_conf: { $avg: "$detections.confidence" } } },
        { $sort: { individuals: -1 } }]).toArray(),
      db.collection("field_reports").aggregate([
        { $group: { _id: "$type", n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray(),
    ]);
    // map species ids from Mongo aggregation to names from MySQL
    const names = Object.fromEntries(population.map(p => [p.species_id, p.common_name]));
    cameraAgg.forEach(c => c.name = names[c._id] || `#${c._id}`);
    return NextResponse.json({ counts: counts[0], rescueByStatus, population, monthly, areaReport, inCare, cameraAgg, reportAgg });
  } catch (e) {
    console.error("Dashboard error:", e);
    return NextResponse.json({ error: "Dashboard query failed: " + (e.sqlMessage || e.message) }, { status: 500 });
  }
}