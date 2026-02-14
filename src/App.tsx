import React, { useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';

declare global {
  interface Window { adsbygoogle?: any[]; }
}

type RawRace = {
  series_id?: number;
  series?: string;
  race_name?: string;
  track_name?: string;
  venue?: string;

  // Broadcasters (authoritative)
  radio_broadcaster?: string;
  television_broadcaster?: string;
  satellite_radio_broadcaster?: string;

  // Legacy/alternate
  tv_broadcaster?: string;
  radio?: string;
  network?: string;
  broadcast?: string;

  // Time
  start_time_local?: string;
  start_time_utc?: string;
  date?: string;
  time?: string;
  time_local?: string;
  time_zone?: string;
  race_date?: string;
  race_time?: string;
  date_scheduled?: string;
};

const SERIES: Record<string, { id: number; fallbackName: string; logo: string }> = {
  N1: { id: 1, fallbackName: 'NASCAR Cup Series', logo: 'N1.png' },
  N2: { id: 2, fallbackName: 'NASCAR O\'Reilly Auto Parts Series', logo: 'N2.png' },
  N3: { id: 3, fallbackName: 'NASCAR Craftsman Truck Series', logo: 'N3.png' },
};

// Broadcaster logos
const TV_LOGOS: Record<string, string> = {
  FOX: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Fox_Sports_wordmark_logo.svg/250px-Fox_Sports_wordmark_logo.svg.png',
  FS1: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/2015_Fox_Sports_1_logo.svg/220px-2015_Fox_Sports_1_logo.svg.png',
  NBC: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/NBC_logo_2022_%28vertical%29.svg/250px-NBC_logo_2022_%28vertical%29.svg.png',
  USA: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/USA_Network_2020.svg/250px-USA_Network_2020.svg.png',
  CW: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/The_CW_2024.svg/250px-The_CW_2024.svg.png',
  PRIME: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Amazon_Prime_logo_%282024%29.svg/250px-Amazon_Prime_logo_%282024%29.svg.png',
};

const RADIO_LOGOS: Record<string, string> = {
  MRN: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Motor_Racing_Network_logo.svg/250px-Motor_Racing_Network_logo.svg.png',
  PRN: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Performance_Racing_Network.png/250px-Performance_Racing_Network.png',
};

const SAT_LOGOS: Record<string, string> = {
  SIRIUSXM: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Sirius_XM_logo_2023.svg/250px-Sirius_XM_logo_2023.svg.png',
};

function parseStart(raw: RawRace): DateTime | null {
  const localZone = DateTime.local().zoneName;
  const iso = raw.start_time_local || raw.start_time_utc || raw.date_scheduled || raw.race_date;
  if (iso) {
    const dt = DateTime.fromISO(String(iso), { setZone: true });
    if (dt.isValid) return dt.setZone(localZone);
  }
  const dateStr = raw.date || raw.race_date;
  const timeStr = raw.time_local || raw.time || raw.race_time;
  const tz = raw.time_zone || 'America/New_York';
  if (dateStr && timeStr) {
    const cleaned = String(timeStr).replace(/\b(ET|CT|MT|PT)\b/i, '').trim();
    const try1 = DateTime.fromFormat(`${dateStr} ${cleaned}`, 'yyyy-LL-dd h:mm a', { zone: tz });
    if (try1.isValid) return try1.setZone(localZone);
    const try2 = DateTime.fromFormat(`${dateStr} ${cleaned}`, 'yyyy-LL-dd h a', { zone: tz });
    if (try2.isValid) return try2.setZone(localZone);
  }
  return null;
}

function splitList(v?: string): string[] {
  if (!v) return [];
  return v.split(/[,&/]|and/gi).map(s => s.trim()).filter(Boolean);
}

function normTV(s: string): string | null {
  const up = s.toUpperCase().trim();
  if (/FOX\s*SPORTS\s*1|FS1/.test(up)) return 'FS1';
  if (/^FOX$/.test(up) || (up.includes('FOX') && !up.includes('FS1'))) return 'FOX';
  if (/NBC/.test(up)) return 'NBC';
  if (/\bUSA\b/.test(up)) return 'USA';
  if (/\bCW\b|THE\s*CW/.test(up)) return 'CW';
  if (/PRIME|AMAZON/.test(up)) return 'PRIME';
  return up || null;
}
function normRadio(s: string): string | null {
  const up = s.toUpperCase().trim();
  if (/NRN/.test(up)) return 'MRN'; // map NRN -> MRN
  if (/MRN/.test(up)) return 'MRN';
  if (/PRN/.test(up)) return 'PRN';
  return up || null;
}
function normSat(s: string): string | null {
  const up = s.toUpperCase().trim();
  if (/SIRIUS\s*XM|SIRIUSXM|^SXM$/.test(up)) return 'SIRIUSXM';
  return up || null;
}

function getBroadcasters(raw: RawRace) {
  const tv = new Set<string>(splitList(raw.television_broadcaster).map(normTV).filter(Boolean) as string[]);
  const radio = new Set<string>(splitList(raw.radio_broadcaster).map(normRadio).filter(Boolean) as string[]);
  const sat = new Set<string>(splitList(raw.satellite_radio_broadcaster).map(normSat).filter(Boolean) as string[]);

  // Backfill from legacy fields if needed
  if (!tv.size && (raw.network || raw.tv_broadcaster)) splitList(raw.network || raw.tv_broadcaster).map(normTV).forEach(x=>x&&tv.add(x));
  if (!radio.size && raw.radio) splitList(raw.radio).map(normRadio).forEach(x=>x&&radio.add(x));

  return { tv: Array.from(tv), radio: Array.from(radio), sat: Array.from(sat) };
}

// ---------- AdSense Slot Component ----------
function AdSenseSlot({ slot, refreshKey }: { slot: string; refreshKey: string }) {
  useEffect(() => {
    // Clear any previous ad content to allow a fresh fill
    const ins = document.querySelector(`ins[data-ad-slot="${slot}"]`) as any;
    if (ins) ins.innerHTML = '';
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, [slot, refreshKey]);

  return (
    <ins className="adsbygoogle"
      style={{display: "block"}}
      data-ad-client="ca-pub-1132550830693888"
      data-ad-slot={slot}
      data-ad-format="horizontal" />
  );
}

type NextMap = Partial<Record<'N1'|'N2'|'N3', RawRace & { start?: DateTime }>>;

export default function App() {
  const [data, setData] = useState<RawRace[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Live clock for header
  const [nowClock, setNowClock] = useState(DateTime.local());
  useEffect(() => {
    const t = setInterval(() => setNowClock(DateTime.local()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    (async () => {
      try {
        setErr(null);
        const res = await fetch('https://cf.nascar.com/cacher/2025/race_list_basic.json', { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!mounted) return;
        let list: RawRace[] = [];
        if (Array.isArray(json)) list = json;
        else if (json?.races) list = json.races;
        else if (json?.series_1 || json?.series_2 || json?.series_3) {
          const map: Record<string, number> = { series_1: 1, series_2: 2, series_3: 3 };
          (Object.keys(map) as (keyof typeof map)[]).forEach(k => {
            const sid = map[k];
            const arr: any[] = json[k] || [];
            arr.forEach(r => list.push({ ...r, series_id: sid }));
          });
        }
        setData(list);
      } catch (e: any) {
        if (e?.name === 'AbortError' || e?.code === 20) return;
        setErr(e?.message || 'Failed to load schedule');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; controller.abort(); };
  }, []);

  const now = DateTime.local();
  const nextBySeries: NextMap = useMemo(() => {
    if (!data) return {};
    const withStart = data.map(r => ({...r, start: parseStart(r) || undefined})).filter(r => r.start && r.start > now);
    const out: NextMap = {};
    (['N1','N2','N3'] as const).forEach(code => {
      const sid = SERIES[code].id;
      const next = withStart.filter(r => Number(r.series_id) === sid).sort((a,b)=> a.start!.toMillis()-b.start!.toMillis())[0];
      if (next) out[code] = next;
    });
    return out;
  }, [data, now]);

  // Compute a stable refresh key based on visible content (refresh when content truly changes)
  const adRefreshKey = useMemo(() => {
    const summary = JSON.stringify({
      N1: nextBySeries.N1?.race_name,
      N2: nextBySeries.N2?.race_name,
      N3: nextBySeries.N3?.race_name,
      // change at most hourly to avoid frequent refreshes
      hour: DateTime.local().toFormat('yyyy-LL-dd-HH'),
    });
    // simple hash
    let hash = 0; for (let i=0;i<summary.length;i++) hash = ((hash<<5)-hash) + summary.charCodeAt(i) | 0;
    return String(hash);
  }, [nextBySeries]);

  return (
    <div>
      <header className="header">
        <div className="container header-inner">
          <div className="header-row">
            <h1 style={{margin:0}}>What Channel is NASCAR on?</h1>
            <div className="subtle">Local time: {nowClock.toFormat('h:mm a z')}</div>
          </div>
          <div className="center">
            <AdSenseSlot slot="1234567890" refreshKey={adRefreshKey} />
          </div>
        </div>
      </header>

      <main className="container" style={{paddingTop: '24px'}}>
        {err && <div style={{color:'#ff7a7a', marginBottom: 16}}>{err}</div>}
        <div className="grid">
          {(['N1','N2','N3'] as const).map(code => {
            const race = nextBySeries[code];
            const displayName = SERIES[code].fallbackName;
            return (
              <div key={code} className="card">
                <div className="card-head">
                  <img src={SERIES[code].logo} alt={`${displayName} logo`} />
                  <div>
                    <div className="title">{displayName}</div>
                    <div className="subtle">Next race & broadcast info</div>
                  </div>
                </div>
                <div className="card-body">
                  {loading ? <div className="subtle">Loading…</div>
                    : !race ? <div className="subtle">No upcoming race found.</div>
                    : <div>
                        <div style={{fontWeight:700, fontSize:18, lineHeight:1.2}}>{race.race_name || 'TBA'}</div>
                        <div className="row">📍 {race.track_name || race.venue || 'TBA'}</div>
                        {race.start && <div className="row">🕒 {race.start.toLocaleString(DateTime.DATETIME_FULL)}</div>}
                        {(() => {
                          const tvlogos = getBroadcasters(race).tv;
                          const radiologos = getBroadcasters(race).radio;
                          const satlogos = getBroadcasters(race).sat;
                          return (
                            <>
                              <div className="broadcasters">
                                <span className="badge">TV</span>
                                {tvlogos.map(n => TV_LOGOS[n] ? <img key={n} className="logo" src={TV_LOGOS[n]} alt={n} /> : <span key={n} className="badge">{n}</span>)}
                              </div>
                              <div className="broadcasters">
                                <span className="badge">Radio</span>
                                {radiologos.map(n => RADIO_LOGOS[n] ? <img key={n} className="logo" src={RADIO_LOGOS[n]} alt={n} /> : <span key={n} className="badge">{n}</span>)}
                              </div>
                              <div className="broadcasters">
                                <span className="badge">Satellite</span>
                                {satlogos.map(n => SAT_LOGOS[n] ? <img key={n} className="logo" src={SAT_LOGOS[n]} alt={n} /> : <span key={n} className="badge">{n}</span>)}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                  }
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="center">
            <AdSenseSlot slot="1234567891" refreshKey={adRefreshKey} />
          </div>
          <p className="small">Data © NASCAR. Times shown in your local timezone.</p>
        </div>
      </footer>
</div>
  );
}
