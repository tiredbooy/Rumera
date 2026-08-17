import { toSettingsPayload } from "@/features/settings/form-utils";
import type { UpdateSiteSettingsInput } from "@/features/settings/types";
import type { SiteSettingsFormValues } from "@/features/settings/validations";

/** PUT body plus the last-GET timestamp for site-settings last-write-wins. */
export type AdminSettingsPutBody = UpdateSiteSettingsInput & {
  expected_updated_at?: string;
};

/** Wholesale-replace groups, plus `expected_updated_at` copied from last GET. */
export function toAdminSettingsPutBody(
  values: SiteSettingsFormValues,
  expectedUpdatedAt: string | undefined,
): AdminSettingsPutBody {
  const payload = toSettingsPayload(values);
  const expected = expectedUpdatedAt?.trim();
  return expected
    ? { ...payload, expected_updated_at: expected }
    : payload;
}
