import Link from "next/link";
import { requireAdmin } from "@/lib/backend/server";
import { systemText } from "@/lib/system-text";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { collectionLabels } from "@/features/admin/fields";
import { boardPage } from "@/features/admin/page-state/board-page";

async function DashboardPage() {
  const admin = await requireAdmin();
  return (
    <div className="admin-shell">
      <AdminHeader title="Your community website" home tour="dashboard" />
      <p className="muted">
        Choose what to update. Save a draft to work privately, or publish when
        information is confirmed. Changes appear without a deployment.
      </p>
      <div className="content-grid">
        {Object.entries(collectionLabels).map(([key, label], index) => (
          <Link
            className="content-card interactive-card"
            href={"/admin/content/" + key}
            key={key}
            data-tour={index === 0 ? "dashboard-content" : undefined}
          >
            <h2>{label}</h2>
            <p>View, create, and edit {label.toLowerCase()} →</p>
          </Link>
        ))}
        <Link
          className="content-card interactive-card"
          href="/admin/prayer-times"
          data-tour="dashboard-prayer"
        >
          <h2>Prayer & iqamah</h2>
          <p>Iqamah, Jumu’ah and one-day changes →</p>
        </Link>
        {/* Pages: the Executive board only (review 3 B). */}
        {admin.canEditPages ? (
          <Link className="content-card interactive-card" href="/admin/pages">
            <h2>Pages</h2>
            <p>
              The words and photos on each page, sign-up forms, FAQ and Qur’an
              verses →
            </p>
          </Link>
        ) : null}
        <Link className="content-card interactive-card" href="/admin/lists">
          <h2>Lists</h2>
          <p>Event categories, terms and resource categories →</p>
        </Link>
        <Link className="content-card interactive-card" href="/admin/photos">
          <h2>Photos</h2>
          <p>
            Every uploaded photo and PDF, where it is used, and the space left →
          </p>
        </Link>
        <Link
          className="content-card interactive-card"
          href="/admin/people"
          data-tour="dashboard-people"
        >
          <h2>People</h2>
          <p>Add and edit the team, its groups and the public team list →</p>
        </Link>
        <Link
          className="content-card interactive-card"
          href={
            admin.canManageMoney ? "/admin/payments" : "/admin/payments/funds"
          }
        >
          <h2>Payments</h2>
          <p>Funds, tickets and their Go2Pay pages, and the money in →</p>
        </Link>
        <Link className="content-card interactive-card" href="/admin/seasons">
          <h2>Seasons</h2>
          <p>
            Ramadan, the two Eids and other seasons, their days and their pages
            →
          </p>
        </Link>
        <Link className="content-card interactive-card" href="/admin/merch">
          <h2>Merch</h2>
          <p>Collections, items, photos and sizes →</p>
        </Link>
        <Link
          className="content-card interactive-card"
          href="/admin/activity"
          data-tour="dashboard-activity"
        >
          <h2>Recent changes</h2>
          <p>See who changed what and when →</p>
        </Link>
        {/* Term export: "Manage people" holders only (review fixes P5). */}
        {admin.canManagePeople ? (
          <Link
            className="content-card interactive-card"
            href="/admin/term-export"
          >
            <h2>{systemText.termExport.title}</h2>
            <p>{systemText.termExport.card}</p>
          </Link>
        ) : null}
        <Link
          className="content-card interactive-card"
          href="/admin/handover"
          data-tour="dashboard-handover"
        >
          <h2>New board term</h2>
          <p>The hand-over checklist and who holds each shared login →</p>
        </Link>
      </div>
      <section className="content-card">
        <h2>Before you publish</h2>
        <p>
          Confirm dates, locations, links, and photo permission. All times use
          Grenada time. Expired notices disappear automatically; finished events
          leave the upcoming list.
        </p>
        <p>
          <Link
            className="text-link"
            href="/admin/help"
            data-tour="dashboard-help"
          >
            Read the board editing guide →
          </Link>
        </p>
      </section>
    </div>
  );
}

export default boardPage(DashboardPage);
