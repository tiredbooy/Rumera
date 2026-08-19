/** Read a JSON body, skipping statuses that must not be parsed. */
export async function readJsonOrNull(response: Response): Promise<unknown> {
  if (response.status === 304 || response.status === 204) return null;
  return response.json().catch(() => null);
}
