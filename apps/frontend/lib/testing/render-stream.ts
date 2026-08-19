import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server.edge";

/**
 * Streaming render for tests.
 *
 * `renderToStaticMarkup` cannot see past a Suspense boundary — it throws the
 * moment a child suspends — so a route that streams needs the real Fizz
 * renderer to be asserted on.
 */
export async function renderStreamedMarkup(
  element: ReactNode,
): Promise<string> {
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}

/** Fizz emits every out-of-order boundary payload into a hidden div. */
const BOUNDARY_PAYLOAD = '<div hidden id="S:';

/**
 * Splits a streamed document into its first flush and the finished document.
 *
 * `shell` is what a browser can paint before any boundary resolves. If it
 * already contains the data-dependent region, nothing streamed — the render
 * blocked on the data and the boundary bought nothing.
 */
export async function renderStreamedShell(
  element: ReactNode,
  /**
   * Runs once the shell bytes are out — where a test resolves the data it held
   * back. Released any earlier and Fizz may still fold the region into the
   * shell, which is exactly what the test is trying to rule out.
   */
  onShellFlushed?: () => void,
): Promise<{ shell: string; html: string }> {
  const stream = await renderToReadableStream(element);
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let flushed = false;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    if (!flushed) {
      flushed = true;
      onShellFlushed?.();
    }
  }

  return { shell: html.split(BOUNDARY_PAYLOAD)[0], html };
}
