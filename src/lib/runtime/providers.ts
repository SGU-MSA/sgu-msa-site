import "server-only";
import { cache } from "react";
import { createMockContentProvider } from "@/lib/community/providers/mock";
import { supabaseContentProvider } from "@/lib/community/providers/supabase";
import type { ContentProvider } from "@/lib/community/providers/contract";
import { yamlEditorialSource } from "@/lib/content/providers/yaml";
import { createSampleEditorialSource } from "@/lib/content/providers/sample";
import { createSupabaseEditorialSource } from "@/lib/content/providers/supabase";
import type { EditorialSource } from "@/lib/content/providers/contract";
import { publicClient } from "@/lib/backend/server";
import {
  createFakeCheckout,
  createFakeGateway,
} from "@/lib/integrations/payments/providers/fake";
import { createGo2PayGateway } from "@/lib/integrations/payments/providers/go2pay";
import { offPaymentGateway } from "@/lib/integrations/payments/providers/off-gateway";
import { createSamplePaymentsProvider } from "@/lib/integrations/payments/providers/sample";
import { supabasePaymentsProvider } from "@/lib/integrations/payments/providers/supabase";
import type {
  FakeCheckout,
  PaymentGateway,
  PaymentsProvider,
} from "@/lib/integrations/payments/providers/contract";
import { createSamplePlacesProvider } from "@/lib/maps/providers/sample";
import { supabasePlacesProvider } from "@/lib/maps/providers/supabase";
import type { PlacesProvider } from "@/lib/maps/providers/contract";
import {
  createSampleAdminAuth,
  createSampleContentEditor,
} from "@/lib/backend/providers/sample";
import {
  createSampleAccountInviter,
  createSampleActivityLog,
  createSamplePeopleEditor,
} from "@/lib/backend/providers/sample-people";
import {
  createSupabaseContentEditor,
  supabaseAdminAuth,
} from "@/lib/backend/providers/supabase";
import {
  createSupabasePeopleEditor,
  supabaseActivityLog,
} from "@/lib/backend/providers/supabase-people";
import { createSampleHandoverEditor } from "@/lib/backend/providers/sample-handover";
import { createSupabaseHandoverEditor } from "@/lib/backend/providers/supabase-handover";
import { createSampleOrderEditor } from "@/lib/backend/providers/sample-order";
import { createSupabaseOrderEditor } from "@/lib/backend/providers/supabase-order";
import { createSupabaseAccountInviter } from "@/lib/backend/providers/supabase-inviter";
import { createSamplePaymentItemEditor } from "@/lib/backend/providers/sample-payments";
import { createSupabasePaymentItemEditor } from "@/lib/backend/providers/supabase-payments";
import { createSampleSeasonEditor } from "@/lib/backend/providers/sample-seasons";
import { createSampleMerchEditor } from "@/lib/backend/providers/sample-merch";
import { createSupabaseMerchEditor } from "@/lib/backend/providers/supabase-merch";
import { createSupabaseSeasonEditor } from "@/lib/backend/providers/supabase-seasons";
import { offAccountInviter } from "@/lib/backend/providers/off-inviter";
import { createGmailWarningMailer } from "@/lib/backend/providers/gmail-mailer";
import { createSampleWarningMailer } from "@/lib/backend/providers/sample-mailer";
import { offWarningMailer } from "@/lib/backend/providers/off-mailer";
import { createSupabaseWarningLedger } from "@/lib/backend/providers/supabase-ledger";
import { createSampleWarningLedger } from "@/lib/backend/providers/sample-ledger";
import { offWarningLedger } from "@/lib/backend/providers/off-ledger";
import type {
  AccountInviter,
  ActivityLog,
  AdminAuth,
  ContentEditor,
  HandoverEditor,
  OrderEditor,
  PaymentItemEditor,
  PeopleEditor,
  SeasonEditor,
  MerchEditor,
  WarningLedger,
  WarningMailer,
} from "@/lib/backend/providers/contract";
import { fixedClock, systemClock, type Clock } from "./clock";
import {
  gmailAppPassword,
  go2payApiKey,
  runtimeConfig,
  supabaseSecretKey,
} from "./config";
import { deploymentProfileFor, planWiring } from "./wiring";

/**
 * The composition point (ADR 0012): the only module that imports adapters.
 * Each accessor resolves once per request.
 */
const wiring = cache(() => planWiring(runtimeConfig()));

export const clock = cache((): Clock => {
  const chosen = wiring().clock;
  return chosen === "system" ? systemClock : fixedClock(chosen.fixed);
});

export const deploymentProfile = cache(() =>
  deploymentProfileFor(runtimeConfig()),
);

export const contentProvider = cache((): ContentProvider =>
  wiring().content === "sample"
    ? createMockContentProvider(clock().now())
    : supabaseContentProvider,
);

/**
 * Editorial page copy (PR5b): page text from Supabase, read once per request;
 * the documents still in YAML (the dhikr) from the YAML adapter. The sandbox: the starter YAML with its own edits.
 */
export const editorialSource = cache((): EditorialSource => {
  switch (wiring().editorial) {
    case "supabase":
      return createSupabaseEditorialSource(publicClient, yamlEditorialSource);
    case "sample":
      return createSampleEditorialSource(clock().now(), yamlEditorialSource);
  }
});

/** Public reads of funds, priced items, their links and seasons (PR6). */
export const paymentsProvider = cache((): PaymentsProvider =>
  wiring().payments === "sample"
    ? createSamplePaymentsProvider(clock().now())
    : supabasePaymentsProvider,
);

/** Board writes of funds, priced items and links (PR6; no Go2Pay call). */
export const paymentItemEditor = cache((): PaymentItemEditor =>
  wiring().payments === "sample"
    ? createSamplePaymentItemEditor(clock().now())
    : createSupabasePaymentItemEditor(clock()),
);

/** Board writes of seasons (PR6). */
export const seasonEditor = cache((): SeasonEditor =>
  wiring().seasons === "sample"
    ? createSampleSeasonEditor(clock().now())
    : createSupabaseSeasonEditor(clock()),
);

/** Board writes of merch collections and items (PR5c; sizes are payment items). */
export const merchEditor = cache((): MerchEditor =>
  wiring().payments === "sample"
    ? createSampleMerchEditor(clock().now())
    : createSupabaseMerchEditor(clock()),
);

/**
 * The Go2Pay API, server-only: the only place the Go2Pay key is handed out
 * (PR6 D-74). The live site refuses a key that can do more than take
 * payments; elsewhere it only warns.
 */
export const paymentGateway = cache((): PaymentGateway => {
  switch (wiring().gateway) {
    case "fake":
      return createFakeGateway(clock().now());
    case "off":
      return offPaymentGateway;
    case "go2pay": {
      const config = runtimeConfig();
      if (config.go2pay === "off")
        throw new Error("Gateway wiring chose Go2Pay without a Go2Pay key.");
      return createGo2PayGateway({
        key: go2payApiKey(config),
        mode: config.go2pay,
        refuseBroadKey: config.production,
      });
    }
  }
});

/** The sandbox checkout: only with the fake gateway (sample data), else null. */
export const fakeCheckout = cache((): FakeCheckout | null =>
  wiring().gateway === "fake" ? createFakeCheckout(clock().now()) : null,
);

/** The musallah location: the board's one pin (PR7). */
export const placesProvider = cache((): PlacesProvider =>
  wiring().places === "sample"
    ? createSamplePlacesProvider(clock().now())
    : supabasePlacesProvider,
);

/** Board writes and protected reads (ADR 0012 rule 6). */
export const contentEditor = cache((): ContentEditor =>
  wiring().editor === "sample"
    ? createSampleContentEditor(clock().now())
    : createSupabaseContentEditor(clock()),
);

export const adminAuth = cache((): AdminAuth =>
  wiring().auth === "sample"
    ? createSampleAdminAuth(clock().now())
    : supabaseAdminAuth,
);

/** People, team sections and access (ADR 0007). */
export const peopleEditor = cache((): PeopleEditor =>
  wiring().people === "sample"
    ? createSamplePeopleEditor(clock().now())
    : createSupabasePeopleEditor(clock()),
);

/** Recent changes (read only; database triggers write the log). */
export const activityLog = cache((): ActivityLog =>
  wiring().activity === "sample"
    ? createSampleActivityLog(clock().now())
    : supabaseActivityLog,
);

/** New board term: hand-over steps and shared-login holders (PR5a). */
export const handoverEditor = cache((): HandoverEditor =>
  wiring().handover === "sample"
    ? createSampleHandoverEditor(clock().now())
    : createSupabaseHandoverEditor(clock()),
);

/** "Save order" on the board's dragged lists (review fixes PR-2). */
export const orderEditor = cache((): OrderEditor =>
  wiring().order === "sample"
    ? createSampleOrderEditor(clock().now())
    : createSupabaseOrderEditor(),
);

/**
 * Invite emails and the daily check's "already emailed" list: the only place
 * the secret key is handed out (ADR 0007, ADR 0022).
 */
export const accountInviter = cache((): AccountInviter => {
  switch (wiring().inviter) {
    case "sample":
      return createSampleAccountInviter(clock().now());
    case "off":
      return offAccountInviter;
    case "supabase": {
      const config = runtimeConfig();
      if (!config.supabase)
        throw new Error(
          "Invite wiring chose Supabase without Supabase settings.",
        );
      return createSupabaseAccountInviter({
        url: config.supabase.url,
        secretKey: supabaseSecretKey(config),
      });
    }
  }
});

/** The daily check's warning email: Gmail only in Vercel Production (ADR 0022). */
export const warningMailer = cache((): WarningMailer => {
  switch (wiring().mailer) {
    case "sample":
      return createSampleWarningMailer(clock().now());
    case "off":
      return offWarningMailer;
    case "gmail": {
      const config = runtimeConfig();
      if (config.warningMail === "off")
        throw new Error("Mailer wiring chose Gmail without Gmail settings.");
      return createGmailWarningMailer({
        address: config.warningMail.address,
        appPassword: gmailAppPassword(config),
      });
    }
  }
});

/** What the daily check already emailed (ADR 0022: the secret key's one table). */
export const warningLedger = cache((): WarningLedger => {
  switch (wiring().ledger) {
    case "sample":
      return createSampleWarningLedger(clock().now());
    case "off":
      return offWarningLedger;
    case "supabase": {
      const config = runtimeConfig();
      if (!config.supabase)
        throw new Error(
          "Ledger wiring chose Supabase without Supabase settings.",
        );
      return createSupabaseWarningLedger({
        url: config.supabase.url,
        secretKey: supabaseSecretKey(config),
      });
    }
  }
});
