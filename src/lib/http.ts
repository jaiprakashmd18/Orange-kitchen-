import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/lib/auth";
import { PricingError } from "@/lib/pricing";
import { firstError } from "@/lib/validation";

export function jsonError(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Maps known error types to safe JSON responses; logs the rest without leaking details. */
export function handleRouteError(err: unknown, context: string) {
  if (err instanceof HttpError) return jsonError(err.status, err.message, err.code);
  if (err instanceof PricingError) return jsonError(422, err.message, err.code);
  if (err instanceof ZodError) return jsonError(400, firstError(err), "VALIDATION");
  console.error(`[${context}]`, err);
  return jsonError(500, "Something went wrong. Please try again.", "INTERNAL");
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
