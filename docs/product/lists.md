# Lists

**Who uses it:** every board member with a login; visitors through the filters. **Where:** Dashboard → **Lists** (`/admin/lists`): **Event categories**, **Terms** and **Resource categories**; the event form's **Category (optional)** and **Term (optional)**; Pages → Resources (a resource's **Category**); the category buttons and **Term** list on the Events page and the categories on the Resources page. **Related:** [architecture: Lists](../architecture.md), [release checklist](../release-checklist.md) (review fixes P3), [ADR 0002](../adr/0002-product-principles.md), [ADR 0020](../adr/0020-format-rules-product-rules-and-settings.md); [Events](events.md), [Pages](pages.md).

## Why it exists

Each year the board names its own terms ("2026 Fall") and may want a new kind of event or resource. These choices used to be fixed in code. Lists make them the board's own data, changeable from a phone without a developer (ADR 0002; review fixes P3, approved plan of 2026-10-07).

## User stories

### Keeping the lists

- **US-LS-1.** As a board member, I want to add an option to a list, so that I can use it on events or resources straight away.
  - Acceptance: type the name in the box under the list (**New category** or **New term**) and **Add**; it goes last and shows "✓ Saved". It is ready in the event form and in Pages → Resources at once (release checklist, review fixes P3).
  - Each list says where it is used, for example "The Term box of an event, and the Term filter on the Events page."
- **US-LS-2.** As a board member, I want to rename an option, so that a typo or a better name is fixed everywhere.
  - Acceptance: change the name in its box and **Save name**; every event, resource and filter shows the new name on the next page load. The option's web address part stays the same, so saved links such as `/resources?category=guide` keep working (lists migration; `slugFor`).
- **US-LS-3.** As a board member, I want to put the options in the order students should see them, so that the filters read sensibly.
  - Acceptance: drag ⠿ (or focus it and press the arrow keys), then **Save order**: "Order saved."; before saving, **Undo** puts the old order back (release checklist, review fixes P3). The filters and drop-downs follow this order.
- **US-LS-4.** As a board member, I want to delete an option nobody uses, so that the list stays short.
  - Acceptance: **Delete** shows only on an option nothing uses: "Deleted." An option in use shows "Used by 3 events. Move them first." (or "… resources …") instead of **Delete** (release checklist, review fixes P3). The database refuses too.

### Using the lists

- **US-LS-5.** As a board member, I want to give an event a category and a term, so that students can filter the Events page.
  - Acceptance: **Category (optional)** and **Term (optional)** under **Place**, with "Change these choices on Dashboard → Lists."; "No category" and "No term" are allowed ([Events](events.md)).
- **US-LS-6.** As an Executive board member, I want to give a resource a category, so that the Resources page groups it.
  - Acceptance: Pages → Resources → **Category** is chosen from **Resource categories** (release checklist, review fixes P3).
- **US-LS-7.** As a visitor, I want filters that always find something, so that I never click into an empty list.
  - Acceptance: the Events page shows only the categories and terms that have events in the tab shown (**Upcoming events** or **Past events**); with none, that filter is hidden; switching tabs resets the choice to All. The Resources page shows only categories with resources (release checklist, review fixes P3).
  - Each event category has a colour dot beside its name; the name is always shown, so colour is never the only sign.

## Rules

- Any board member with a login changes Lists, including resource categories, though resources themselves are edited only by the Executive board (Lists screen; ADR 0027).
- There are three lists, fixed in code; the board changes their options, not the lists themselves.
- An option's name is 1 to 60 characters and unique in its list, ignoring capitals and spaces: "Name: this list already has an option with this name."
- An option is deleted, never archived, and only while nothing uses it: an event, archived or not, or a resource on the Resources page, archived or not (lists migration).
- Every add, rename, reorder and delete is in Recent changes (lists migration).
- Starter options: event categories MSA, Academic, Informational, Faith, Social; resource categories Newsletter, Infographic, Guide, Academic, Faith, Ramadan, Incoming students; no terms, which the board adds (lists migration).
- Category colours come from five design colours, given in list order and starting again after the fifth (`categoryTone`).

## Edge cases

| Case                                         | What should happen                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New board term                               | Add the new term ("2027 Spring"), drag it into place and choose it on new events. Old events keep their old term; the old term stays while any event uses it. |
| Deleting an option that events use           | Not offered: "Used by 3 events. Move them first." Change those events first.                                                                                  |
| The only events using an option are archived | Still in use: archived events are read-only, so restore them and change them, or a "manage people" holder deletes them for good, before the option can go.    |
| Someone else used the option a moment ago    | The delete is refused: "Something uses this option now. Reload to see what, then move it first."                                                              |
| Two board members add the same name          | The second is refused on the box: "Name: this list already has an option with this name."                                                                     |
| Two board members rename one option          | The second: "Someone else changed this; reload before trying again." Typed text stays.                                                                        |
| Reorder not saved                            | "The order changed. Save it to keep it." stays above the **Unsaved changes** bar until **Save order** or **Undo**.                                            |
| Session expires or connection drops          | "Your session expired or access was removed. Sign in again." or "Could not save. Check your connection and try again." Typed name stays.                      |
| Lists cannot be read                         | "The lists could not be loaded. Check your connection and reload."; the event form says the same under **Category** and **Term**.                             |
| Empty list                                   | "None yet." (Terms starts empty.)                                                                                                                             |
| Long or Arabic names                         | Up to 60 characters; shown as typed in filters and on cards.                                                                                                  |
| A sixth event category                       | Gets the first category's colour again; its name tells them apart.                                                                                            |
| Phone                                        | **Save name** and **Delete** (or "Used by …") sit side by side under each name (release checklist, review fixes P3).                                          |

## Known gaps

None known.

## Open questions

None.
