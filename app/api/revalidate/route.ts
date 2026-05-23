import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { SNAPSHOT_TAG } from "@/lib/data/snapshot";

const ALLOWED_TAGS = new Set([SNAPSHOT_TAG]);

interface RevalidateBody {
  tag?: string;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: Request) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "REVALIDATE_SECRET not configured on server" },
      { status: 500 },
    );
  }

  const provided = request.headers.get("x-revalidate-secret") ?? "";
  if (!timingSafeEqual(provided, expected)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: RevalidateBody = {};
  try {
    body = (await request.json()) as RevalidateBody;
  } catch {
    body = {};
  }

  const tag = body.tag ?? SNAPSHOT_TAG;
  if (!ALLOWED_TAGS.has(tag)) {
    return NextResponse.json(
      { ok: false, error: `Tag not allowed: ${tag}` },
      { status: 400 },
    );
  }

  revalidateTag(tag, "max");

  return NextResponse.json({
    ok: true,
    tag,
    revalidated_at: new Date().toISOString(),
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Use POST with x-revalidate-secret header and JSON { tag }",
    allowed_tags: [...ALLOWED_TAGS],
  });
}
