import Link from "next/link";
import { requireAdmin } from "@/lib/backend/server";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { tourPages } from "@/features/admin/tour/steps";
import { boardPage } from "@/features/admin/page-state/board-page";

/**
 * The board's Help page (final plan B, one source per topic): the step-by-step
 * how-to lives only in the board's Word file, the SGU MSA Website Handbook,
 * so this page points to it and lists the "Show me how" tours, which are live
 * guidance on the real screens (ADR 0008).
 */
async function AdminHelp() {
  await requireAdmin();
  return (
    <div className="admin-shell narrow">
      <AdminHeader title="Help" />
      <section className="content-card" aria-labelledby="handbook">
        <h2 id="handbook">The board handbook</h2>
        <p>
          Step-by-step help for every task is in one Word file, the{" "}
          <strong>SGU MSA Website Handbook</strong>. The president keeps it: ask
          them for a copy.
        </p>
        <p>
          It also covers money with Go2Pay, sign-up forms, a new board term, and
          the shared accounts and emergencies.
        </p>
      </section>
      <section className="content-card" aria-labelledby="tours">
        <h2 id="tours">“Show me how” tours</h2>
        <p>
          A tour walks you through a screen, one part at a time. On these
          screens, <strong>Show me how</strong> beside <strong>Sign out</strong>{" "}
          plays it again.
        </p>
        <ul>
          {Object.entries(tourPages).map(([id, tour]) => (
            <li key={id}>
              <Link className="text-link" href={tour.href}>
                {tour.label} →
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default boardPage(AdminHelp);
