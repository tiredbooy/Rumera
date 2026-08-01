const faDateFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
});

const faDateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function faDate(iso: string): string {
  try {
    return faDateFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

export function faDateTime(iso: string): string {
  try {
    return faDateTimeFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}
