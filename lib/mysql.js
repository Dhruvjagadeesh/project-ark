import mysql from "mysql2/promise";

const g = globalThis;
export const pool = g._arkPool || mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  connectionLimit: 5,
  dateStrings: true,
  // TLS for cloud MySQL; off for local MySQL
  ssl: process.env.MYSQL_SSL === "true"
    ? (process.env.MYSQL_CA ? { ca: process.env.MYSQL_CA } : { rejectUnauthorized: false })
    : undefined,
});
if (process.env.NODE_ENV !== "production") g._arkPool = pool;

export async function q(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}