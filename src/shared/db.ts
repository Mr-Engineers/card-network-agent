import postgres from "postgres";
import { getDatabaseUrl } from "./env.js";

let sql: ReturnType<typeof postgres> | null = null;

export function getSql() {
  if (!sql) {
    sql = postgres(getDatabaseUrl(), {
      prepare: false,
      max: 10,
      idle_timeout: 20,
      connect_timeout: 30,
    });
  }
  return sql;
}

export async function closeSql() {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = null;
  }
}

export function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value == null) return NaN;
  return Number(value);
}

export function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true as const,
  };
}
