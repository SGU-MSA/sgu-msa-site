import { currentAdmin } from "@/lib/backend/server";
import { storedFileName } from "@/lib/community/schema";
import { contentEditor } from "@/lib/runtime/providers";

/**
 * Any stored photo or PDF for a signed-in board member (photo library,
 * 2026-10-06): the Photos screen and the photo chooser show files no
 * published item uses yet, which `/media/[name]` (visitors) never serves.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!storedFileName.safeParse(name).success || !(await currentAdmin()))
    return new Response("Not found", { status: 404 });
  const { file, unavailable } = await contentEditor().readFile(name);
  if (unavailable) return new Response("Unavailable", { status: 503 });
  if (!file) return new Response("Not found", { status: 404 });
  const pdf = name.endsWith(".pdf");
  return new Response(file, {
    headers: {
      "Content-Type": pdf ? "application/pdf" : "image/webp",
      "Content-Disposition": `${pdf ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
