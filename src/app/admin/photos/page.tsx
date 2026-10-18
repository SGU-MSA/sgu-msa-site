import Link from "next/link";
import { FileText } from "lucide-react";
import { localDate } from "@/lib/community/schema";
import {
  sizeLabel,
  storageLevel,
  storagePercent,
  STORAGE_LIMIT_LABEL,
} from "@/lib/media/storage-space";
import { systemText } from "@/lib/system-text";
import { dayLabel } from "@/lib/time/date-label";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { boardPage } from "@/features/admin/page-state/board-page";
import { DeleteFile } from "@/features/admin/photos/DeleteFile";
import { photoLibrary } from "@/features/admin/photos/photo-library";

const words = systemText.photos;

/**
 * Photos (photo library, 2026-10-06): every uploaded photo and PDF, newest
 * first, where each is used, and the space they take of the free 1 GB.
 * Delete only on a file nothing uses; any board member.
 */
async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const library = await photoLibrary();
  return (
    <div className="admin-shell">
      <AdminHeader title={words.title} />
      {query.deleted ? (
        <p role="status" className="success-message">
          {words.deleted}
        </p>
      ) : null}
      <p className="muted">{words.intro}</p>
      {library.unavailable ? (
        <p role="alert" className="content-card">
          {words.unavailable}
        </p>
      ) : (
        <>
          <section
            className="content-card photo-space"
            aria-labelledby="photo-space"
          >
            <h2 id="photo-space">
              {words.space(
                sizeLabel(library.bytes),
                STORAGE_LIMIT_LABEL,
                storagePercent(library.bytes),
              )}
            </h2>
            <div className="photo-space-bar" aria-hidden="true">
              {/* Nothing stored: an empty bar, not a sliver. */}
              {library.bytes > 0 ? (
                <span
                  style={{
                    width: `${Math.min(100, storagePercent(library.bytes))}%`,
                  }}
                />
              ) : null}
            </div>
            {storageLevel(library.bytes) ? (
              <p className="form-error">{words.nearlyFull}</p>
            ) : null}
            <p>{words.spaceNote}</p>
          </section>
          {library.files.length ? (
            <ul className="photo-library">
              {library.files.map((file) => {
                const details = words.details(
                  file.uploadedAt
                    ? dayLabel(localDate(new Date(file.uploadedAt)))
                    : null,
                  sizeLabel(file.bytes),
                );
                return (
                  <li key={file.name} className="photo-card">
                    <div className="photo-card-thumb">
                      {file.kind === "photo" ? (
                        // eslint-disable-next-line @next/next/no-img-element -- a stored photo, shown as it is
                        <img
                          src={`/admin/media/${file.name}`}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span className="photo-card-pdf">
                          <FileText aria-hidden="true" />
                          {words.pdf}
                        </span>
                      )}
                    </div>
                    <div className="photo-card-body">
                      <p className="muted">{details}</p>
                      {file.uses.length ? (
                        <>
                          <p>{words.usedOn}</p>
                          <ul>
                            {file.uses.map((use) => (
                              <li key={use.href}>
                                <Link className="text-link" href={use.href}>
                                  {use.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <>
                          <p>
                            <strong>{words.notUsed}</strong>
                          </p>
                          <DeleteFile
                            name={file.name}
                            itemName={`${file.kind === "pdf" ? words.pdf : words.photo}, ${details}`}
                          />
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="content-card">{words.empty}</p>
          )}
        </>
      )}
    </div>
  );
}

export default boardPage(PhotosPage);
