(() => {
  'use strict';

  const STOPS_KEY = 'tavla:stops';
  const SITES_CACHE_KEY = 'tavla:sitesCache';
  const SITES_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — the stop list barely changes
  const FORECAST_MINUTES = 90;
  const REFRESH_MS = 20 * 1000;
  const MAX_ROWS_PER_STOP = 8;

  const stopsGrid = document.getElementById('stopsGrid');
  const emptyState = document.getElementById('emptyState');
  const clockEl = document.getElementById('clock');
  const openAddStopBtn = document.getElementById('openAddStop');
  const addStopDialog = document.getElementById('addStopDialog');
  const stopSearchInput = document.getElementById('stopSearchInput');
  const searchStatus = document.getElementById('searchStatus');
  const searchResults = document.getElementById('searchResults');
  const stopCardTemplate = document.getElementById('stopCardTemplate');
  const departureRowTemplate = document.getElementById('departureRowTemplate');

  /** @type {Map<number, {timer: number, card: HTMLElement, lastTexts: string[]}>} */
  const activeStops = new Map();

  let allSites = null; // loaded lazily when the dialog is first opened

  // ---------- Clock ----------

  function tickClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('sv-SE', { hour12: false });
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ---------- Persistence ----------

  function loadStops() {
    try {
      const raw = localStorage.getItem(STOPS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveStops(stops) {
    localStorage.setItem(STOPS_KEY, JSON.stringify(stops));
  }

  function addStopToStorage(stop) {
    const stops = loadStops();
    if (stops.some((s) => s.id === stop.id)) return stops;
    stops.push(stop);
    saveStops(stops);
    return stops;
  }

  function removeStopFromStorage(id) {
    const stops = loadStops().filter((s) => s.id !== id);
    saveStops(stops);
    return stops;
  }

  // ---------- Sites (for search) ----------

  async function getAllSites() {
    if (allSites) return allSites;

    try {
      const cached = JSON.parse(localStorage.getItem(SITES_CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.fetchedAt < SITES_CACHE_TTL_MS) {
        allSites = cached.sites;
        return allSites;
      }
    } catch {
      // fall through to network fetch
    }

    const res = await fetch('/api/sites');
    if (!res.ok) throw new Error('Kunde inte hämta hållplatslistan');
    const sites = await res.json();

    allSites = sites;
    try {
      localStorage.setItem(
        SITES_CACHE_KEY,
        JSON.stringify({ fetchedAt: Date.now(), sites })
      );
    } catch {
      // localStorage full or unavailable — not fatal, just skip caching
    }

    return sites;
  }

  function searchSites(sites, query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const starts = [];
    const contains = [];

    for (const site of sites) {
      const name = site.name.toLowerCase();
      if (name.startsWith(q)) {
        starts.push(site);
      } else if (name.includes(q)) {
        contains.push(site);
      }
      if (starts.length >= 10) break;
    }

    return [...starts, ...contains].slice(0, 10);
  }

  // ---------- Add-stop dialog ----------

  let searchDebounceTimer = null;

  openAddStopBtn.addEventListener('click', async () => {
    addStopDialog.showModal();
    stopSearchInput.value = '';
    searchResults.innerHTML = '';
    searchStatus.textContent = 'Laddar hållplatser…';
    stopSearchInput.focus();

    try {
      await getAllSites();
      searchStatus.textContent = 'Skriv minst två bokstäver för att söka.';
    } catch (err) {
      searchStatus.textContent = 'Kunde inte ladda hållplatslistan. Försök igen om en stund.';
    }
  });

  stopSearchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(runSearch, 150);
  });

  async function runSearch() {
    const query = stopSearchInput.value;
    if (!allSites) {
      try {
        await getAllSites();
      } catch {
        searchStatus.textContent = 'Kunde inte ladda hållplatslistan.';
        return;
      }
    }

    const results = searchSites(allSites, query);
    searchResults.innerHTML = '';

    if (query.trim().length < 2) {
      searchStatus.textContent = 'Skriv minst två bokstäver för att söka.';
      return;
    }

    if (results.length === 0) {
      searchStatus.textContent = 'Inga hållplatser hittades.';
      return;
    }

    searchStatus.textContent = `${results.length} träff${results.length === 1 ? '' : 'ar'}`;

    for (const site of results) {
      const li = document.createElement('li');
      li.className = 'add-dialog__result';
      li.setAttribute('role', 'option');
      li.tabIndex = 0;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'add-dialog__result-name';
      nameSpan.textContent = site.name;

      const noteSpan = document.createElement('span');
      noteSpan.className = 'add-dialog__result-note';
      noteSpan.textContent = site.note || '';

      li.append(nameSpan, noteSpan);

      const choose = () => {
        addStopToStorage({ id: site.id, name: site.name, note: site.note || '' });
        renderStop({ id: site.id, name: site.name, note: site.note || '' });
        updateEmptyState();
        addStopDialog.close();
      };

      li.addEventListener('click', choose);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') choose();
      });

      searchResults.appendChild(li);
    }
  }

  // ---------- Departures rendering ----------

  function badgeClassFor(line) {
    const mode = (line.transport_mode || '').toUpperCase();
    const group = (line.group_of_lines || '').toLowerCase();

    if (mode === 'METRO') {
      if (group.includes('röd')) return 'badge--metro-red';
      if (group.includes('grön')) return 'badge--metro-green';
      if (group.includes('blå')) return 'badge--metro-blue';
      return 'badge--metro';
    }
    if (mode === 'BUS') return 'badge--bus';
    if (mode === 'TRAIN') return 'badge--train';
    if (mode === 'TRAM') return 'badge--tram';
    if (mode === 'SHIP' || mode === 'FERRY') return 'badge--ship';
    return 'badge--other';
  }

  function minutesUntil(isoString) {
    const target = new Date(isoString).getTime();
    const diffMs = target - Date.now();
    return Math.round(diffMs / 60000);
  }

  function formatTime(departure) {
    if (typeof departure.display === 'string' && departure.display.length > 0) {
      return departure.display;
    }
    const iso = departure.expected || departure.scheduled;
    if (!iso) return '?';
    const mins = minutesUntil(iso);
    if (mins <= 0) return 'Nu';
    return `${mins} min`;
  }

  function timeSortValue(departure) {
    const iso = departure.expected || departure.scheduled;
    return iso ? new Date(iso).getTime() : Number.MAX_SAFE_INTEGER;
  }

  function renderStop(stop) {
    if (activeStops.has(stop.id)) return; // already rendered

    const node = stopCardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.stopId = String(stop.id);
    node.querySelector('.stop-card__name').textContent = stop.note
      ? `${stop.name} (${stop.note})`
      : stop.name;

    node.querySelector('.stop-card__remove').addEventListener('click', () => {
      removeStopFromStorage(stop.id);
      const entry = activeStops.get(stop.id);
      if (entry) {
        clearInterval(entry.timer);
        entry.card.remove();
        activeStops.delete(stop.id);
      }
      updateEmptyState();
    });

    stopsGrid.appendChild(node);

    const entry = { timer: null, card: node, lastTexts: [] };
    activeStops.set(stop.id, entry);

    const poll = () => fetchDepartures(stop.id, entry);
    poll();
    entry.timer = setInterval(poll, REFRESH_MS);
  }

  async function fetchDepartures(siteId, entry) {
    const list = entry.card.querySelector('.departure-list');
    const emptyMsg = entry.card.querySelector('.stop-card__empty');
    const errorMsg = entry.card.querySelector('.stop-card__error');

    try {
      const res = await fetch(`/api/departures?siteId=${siteId}&forecast=${FORECAST_MINUTES}`);
      if (!res.ok) throw new Error('Bad response');
      const data = await res.json();
      const departures = Array.isArray(data.departures) ? data.departures : [];

      departures.sort((a, b) => timeSortValue(a) - timeSortValue(b));
      const shown = departures.slice(0, MAX_ROWS_PER_STOP);

      errorMsg.hidden = true;

      if (shown.length === 0) {
        list.innerHTML = '';
        emptyMsg.hidden = false;
        entry.lastTexts = [];
        return;
      }

      emptyMsg.hidden = true;
      list.innerHTML = '';

      const newTexts = [];

      shown.forEach((dep, i) => {
        const row = departureRowTemplate.content.firstElementChild.cloneNode(true);
        const badge = row.querySelector('.badge');
        const dest = row.querySelector('.departure__destination');
        const time = row.querySelector('.departure__time');

        const line = dep.line || {};
        badge.classList.add(badgeClassFor(line));
        badge.textContent = line.designation || '';

        dest.textContent = dep.destination || '';

        const text = formatTime(dep);
        time.textContent = text;
        newTexts.push(text);

        const mins = /^\d+/.test(text) ? parseInt(text, 10) : (text === 'Nu' ? 0 : null);
        if (mins === 0) time.classList.add('departure__time--now');
        else if (mins !== null && mins <= 3) time.classList.add('departure__time--soon');

        if (entry.lastTexts[i] && entry.lastTexts[i] !== text) {
          time.classList.add('flip');
        }

        list.appendChild(row);
      });

      entry.lastTexts = newTexts;
    } catch (err) {
      errorMsg.hidden = false;
      errorMsg.textContent = 'Kunde inte hämta avgångar just nu. Försöker igen om en stund.';
    }
  }

  function updateEmptyState() {
    emptyState.hidden = activeStops.size > 0;
  }

  // ---------- Init ----------

  function init() {
    const stops = loadStops();
    stops.forEach(renderStop);
    updateEmptyState();
  }

  init();
})();
