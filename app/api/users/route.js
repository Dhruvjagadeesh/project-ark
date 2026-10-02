import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { q } from "@/lib/mysql";
import { requireRole, dbError } from "@/lib/auth";

export async function GET() {
  const { error } = await requireRole("ADMIN"); if (error) return error;
  return NextResponse.json(await q("SELECT user_id, full_name, email, role, phone, is_active, created_at FROM users ORDER BY user_id"));
}

// Registration by admin; password stored only as bcrypt hash
export async function POST(req) {
  const { error } = await requireRole("ADMIN"); if (error) return error;
  const b = await req.json();
  if (!b.password || b.password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  try {
    const hash = await bcrypt.hash(b.password, 10);
    const r = await q("INSERT INTO users(full_name, email, password_hash, role, phone) VALUES (?,?,?,?,?)",
      [b.full_name, b.email, hash, b.role, b.phone || null]);
    return NextResponse.json({ id: r.insertId });
  } catch (e) { return dbError(e); }
}

export async function PATCH(req) {
  const { error } = await requireRole("ADMIN"); if (error) return error;
  const b = await req.json();
  await q("UPDATE users SET is_active = ? WHERE user_id = ?", [b.is_active, b.user_id]);
  return NextResponse.json({ ok: true });
}
