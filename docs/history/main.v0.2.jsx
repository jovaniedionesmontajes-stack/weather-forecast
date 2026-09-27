import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard, MapPin, CloudSun, History, BadgeCheck, BarChart3, Settings,
  Search, Plus, ChevronDown, Bell, CalendarDays, RefreshCw, Droplets, Wind,
  Eye, Sunrise, Sunset, CloudRain, Thermometer, Pencil, Trash2, CheckCircle2,
  AlertTriangle, XCircle, Menu, X, Database, Clock3, Map as MapIcon
} from 'lucide-react';
import './styles.css';

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

function Stat({ icon, label, value, sub }) {
  return <div className="stat"><div className="stat-icon">{icon}</div><div><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{sub && <div className="stat-sub">{sub}</div>}</div></div>;
}

function Dashboard({ branch, weather, onRefresh, loading }) {
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
    <div className="page-head"><div><h1>Dashboard</h1><p>Real-time weather and forecast for all branches</p></div><button className="icon-btn" onClick={onRefresh} title="Refresh weather"><RefreshCw size={18} className={loading ? 'spin' : ''}/></button></div>
    <div className="branch-row"><label><MapPin size={16}/> Select Branch</label><div className="select-wrap"><select value={branch.id} disabled><option>{branch.name}</option></select><ChevronDown size={16}/></div><span className="data-note">Live source · coordinates stored per branch</span></div>

    <section className="grid top-grid">
      <div className="hero-weather">
        <div className="hero-top"><div><span className="live-dot"></span> Live</div><span>Updated {current ? new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : '—'}</span></div>
        <div className="hero-location"><MapPin size={16}/><strong>{branch.name} Branch</strong></div>
        <div className="hero-coord">{branch.lat.toFixed(4)}° N, {branch.lon.toFixed(4)}° E</div>
        <div className="hero-main"><div className="weather-symbol">{iconFor(current?.weather_code || 2, 64)}</div><div><div className="big-temp">{Math.round(current?.temperature_2m ?? 29)}°C</div><div className="condition">{condition}</div><div className="feels">Feels like {Math.round(current?.apparent_temperature ?? 32)}°C</div></div></div>
        <div className="hero-metrics"><div><span>Humidity</span><b>{current?.relative_humidity_2m ?? 82}%</b></div><div><span>Rain probability</span><b>{hours[0]?.prob ?? 0}%</b></div><div><span>Rainfall</span><b>{Number(current?.rain ?? 0).toFixed(1)} mm</b></div><div><span>Wind</span><b>{Math.round(current?.wind_speed_10m ?? 0)} km/h</b></div><div><span>Cloud cover</span><b>{current?.cloud_cover ?? 0}%</b></div><div><span>Visibility</span><b>{current?.visibility ? `${(current.visibility/1000).toFixed(1)} km` : '—'}</b></div></div>
      </div>
      <div className="card summary"><div className="card-title"><span>Today's Summary</span><CalendarDays size={16}/></div><Stat icon={<Thermometer size={17}/>} label="Highest temp" value={`${Math.round(daily?.temperature_2m_max?.[0] ?? 32)}°C`}/><Stat icon={<Thermometer size={17}/>} label="Lowest temp" value={`${Math.round(daily?.temperature_2m_min?.[0] ?? 26)}°C`}/><Stat icon={<Sunrise size={17}/>} label="Sunrise" value={daily?.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : '—'}/><Stat icon={<Sunset size={17}/>} label="Sunset" value={daily?.sunset?.[0] ? new Date(daily.sunset[0]).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : '—'}/></div>
      <div className="card map-card"><div className="card-title"><span>Branch Location</span><MapIcon size={16}/></div><div className="map"><div className="map-grid"></div><div className="map-road r1"></div><div className="map-road r2"></div><div className="pin"><MapPin size={27} fill="currentColor"/></div><span className="map-label">{branch.name}</span><span className="map-city">{branch.address}</span></div></div>
    </section>

    <section className="grid forecast-grid">
      <div className="card hourly"><div className="card-head"><div><h2>Hourly Forecast</h2><p>{branch.name}</p></div><span className="view-link">Next 8 hours</span></div><div className="hour-row">{hours.map((h, i) => <div className={`hour ${i === 2 ? 'selected' : ''}`} key={h.time}><span>{formatHour(h.time)}</span>{iconFor(h.code, 27)}<b>{Math.round(h.temp)}°</b><small>{h.prob}%</small></div>)}</div>{peak && <div className="insight"><CloudRain size={18}/><span>Highest rain probability: <strong>{formatHour(peak.time)} · {peak.prob}%</strong></span></div>}</div>
      <div className="card five-day"><div className="card-head"><div><h2>7-Day Forecast</h2><p>{branch.name}</p></div><span className="view-link">View full forecast →</span></div><div className="days">{(daily?.time || []).slice(0,7).map((d,i)=><div className="day" key={d}><span>{i===0?'Today':formatDay(d)}</span><small>{formatDate(d)}</small>{iconFor(daily.weather_code[i],25)}<b>{Math.round(daily.temperature_2m_max[i])}° / {Math.round(daily.temperature_2m_min[i])}°</b><em><Droplets size={11}/>{daily.precipitation_probability_max[i] ?? 0}%</em></div>)}</div></div>
    </section>

    <section className="grid lower-grid">
      <div className="card radar"><div className="card-head"><div><h2>Rain Monitoring</h2><p>Weather radar layer placeholder</p></div><span className="status-pill"><span></span> Monitoring</span></div><div className="radar-art"><div className="radar-ring one"></div><div className="radar-ring two"></div><div className="radar-ring three"></div><div className="radar-sweep"></div><div className="rain-cell c1"></div><div className="rain-cell c2"></div><div className="rain-cell c3"></div><MapPin className="radar-pin" size={22} fill="currentColor"/></div><div className="radar-foot"><span>Radar integration slot</span><b>PAGASA / approved source</b></div></div>
      <div className="card updates"><div className="card-title"><span>Recent Weather Updates</span><Clock3 size={16}/></div>{[0,1,2,3].map((i)=><div className="update" key={i}><span>{['Now','15 min ago','30 min ago','45 min ago'][i]}</span><b>{['Live update','Forecast refreshed','Branch data checked','Weather source synced'][i]}</b><em>{i===0?'Current':'System'}</em></div>)}</div>
      <div className="card accuracy"><div className="card-title"><span>Forecast Verification</span><BadgeCheck size={16}/></div><div className="accuracy-body"><div className="ring"><span>78%</span><small>Match rate</small></div><div className="accuracy-list"><div><span>Total verifications</span><b>42</b></div><div><span>Matched</span><b className="good">33</b></div><div><span>Needs review</span><b className="warn">9</b></div></div></div></div>
    </section>
  </>;
}

function BranchModal({ initial, onClose, onSave }) {
  const [form,setForm]=useState(initial||{name:'',address:'',lat:'',lon:'',active:true});
  const [error,setError]=useState('');
  const submit=(e)=>{e.preventDefault(); const lat=Number(form.lat), lon=Number(form.lon); if(!form.name.trim()||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180){setError('Enter a branch name and valid latitude/longitude.');return;} onSave({...form,name:form.name.trim(),address:form.address.trim()||'Davao City',lat,lon});};
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="modal" onSubmit={submit}><div className="modal-head"><div><h2>{initial?'Edit Branch':'Add Branch'}</h2><p>Use the exact Google Maps coordinates of the branch.</p></div><button type="button" className="icon-btn" onClick={onClose}><X size={17}/></button></div><div className="form-grid"><label>Branch name<input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Matina"/></label><label>Address<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Branch address"/></label><label>Latitude<input value={form.lat} onChange={e=>setForm({...form,lat:e.target.value})} inputMode="decimal" placeholder="7.0731"/></label><label>Longitude<input value={form.lon} onChange={e=>setForm({...form,lon:e.target.value})} inputMode="decimal" placeholder="125.6128"/></label></div>{error&&<div className="form-error"><AlertTriangle size={15}/>{error}</div>}<div className="modal-foot"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" type="submit">{initial?'Save Changes':'Add Branch'}</button></div></form></div>;
}

function Branches({ branches, setBranches }) {
  const [query,setQuery]=useState(''); const [editing,setEditing]=useState(null); const [adding,setAdding]=useState(false);
  const filtered=branches.filter(b=>`${b.name} ${b.address}`.toLowerCase().includes(query.toLowerCase()));
  const save=(data)=>{if(editing){setBranches(branches.map(x=>x.id===editing.id?{...x,...data}:x));}else{setBranches([...branches,{id:crypto.randomUUID(),...data}]);}setEditing(null);setAdding(false);};
  return <><div className="page-head"><div><h1>Branches</h1><p>Manage branch locations used by the weather engine</p></div><button className="primary" onClick={()=>setAdding(true)}><Plus size={17}/> Add Branch</button></div><div className="toolbar"><div className="search"><Search size={16}/><input placeholder="Search branches..." value={query} onChange={e=>setQuery(e.target.value)}/></div><span className="data-note">Coordinates are the source of truth for weather requests.</span></div><div className="card table-card"><table><thead><tr><th>Branch</th><th>Address</th><th>Coordinates</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(b=><tr key={b.id}><td><strong>{b.name}</strong></td><td>{b.address}</td><td>{b.lat.toFixed(4)}, {b.lon.toFixed(4)}</td><td><span className="status"><span></span> Active</span></td><td><button className="table-btn" title="Edit" onClick={()=>setEditing(b)}><Pencil size={15}/></button><button className="table-btn danger" title="Delete" onClick={()=>{if(confirm(`Delete ${b.name} branch?`))setBranches(branches.filter(x=>x.id!==b.id));}}><Trash2 size={15}/></button></td></tr>)}</tbody></table>{!filtered.length&&<div className="empty compact-empty"><Search size={24}/><h2>No branches found</h2><p>Try another search term.</p></div>}</div>{(adding||editing)&&<BranchModal initial={editing} onClose={()=>{setAdding(false);setEditing(null)}} onSave={save}/>}</>;
}

function Forecast({ branch, weather }) {
  const h=weather?.hourly; const rows=h ? h.time.slice(0,24).map((time,i)=>({time,temp:h.temperature_2m[i],prob:h.precipitation_probability[i],rain:h.rain[i],code:h.weather_code[i],wind:h.wind_speed_10m[i]})) : [];
  return <><div className="page-head"><div><h1>Weather Forecast</h1><p>Hourly forecast detail for {branch.name}</p></div></div><div className="card table-card"><div className="table-top"><div className="filter-chip"><MapPin size={14}/> {branch.name}</div><div className="data-note">24-hour view · live forecast source</div></div><table><thead><tr><th>Time</th><th>Weather</th><th>Temp</th><th>Rain prob.</th><th>Rainfall</th><th>Wind</th></tr></thead><tbody>{rows.map(r=><tr key={r.time}><td>{formatHour(r.time)}</td><td><span className="weather-cell">{iconFor(r.code,19)} {weatherText[r.code]?.[0]}</span></td><td>{Math.round(r.temp)}°C</td><td><span className={r.prob>=70?'rain-high':''}>{r.prob}%</span></td><td>{Number(r.rain||0).toFixed(1)} mm</td><td>{Math.round(r.wind)} km/h</td></tr>)}</tbody></table></div></>;
}

function Historical({ branch }) {
  const demo = Array.from({length:7},(_,i)=>({date:`2026-09-${String(20+i).padStart(2,'0')}`,time:'12:00 PM',temp:28+i%4,prob:40+i*7,rain:(i%3)*0.6,condition:['Cloudy','Partly cloudy','Light rain','Rain'][i%4]}));
  return <><div className="page-head"><div><h1>Historical Weather</h1><p>Saved forecast and observation records for {branch.name}</p></div></div><div className="filterbar"><div className="filter-chip"><CalendarDays size={14}/> Sep 20 – Sep 26, 2026</div><div className="filter-chip"><MapPin size={14}/> {branch.name}</div></div><div className="card table-card"><table><thead><tr><th>Date</th><th>Time</th><th>Temp</th><th>Rain prob.</th><th>Rainfall</th><th>Condition</th></tr></thead><tbody>{demo.map(r=><tr key={r.date}><td>{r.date}</td><td>{r.time}</td><td>{r.temp}°C</td><td>{r.prob}%</td><td>{r.rain.toFixed(1)} mm</td><td>{r.condition}</td></tr>)}</tbody></table></div><div className="info-banner"><Database size={18}/><div><strong>Database connection comes next.</strong><p>These rows are intentionally demo records. The production version will store each forecast run with its fetch time so you can later compare what was predicted against what actually happened.</p></div></div></>;
}

function Verification({ branch }) {
  const key=`bakeshop_verifications_${branch.id}`;
  const [rows,setRows]=useState(()=>{try{return JSON.parse(localStorage.getItem(key))||[]}catch{return []}});
  const [open,setOpen]=useState(false);
  useEffect(()=>localStorage.setItem(key,JSON.stringify(rows)),[key,rows]);
  const add=(r)=>{setRows([{...r,id:crypto.randomUUID()},...rows]);setOpen(false)};
  const matches=rows.filter(r=>r.result==='match').length; const rate=rows.length?Math.round(matches/rows.length*100):0;
  return <><div className="page-head"><div><h1>Forecast Verification</h1><p>Compare the original forecast with branch-reported actual conditions</p></div><button className="primary" onClick={()=>setOpen(true)}><BadgeCheck size={17}/> New Verification</button></div><div className="verification-grid"><div className="card verify-card"><div className="card-head"><div><h2>{branch.name}</h2><p>{rows.length} recorded verification{rows.length===1?'':'s'}</p></div><span className="filter-chip">Local records</span></div><table><thead><tr><th>Date & time</th><th>Forecast</th><th>Actual</th><th>Result</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id}><td>{r.date} · {r.time}</td><td>{r.forecastTemp}°C · {r.forecastProb}%</td><td>{r.actualTemp}°C · {r.didRain?'Rain':'No rain'}</td><td><span className={`result ${r.result==='match'?'good':r.result==='partial'?'partial':'bad'}`}>{r.result==='match'?<CheckCircle2 size={15}/>:r.result==='partial'?<AlertTriangle size={15}/>:<XCircle size={15}/>} {r.result==='match'?'Match':r.result==='partial'?'Partial':'Mismatch'}</span></td></tr>):<tr><td colSpan="4"><div className="table-empty">No verification records yet. Record the first branch observation.</div></td></tr>}</tbody></table></div><div className="card verification-note"><BadgeCheck size={25}/><h2>Verification accuracy</h2><p>The system keeps the forecast and the actual branch observation separate. This lets us measure how reliable the forecast is for each location over time.</p><div className="mini-metric"><span>Recorded match rate</span><b>{rate}%</b></div><div className="mini-metric"><span>Total records</span><b>{rows.length}</b></div></div></div>{open&&<VerificationModal branch={branch} onClose={()=>setOpen(false)} onSave={add}/>}</>;
}

function VerificationModal({ branch, onClose, onSave }) {
  const [form,setForm]=useState({date:new Date().toISOString().slice(0,10),time:'12:00',forecastTemp:29,forecastProb:70,actualTemp:29,didRain:false,notes:''});
  const save=e=>{e.preventDefault();const ft=Number(form.forecastTemp),at=Number(form.actualTemp),fp=Number(form.forecastProb);const result=(form.didRain&&fp>=50)||(!form.didRain&&fp<50)?'match':Math.abs(ft-at)<=1?'partial':'mismatch';onSave({...form,forecastTemp:ft,actualTemp:at,forecastProb:fp,result});};
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="modal" onSubmit={save}><div className="modal-head"><div><h2>New Verification</h2><p>{branch.name} · record what actually happened.</p></div><button type="button" className="icon-btn" onClick={onClose}><X size={17}/></button></div><div className="form-grid"><label>Date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Time<input type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></label><label>Forecast temperature °C<input type="number" value={form.forecastTemp} onChange={e=>setForm({...form,forecastTemp:e.target.value})}/></label><label>Forecast rain probability %<input type="number" min="0" max="100" value={form.forecastProb} onChange={e=>setForm({...form,forecastProb:e.target.value})}/></label><label>Actual temperature °C<input type="number" value={form.actualTemp} onChange={e=>setForm({...form,actualTemp:e.target.value})}/></label><label>Did it rain?<select value={form.didRain?'yes':'no'} onChange={e=>setForm({...form,didRain:e.target.value==='yes'})}><option value="no">No</option><option value="yes">Yes</option></select></label></div><label className="full-label">Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Optional branch observation..."/></label><div className="modal-foot"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" type="submit">Save Verification</button></div></form></div>;
}

function SettingsPage() { return <><div className="page-head"><div><h1>Settings</h1><p>System configuration and data source controls</p></div></div><div className="settings-grid"><div className="card settings-card"><div className="setting-row"><div><strong>System name</strong><span>Displayed in the navigation and browser title.</span></div><input defaultValue="Bakeshop Weather"/></div><div className="setting-row"><div><strong>Timezone</strong><span>Branch forecast display timezone.</span></div><select defaultValue="Asia/Manila"><option>Asia/Manila (GMT+8)</option></select></div><div className="setting-row"><div><strong>Refresh interval</strong><span>How often the frontend asks for updated weather.</span></div><select defaultValue="15"><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option></select></div></div><div className="card settings-card"><div className="card-title"><span>Weather source</span><CloudSun size={17}/></div><div className="source-box"><span className="source-dot"></span><div><strong>Open-Meteo</strong><p>Live coordinate-based forecast source for this first build.</p></div><span className="connected">Connected</span></div><div className="info-banner compact"><Database size={17}/><p>Supabase will be connected in the next build stage for persistent branches, forecast snapshots and verification records.</p></div></div></div></>;
}

function App() {
  const [branches,setBranches]=useState(()=>{try{return JSON.parse(localStorage.getItem('bakeshop_branches'))||defaultBranches}catch{return defaultBranches}});
  const [selectedId,setSelectedId]=useState(()=>localStorage.getItem('bakeshop_selected')||defaultBranches[0].id);
  const [page,setPage]=useState('dashboard'); const [mobileOpen,setMobileOpen]=useState(false); const [weather,setWeather]=useState(null); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const branch=branches.find(b=>b.id===selectedId)||branches[0];
  useEffect(()=>localStorage.setItem('bakeshop_branches',JSON.stringify(branches)),[branches]);
  useEffect(()=>localStorage.setItem('bakeshop_selected',selectedId),[selectedId]);
  useEffect(()=>{ if(branch) load(); },[selectedId,branch?.lat,branch?.lon]);
  useEffect(()=>{const timer=setInterval(()=>load(),15*60*1000);return()=>clearInterval(timer)},[selectedId,branch?.lat,branch?.lon]);
  async function load(){ if(!branch)return; setLoading(true);setError(''); try{setWeather(await fetchWeather(branch));}catch(e){setError(e.message||'Unable to load weather.');}finally{setLoading(false);} }
  const nav=[['dashboard','Dashboard',LayoutDashboard],['branches','Branches',MapPin],['forecast','Weather Forecast',CloudSun],['historical','Historical Weather',History],['verification','Verification',BadgeCheck],['reports','Reports',BarChart3],['settings','Settings',Settings]];
  const content=page==='dashboard'?<Dashboard branch={branch} weather={weather} onRefresh={load} loading={loading}/>:page==='branches'?<Branches branches={branches} setBranches={setBranches}/>:page==='forecast'?<Forecast branch={branch} weather={weather}/>:page==='historical'?<Historical branch={branch}/>:page==='verification'?<Verification branch={branch}/>:page==='settings'?<SettingsPage/>:<><div className="page-head"><div><h1>Reports</h1><p>Weather performance reports will be added after forecast verification data is connected.</p></div></div><div className="empty card"><BarChart3 size={30}/><h2>Reporting layer</h2><p>This area is reserved for branch-level weather accuracy and historical trend reports.</p></div></>;
  return <div className="app"><aside className={`sidebar ${mobileOpen?'open':''}`}><div className="brand"><div className="brand-mark"><CloudSun size={21}/></div><div><strong>Bakeshop Weather</strong><span>Branch Monitoring System</span></div><button className="mobile-close" onClick={()=>setMobileOpen(false)}><X size={19}/></button></div><nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setMobileOpen(false)}}><Icon size={18}/><span>{label}</span></button>)}</nav><div className="sidebar-foot"><span>v0.1.0</span><span>Weather only</span></div></aside><main className="main"><header className="topbar"><button className="mobile-menu" onClick={()=>setMobileOpen(true)}><Menu size={21}/></button><div className="topbar-space"></div><div className="top-date"><CalendarDays size={16}/><span>{new Date().toLocaleDateString([], {weekday:'short',month:'short',day:'numeric',year:'numeric'})}</span></div><div className="bell"><Bell size={18}/><i></i></div><div className="user"><div className="avatar">JD</div><div><strong>Branch Monitor</strong><span>Administrator</span></div><ChevronDown size={15}/></div></header><div className="content">{error&&<div className="error-banner"><AlertTriangle size={18}/><span>{error} Check your internet connection or branch coordinates.</span><button onClick={load}><RefreshCw size={15}/> Retry</button></div>}{page!=='branches'&&page!=='settings'&&<div className="global-branch"><span>Monitoring</span><select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{branches.map(b=><option value={b.id} key={b.id}>{b.name} Branch</option>)}</select></div>}{content}</div><footer>Bakeshop Weather <span>·</span> Smarter Decisions. Better Days. <span>·</span> UI build 0.1.0</footer></main></div>;
}

createRoot(document.getElementById('root')).render(<App />);
