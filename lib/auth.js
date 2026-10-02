import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { q } from "./mysql";

export const authOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const rows = await q("SELECT user_id, full_name, email, password_hash, role FROM users WHERE email = ? AND is_active = TRUE", [creds.email]);
        const u = rows[0];
        if (!u || !(await bcrypt.compare(creds.password, u.password_hash))) return null;
        return { id: u.user_id, name: u.full_name, email: u.email, role: u.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) { if (user) { token.role = user.role; token.uid = user.id; } return token; },
    async session({ session, token }) { session.user.role = token.role; session.user.id = token.uid; return session; },
  },
};

// Server-side role guard for API routes
export async function requireRole(...roles) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Not logged in" }, { status: 401 }) };
  if (roles.length && !roles.includes(session.user.role))
    return { error: NextResponse.json({ error: "Forbidden for role " + session.user.role }, { status: 403 }) };
  return { user: session.user };
}

// Turn MySQL trigger/constraint errors into readable API responses
export function dbError(e) {
  const msg = e.sqlMessage || e.message;
  const status = e.sqlState === "45000" || e.code === "ER_CHECK_CONSTRAINT_VIOLATED" || e.code === "ER_DUP_ENTRY" ? 400 : 500;
  return NextResponse.json({ error: msg }, { status });
}
