const faDateFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
});

export function faDate(iso: string): string {
  try {
    return faDateFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}
