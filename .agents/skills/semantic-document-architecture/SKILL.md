---
name: semantic-document-architecture
description: Structures pages with correct HTML semantics, covering landmarks, one h1 with sequential headings, lists, data tables, figures and quotations, time and address elements, links versus buttons, form labels, fieldsets and error associations, language attributes and alt text. Use when building or reviewing any page, section, form or table markup, writing alt text, or fixing screen-reader navigation and document outline. Not for custom widget ARIA (use aria-complex-widget-accessibility), focus and keyboard behavior (use keyboard-navigation-systems) or page titles, meta tags and JSON-LD (use seo-metadata-structured-data).
---

# Semantic document architecture

Choose elements for meaning, not appearance. Good semantics serve screen readers, search engines and reader modes at once.

## In this repo

- The root layout sets `<html lang="en">` and a skip link to `#main-content`; `SiteChrome` renders `<main id="main-content">`. Pages render inside that `<main>`; never add a second one.
- `PageHero` renders the page `<h1>`. A page using it must not add another `<h1>`.
- `SafeImage` takes `alt` from content data. Board-uploaded images therefore need alt text from the admin form. Whether alt text is required or optional with a "decorative" choice is a product decision; propose it.

## Rules

- One `<main>`, one `<h1>` per page; heading levels never skip (`h2` → `h4` is wrong). Pick levels by structure, style with classes.
- Landmarks: `<header>`, `<nav aria-label="…">` (label each when there is more than one), `<main>`, `<footer>`, `<aside>` only for tangential content.
- `<section>` with a heading (`aria-labelledby`) for real sections; `<article>` for self-contained items (an event card, a newsletter).
- Lists of things are `<ul>`/`<ol>`; name/value pairs are `<dl>`.
- `<button>` acts, `<a href>` navigates. No `div` with `onClick`, no `<a href="#">` buttons.
- `<strong>`/`<em>` for meaning; `<b>`/`<i>` only for stylistic offsets.

## Site-specific patterns

- **Events and prayer times**: wrap dates and times in `<time dateTime="…">` with an ISO value including the timezone offset.
- **Prayer timetable**: a real `<table>` with `<caption>`, `<th scope="col">` for prayers and `<th scope="row">` for days. Never a grid of divs.
- **Contact and location**: `<address>` for the MSA's contact details.
- **Quran verses, hadith and du'a**: `<figure>` with `<blockquote>` (Arabic marked `lang="ar" dir="rtl"`), the translation, and `<figcaption>` citing the source.
- **FAQ**: `<details>`/`<summary>` or headings with answers; keep the question text in the heading or summary.

## Forms

- Every control has a visible `<label for>`; placeholder text is not a label.
- Related controls (radio groups, date + time) sit in `<fieldset>` with `<legend>`.
- Use the right `type` and `autocomplete` (`email`, `tel`, `name`).
- Field errors are linked with `aria-describedby` and announced (see aria-complex-widget-accessibility for live regions).

## Alt text

- Describe what the image contributes in context, under ~125 characters; do not start with "image of".
- Decorative images use `alt=""`. Images of text repeat the text.
- Icon-only buttons and links get an accessible name (`aria-label` or visually hidden text).

## Verify

Axe in Playwright (see frontend-testing-visual-qa) catches missing labels, alt text and landmark errors. Heading order and alt-text quality need a human read: list headings with a browser accessibility tree or extension.

## Failure modes

- Two `<h1>` elements because a page adds one beside `PageHero`
- Prayer timetable built from divs
- Clickable divs with no keyboard access
- Board photos rendered with empty or file-name alt text
