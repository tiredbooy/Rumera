import { NextResponse } from "next/server";

import { safeCallbackUrl } from "@/features/auth/redirects";
import { auth } from "@/lib/auth/auth";

export const GET = auth((request) => {
  const callbackUrl = safeCallbackUrl(
    request.nextUrl.searchParams.get("callbackUrl"),
    "/account",
  );

  if (!request.auth?.user || request.auth.error) {
    const login = new URL("/login", request.nextUrl.origin);
    login.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(login);
  }

  return NextResponse.redirect(new URL(callbackUrl, request.nextUrl.origin));
});
