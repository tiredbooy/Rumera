const MAX_DECODE_DEPTH = 8;
const UNSAFE_SEGMENT_CHARACTERS = /[\\/\u0000-\u001f\u007f]/;

function decodeSafeSegment(rawSegment: string): string | null {
  if (!rawSegment) return null;

  let segment = rawSegment;
  for (let depth = 0; depth < MAX_DECODE_DEPTH; depth += 1) {
    if (
      !segment ||
      segment === "." ||
      segment === ".." ||
      UNSAFE_SEGMENT_CHARACTERS.test(segment)
    ) {
      return null;
    }

    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return null;
    }

    if (decoded === segment) return segment;
    segment = decoded;
  }

  // Reject inputs that remain encoded after the recursion limit rather than
  // accepting a payload whose dangerous form appears at a deeper decode layer.
  if (
    !segment ||
    segment === "." ||
    segment === ".." ||
    UNSAFE_SEGMENT_CHARACTERS.test(segment)
  ) {
    return null;
  }
  try {
    return decodeURIComponent(segment) === segment ? segment : null;
  } catch {
    return null;
  }
}

export interface AdminProxyTarget {
  decodedSegments: string[];
  url: string;
}

export function buildAdminProxyTarget(
  apiBase: string,
  rawSegments: string[],
  search = "",
): AdminProxyTarget | null {
  if (rawSegments.length === 0) return null;

  const decodedSegments: string[] = [];
  for (const rawSegment of rawSegments) {
    const decoded = decodeSafeSegment(rawSegment);
    if (decoded === null) return null;
    decodedSegments.push(decoded);
  }

  let base: URL;
  try {
    base = new URL(apiBase.endsWith("/") ? apiBase : `${apiBase}/`);
  } catch {
    return null;
  }
  if (base.search || base.hash) return null;

  const encodedPath = decodedSegments.map(encodeURIComponent).join("/");
  const expectedPath = `${base.pathname}${encodedPath}`;
  const target = new URL(encodedPath, base);
  if (target.origin !== base.origin || target.pathname !== expectedPath) {
    return null;
  }

  target.search = search;
  return { decodedSegments, url: target.toString() };
}
