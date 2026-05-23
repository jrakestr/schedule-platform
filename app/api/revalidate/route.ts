import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import crypto from "crypto";
import { z } from "zod";
import { SNAPSHOT_TAG } from "@/lib/data/snapshot";

const ALLOWED_TAGS = new Set([SNAPSHOT_TAG]);

const revalidateSchema = z.object({
  tag: z.string().optional().default(SNAPSHOT_TAG),
});

/**
 * Constant-time comparison function to mitigate timing-based length attacks.
 */
function timingSafeCompare(configuredSecret: string, clientSecret: string): boolean {
  const configuredBuffer = Buffer.from(configuredSecret, "utf-8");
  const clientBuffer = Buffer.from(clientSecret, "utf-8");

  if (configuredBuffer.length !== clientBuffer.length) {
    // Perform a safe dummy comparison check to mitigate timing-based length attacks in a constant-time secure manner.
    crypto.timingSafeEqual(configuredBuffer, configuredBuffer);
    return false;
  }

  return crypto.timingSafeEqual(configuredBuffer, clientBuffer);
}

export async function POST(request: Request) {
  const configuredSecret = process.env.REVALIDATE_SECRET;
  if (!configuredSecret) {
    return NextResponse.json(
      { ok: false, error: "REVALIDATE_SECRET not configured on server" },
      { status: 500 },
    );
  }

  const clientSecret = request.headers.get("x-revalidate-secret") ?? "";
  if (!timingSafeCompare(configuredSecret, clientSecret)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: { tag: string };
  try {
    const json = await request.json();
    const result = revalidateSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", details: result.error.issues },
        { status: 400 },
      );
    }
    body = result.data;
  } catch {
    // Fallback to empty object parsed with defaults if request has no body
    const result = revalidateSchema.safeParse({});
    body = result.success ? result.data : { tag: SNAPSHOT_TAG };
  }

  const tag = body.tag;
  if (!ALLOWED_TAGS.has(tag)) {
    return NextResponse.json(
      { ok: false, error: `Tag not allowed: ${tag}` },
      { status: 400 },
    );
  }

  // @ts-expect-error - The single-argument form is deprecated in Next.js 16 types but remains functional at runtime.
  revalidateTag(tag);

  return NextResponse.json({
    ok: true,
    tag,
    revalidated_at: new Date().toISOString(),
  });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Method Not Allowed",
      message: "Use POST with x-revalidate-secret header and JSON { tag }",
      allowed_tags: [...ALLOWED_TAGS],
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    }
  );
}
