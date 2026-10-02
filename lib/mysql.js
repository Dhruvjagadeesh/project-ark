import mysql from "mysql2/promise";

// Single pool reused across hot reloads. Credentials come only from env vars.
const g = globalThis;
export const pool = g._arkPool || mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  connectionLimit: 10,
  dateStrings: true,
});
if (process.env.NODE_ENV !== "production") g._arkPool = pool;

// Parameterised queries only (prevents SQL injection)
export async function q(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
