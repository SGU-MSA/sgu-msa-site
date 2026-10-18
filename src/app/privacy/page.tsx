import type { Metadata } from "next";

import {
  PrivacyLedger,
  privacySummary,
} from "@/features/privacy/PrivacyLedger";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  title: "Privacy",
  description: privacySummary,
};

export default function PrivacyPage() {
  return <PrivacyLedger />;
}
