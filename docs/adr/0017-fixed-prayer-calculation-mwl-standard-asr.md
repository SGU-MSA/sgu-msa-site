# 0017. Fixed prayer calculation: Muslim World League + Standard Asr

- Status: Accepted
- Date: 2026-10-03

## Context

Today the dashboard lets the board choose the calculation method, Asr school and per-prayer corrections. Visitors' phones already show prayer times, so the site should match what they see. The setting rarely changes, and changing it is a religious decision for the founders, not routine board work.

## Decision

- Prayer starts use **Muslim World League** (Fajr 18°, Isha 17°) and **Standard (Shafi'i) Asr** (adhan `Madhab.Shafi`). Both are fixed in configuration and are not board-editable.
- This is an explicit exception to board self-sufficiency ([ADR 0002](0002-product-principles.md)): if the founders decide to change it, a developer changes the configuration.
- Evidence: for St. George's this matches the Muslim Pro and IslamicFinder defaults within 0–2 minutes.
- The dashboard keeps only iqamah times, Jumu'ah and per-date exceptions (roadmap item PR4). Coordinates come from the board-editable musallah pin (roadmap item PR7).
- Decided by the user (D0 follow-up, 2026-10-03); rejected: ISNA (US default; Fajr about 12 minutes later than local apps), Hanafi Asr (the user chose Standard).

## Consequences

- The method, madhab, correction and "leadership confirmed" controls are removed from the dashboard in roadmap item PR4.
- Until roadmap item PR7 ships, the existing stored coordinates keep being used.
- See [Prayer times explained](../guides/prayer-times.md).

## Notes

- 2026-10-05: confirmed. The user checked the calculated prayer times (Muslim World League, Standard Asr) against mobile prayer apps and they match (answer to Q84).
