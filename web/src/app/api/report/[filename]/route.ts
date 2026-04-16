import { readFile } from "fs/promises";
import { resolve, join } from "path";
import { NextRequest } from "next/server";

const OUTPUT_DIR = resolve(process.cwd(), process.env.OUTPUT_DIR || "../output");

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const { filename } = params;
  if (!/^report_[0-9_]+\.pdf$/.test(filename)) {
    return new Response("Invalid filename", { status: 400 });
  }
  try {
    const buf = await readFile(join(OUTPUT_DIR, filename));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
