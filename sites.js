// Proxies https://transport.integration.sl.se/v1/sites so the browser never
// has to talk cross-origin to SL directly, and so we can cache the (large,
// slow-changing) stop list on Vercel's edge instead of refetching it for
// every visitor.
export default async function handler(req, res) {
  try {
    const upstream = await fetch(
      'https://transport.integration.sl.se/v1/sites?expand=false'
    );

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'SL svarade inte OK' });
      return;
    }

    const data = await upstream.json();

    // The stop list barely changes, so cache it aggressively both at the
    // edge and in the browser.
    res.setHeader(
      'Cache-Control',
      's-maxage=86400, stale-while-revalidate=604800'
    );
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Kunde inte hämta hållplatslistan', detail: String(err) });
  }
}
