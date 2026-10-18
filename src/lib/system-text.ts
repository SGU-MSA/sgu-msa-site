/**
 * Fixed system wording (PR5b D-22): the labels and messages the board cannot
 * edit because the site's own rules produce them, shared by server actions,
 * adapters and components. One copy: nothing here is repeated elsewhere, and
 * everything the board may reword is page text instead (`page_texts`).
 *
 * No `server-only` import: browser components read it too.
 */

/** "A", "A and B", "A, B and C". */
const andList = (names: readonly string[]) =>
  names.length < 2
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** Fixed button names. */
const buttons = {
  /** An event's sign-up button (D-7); the button draws its own arrow. */
  signUp: "Sign up",
  save: "Save",
  saving: "Saving…",
  restore: "Restore",
  restoring: "Restoring…",
} as const;

/** Fixed messages: refusals, failures and states every board form shares. */
const messages = {
  /** Shown when a save finds no signed-in board member. */
  sessionExpired: "Your session expired or access was removed. Sign in again.",
  /** Shown when the version on screen no longer matches (PR3 contract, Failure Modes). */
  staleScreen: "Someone else changed this; reload before trying again.",
  /** A screen loaded before the form changed posts other fields (deployment skew). */
  outOfDate: "This page is out of date. Reload it and try again.",
  /** An action that could not reach the database: "Could not {verb}. Check …". */
  unavailable: (verb: string) =>
    `Could not ${verb}. Check your connection and try again.`,
  /**
   * The one line at the top of a board form whose boxes have problems (the
   * user, 2026-10-05: no list; each box says what is wrong under it).
   */
  boxesNeedFixing: "Some boxes need fixing.",
  /** The heading above the list of problems of a page's Preview. */
  fixBeforeSaving: (count: number) =>
    `Please fix ${count} ${count === 1 ? "thing" : "things"} before saving:`,
  /** After a refused save: browsers cannot keep a chosen file. */
  chooseFileAgain: (file: string) => `Choose the ${file} again before saving.`,
  /** A season page's sign-up form that is not in the forms list (PR5c). */
  unknownSignUpForm: "Sign-up form: choose one from the list.",
} as const;

/**
 * What each error code the database raises means, as the board reads it
 * (`raise exception using errcode = 'SGUnn'` in `supabase/migrations/`; a
 * test checks every raised code has an entry). Adapters map a code to a
 * reason; the reason's words come from here.
 */
const sguCodes = {
  SGU01:
    "You cannot remove your own access or your own 'manage people' permission. Ask another manager.",
  SGU02:
    "At least one active person must keep 'manage people'. Give it to someone else first.",
  SGU03:
    "Only a board member who can manage people can invite, change permissions or deactivate logins.",
  SGU04: "This group still has people in it. Move them to another group first.",
  SGU05: "Recent changes is add-only: entries cannot be changed or removed.",
  SGU06: "This item is archived. Restore it before changing it.",
  // PR6 (202610150001_schema.sql); the words are the database's own.
  SGU08: "Move or archive the funds and items that use this season first.",
  SGU09:
    "You cannot turn on your own 'manage money' permission. Ask another manager.",
  SGU10:
    "Givers have already seen this fund's category. Make a new fund instead.",
  // Review 2 (202610150001_schema.sql).
  SGU12: "Choose one of the Executive board roles.",
  SGU13:
    "The Executive board and the General board cannot be renamed, archived or deleted.",
  // Hand-in plan, 2026-10-06 (202610150001_schema.sql).
  SGU14: "Only Executive board members can have Manage people or Manage money.",
  SGU15:
    "Only a board member who can manage people can move someone into or out of the Executive board or change an executive's role.",
  // PR5c (202610150001_schema.sql).
  SGU16: "Archive this item's sizes first.",
  // 2026-10-06 (202610150001_schema.sql): one current person per role.
  SGU17:
    "Someone else in the Executive board holds this role now. Each role has one person at a time.",
  // Review fixes P4 (202610160003_team_list_and_campus_pin.sql): photos are for the Executive board.
  SGU40: "Only Executive board members have a photo on the About page.",
} as const satisfies Readonly<Record<`SGU${string}`, string>>;

/** The Pages screens' own words (PR5b): the boxes' labels come from the field lists. */
const pages = {
  optional: "(optional)",
  choose: "Choose…",
  noVerse: "No verse on this page",
  notOffered: (value: string) => `${value} (no longer offered)`,
  choosePhoto: "Choose a photo",
  replacePhoto: "Replace photo: choose a file",
  describePhoto: "Describe the photo",
  removePhoto: "Remove photo",
  remove: "Remove",
  add: (item: string) => `+ Add ${item.toLowerCase()}`,
  emptyList: "None yet.",
  shownOn: (where: string) => `Shows on: ${where}`,
  save: "Save page",
  saveHint:
    "A box that needs fixing turns red and says why under it; what you typed stays.",
  previewLater:
    "The picture of this page comes with the next update. Until then, save and open the page on the website to check it.",
  restored:
    "The earlier text is back on the website. Photos replaced since then stay as they are now.",
  notLoaded:
    "This page's text could not be loaded. Check your connection and reload.",
  tooManyPhotos: (count: number) =>
    `Add up to ${count} new photos per save, then save again.`,
  photosAgain: "photos",
  unknownPage: "Unknown page. Reload and try again.",
  restoreRefused: (problem: string) =>
    `This earlier version cannot be restored: ${problem}`,
  restoreFailed:
    "Could not restore. Reload to get the latest text before restoring.",
} as const;

/**
 * A page as a list of its sections (review 3 B, 2026-10-05): show or hide
 * each one, drag them in order, Edit. "Show this section on the page" and
 * "Nobody can edit pages: add an executive" are the user's words; the rest
 * is new wording (release checklist, "You or the founder must decide").
 */
const pageSections = {
  show: "Show this section on the page",
  edit: "Edit",
  close: "Close",
  hidden: "Hidden",
  needsFixing: "Needs fixing",
  hint: "Drag ⠿ to change the order of the sections. Untick “Show this section on the page” to hide one: its words are kept.",
  listLabel: "Sections of the page",
  top: "Always first on the page.",
  /** A band section (About's Contact): fixed at the end, never dragged (review fixes P3). */
  band: "Always last on the page.",
  settings: "Settings of the page, above its top.",
  /** A section whose content comes from another dashboard screen. */
  fromScreen: (screen: string) => `Its content comes from ${screen}.`,
  fixed: "Its words are fixed: ask the site owner to change them.",
  /** A section another page shows, hides and moves. */
  onPage: (page: string, shown: boolean) =>
    `${shown ? "Shown" : "Hidden"} on the ${page} page.`,
  moveThere: (page: string) => `Show, hide or move it on ${page}`,
  /** A restore that shows a section whose words, kept while hidden, miss a required box. */
  fillFirst: (section: string) =>
    `${section}: fill in its required boxes before showing it.`,
  /**
   * A section whose words show on other pages too (shared text, option A,
   * 2026-10-06; "Shared · also on Home" is the plan's): editing it here
   * changes it there.
   */
  shared: (pages: readonly string[]) => `Shared · also on ${andList(pages)}`,
  /** The page switcher of Preview, when the page's words show on other pages. */
  previewPage: "Preview the page",
  /**
   * The screen of words shown only inside other pages (Jumu'ah, Musallah
   * directions, Newsletter archive): where they are edited; its History
   * stays here.
   */
  editedOn: "Its words are edited on the page that shows them:",
  /** Pages are for the Executive board only (user, 2026-10-05). */
  executiveOnly: "Only people in the Executive board can change pages.",
  /** The dashboard warning while no Executive board member has a login. */
  nobodyCanEdit: "Nobody can edit pages: add an executive",
} as const;

/**
 * Per-item History and Restore (review 3 D, 2026-10-05): every History
 * screen (a page's text, the prayer settings) says the same. The
 * confirmation sentence is the plan's; the rest is new wording (release
 * checklist, "You or the founder must decide").
 */
const history = {
  heading: "History",
  notLoaded:
    "The history could not be loaded. Check your connection and reload.",
  restore: "Restore the version before this change",
  /** Read after the button's name, so each Restore names its change. */
  changedAt: (when: string) => `(changed ${when})`,
  confirmTitle: "Restore this version?",
  confirm: (item: string, when: string, count: number) =>
    `This puts ${item} back to how it was on ${when}. The ${count} ${count === 1 ? "change" : "changes"} made to it after that will be replaced. Nothing else on the website changes. You can undo this from History.`,
  preview: "This version",
  cancel: "Cancel",
  /** A restore in History and Recent changes. */
  restoredTo: (when: string) => `Restored to the version of ${when}`,
  /**
   * Under the History of a page that shows sections of other page texts
   * (dashboard polish, 2026-10-06): their words are kept, and restored,
   * with that text, never by this page's Restore.
   */
  sharedWords: (sections: readonly string[], text: string) =>
    `Restore here leaves the words of ${andList(sections)} as they are: they are kept with ${text}, which has its own History.`,
  sharedLink: (text: string) => `History of ${text}`,
  /** How the confirmation names a page's text and the prayer settings: by their screen's title. */
  pageItem: (title: string) => `“${title}”`,
  prayerItem: "“Prayer & iqamah”",
} as const;

/** How a library verse is named and credited on public pages (PR5b D-24). */
const verses = {
  /** "Qur'an 94:5 (Ash-Sharh)": the reference under a verse's meaning. */
  reference: (reference: string, surahName: string) =>
    `Qur’an ${reference} (${surahName})`,
  /** The translator credit the Qur'an service's terms ask for. */
  credit: (translator: string) => `Translation: ${translator}`,
} as const;

/**
 * The Qur'an verses screen's own words (PR5b WP7; Review 3 E, the fixed
 * verse library). Words new in Review 3 E are listed in the release
 * checklist under "You or the founder must decide".
 */
const versePicker = {
  title: "Qur’an verses",
  intro:
    "Choose the Qur’an verse each place on the site shows. Every verse comes from the site’s verse library: each whole verse of the Qur’an that is short enough for one line, in Arabic with its English meaning (Saheeh International). Nobody types or changes the text.",
  save: "Save verse choices",
  footnote:
    "The public pages show the verse with “Translation: Saheeh International”. The verse library never changes, and the website never contacts a Qur’an text service.",
  /** "Ash-Sharh 94:5": a verse's name on the board screens. */
  name: (reference: string, surahName: string) => `${surahName} ${reference}`,
  change: "Change verse",
  choose: "Choose a verse",
  noVerse: "No verse",
  cancel: "Cancel",
  searchLabel: "Find a verse in the library",
  searchHint:
    "A verse number such as 94:5, a surah number such as 94, or a word in English or Arabic such as patience.",
  searchExample: "94:5, 94 or patience",
  useVerse: "Use this verse",
  found: (shown: number, total: number) =>
    shown < total
      ? `Showing the first ${shown} of ${total} verses. Add a word to find fewer.`
      : `${total} ${total === 1 ? "verse" : "verses"} found.`,
  none: "No verse in the library matches. Try another word.",
  invalid: (typed: string) =>
    `There is no verse ${typed}. Check the surah and verse numbers.`,
  notInLibrary: (reference: string) =>
    `${reference} is not in the library: it is too long for one line, or there is no such verse.`,
  libraryNotLoaded:
    "The verse library could not be loaded. Check your connection and reload.",
} as const;

/**
 * Lists the board puts in order by dragging (review fixes PR-2): People in a
 * group, groups, funds, tickets, hand-over steps and the lists inside a
 * page's text. New wording (release checklist, "You or the founder must
 * decide").
 */
const order = {
  /** Under a list that can be dragged. */
  hint: "Drag ⠿ to change the order.",
  /** The drag handle's name, for keyboards and screen readers (review 2). */
  handle: (name: string) => `Move ${name}`,
  /** Read with the handle: how to move it without a mouse. */
  keys: "Press the up or down arrow key to move it.",
  /** Read out after the arrow keys move an item. */
  moved: (name: string, place: number, total: number) =>
    `${name} is now ${place} of ${total}.`,
  changed: "The order changed. Save it to keep it.",
  save: "Save order",
  saving: "Saving…",
  undo: "Undo",
  saved: "Order saved.",
} as const;

/**
 * The photo library (2026-10-06): the Photos screen, "Choose from uploaded
 * photos" on every photo box, and where a file is used. New wording (release
 * checklist, "You or the founder must decide").
 */
const photos = {
  title: "Photos",
  intro:
    "Every photo and PDF uploaded to the website, newest first, and where each one is used.",
  /** "Space used: 12.4 MB of 1 GB (1%)". */
  space: (used: string, limit: string, percent: number) =>
    `Space used: ${used} of ${limit} (${percent}%)`,
  spaceNote:
    "The free plan has room for about 1 GB. Photos are made smaller when they are uploaded.",
  /** Under the space line from 80% full. */
  nearlyFull: "Space is running out. Delete photos and PDFs nothing uses.",
  unavailable: "Photos could not be loaded. Check your connection and reload.",
  empty: "No photos or PDFs uploaded yet.",
  usedOn: "Used on:",
  notUsed: "Not used anywhere",
  pdf: "PDF",
  photo: "Photo",
  /** "Uploaded 6 Oct 2026 · 245 KB". */
  details: (day: string | null, size: string) =>
    day ? `Uploaded ${day} · ${size}` : size,
  delete: "Delete",
  deleteTitle: "Delete this file?",
  deleteText:
    "Nothing on the website uses it. Once deleted, it can't be brought back.",
  cancel: "Cancel",
  deleting: "Deleting…",
  deleted: "Deleted.",
  inUse:
    "This file is still used somewhere, so it can't be deleted. Reload to see where.",
  /** Where a file is used: the kind of thing, then its name. */
  use: {
    events: "Event",
    announcements: "Announcement",
    news_posts: "Community news",
    newsletters: "Newsletter",
    person: "People",
    page: "Page",
    season: "Season page",
    merch: "Merch item",
  },
  archived: "(archived)",
  /** On every photo box. */
  choose: "Choose from uploaded photos",
  pickerTitle: "Uploaded photos",
  pickerIntro:
    "Click a photo to use it here. Nothing is copied or uploaded again.",
  pickerEmpty: "No photos uploaded yet.",
  pickerLoading: "Loading photos…",
  pickerFailed: "Photos could not be loaded. Close this and try again.",
  close: "Close",
  /** A photo's name in the picker when nothing uses it yet. */
  notUsedYet: "Not used yet",
  chosen: "Chosen from uploaded photos.",
  undo: "Undo",
} as const;

/**
 * Term export (review fixes P5): one term's records and files as a zip,
 * then "Free up space". New wording (release checklist, "You or the founder
 * must decide"); "Term export" and "Free up space" are the plan's.
 */
const termExport = {
  title: "Term export",
  card: "Download a term’s records, photos and PDFs as one zip, then free up space →",
  intro:
    "Download one term as a zip: spreadsheets of its events, community news and newsletters, of the people, funds and resources, and every photo and PDF they use. The zip is made when you click and is not kept on the website. Keep it safe outside the website, such as on the club’s Google Drive.",
  managersOnly: "Only board members who can manage people can export a term.",
  nameHint: "The zip and its folder are named after it.",
  rangeHint:
    "Events, community news and newsletters dated from the first day to the last, archived ones too. People, funds and resources are added as they are today.",
  fillFirst: "Fill in the name and both days to download.",
  downloadTitle: "Download the term",
  download: "Download zip",
  preparing:
    "Preparing the zip… It downloads by itself. A term with many photos can take a few minutes.",
  started: "The zip is downloading. Open it to check it.",
  unavailable:
    "The term could not be read. Check your connection and try again.",
  freeTitle: "Free up space",
  freeIntro:
    "After you have opened the zip, remove the photos and PDFs of the archived events, community news and newsletters from the same days. The items stay in Archived with all their words. Nothing on the website changes.",
  downloadFirst: "Download the zip for these days first.",
  freeButton: "Free up space…",
  checking: "Checking…",
  confirmTitle: "Remove these photos and PDFs?",
  /** "3 photos and PDFs (2.4 MB) of 2 archived items dated 1 Sep 2026 to 15 Dec 2026 …" */
  confirm: (files: number, size: string, items: number, days: string) =>
    `${files} ${files === 1 ? "photo or PDF" : "photos and PDFs"} (${size}) of ${items} archived ${items === 1 ? "item" : "items"} dated ${days} will be deleted. The ${items === 1 ? "item stays" : "items stay"} in Archived without ${files === 1 ? "it" : "them"}. This can’t be undone, so keep the zip.`,
  /** Files of those items that another item or page still uses. */
  kept: (count: number) =>
    `${count} more ${count === 1 ? "stays" : "stay"}, because another item or page still uses ${count === 1 ? "it" : "them"}.`,
  nothing: "No archived item from these days has a photo or PDF to remove.",
  /** The tick box "Remove files" waits for (the user's decision of 2026-10-07). */
  opened: "I opened the zip and can see the photos",
  /** The server's answer when the tick box was not ticked. */
  openFirst:
    "Tick “I opened the zip and can see the photos” before removing files.",
  remove: "Remove files",
  removing: "Removing…",
  cancel: "Cancel",
  close: "Close",
  /** "Space freed: 3 files removed (2.4 MB)." */
  freed: (files: number, size: string) =>
    `Space freed: ${files} ${files === 1 ? "file" : "files"} removed (${size}).`,
  /** After Free up space, when the files left cannot be counted. */
  freedUncounted:
    "Free up space is done, but the website could not count what was removed. Photos shows what is left.",
  partly:
    "Some files could not be removed. Photos lists them as “Not used anywhere”, where you can delete them.",
  /** "1 Sep 2026 to 15 Dec 2026". */
  days: (from: string, until: string) => `${from} to ${until}`,
} as const;

/**
 * The dashboard's shared boxes and save state (review fixes P1): the time
 * box's three drop-downs, as screen readers name them, and what every
 * editor says about saving. New wording (release checklist, "You or the
 * founder must decide").
 */
const fields = {
  hour: "Hour",
  minutes: "Minutes",
  period: "AM or PM",
  /** The empty choice of each drop-down. */
  notChosen: "–",
  unsaved: "Unsaved changes",
  /** "Saving…" is `buttons.saving`. */
  saved: "Saved",
  /** Before the links to the public pages an editor's changes show on. */
  appearsOn: "Appears on",
  /** Read after a link that opens in a new tab. */
  newTab: "(opens in a new tab)",
} as const;

/**
 * "Appears on: …" for an editor with no one public page (review follow-ups,
 * 2026-10-07; `appearsOnElsewhere`).
 */
const places = {
  everyPage: "every page",
  go2payReceipts: "Go2Pay receipts",
} as const;

export const systemText = {
  buttons,
  fields,
  places,
  messages,
  history,
  sguCodes,
  pages,
  pageSections,
  order,
  verses,
  versePicker,
  photos,
  termExport,
} as const;

// The shared messages by name, for the actions and forms that use them.
export const {
  sessionExpired,
  staleScreen,
  outOfDate,
  fixBeforeSaving,
  chooseFileAgain,
  boxesNeedFixing,
  unknownSignUpForm,
} = messages;
export const unavailableMessage = messages.unavailable;
