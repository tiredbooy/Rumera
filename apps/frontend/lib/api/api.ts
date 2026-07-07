import "server-only";

import { auth } from "../auth/auth";
import { BASE_API_URL } from "@/lib/utils/api-helpers";

export async function adminRequest<T>(
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  const session = await auth();

  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${BASE_API_URL}/${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const json = await res.json();

  // if your Go backend returns { data: ... }
  return json.data;
}
