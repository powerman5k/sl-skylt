// Proxies https://transport.integration.sl.se/v1/sites/{siteId}/departures
export default async function handler(req, res) {
  const { siteId, forecast } = req.query;

  if (!siteId || !/^\d+$/.test(String(siteId))) {
    res.status(400).json({ error: 'Ogiltigt eller saknat siteId' });
    return;
  }

  const forecastMinutes = /^\d+$/.test(String(forecast)) ? forecast : '60';

  try {
    const upstream = await fetch(
      `https://transport.integration.sl.se/v1/sites/${siteId}/departures?forecast=${forecastMinutes}`
    );

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'SL svarade inte OK' });
      return;
    }

    const data = await upstream.json();

    // Departures change by the minute — no caching, always fresh.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Kunde inte hämta avgångar', detail: String(err) });
  }
}
