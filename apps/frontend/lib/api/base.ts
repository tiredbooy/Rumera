import "server-only";

const API =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8080";

export const API_BASE = `${API.replace(/\/$/, "")}/api/v1`;
