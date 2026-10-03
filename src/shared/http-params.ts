import type { Request } from "express";

export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return String(value[0] ?? "");
  return String(value ?? "");
}
