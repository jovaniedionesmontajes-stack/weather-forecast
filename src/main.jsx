import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard, MapPin, CloudSun, History, BadgeCheck, BarChart3, Settings,
  Search, Plus, ChevronDown, Bell, CalendarDays, RefreshCw, Droplets, Wind,
  Eye, Sunrise, Sunset, CloudRain, Thermometer, Pencil, Trash2, CheckCircle2,
  AlertTriangle, XCircle, Menu, X, Database, Clock3, Map as MapIcon, UserCog, Download, UserPlus, Save
} from 'lucide-react';
import './styles.css';
import { api } from './lib/api.js';
import { authEnabled, getSession, signIn, signOut, supabaseAuth } from './lib/auth.js';

const defaultBranches = [
  { id: 'matina', name: 'Matina', address: 'Davao City', lat: 7.0731, lon: 125.6128, active: true },
  { id: 'lanang', name: 'Lanang', address: 'Davao City', lat: 7.1055, lon: 125.6460, active: true },
  { id: 'buhangin', name: 'Buhangin', address: 'Davao City', lat: 7.1050, lon: 125.6340, active: true },
  { id: 'talomo', name: 'Talomo', address: 'Davao City', lat: 7.0570, lon: 125.5634, active: true },
  { id: 'agdao', name: 'Agdao', address: 'Davao City', lat: 7.0852, lon: 125.6195, active: true }
];

const weatherText = {
  0: ['Clear sky', 'clear'], 1: ['Mainly clear', 'clear'], 2: ['Partly cloudy', 'cloud'], 3: ['Overcast', 'cloud'],
  45: ['Fog', 'fog'], 48: ['Rime fog', 'fog'], 51: ['Light drizzle', 'rain'], 53: ['Drizzle', 'rain'], 55: ['Heavy drizzle', 'rain'],
  56: ['Freezing drizzle', 'rain'], 57: ['Heavy freezing drizzle', 'rain'], 61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'],
  66: ['Freezing rain', 'rain'], 67: ['Heavy freezing rain', 'rain'], 71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'],
  77: ['Snow grains', 'snow'], 80: ['Rain showers', 'rain'], 81: ['Rain showers', 'rain'], 82: ['Heavy rain showers', 'rain'],
  85: ['Snow showers', 'snow'], 86: ['Heavy snow showers', 'snow'], 95: ['Thunderstorm', 'storm'], 96: ['Thunderstorm + hail', 'storm'], 99: ['Thunderstorm + hail', 'storm']
};

function iconFor(code, size = 34) {
  const type = weatherText[code]?.[1] || 'cloud';
  const Icon = type === 'rain' ? CloudRain : type === 'clear' ? CloudSun : type === 'storm' ? CloudRain : CloudSun;
  return <Icon size={size} strokeWidth={1.8} />;
}


function mapsUrl(lat, lon) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`; }
function formatHour(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric' });
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function formatDay(iso) {
  return new Date(iso).toLocaleDateString([], { weekday: 'short' });
}
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

async function fetchWeather(branch) {
  const params = new URLSearchParams({
    latitude: branch.lat,
    longitude: branch.lon,
    timezone: 'Asia/Manila',
    forecast_days: '7',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,visibility',
    hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,visibility',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,precipitation_sum'
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error('Weather service returned an error.');
  return res.json();
}

function Skel({ w = '60px', h = '14px' }) { return <span className="skeleton" style={{ display: 'inline-block', width: w, height: h, verticalAlign: 'middle' }}/>; }
function Stat({ icon, label, value, sub }) {
  return <div className="stat"><div className="stat-icon">{icon}</div><div><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{sub && <div className="stat-sub">{sub}</div>}</div></div>;
}

function monitoringRisk(weather) {
  const h = weather?.hourly;
  if (!h?.time?.length) return { label:'No data', key:'unknown', peak:null, current:null };
  const now = Date.now();
  let start = 0, diff = Infinity;
  h.time.forEach((t,i)=>{ const d=Math.abs(new Date(t).getTime()-now); if(d<diff){diff=d;start=i;} });
  const rows = h.time.slice(start,start+24).map((time,j)=>({
    time,
    prob:Number(h.precipitation_probability?.[start+j] ?? 0),
    temp:Number(h.temperature_2m?.[start+j] ?? 0),
    code:h.weather_code?.[start+j]
  }));
  const peak = rows.reduce((a,b)=>!a||b.prob>a.prob?b:a,null);
  const current = weather.current || {};
  const currentProb = Number(h.precipitation_probability?.[start] ?? 0);
  const key = peak?.prob >= 80 ? 'high' : peak?.prob >= 50 ? 'watch' : 'normal';
  return { label:key==='high'?'High Rain Risk':key==='watch'?'Rain Watch':'Normal', key, peak, current, currentProb, rows };
}

function BranchMonitoringOverview({ branches, backendOnline, onSelectBranch, onRefresh }) {
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [filter,setFilter]=useState('all');

  const load=async()=>{
    if(!branches?.length) return;
    setLoading(true); setError('');
    try {
      if(backendOnline) {
        const data=await api.monitoringOverview();
        setItems(data?.branches||[]);
      } else {
        const results=await Promise.all(branches.filter(b=>b.active!==false).map(async branch=>({branch,weather:await fetchWeather(branch),fetched_at:new Date().toISOString()})));
        setItems(results);
      }
    } catch(e) { setError(e.message||'Unable to load branch monitoring overview.'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{load();},[branches,backendOnline]);

  const cards=useMemo(()=>items.map(item=>({ ...item, risk:monitoringRisk(item.weather) })),[items]);
  const visible=useMemo(()=>filter==='all'?cards:cards.filter(x=>x.risk.key===filter),[cards,filter]);
  const counts=useMemo(()=>({all:cards.length,normal:cards.filter(x=>x.risk.key==='normal').length,watch:cards.filter(x=>x.risk.key==='watch').length,high:cards.filter(x=>x.risk.key==='high').length}),[cards]);

  return <section className="monitoring-overview">
    <div className="page-head overview-head"><div><h1>Branch Monitoring Overview</h1><p>Weather risk across all active branches · next 24 hours</p></div><button className="secondary" onClick={()=>{load();onRefresh?.()}} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/> Refresh all</button></div>
    {error&&<div className="form-error branch-error"><AlertTriangle size={15}/>{error}</div>}
    <div className="monitoring-toolbar">
      <div className="monitoring-filters"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>All <b>{counts.all}</b></button><button className={filter==='normal'?'active':''} onClick={()=>setFilter('normal')}>Normal <b>{counts.normal}</b></button><button className={filter==='watch'?'active':''} onClick={()=>setFilter('watch')}>Rain Watch <b>{counts.watch}</b></button><button className={filter==='high'?'active':''} onClick={()=>setFilter('high')}>High Risk <b>{counts.high}</b></button></div>
      <span className="monitoring-updated">{items[0]?.fetched_at?`Updated ${new Date(items[0].fetched_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`:'Waiting for forecast data'}</span>
    </div>
    <div className="monitoring-grid">{visible.map(item=>{
      const {branch,weather,risk}=item; const current=weather?.current||{};
      return <button className={`monitor-card ${risk.key}`} key={branch.id} onClick={()=>onSelectBranch(branch.id)}>
        <div className="monitor-card-top"><div><strong>{branch.branch_name||branch.name}</strong><span>{branch.address||'Branch location'}</span></div><span className={`monitor-status ${risk.key}`}>{risk.label}</span></div>
        <div className="monitor-main"><div className="monitor-temp">{Math.round(current.temperature_2m ?? risk.peak?.temp ?? 0)}°<small>C</small></div><div className="monitor-condition">{weatherText[current.weather_code]?.[0]||weatherText[risk.peak?.code]?.[0]||'Weather data'}<span>Rain now {risk.currentProb}%</span></div>{iconFor(current.weather_code ?? risk.peak?.code ?? 2,31)}</div>
        <div className="monitor-meta"><span><CloudRain size={13}/> Peak rain <b>{risk.peak?.prob ?? 0}%</b></span><span><Clock3 size={13}/> {risk.peak?formatHour(risk.peak.time):'—'}</span><span><Wind size={13}/> {Math.round(current.wind_speed_10m ?? 0)} km/h</span></div>
        <div className="monitor-foot"><span>Forecast update</span><b>{item.fetched_at?new Date(item.fetched_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'—'}</b><ChevronDown size={15}/></div>
      </button>;
    })}{!visible.length&&<div className="card table-empty">{loading?'Loading branch weather…':'No branches match this filter.'}</div>}</div>
  </section>;
}

function AlertCenter({ branches, backendOnline, onSelectBranch }) {
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [filter,setFilter]=useState('all');

  const load=async()=>{
    if(!branches?.length) return;
    setLoading(true); setError('');
    try {
      if(backendOnline) {
        const data=await api.monitoringOverview();
        setItems(data?.branches||[]);
      } else {
        const results=await Promise.all(branches.filter(b=>b.active!==false).map(async branch=>({branch,weather:await fetchWeather(branch),fetched_at:new Date().toISOString()})));
        setItems(results);
      }
    } catch(e) { setError(e.message||'Unable to load weather alerts.'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{load();},[branches,backendOnline]);

  const alerts=useMemo(()=>items.map(item=>({...item,risk:monitoringRisk(item.weather)})).filter(x=>x.risk.key==='high'||x.risk.key==='watch'),[items]);
  const high=alerts.filter(x=>x.risk.key==='high').length;
  const watch=alerts.filter(x=>x.risk.key==='watch').length;
  const visible=filter==='all'?alerts:alerts.filter(x=>x.risk.key===filter);

  function windows(rows){
    const out=[]; let active=null;
    rows.forEach(r=>{
      if(r.prob>=50){
        if(!active) active={start:r.time,end:r.time,peak:r};
        active.end=r.time;
        if(r.prob>active.peak.prob) active.peak=r;
      } else if(active){out.push(active);active=null;}
    });
    if(active) out.push(active);
    return out.slice(0,3);
  }

  return <>
    <div className="page-head alert-head"><div><h1>Alert Center</h1><p>Operational rain-risk alerts across active branches · next 24 hours</p></div><button className="secondary" onClick={load} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/> Refresh alerts</button></div>
    {error&&<div className="form-error branch-error"><AlertTriangle size={15}/>{error}</div>}
    <div className="alert-summary">
      <div className="card alert-summary-card"><span>Open alerts</span><strong>{alerts.length}</strong><small>Branches at 50%+ peak rain probability</small></div>
      <div className="card alert-summary-card high"><span>High risk</span><strong>{high}</strong><small>Peak rain probability 80%+</small></div>
      <div className="card alert-summary-card watch"><span>Rain watch</span><strong>{watch}</strong><small>Peak rain probability 50–79%</small></div>
    </div>
    <div className="alert-toolbar">
      <div className="alert-filters"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>All <b>{alerts.length}</b></button><button className={filter==='high'?'active':''} onClick={()=>setFilter('high')}>High Risk <b>{high}</b></button><button className={filter==='watch'?'active':''} onClick={()=>setFilter('watch')}>Rain Watch <b>{watch}</b></button></div>
      <span className="alert-source">Threshold: precipitation probability ≥ 50%</span>
    </div>
    {visible.length ? <div className="alert-list">{visible.map(item=>{
      const {branch,weather,risk}=item; const current=weather?.current||{}; const ws=windows(risk.rows);
      return <article className={`alert-item ${risk.key}`} key={branch.id}>
        <div className="alert-item-top"><div className="alert-title"><span className={`alert-severity ${risk.key}`}>{risk.key==='high'?'HIGH':'WATCH'}</span><div><h2>{branch.branch_name||branch.name}</h2><p>{branch.address||'Branch location'}</p></div></div><button className="secondary small-btn" onClick={()=>onSelectBranch(branch.id)}>Open branch</button></div>
        <div className="alert-facts"><div><span>Peak rain</span><strong>{risk.peak?.prob ?? 0}%</strong></div><div><span>Peak time</span><strong>{risk.peak?formatHour(risk.peak.time):'—'}</strong></div><div><span>Current temp</span><strong>{Math.round(current.temperature_2m ?? 0)}°C</strong></div><div><span>Current rain</span><strong>{risk.currentProb}%</strong></div></div>
        <div className="alert-windows"><span className="alert-label"><CloudRain size={14}/> Rain-risk windows</span>{ws.length?ws.map(w=><div className="alert-window" key={w.start}><strong>{formatHour(w.start)}{w.start!==w.end?` – ${formatHour(new Date(new Date(w.end).getTime()+3600000).toISOString())}`:''}</strong><span>Peak {w.peak.prob}% · {weatherText[w.peak.code]?.[0]||'Rain risk'}</span></div>):<div className="alert-window">No active 50%+ window</div>}</div>
        <div className="alert-foot">Forecast source: Open-Meteo <span>·</span> Updated {item.fetched_at?new Date(item.fetched_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'—'}</div>
      </article>;
    })}</div> : <div className="card alert-empty"><CheckCircle2 size={30}/><h2>No open rain alerts</h2><p>{loading?'Checking branch forecasts…':'No active branch has a 50%+ peak rain probability in the next 24 hours.'}</p></div>}
  </>;
}

function AlertHistory({ backendOnline, onSelectBranch }) {
  const [rows,setRows]=useState([]); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const [status,setStatus]=useState('all'); const [severity,setSeverity]=useState('all');
  const load=async()=>{ if(!backendOnline) return; setLoading(true); setError(''); try { const data=await api.alertHistory({status:status==='all'?'':status,severity:severity==='all'?'':severity,limit:200}); setRows(data?.alerts||[]); } catch(e){setError(e.message||'Unable to load alert history.')} finally{setLoading(false)} };
  useEffect(()=>{load();},[backendOnline,status,severity]);
  const refresh=async()=>{ if(!backendOnline) return; setLoading(true); setError(''); try { await api.refreshAlerts(); await load(); } catch(e){setError(e.message||'Unable to refresh alerts.')} finally{setLoading(false)} };
  return <>
    <div className="page-head"><div><h1>Alert History</h1><p>Persistent record of branch rain-risk alerts and cleared conditions</p></div><button className="secondary" onClick={refresh} disabled={loading||!backendOnline}><RefreshCw size={15} className={loading?'spin':''}/> Refresh & check alerts</button></div>
    {error&&<div className="form-error branch-error"><AlertTriangle size={15}/>{error}</div>}
    {!backendOnline ? <div className="empty card"><Database size={30}/><h2>Database connection required</h2><p>Alert history is stored in Supabase so it remains available across sessions and devices.</p></div> : <>
      <div className="history-toolbar"><div className="history-filters"><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="cleared">Cleared</option></select></label><label>Severity<select value={severity} onChange={e=>setSeverity(e.target.value)}><option value="all">All levels</option><option value="high">High risk</option><option value="watch">Rain watch</option></select></label></div><span className="data-note">{rows.length} record{rows.length===1?'':'s'}</span></div>
      <div className="card table-card alert-history-table"><table><thead><tr><th>Branch</th><th>Alert</th><th>Rain window</th><th>Peak</th><th>Detected</th><th>Status</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id}><td><button className="link-btn" onClick={()=>onSelectBranch(r.branch_id)}>{r.branches?.branch_name||'Branch'}</button><small>{r.branches?.address||''}</small></td><td><span className={`history-severity ${r.severity}`}>{r.severity==='high'?'HIGH':'WATCH'}</span></td><td>{formatHour(r.window_start)} – {formatHour(new Date(new Date(r.window_end).getTime()+3600000).toISOString())}</td><td><strong>{r.peak_probability_pct}%</strong><br/><small>{formatHour(r.peak_time)}</small></td><td>{new Date(r.detected_at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</td><td><span className={`history-status ${r.status}`}>{r.status==='open'?'Open':'Cleared'}</span></td></tr>) : <tr><td colSpan="6"><div className="table-empty">{loading?'Loading alert history…':'No alert history found for the selected filters.'}</div></td></tr>}</tbody></table></div>
    </>}
  </>;
}

function Dashboard({ branch, weather, onRefresh, loading, branches, backendOnline, onSelectBranch }) {
  const current = weather?.current;
  const hourly = weather?.hourly;
  const daily = weather?.daily;
  const start = useMemo(() => {
    if (!hourly?.time) return 0;
    const now = Date.now();
    let best = 0;
    let diff = Infinity;
    hourly.time.forEach((t, i) => { const d = Math.abs(new Date(t).getTime() - now); if (d < diff) { diff = d; best = i; } });
    return best;
  }, [hourly]);
  const hours = hourly ? hourly.time.slice(start, start + 8).map((time, j) => ({
    time,
    temp: hourly.temperature_2m[start + j],
    prob: hourly.precipitation_probability[start + j],
    rain: hourly.precipitation[start + j],
    code: hourly.weather_code[start + j]
  })) : [];
  const peak = hours.reduce((a, b) => b.prob > a.prob ? b : a, hours[0]);
  const condition = current ? weatherText[current.weather_code]?.[0] || 'Unknown' : 'Loading';

  return <>
    <BranchMonitoringOverview branches={branches} backendOnline={backendOnline} onSelectBranch={onSelectBranch} />
    <div className="page-head"><div><h1>Dashboard</h1><p>Real-time weather and forecast for all branches</p></div><button className="icon-btn" onClick={onRefresh} title="Refresh weather" aria-label="Refresh weather"><RefreshCw size={18} className={loading ? 'spin' : ''}/></button></div>
    <div className="branch-row"><label><MapPin size={16}/> Select Branch</label><div className="select-wrap"><select value={branch.id} onChange={e => onSelectBranch(e.target.value)}>{branches.filter(b => b.active !== false).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><ChevronDown size={16}/></div><span className="data-note">Live source · coordinates stored per branch</span></div>

    <section className="grid top-grid">
      <div className="hero-weather">
        <div className="hero-top"><div><span className="live-dot"></span> Live</div><span>Updated {current?.time ? new Date(current.time).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : '—'}</span></div>
        <div className="hero-location"><MapPin size={16}/><strong>{branch.name} Branch</strong></div>
        <div className="hero-coord">{branch.lat.toFixed(4)}° N, {branch.lon.toFixed(4)}° E</div>
        <a className="hero-maplink" href={mapsUrl(branch.lat, branch.lon)} target="_blank" rel="noreferrer"><MapPin size={11}/> Open in Google Maps</a>
        <div className="hero-main"><div className="weather-symbol">{current ? iconFor(current.weather_code, 64) : <Skel w="64px" h="64px"/>}</div><div><div className="big-temp">{current ? `${Math.round(current.temperature_2m)}°C` : <Skel w="96px" h="40px"/>}</div><div className="condition">{current ? condition : <Skel w="110px" h="16px"/>}</div><div className="feels">{current ? `Feels like ${Math.round(current.apparent_temperature)}°C` : <Skel w="120px" h="12px"/>}</div></div></div>
        <div className="hero-metrics"><div><span>Humidity</span><b>{current ? `${current.relative_humidity_2m}%` : <Skel w="34px" h="12px"/>}</b></div><div><span>Rain probability</span><b>{current ? `${hours[0]?.prob ?? 0}%` : <Skel w="34px" h="12px"/>}</b></div><div><span>Rainfall</span><b>{current ? `${Number(current.rain ?? 0).toFixed(1)} mm` : <Skel w="44px" h="12px"/>}</b></div><div><span>Wind</span><b>{current ? `${Math.round(current.wind_speed_10m ?? 0)} km/h` : <Skel w="50px" h="12px"/>}</b></div><div><span>Cloud cover</span><b>{current ? `${current.cloud_cover ?? 0}%` : <Skel w="34px" h="12px"/>}</b></div><div><span>Visibility</span><b>{current?.visibility ? `${(current.visibility/1000).toFixed(1)} km` : current ? '—' : <Skel w="44px" h="12px"/>}</b></div></div>
      </div>
      <div className="card summary"><div className="card-title"><span>Today's Summary</span><CalendarDays size={16}/></div><Stat icon={<Thermometer size={17}/>} label="Highest temp" value={daily ? `${Math.round(daily.temperature_2m_max?.[0])}°C` : <Skel/>}/><Stat icon={<Thermometer size={17}/>} label="Lowest temp" value={daily ? `${Math.round(daily.temperature_2m_min?.[0])}°C` : <Skel/>}/><Stat icon={<Sunrise size={17}/>} label="Sunrise" value={daily?.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : (daily ? '—' : <Skel/>)}/><Stat icon={<Sunset size={17}/>} label="Sunset" value={daily?.sunset?.[0] ? new Date(daily.sunset[0]).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : (daily ? '—' : <Skel/>)}/></div>
      <RainRisk weather={weather} hours={12} compact/>
    </section>

    <section className="grid forecast-grid">
      <div className="card hourly"><div className="card-head"><div><h2>Hourly Forecast</h2><p>{branch.name}</p></div><span className="view-link">Next 8 hours</span></div><div className="hour-row">{hours.map((h, i) => <div className={`hour ${i === 2 ? 'selected' : ''}`} key={h.time}><span>{formatHour(h.time)}</span>{iconFor(h.code, 27)}<b>{Math.round(h.temp)}°</b><small>{h.prob}%</small></div>)}</div>{peak && <div className="insight"><CloudRain size={18}/><span>Highest rain probability: <strong>{formatHour(peak.time)} · {peak.prob}%</strong></span></div>}</div>
      <div className="card five-day"><div className="card-head"><div><h2>7-Day Forecast</h2><p>{branch.name}</p></div><span className="view-link">View full forecast →</span></div><div className="days">{(daily?.time || []).slice(0,7).map((d,i)=><div className="day" key={d}><span>{i===0?'Today':formatDay(d)}</span><small>{formatDate(d)}</small>{iconFor(daily.weather_code[i],25)}<b>{Math.round(daily.temperature_2m_max[i])}° / {Math.round(daily.temperature_2m_min[i])}°</b><em><Droplets size={11}/>{daily.precipitation_probability_max[i] ?? 0}%</em></div>)}</div></div>
    </section>

    <section className="grid lower-grid">
      <div className="card updates"><div className="card-title"><span>Recent Weather Updates</span><Clock3 size={16}/></div>{[0,1,2,3].map((i)=><div className="update" key={i}><span>{['Now','15 min ago','30 min ago','45 min ago'][i]}</span><b>{['Live update','Forecast refreshed','Branch data checked','Weather source synced'][i]}</b><em>{i===0?'Current':'System'}</em></div>)}</div>
      <div className="card accuracy"><div className="card-title"><span>Forecast Verification</span><BadgeCheck size={16}/></div><div className="accuracy-body"><div className="ring"><span>78%</span><small>Match rate</small></div><div className="accuracy-list"><div><span>Total verifications</span><b>42</b></div><div><span>Matched</span><b className="good">33</b></div><div><span>Needs review</span><b className="warn">9</b></div></div></div></div>
    </section>
  </>;
}

function BranchModal({ initial, onClose, onSave }) {
  const [form,setForm]=useState(initial||{name:'',address:'',lat:'',lon:'',active:true});
  const [error,setError]=useState('');
  const [copied,setCopied]=useState(false);
  const lat=Number(form.lat), lon=Number(form.lon);
  const validCoords=Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
  const copyCoords=async()=>{if(!validCoords)return;try{await navigator.clipboard.writeText(`${lat}, ${lon}`);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch{}};
  const submit=(e)=>{e.preventDefault(); if(!form.name.trim()||!validCoords){setError('Enter a branch name and valid latitude/longitude.');return;} onSave({...form,name:form.name.trim(),address:form.address.trim()||'Davao City',lat,lon});};
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="modal wide-modal" onSubmit={submit}>
    <div className="modal-head"><div><h2>{initial?'Edit Branch':'Add Branch'}</h2><p>Register the exact physical branch location used by the weather engine.</p></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={17}/></button></div>
    <div className="location-guide"><div className="guide-icon"><MapPin size={18}/></div><div><strong>Use the branch pin, not the city center.</strong><span>Open Google Maps, place the pin on the actual store, then copy the latitude and longitude.</span></div></div>
    <div className="form-grid"><label>Branch name<input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Matina"/></label><label>Address<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Exact branch address"/></label><label>Latitude<input value={form.lat} onChange={e=>setForm({...form,lat:e.target.value})} inputMode="decimal" placeholder="7.0731"/></label><label>Longitude<input value={form.lon} onChange={e=>setForm({...form,lon:e.target.value})} inputMode="decimal" placeholder="125.6128"/></label></div>
    <div className="coordinate-preview"><div><small>Coordinates</small><strong>{validCoords?`${lat.toFixed(6)}, ${lon.toFixed(6)}`:'Waiting for valid coordinates'}</strong></div>{validCoords&&<div className="coordinate-actions"><button type="button" className="secondary small-btn" onClick={copyCoords}>{copied?'Copied':'Copy'}</button><a className="secondary small-btn" href={mapsUrl(lat,lon)} target="_blank" rel="noreferrer">Open in Maps</a></div>}</div>
    {error&&<div className="form-error"><AlertTriangle size={15}/>{error}</div>}
    <div className="modal-foot"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" type="submit">{initial?'Save Changes':'Add Branch'}</button></div>
  </form></div>;
}

function Branches({ branches, setBranches, backendOnline }) {
  const [query,setQuery]=useState(''); const [editing,setEditing]=useState(null); const [adding,setAdding]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const filtered=branches.filter(b=>`${b.name} ${b.address}`.toLowerCase().includes(query.toLowerCase()));
  const save=async(data)=>{
    setBusy(true);setError('');
    try {
      if (backendOnline) {
        const payload={branch_name:data.name,address:data.address,latitude:data.lat,longitude:data.lon,timezone:'Asia/Manila',is_active:data.active!==false};
        if(editing){ const saved=await api.updateBranch(editing.id,payload); setBranches(branches.map(x=>x.id===editing.id?{...x,id:saved.id,name:saved.branch_name,address:saved.address,lat:saved.latitude,lon:saved.longitude,active:saved.is_active}:x)); }
        else { const saved=await api.createBranch(payload); setBranches([...branches,{id:saved.id,name:saved.branch_name,address:saved.address,lat:saved.latitude,lon:saved.longitude,active:saved.is_active}]); }
      } else if(editing){ setBranches(branches.map(x=>x.id===editing.id?{...x,...data}:x)); }
      else { setBranches([...branches,{id:crypto.randomUUID(),...data}]); }
      setEditing(null);setAdding(false);
    } catch(e) { setError(e.message||'Unable to save branch.'); }
    finally { setBusy(false); }
  };
  const remove=async(id,name)=>{ if(!confirm(`Delete ${name} branch?`))return; setBusy(true);setError(''); try { if(backendOnline) await api.deleteBranch(id); setBranches(branches.filter(x=>x.id!==id)); } catch(e){setError(e.message||'Unable to delete branch.');} finally{setBusy(false);} };
  return <><div className="page-head"><div><h1>Branches</h1><p>Manage branch locations used by the weather engine</p></div><button className="primary" disabled={busy} onClick={()=>setAdding(true)}><Plus size={17}/> Add Branch</button></div><div className="toolbar"><div className="search"><Search size={16}/><input placeholder="Search branches..." value={query} onChange={e=>setQuery(e.target.value)}/></div><span className="data-note">{backendOnline?'Connected to database · changes persist':'Local mode · changes stay in this browser'}</span></div>{error&&<div className="form-error branch-error"><AlertTriangle size={15}/>{error}</div>}<div className="card table-card"><table><thead><tr><th>Branch</th><th>Address</th><th>Coordinates</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(b=><tr key={b.id}><td><strong>{b.name}</strong></td><td>{b.address}</td><td><div className="coord-cell"><span>{Number(b.lat).toFixed(4)}, {Number(b.lon).toFixed(4)}</span><a href={mapsUrl(b.lat,b.lon)} target="_blank" rel="noreferrer" title="Open branch in Google Maps"><MapPin size={13}/></a></div></td><td><span className="status"><span></span> {b.active===false?'Inactive':'Active'}</span></td><td><button className="table-btn" title="Edit" disabled={busy} onClick={()=>setEditing(b)}><Pencil size={15}/></button><button className="table-btn danger" title="Delete" disabled={busy} onClick={()=>remove(b.id,b.name)}><Trash2 size={15}/></button></td></tr>)}</tbody></table>{!filtered.length&&<div className="empty compact-empty"><Search size={24}/><h2>No branches found</h2><p>Try another search term.</p></div>}</div>{(adding||editing)&&<BranchModal initial={editing} onClose={()=>{setAdding(false);setEditing(null)}} onSave={save}/>}</>;
}
function RainRisk({ weather, hours = 24, compact = false }) {
  const h = weather?.hourly;
  const rows = useMemo(() => {
    if (!h?.time) return [];
    return h.time.slice(0, hours).map((time, i) => ({
      time, prob: Number(h.precipitation_probability?.[i] ?? 0),
      rain: Number(h.rain?.[i] ?? 0), code: h.weather_code?.[i]
    }));
  }, [h, hours]);
  const level = p => p >= 80 ? 'high' : p >= 50 ? 'watch' : 'low';
  const windows = useMemo(() => {
    const out = [];
    let active = null;
    rows.forEach(r => {
      if (r.prob >= 50) {
        if (!active) active = { start:r.time, end:r.time, peak:r };
        active.end = r.time;
        if (r.prob > active.peak.prob) active.peak = r;
      } else if (active) { out.push(active); active = null; }
    });
    if (active) out.push(active);
    return out;
  }, [rows]);
  const peak = rows.reduce((a,b) => !a || b.prob > a.prob ? b : a, null);
  if (!rows.length) return <div className="card empty compact-empty"><CloudRain size={24}/><h2>No forecast data</h2></div>;
  if (compact) {
    const badgeLevel = peak ? level(peak.prob) : 'low';
    const badgeText = badgeLevel === 'high' ? 'High Rain Risk' : badgeLevel === 'watch' ? 'Rain Watch' : 'Low Risk';
    return <div className="card rain-risk-compact">
      <div className="card-title"><span>Rain Risk</span><CloudRain size={16}/></div>
      {peak && peak.prob >= 50 ? <>
        <div className="risk-peak"><b>{peak.prob}%</b><span>peak</span></div>
        {windows[0] && <div className="risk-window-range">{formatHour(windows[0].start)} – {formatHour(windows[0].end)}</div>}
        <span className={`risk-badge ${badgeLevel}`}>{badgeText}</span>
      </> : <div className="risk-clear"><CheckCircle2 size={16}/> No 50%+ rain window in the next {hours}h</div>}
    </div>;
  }
  return <div className="card rain-risk">
    <div className="card-head"><div><h2>Rain Risk Windows</h2><p>{compact ? 'Next 24 hours' : 'Operational view · based on precipitation probability'}</p></div>{peak && <span className={`risk-badge ${level(peak.prob)}`}>{peak.prob}% peak</span>}</div>
    <div className="risk-timeline">{rows.map(r => <div key={r.time} className={`risk-hour ${level(r.prob)}`} title={`${new Date(r.time).toLocaleString()} · ${r.prob}% rain probability`}><span>{formatHour(r.time)}</span><div className="risk-bar"><i style={{height:`${Math.max(4,r.prob)}%`}}></i></div><b>{r.prob}%</b></div>)}</div>
    {windows.length ? <div className="risk-windows">{windows.slice(0,4).map(w => <div className="risk-window" key={w.start}><CloudRain size={15}/><div><strong>{formatHour(w.start)}{w.start!==w.end?` – ${formatHour(new Date(new Date(w.end).getTime()+3600000).toISOString())}`:''}</strong><span>Peak {w.peak.prob}% · {weatherText[w.peak.code]?.[0] || 'Rain risk'}</span></div><em>{w.peak.prob>=80?'High':'Watch'}</em></div>)}</div> : <div className="risk-clear"><CheckCircle2 size={16}/> No 50%+ rain-probability window in the selected period.</div>}
    <div className="risk-legend"><span><i className="low"></i>&lt;50% Low</span><span><i className="watch"></i>50–79% Watch</span><span><i className="high"></i>80%+ High</span></div>
  </div>;
}

function Forecast({ branch, weather }) {
  const h=weather?.hourly; const rows=h ? h.time.slice(0,24).map((time,i)=>({time,temp:h.temperature_2m[i],prob:h.precipitation_probability[i],rain:h.rain[i],code:h.weather_code[i],wind:h.wind_speed_10m[i]})) : [];
  return <><div className="page-head"><div><h1>Weather Forecast</h1><p>Hourly forecast detail for {branch.name}</p></div></div><RainRisk weather={weather}/><div className="card table-card"><div className="table-top"><div className="filter-chip"><MapPin size={14}/> {branch.name}</div><div className="data-note">24-hour view · live forecast source</div></div><table><thead><tr><th>Time</th><th>Weather</th><th>Temp</th><th>Rain prob.</th><th>Rainfall</th><th>Wind</th></tr></thead><tbody>{rows.map(r=><tr key={r.time}><td>{formatHour(r.time)}</td><td><span className="weather-cell">{iconFor(r.code,19)} {weatherText[r.code]?.[0]}</span></td><td>{Math.round(r.temp)}°C</td><td><span className={r.prob>=70?'rain-high':''}>{r.prob}%</span></td><td>{Number(r.rain||0).toFixed(1)} mm</td><td>{Math.round(r.wind)} km/h</td></tr>)}</tbody></table></div></>;
}

function Historical({ branch, backendOnline }) {
  const [rows,setRows]=useState([]); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const [date,setDate]=useState(''); const [run,setRun]=useState('all'); const [minProb,setMinProb]=useState('all'); const [limit,setLimit]=useState(500);
  const load=async()=>{if(!backendOnline||!branch?.id)return;setLoading(true);setError('');try{const data=await api.forecastHistory(branch.id,{date,limit});if(data) setRows(data);}catch(e){setError(e.message||'Unable to load forecast history.')}finally{setLoading(false)}};
  useEffect(()=>{load()},[branch?.id,backendOnline,date,limit]);
  const runs=useMemo(()=>Array.from(new Set(rows.map(r=>r.forecast_run_time))).sort((a,b)=>new Date(b)-new Date(a)),[rows]);
  const display=useMemo(()=>rows.filter(r=>(run==='all'||r.forecast_run_time===run)&&(minProb==='all'||Number(r.rain_probability_pct||0)>=Number(minProb))),[rows,run,minProb]);
  const clear=()=>{setDate('');setRun('all');setMinProb('all');setLimit(500)};
  return <><div className="page-head"><div><h1>Historical Weather</h1><p>Search exactly what the system forecasted for {branch.name}</p></div><button className="secondary" onClick={load} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/> Refresh</button></div>{error&&<div className="form-error branch-error"><AlertTriangle size={15}/>{error}</div>}
    <div className="card history-filter"><div className="filter-field"><label>Date</label><input type="date" value={date} onChange={e=>{setDate(e.target.value);setRun('all')}}/></div><div className="filter-field"><label>Forecast run</label><select value={run} onChange={e=>setRun(e.target.value)}><option value="all">All runs</option>{runs.map(r=><option key={r} value={r}>{new Date(r).toLocaleString()}</option>)}</select></div><div className="filter-field"><label>Rain probability</label><select value={minProb} onChange={e=>setMinProb(e.target.value)}><option value="all">Any</option><option value="50">50%+</option><option value="70">70%+</option><option value="80">80%+</option></select></div><button className="secondary filter-clear" onClick={clear}>Clear filters</button><span className="filter-count">{display.length} rows</span></div>
    <div className="card table-card"><table><thead><tr><th>Forecast run</th><th>Forecast time</th><th>Temp</th><th>Rain prob.</th><th>Rainfall</th><th>Condition</th></tr></thead><tbody>{display.map(r=><tr key={r.id}><td>{new Date(r.forecast_run_time).toLocaleString()}</td><td>{new Date(r.forecast_time).toLocaleString([], {month:'short',day:'numeric',hour:'numeric'})}</td><td>{r.temperature_c == null?'—':`${Math.round(r.temperature_c)}°C`}</td><td><span className={Number(r.rain_probability_pct)>=70?'rain-high':''}>{r.rain_probability_pct == null?'—':`${r.rain_probability_pct}%`}</span></td><td>{r.precipitation_mm == null?'—':`${Number(r.precipitation_mm).toFixed(1)} mm`}</td><td>{weatherText[r.weather_code]?.[0]||'—'}</td></tr>)}{!display.length&&<tr><td colSpan="6"><div className="table-empty">{loading?'Loading saved forecasts…':'No matching forecast records.'}</div></td></tr>}</tbody></table></div>
    <div className="info-banner"><History size={18}/><div><strong>This is the audit trail for predictions.</strong><p><b>Forecast run</b> = when the prediction was captured. <b>Forecast time</b> = the time being predicted. Use these records when checking whether a forecast was correct.</p></div></div></>;
}
function Verification({ branch, backendOnline }) {
  const [rows,setRows]=useState([]); const [accuracy,setAccuracy]=useState(null); const [open,setOpen]=useState(false); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const load=async()=>{let alive=true;setLoading(true);setError('');try{if(backendOnline){const [obs,report]=await Promise.all([api.observations(branch.id),api.accuracy(branch.id)]);if(alive){setRows(obs||[]);setAccuracy(report);}}else{const key=`bakeshop_verifications_${branch.id}`;setRows(JSON.parse(localStorage.getItem(key)||'[]'));}}catch(e){if(alive)setError(e.message||'Unable to load verification records.');}finally{if(alive)setLoading(false)}};
  useEffect(()=>{load();return()=>{}},[branch?.id,backendOnline]);
  const add=async(r)=>{setOpen(false);setError('');try{if(backendOnline){await api.createObservation(branch.id,{observation_time:new Date(`${r.date}T${r.time}:00+08:00`).toISOString(),did_rain:r.didRain,rain_intensity:r.rainIntensity,actual_temperature_c:r.actualTemp,notes:r.notes});await load();}else{const key=`bakeshop_verifications_${branch.id}`;const local={...r,id:crypto.randomUUID()};const next=[local,...rows];setRows(next);localStorage.setItem(key,JSON.stringify(next));}}catch(e){setError(e.message||'Unable to save verification.');}};
  const rate=accuracy?.rain_match_rate_pct;
  return <><div className="page-head"><div><h1>Forecast Verification</h1><p>Record actual branch conditions and automatically compare them with the original forecast</p></div><button className="primary" onClick={()=>setOpen(true)}><BadgeCheck size={17}/> New Verification</button></div>{error&&<div className="form-error branch-error"><AlertTriangle size={15}/>{error}</div>}
    <div className="verification-grid"><div className="card verify-card"><div className="card-head"><div><h2>{branch.name}</h2><p>{accuracy?.total_observations ?? rows.length} recorded observation{(accuracy?.total_observations ?? rows.length)===1?'':'s'}</p></div><span className="filter-chip">{backendOnline?'Database records':'Local records'}</span></div><table><thead><tr><th>Date & time</th><th>Actual</th><th>Original forecast</th><th>Result</th></tr></thead><tbody>{rows.length?rows.map(r=>{const match=accuracy?.records?.find(x=>x.observation_id===r.id);return <tr key={r.id}><td>{new Date(r.observation_time||`${r.date}T${r.time}`).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</td><td>{r.actual_temperature_c ?? r.actualTemp ?? '—'}°C · {(r.did_rain ?? r.didRain) ? 'Rain' : 'No rain'}</td><td>{match?`${match.forecast_temperature_c ?? '—'}°C · ${match.forecast_rain_probability_pct ?? '—'}%`: 'Matched automatically'}</td><td>{match?.rain_result==='match'?<span className="result good"><CheckCircle2 size={14}/> Match</span>:match?.rain_result==='mismatch'?<span className="result bad"><XCircle size={14}/> Mismatch</span>:<span className="result partial"><AlertTriangle size={14}/> Review</span>}</td></tr>}) : <tr><td colSpan="4"><div className="table-empty">{loading?'Loading verification records…':'No verification records yet. Record the first branch observation.'}</div></td></tr>}</tbody></table></div>
      <div className="card verification-note"><BadgeCheck size={25}/><h2>Accuracy</h2><p>The system chooses the latest saved forecast run before the observation and the nearest forecast hour. You do not need to manually type the forecast values.</p><div className="mini-metric"><span>Rain match rate</span><b>{rate == null ? '—' : `${rate}%`}</b></div><div className="mini-metric"><span>Temperature MAE</span><b>{accuracy?.mean_absolute_temperature_error_c == null ? '—' : `${accuracy.mean_absolute_temperature_error_c}°C`}</b></div><div className="mini-metric"><span>Brier score</span><b>{accuracy?.brier_score == null ? '—' : accuracy.brier_score}</b></div></div></div>{open&&<VerificationModal branch={branch} backendOnline={backendOnline} onClose={()=>setOpen(false)} onSave={add}/>}</>;
}

function VerificationModal({ branch, backendOnline, onClose, onSave }) {
  const [form,setForm]=useState({date:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'}),time:'12:00',actualTemp:'',didRain:false,rainIntensity:'none',notes:''});
  const [forecast,setForecast]=useState(null); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const loadForecast=async()=>{if(!backendOnline||!form.date||!form.time){setForecast(null);return}setLoading(true);setError('');try{setForecast(await api.forecastForTime(branch.id,`${form.date}T${form.time}:00+08:00`));}catch(e){setForecast(null);setError(e.message||'No saved forecast found for this time.')}finally{setLoading(false)}};
  useEffect(()=>{loadForecast()},[form.date,form.time,backendOnline]);
  const save=e=>{e.preventDefault();if(form.actualTemp===''||!form.date||!form.time){setError('Enter the actual temperature, date and time.');return;}onSave({...form,actualTemp:Number(form.actualTemp)});};
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="modal wide-modal" onSubmit={save}><div className="modal-head"><div><h2>New Verification</h2><p>{branch.name} · record what actually happened. Forecast values are pulled from saved history.</p></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={17}/></button></div>
    <div className="form-grid"><label>Date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Time<input type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></label><label>Actual temperature °C<input type="number" step="0.1" value={form.actualTemp} onChange={e=>setForm({...form,actualTemp:e.target.value})} placeholder="e.g. 29.5"/></label><label>Did it rain?<select value={form.didRain?'yes':'no'} onChange={e=>setForm({...form,didRain:e.target.value==='yes'})}><option value="no">No</option><option value="yes">Yes</option></select></label><label>Rain intensity<select value={form.rainIntensity} onChange={e=>setForm({...form,rainIntensity:e.target.value})}><option value="none">None</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="heavy">Heavy</option></select></label></div>
    <div className="forecast-match">{loading?<><RefreshCw size={16} className="spin"/> Looking up original forecast…</>:forecast?<><div><small>ORIGINAL FORECAST</small><strong>{forecast.temperature_c == null?'—':`${Number(forecast.temperature_c).toFixed(1)}°C`} · {forecast.rain_probability_pct ?? '—'}% rain probability</strong><span>{new Date(forecast.forecast_time).toLocaleString()} · captured {new Date(forecast.forecast_run_time).toLocaleString()}</span></div><span className="match-source">Saved forecast</span></>:<><AlertTriangle size={16}/><div><strong>No saved forecast for this time.</strong><span>Save a snapshot first or choose a time covered by the stored forecast history.</span></div></>}</div>
    <label className="full-label">Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Optional branch observation..."/></label>{error&&<div className="form-error"><AlertTriangle size={15}/>{error}</div>}<div className="modal-foot"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" type="submit" disabled={loading}>Save Verification</button></div></form></div>;
}

function downloadCSV(filename, rows) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(row => headers.map(h => {
    const value = row[h] ?? '';
    return `"${String(value).replaceAll('"','""')}"`;
  }).join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
}

function UsersPage({ backendOnline }) {
  const [users,setUsers]=useState([]); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const [email,setEmail]=useState(''); const [name,setName]=useState(''); const [role,setRole]=useState('viewer');
  const load=async()=>{if(!backendOnline)return;setLoading(true);setError('');try{setUsers(await api.users())}catch(e){setError(e.message||'Unable to load users.')}finally{setLoading(false)}};
  useEffect(()=>{load()},[backendOnline]);
  async function invite(e){e.preventDefault();setLoading(true);setError('');try{await api.inviteUser({email,full_name:name,role});setEmail('');setName('');setRole('viewer');await load()}catch(e){setError(e.message||'Unable to invite user.')}finally{setLoading(false)}}
  async function update(id, body){setLoading(true);setError('');try{const updated=await api.updateUser(id,body);setUsers(prev=>prev.map(u=>u.id===id?updated:u))}catch(e){setError(e.message||'Unable to update user.')}finally{setLoading(false)}}
  return <><div className="page-head"><div><h1>User Management</h1><p>Manage authorized accounts and system roles</p></div><button className="secondary" onClick={load} disabled={loading||!backendOnline}><RefreshCw size={15} className={loading?'spin':''}/> Refresh</button></div>
    {!backendOnline?<div className="empty card"><Database size={30}/><h2>Database connection required</h2><p>User accounts are managed through Supabase Authentication and the profiles table.</p></div>:<>
      {error&&<div className="form-error branch-error"><AlertTriangle size={15}/>{error}</div>}
      <div className="card invite-card"><div className="card-title"><span>Invite user</span><UserPlus size={17}/></div><form className="inline-form" onSubmit={invite}><label>Full name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Optional"/></label><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" required/></label><label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option value="viewer">Viewer</option><option value="manager">Manager</option><option value="admin">Admin</option></select></label><button className="primary" disabled={loading}><UserPlus size={15}/> Send invite</button></form></div>
      <div className="card table-card"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{users.length?users.map(u=><tr key={u.id}><td><strong>{u.full_name||'Unnamed user'}</strong><small>{u.email||'—'}</small></td><td><select value={u.role} onChange={e=>update(u.id,{role:e.target.value})}><option value="viewer">Viewer</option><option value="manager">Manager</option><option value="admin">Admin</option></select></td><td><span className={`history-status ${u.is_active?'open':'cleared'}`}>{u.is_active?'Active':'Inactive'}</span></td><td>{u.created_at?new Date(u.created_at).toLocaleDateString():'—'}</td><td><button className="secondary small-btn" onClick={()=>update(u.id,{is_active:!u.is_active})}>{u.is_active?'Deactivate':'Activate'}</button></td></tr>):<tr><td colSpan="5"><div className="table-empty">{loading?'Loading users…':'No profile records found.'}</div></td></tr>}</tbody></table></div>
    </>}
  </>;
}

function AuditPage({ backendOnline }) {
  const [rows,setRows]=useState([]); const [error,setError]=useState('');
  useEffect(()=>{if(backendOnline)api.auditLogs(300).then(setRows).catch(e=>setError(e.message||'Unable to load audit logs.'))},[backendOnline]);
  return <><div className="page-head"><div><h1>Audit Log</h1><p>Administrative activity recorded by the system</p></div></div>{!backendOnline?<div className="empty card"><Database size={30}/><h2>Database connection required</h2></div>:error?<div className="form-error branch-error">{error}</div>:<div className="card table-card"><table><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td><strong>{r.action}</strong></td><td>{r.entity_type} {r.entity_id?`· ${r.entity_id.slice(0,8)}`:''}</td><td><small>{JSON.stringify(r.metadata||{})}</small></td></tr>):<tr><td colSpan="4"><div className="table-empty">No audit activity recorded.</div></td></tr>}</tbody></table></div>}</>;
}

function ReportsPage({ backendOnline }) {
  const [report,setReport]=useState(null); const [loading,setLoading]=useState(false); const [running,setRunning]=useState(false); const [error,setError]=useState('');
  const load=async()=>{if(!backendOnline)return;setLoading(true);setError('');try{setReport(await api.reportsOverview())}catch(e){setError(e.message||'Unable to load report.')}finally{setLoading(false)}};
  useEffect(()=>{load()},[backendOnline]);
  const run=async()=>{setRunning(true);setError('');try{await api.runSnapshots();await load()}catch(e){setError(e.message||'Snapshot run failed.')}finally{setRunning(false)}};
  return <><div className="page-head"><div><h1>Weather Reports</h1><p>Branch-level forecast performance from verified observations</p></div><button className="primary" disabled={!backendOnline||running} onClick={run}><RefreshCw size={16} className={running?'spin':''}/>{running?'Saving forecasts…':'Run Snapshot Now'}</button></div>{error&&<div className="form-error branch-error"><AlertTriangle size={15}/>{error}</div>}{!backendOnline?<div className="empty card"><Database size={30}/><h2>Database connection required</h2><p>Reports become live after Supabase is configured and verification observations are recorded.</p></div>:<><div className="report-summary"><div className="card report-stat"><span>Overall rain match rate</span><strong>{report?.overall_rain_match_rate_pct == null?'—':`${report.overall_rain_match_rate_pct}%`}</strong><small>Across comparable verified forecasts</small></div><div className="card report-stat"><span>Total observations</span><strong>{report?.total_observations ?? '—'}</strong><small>Branch-reported actual conditions</small></div><div className="card report-stat"><span>Branches tracked</span><strong>{report?.branches?.length ?? '—'}</strong><small>Active branches</small></div></div><div className="card table-card"><div className="table-top"><div><strong>Branch performance</strong><p className="table-subtitle">Rain match rate and temperature error by location</p></div><span className="data-note">Generated {report?.generated_at?new Date(report.generated_at).toLocaleString():'—'}</span></div><table><thead><tr><th>Branch</th><th>Observations</th><th>Rain match rate</th><th>Temperature MAE</th><th>Brier score</th></tr></thead><tbody>{report?.branches?.map(r=><tr key={r.branch_id}><td><strong>{r.branch_name}</strong></td><td>{r.total_observations}</td><td>{r.rain_match_rate_pct == null?'—':`${r.rain_match_rate_pct}%`}</td><td>{r.mean_absolute_temperature_error_c == null?'—':`${r.mean_absolute_temperature_error_c}°C`}</td><td>{r.brier_score == null?'—':r.brier_score}</td></tr>)}{!report?.branches?.length&&<tr><td colSpan="5"><div className="table-empty">No active branches found.</div></td></tr>}</tbody></table></div><div className="info-banner"><BadgeCheck size={18}/><div><strong>How this report works</strong><p>The system uses the latest forecast run available before each branch observation and matches it to the nearest forecast hour. Rain probability is evaluated at a 50% operational threshold; Brier score keeps the underlying probability information for future calibration analysis.</p></div></div></>}</>;
}

function SettingsPage() { return <><div className="page-head"><div><h1>Settings</h1><p>System configuration and data source controls</p></div></div><div className="settings-grid"><div className="card settings-card"><div className="setting-row"><div><strong>System name</strong><span>Displayed in the navigation and browser title.</span></div><input defaultValue="Bakeshop Weather"/></div><div className="setting-row"><div><strong>Timezone</strong><span>Branch forecast display timezone.</span></div><select defaultValue="Asia/Manila"><option>Asia/Manila (GMT+8)</option></select></div><div className="setting-row"><div><strong>Refresh interval</strong><span>How often the frontend asks for updated weather.</span></div><select defaultValue="15"><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option></select></div></div><div className="card settings-card"><div className="card-title"><span>Weather source</span><CloudSun size={17}/></div><div className="source-box"><span className="source-dot"></span><div><strong>Open-Meteo</strong><p>Live coordinate-based forecast source for this first build.</p></div><span className="connected">Connected</span></div><div className="info-banner compact"><Database size={17}/><p>Supabase provides persistent branches, forecast snapshots and verification records when the production environment is configured.</p></div></div></div></>;
}

function Login({ onSignedIn }) {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{const session=await signIn(email.trim(),password);localStorage.setItem('bakeshop_access_token',session.access_token);onSignedIn(session);}catch(err){setError(err.message||'Unable to sign in.');}finally{setBusy(false);}}
  return <div className="auth-screen"><div className="auth-card"><div className="auth-brand"><div className="brand-mark"><CloudSun size={23}/></div><div><strong>Bakeshop Weather</strong><span>Branch Monitoring System</span></div></div><div className="auth-copy"><h1>Sign in</h1><p>Use your authorized account to access branch weather monitoring.</p></div><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required placeholder="you@company.com"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required placeholder="••••••••"/></label>{error&&<div className="form-error"><AlertTriangle size={15}/>{error}</div>}<button className="primary auth-submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form><div className="auth-foot">Private internal system · Authorized users only</div></div></div>;
}

function App() {
  const [session,setSession]=useState(undefined);
  useEffect(()=>{ if(!authEnabled){setSession(null);return;} getSession().then(s=>{setSession(s); if(s?.access_token)localStorage.setItem('bakeshop_access_token',s.access_token);}); const {data}=supabaseAuth.auth.onAuthStateChange((_event,s)=>{setSession(s); if(s?.access_token)localStorage.setItem('bakeshop_access_token',s.access_token); else localStorage.removeItem('bakeshop_access_token');}); return ()=>data.subscription.unsubscribe(); },[]);
  const [branches,setBranches]=useState(()=>{try{return JSON.parse(localStorage.getItem('bakeshop_branches'))||defaultBranches}catch{return defaultBranches}});
  const [selectedId,setSelectedId]=useState(()=>localStorage.getItem('bakeshop_selected')||defaultBranches[0].id);
  const [backendOnline,setBackendOnline]=useState(false);
  const [page,setPage]=useState('dashboard'); const [mobileOpen,setMobileOpen]=useState(false); const [weather,setWeather]=useState(null); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const branch=branches.find(b=>b.id===selectedId)||branches[0];
  useEffect(()=>localStorage.setItem('bakeshop_branches',JSON.stringify(branches)),[branches]);
  useEffect(()=>localStorage.setItem('bakeshop_selected',selectedId),[selectedId]);
  useEffect(()=>{(async()=>{try{const health=await api.health();if(health?.databaseConfigured){const rows=await api.branches();if(rows.length){const mapped=rows.map(b=>({id:b.id,name:b.branch_name,address:b.address||'',lat:b.latitude,lon:b.longitude,active:b.is_active}));setBranches(mapped);if(!mapped.some(b=>b.id===selectedId))setSelectedId(mapped[0].id);}setBackendOnline(true);}}catch{setBackendOnline(false);}})()},[]);
  useEffect(()=>{ if(branch) load(); },[selectedId,branch?.lat,branch?.lon,backendOnline]);
  useEffect(()=>{const timer=setInterval(()=>load(),15*60*1000);return()=>clearInterval(timer)},[selectedId,branch?.lat,branch?.lon,backendOnline]);
  async function load(){ if(!branch)return; setLoading(true);setError(''); try{if(backendOnline){const result=await api.saveSnapshot(branch.id);setWeather(result.weather);}else{setWeather(await fetchWeather(branch));}}catch(e){setError(e.message||'Unable to load weather.');}finally{setLoading(false);} }

  // Auth gating happens AFTER every hook above has run, on every render --
  // never before. This used to sit right after the first useEffect, which
  // meant the pre-login render used far fewer hooks than the post-login
  // render (React error #310: "Rendered more hooks than during the previous
  // render"), crashing the whole app to a blank white screen right after a
  // successful sign-in.
  if(authEnabled && session===undefined) return <div className="auth-loading">Loading secure session…</div>;
  if(authEnabled && !session) return <Login onSignedIn={setSession}/>;

  const nav=[['dashboard','Dashboard',LayoutDashboard],['alerts','Alert Center',Bell],['alert-history','Alert History',History],['branches','Branches',MapPin],['forecast','Weather Forecast',CloudSun],['historical','Historical Weather',History],['verification','Verification',BadgeCheck],['reports','Reports',BarChart3],['users','Users',UserCog],['audit','Audit Log',History],['settings','Settings',Settings]];
  const content=page==='dashboard'?<Dashboard branch={branch} weather={weather} onRefresh={load} loading={loading} branches={branches} backendOnline={backendOnline} onSelectBranch={(id)=>setSelectedId(id)}/>:page==='alerts'?<AlertCenter branches={branches} backendOnline={backendOnline} onSelectBranch={(id)=>setSelectedId(id)}/>:page==='alert-history'?<AlertHistory backendOnline={backendOnline} onSelectBranch={(id)=>setSelectedId(id)}/>:page==='branches'?<Branches branches={branches} setBranches={setBranches} backendOnline={backendOnline}/>:page==='forecast'?<Forecast branch={branch} weather={weather}/>:page==='historical'?<Historical branch={branch} backendOnline={backendOnline}/>:page==='verification'?<Verification branch={branch} backendOnline={backendOnline}/>:page==='settings'?<SettingsPage/>:page==='users'?<UsersPage backendOnline={backendOnline}/>:page==='audit'?<AuditPage backendOnline={backendOnline}/>:<ReportsPage backendOnline={backendOnline}/>;
  return <div className="app"><aside className={`sidebar ${mobileOpen?'open':''}`}><div className="brand"><div className="brand-mark"><CloudSun size={21}/></div><div><strong>Bakeshop Weather</strong><span>Branch Monitoring System</span></div><button className="mobile-close" onClick={()=>setMobileOpen(false)}><X size={19}/></button></div><nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setMobileOpen(false)}}><Icon size={18}/><span>{label}</span></button>)}</nav><div className="sidebar-foot"><span>v2.0.0</span><span>{backendOnline ? 'Database online' : 'Local mode'}</span></div></aside><main className="main"><header className="topbar"><button className="mobile-menu" onClick={()=>setMobileOpen(true)}><Menu size={21}/></button><div className="topbar-space"></div><div className="top-date"><CalendarDays size={16}/><span>{new Date().toLocaleDateString([], {weekday:'short',month:'short',day:'numeric',year:'numeric'})}</span></div><div className="bell"><Bell size={18}/><i></i></div><div className="user"><div className="avatar">{(session?.user?.email||'JD').slice(0,2).toUpperCase()}</div><div><strong>{session?.user?.email||'Branch Monitor'}</strong><span>{authEnabled?'Authorized user':'Administrator'}</span></div>{authEnabled&&<button className="icon-btn user-logout" title="Sign out" onClick={()=>signOut()}><ChevronDown size={15}/></button>}</div></header><div className="content">{error&&<div className="error-banner"><AlertTriangle size={18}/><span>{error} Check your internet connection or branch coordinates.</span><button onClick={load}><RefreshCw size={15}/> Retry</button></div>}{page!=='branches'&&page!=='settings'&&page!=='dashboard'&&<div className="global-branch"><span>Monitoring</span><span className={`backend-status ${backendOnline?'online':'local'}`}><i></i>{backendOnline?'Database online':'Local mode'}</span><select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{branches.map(b=><option value={b.id} key={b.id}>{b.name} Branch</option>)}</select></div>}{content}</div><footer>Bakeshop Weather <span>·</span> Smarter Decisions. Better Days. <span>·</span> Build 2.0.0</footer></main></div>;
}

createRoot(document.getElementById('root')).render(<App />);
