import { currentAdmin } from "@/lib/backend/server";
import { zipStream, type ZipEntry } from "@/lib/media/zip";
import { clock, contentEditor } from "@/lib/runtime/providers";
import { systemText } from "@/lib/system-text";
import { readTerm } from "@/features/admin/term-export/read-term";
import {
  missingFilesSheet,
  termContents,
  termFolder,
  zipFileName,
} from "@/features/admin/term-export/term-contents";
import { termExportSchema } from "@/features/admin/term-export/term-form";
import {
  downloadStartedCookie,
  downloadToken,
} from "@/features/admin/term-export/download-mark";

// The term zip (review fixes P5): made per request while it downloads and
// never stored (`no-store`). Only "manage people" holders; anyone else gets
// 403. A list that cannot be read gives no zip (back to the screen with a
// message), so a missing list never looks like a complete term. The zip
// streams, so Vercel's 4.5 MB response limit does not apply; its time limit
// does: 300 seconds, the most on the free (Hobby) plan.
export const maxDuration = 300;

const words = systemText.termExport;
const utf8 = new TextEncoder();

export async function GET(request: Request) {
  const admin = await currentAdmin();
  if (!admin?.canManagePeople)
    return new Response(words.managersOnly, {
      status: 403,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  const query = new URL(request.url).searchParams;
  const term = termExportSchema.safeParse({
    name: query.get("name") ?? "",
    from: query.get("from") ?? "",
    until: query.get("until") ?? "",
  });
  const back = (problem: "invalid" | "unavailable") => {
    const screen = new URL("/admin/term-export", request.url);
    screen.searchParams.set("problem", problem);
    for (const key of ["name", "from", "until"])
      screen.searchParams.set(key, query.get(key) ?? "");
    return Response.redirect(screen, 303);
  };
  if (!term.success) return back("invalid");
  const data = await readTerm(term.data);
  if (!data) return back("unavailable");

  const { sheets, files } = termContents(data);
  const folder = termFolder(term.data);
  const made = clock().now();
  // Signed in now, while the request is open; the files are read one at a
  // time as the download asks for them.
  const stored = contentEditor().readFiles(files.map((file) => file.name));
  async function* entries(): AsyncGenerator<ZipEntry> {
    for (const sheet of sheets)
      yield {
        path: `${folder}/${sheet.path}`,
        data: utf8.encode(sheet.text),
        modified: made,
        compress: true,
      };
    const missing: string[] = [];
    let at = 0;
    for await (const { file } of stored) {
      const { path } = files[at++];
      if (!file) missing.push(path);
      else
        yield {
          path: `${folder}/${path}`,
          data: new Uint8Array(await file.arrayBuffer()),
          modified: made,
        };
    }
    if (missing.length) {
      const sheet = missingFilesSheet(missing);
      yield {
        path: `${folder}/${sheet.path}`,
        data: utf8.encode(sheet.text),
        modified: made,
        compress: true,
      };
    }
  }

  const name = zipFileName(term.data);
  const headers = new Headers({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]|"/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  // Tells the screen the download has started (`download-mark.ts`).
  const token = downloadToken(query.get("token"));
  if (token)
    headers.append(
      "Set-Cookie",
      `${downloadStartedCookie}=${token}; Path=/admin; Max-Age=120; SameSite=Lax`,
    );
  return new Response(zipStream(entries()), { headers });
}
