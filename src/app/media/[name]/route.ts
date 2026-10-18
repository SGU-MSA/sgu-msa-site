import { contentProvider } from "@/lib/runtime/providers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!/^[a-f0-9-]{36}\.(webp|pdf)$/.test(name))
    return new Response("Not found", { status: 404 });
  // Only files referenced by currently published records (the storage policy).
  const { file, unavailable } = await contentProvider().getMedia(name);
  if (unavailable) return new Response("Unavailable", { status: 503 });
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file, {
    headers: {
      "Content-Type": name.endsWith(".pdf") ? "application/pdf" : "image/webp",
      "Content-Disposition": `${name.endsWith(".pdf") ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
