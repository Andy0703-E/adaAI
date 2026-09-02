/**
 * Benchmark route — PERMANENTLY DISABLED.
 * This route exists only in git history for reference.
 * It must never be accessible in any environment other than local development.
 *
 * Do NOT re-enable by checking NODE_ENV — that check can be bypassed
 * in preview/staging deployments. Delete this file before deploying to production.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
