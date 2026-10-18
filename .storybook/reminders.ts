import { load } from "js-yaml";

import { verseReminder } from "../src/lib/content/reminders";
import {
  reminderPlacesSchema,
  remindersSchema,
  type ReminderPlace,
} from "../src/lib/content/schemas";
import { sandboxVerseLibrary } from "../src/lib/demo/quran";
import source from "../content/reminders.yaml?raw";
import placesSource from "../content/reminder-places.yaml?raw";

/**
 * Stories read the one reminders file (content/reminders.yaml) and the
 * verse library with the starter "Verse on each page"
 * (content/reminder-places.yaml) through the same code as the site, so no
 * Arabic text is copied into a story.
 */
export const reminders = remindersSchema.parse(load(source));
const places = reminderPlacesSchema.parse(load(placesSource)).places;

/** The verse a place starts with, as the pages draw it. */
export const verse = (place: ReminderPlace) => {
  const found = sandboxVerseLibrary.find(
    (entry) => entry.reference === places[place],
  );
  if (!found) throw new Error(`No ${place} verse in the verse library`);
  return verseReminder(found);
};
export const dhikr = (slot: (typeof reminders.dhikr)[number]["slot"]) => {
  const found = reminders.dhikr.find((entry) => entry.slot === slot);
  if (!found) throw new Error(`No ${slot} dhikr in content/reminders.yaml`);
  return found;
};
