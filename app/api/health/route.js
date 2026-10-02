import { NextResponse } from "next/server";
import { pool, q } from "@/lib/mysql";
import { requireRole, dbError } from "@/lib/auth";

// Exam + optional treatment + optional vaccination saved atomically
export async function POST(req) {
  const { error, user } = await requireRole("VET_OFFICER", "ADMIN"); if (error) return error;
  const b = await req.json();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(`INSERT INTO health_records(animal_id, vet_id, exam_date, diagnosis, weight_kg, condition_level)
                                  VALUES (?,?,?,?,?,?)`, [b.animal_id, user.id, b.exam_date, b.diagnosis, b.weight_kg || null, b.condition_level]);
    if (b.medication)
      await conn.query("INSERT INTO treatments(record_id, medication, dosage, start_date, end_date) VALUES (?,?,?,?,?)",
        [r.insertId, b.medication, b.dosage || null, b.exam_date, b.end_date || null]);
    if (b.vaccine_name)
      await conn.query("INSERT INTO vaccinations(animal_id, vaccine_name, given_on, next_due) VALUES (?,?,?,?)",
        [b.animal_id, b.vaccine_name, b.exam_date, b.next_due || null]);
    await conn.commit();
    return NextResponse.json({ id: r.insertId });
  } catch (e) { await conn.rollback(); return dbError(e); }
  finally { conn.release(); }
}
