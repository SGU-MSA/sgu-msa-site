---
name: frontend-security
description: Prevents security flaws in the browser-facing parts of this Next.js and Supabase site, covering XSS and unsafe HTML, JSON-LD and URL injection, secrets leaking through NEXT_PUBLIC variables or client bundles, authorization inside server actions, Supabase RLS as the real boundary, file upload validation and photo privacy, embeds and the Content Security Policy, and payment-link integrity with Go2Pay. Use when rendering user- or board-supplied content, adding a server action, form, upload, embed or third-party script, touching auth or environment variables, or handling payment links and webhooks. Not for designing database schemas or RLS policies (use planning-engineering-changes) or general error handling (use cross-browser-error-resilience).
---

# Frontend security

Treat every value from a visitor, a board member, a webhook or a third party as untrusted until validated on the server.

## In this repo

- A baseline Content Security Policy and security headers live in `next.config.ts` (frame origins allowlisted, `frame-ancestors 'none'`). Adding an origin is a security change; justify it in the contract.
- Supabase sessions use `@supabase/ssr` cookies. Server-only modules (`src/lib/backend/*`, `src/lib/community/queries.ts`) start with `import "server-only"`.
- Admin server actions validate with zod and check `currentAdmin()` (`src/lib/backend/server.ts`).

## Secrets

- Only `NEXT_PUBLIC_*` variables reach the browser; everything else stays server-side. Service or secret Supabase keys and Go2Pay API keys never appear in client code, logs or errors.
- Never print, copy or commit values from `.env.local`.

## Authorization

- Every server action and route handler re-checks the caller (`currentAdmin()` for admin work). Hiding a button is not authorization.
- RLS is the real boundary: anonymous clients read only published data; writes require an admin. Test with `npm run test:backend`.
- Validate every input with zod: types, lengths, enums. Reject what you do not expect.

## Rendering untrusted content

- React escapes text by default. `dangerouslySetInnerHTML` only for JSON-LD (escape `<` as `<`, as `src/app/page.tsx` does) or HTML passed through a vetted sanitizer. Adding a sanitizer or rich-text editor is a dependency decision; prefer structured fields or Markdown rendered to React elements.
- URLs from content or forms: allow only `https:`, `mailto:`, `tel:` and relative paths; never render `javascript:` or `data:` links.
- External links opened in a new tab use `rel="noopener noreferrer"`.

## Uploads (Supabase Storage via `src/lib/backend/storage.ts`)

- Allowlist MIME types and extensions and check them on the server; enforce a size limit.
- Never serve uploaded SVG or HTML inline. Use generated file names, not the uploader's.
- Strip EXIF metadata (GPS location) from student photos; `sharp` is installed and can re-encode.

## Embeds and scripts

- Third-party scripts load through `next/script`, from hosts added to the CSP deliberately.
- iframes use the narrowest `sandbox` and `allow` that works, from allowlisted origins only.

## Payments (principle 6)

- The site knows only Go2Pay: it links to or creates Go2Pay products. Prices and order status come from Go2Pay, never from client input.
- Go2Pay webhooks are unsigned: re-verify every webhook by fetching `GET /orders/{id}` with the server key before acting, and process idempotently.
- Never build anything that hides or routes money around required university reporting.

## Personal data

- Collect the minimum from forms; never log names, emails or phone numbers; show them only in authenticated admin views.

## Checklist

- [ ] No secret reachable from a client bundle
- [ ] Server action validates input and authorizes the caller
- [ ] No unsanitized HTML, unchecked URL or unescaped JSON-LD
- [ ] Uploads type-checked, size-limited and metadata-stripped
- [ ] Payment state verified with Go2Pay, never trusted from the request

## Failure modes

- Admin action callable by any signed-in user
- Board-entered link rendered as `javascript:`
- Uploaded photo publishing a student's home location
- Order marked paid from an unverified webhook body
