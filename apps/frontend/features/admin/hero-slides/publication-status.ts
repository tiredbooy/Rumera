export type HeroPublicationStatus =
  | "inactive"
  | "scheduled"
  | "expired"
  | "active";

type HeroPublicationWindow = {
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
};

export const heroPublicationStatusLabel: Record<HeroPublicationStatus, string> =
  {
    inactive: "غیرفعال",
    scheduled: "زمان‌بندی‌شده",
    expired: "منقضی",
    active: "فعال",
  };

export function getHeroPublicationStatus(
  slide: HeroPublicationWindow,
  now = Date.now(),
): HeroPublicationStatus {
  if (!slide.is_active) return "inactive";

  const startsAt = slide.starts_at ? new Date(slide.starts_at).getTime() : null;
  if (startsAt !== null && startsAt > now) return "scheduled";

  const endsAt = slide.ends_at ? new Date(slide.ends_at).getTime() : null;
  if (endsAt !== null && endsAt < now) return "expired";

  return "active";
}
