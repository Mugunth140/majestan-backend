/** Refresh public Next.js caches after a committed CRM change. */
export async function revalidatePublicInventory(change: { slug?: string; tag?: string }): Promise<boolean> {
  const frontend = process.env.FRONTEND_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!frontend || !secret) {
    if (process.env.NODE_ENV !== 'test') console.warn('[Public cache] Configure FRONTEND_URL and REVALIDATE_SECRET to enable CRM refreshes');
    return false;
  }
  try {
    const response = await fetch(`${frontend.replace(/\/$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...change, secret }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      console.warn('[Public cache] Refresh failed with HTTP', response.status);
      return false;
    }
    return true;
  } catch {
    console.warn('[Public cache] Refresh unavailable; bounded time-based revalidation remains active');
    return false;
  }
}
