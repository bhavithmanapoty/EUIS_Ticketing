const TZ = "Europe/London";

/** "Sat 1 Nov 2026" from a YYYY-MM-DD date column. */
export function formatEventDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "7:42 pm (14 min ago)" for a check-in timestamp. */
export function formatScanTime(iso: string, now = Date.now()): string {
  const time = new Date(iso).toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  let ago: string;
  if (mins < 1) ago = "just now";
  else if (mins < 60) ago = `${mins} min ago`;
  else if (mins < 24 * 60) ago = `${Math.floor(mins / 60)} h ${mins % 60} min ago`;
  else
    ago = new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: TZ,
    });
  return `${time} (${ago})`;
}
