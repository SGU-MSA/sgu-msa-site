const shortDateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});

/**
 * "15 Dec" for a Grenada date (YYYY-MM-DD): the dashboard's iqamah reminder
 * (PR4 D-12), the Jumu'ah notice text and the preview's "Scheduled: appears
 * on" (PR5a). Browser-safe.
 */
export function shortDateLabel(date: string) {
  return shortDateFormat.format(new Date(`${date}T12:00:00Z`));
}

/**
 * "26 Sep 2026" for a Grenada date (YYYY-MM-DD): Recent changes filters and
 * the New board term's shared logins (PR5a). Browser-safe.
 */
export function dayLabel(date: string) {
  return `${shortDateLabel(date)} ${date.slice(0, 4)}`;
}

const weekdayDateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

/**
 * "Thu 15 Oct" for a Grenada date (YYYY-MM-DD): the "Needs attention" lines
 * on the dashboard and in the daily-check email. Browser-safe.
 */
export function weekdayDateLabel(date: string) {
  return weekdayDateFormat.format(new Date(`${date}T12:00:00Z`));
}

/**
 * "Tue 9 Mar 2027" for a Grenada date (YYYY-MM-DD): season days on the
 * board's screens and in the "Needs attention" lines. Browser-safe.
 */
export function longDateLabel(date: string) {
  return `${weekdayDateLabel(date)} ${date.slice(0, 4)}`;
}
