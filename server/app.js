import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const app = express();

// CORS: only allow the frontend origins listed in ALLOWED_ORIGINS (comma-separated).
// Falls back to allowing everything ONLY if the var is unset, so local dev keeps working
// without extra setup -- but production deployments should always set this.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // curl/server-to-server/health checks
    if (allowedOrigins.length === 0) return callback(null, true); // dev fallback
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  }
}));
app.use(express.json());

const port = Number(process.env.PORT || 8787);
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && serviceRole ? createClient(supabaseUrl, serviceRole) : null;
const authRequired = String(process.env.AUTH_REQUIRED || 'false').toLowerCase() === 'true';

async function authenticate(req, res, next) {
  if (!authRequired) return next();
  if (!supabase) return res.status(503).json({ error: 'Authentication requires Supabase configuration.' });
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid or expired session.' });
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id,email,full_name,role,is_active').eq('id', userData.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile && profile.is_active === false) return res.status(403).json({ error: 'Your account is inactive.' });
    req.user = userData.user;
    req.profile = profile || { id: userData.user.id, email: userData.user.email, role: 'viewer', is_active: true };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unable to validate session.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!authRequired) return next();
    if (!roles.includes(req.profile?.role)) return res.status(403).json({ error: 'You do not have permission for this action.' });
    next();
  };
}

const weatherUrl = 'https://api.open-meteo.com/v1/forecast';

function requireDb(res) {
  if (!supabase) {
    res.status(503).json({ error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.' });
    return false;
  }
  return true;
}

async function fetchWeather(branch) {
  const params = new URLSearchParams({
    latitude: branch.latitude,
    longitude: branch.longitude,
    timezone: branch.timezone || 'Asia/Manila',
    forecast_days: '7',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,visibility',
    hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,visibility',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,precipitation_sum'
  });
  const response = await fetch(`${weatherUrl}?${params}`);
  if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
  return response.json();
}

function forecastRows(branch, weather, runTime = new Date().toISOString()) {
  const h = weather.hourly;
  return h.time.map((forecastTime, i) => ({
    branch_id: branch.id,
    forecast_run_time: runTime,
    forecast_time: new Date(forecastTime).toISOString(),
    temperature_c: h.temperature_2m?.[i] ?? null,
    apparent_temperature_c: h.apparent_temperature?.[i] ?? null,
    humidity_pct: h.relative_humidity_2m?.[i] ?? null,
    rain_probability_pct: h.precipitation_probability?.[i] ?? null,
    precipitation_mm: h.precipitation?.[i] ?? null,
    rain_mm: h.rain?.[i] ?? null,
    weather_code: h.weather_code?.[i] ?? null,
    cloud_cover_pct: h.cloud_cover?.[i] ?? null,
    wind_speed_kmh: h.wind_speed_10m?.[i] ?? null,
    wind_direction_deg: h.wind_direction_10m?.[i] ?? null,
    visibility_m: h.visibility?.[i] ?? null,
    source: 'open-meteo'
  }));
}



function classifyRainMatch(rainProbability, didRain) {
  if (rainProbability == null) return 'unknown';
  const predictedRain = Number(rainProbability) >= 50;
  return predictedRain === Boolean(didRain) ? 'match' : 'mismatch';
}

async function calculateAccuracy(branchId) {
  const [{ data: observations, error: obsError }, { data: forecasts, error: fcError }] = await Promise.all([
    supabase.from('weather_observations').select('*').eq('branch_id', branchId).order('observation_time', { ascending: false }).limit(1000),
    supabase.from('weather_forecasts').select('*').eq('branch_id', branchId).order('forecast_run_time', { ascending: false }).limit(5000)
  ]);
  if (obsError) throw obsError;
  if (fcError) throw fcError;

  const matches = [];
  for (const observation of observations || []) {
    const target = new Date(observation.observation_time).getTime();
    const candidates = (forecasts || []).filter(f => {
      const ft = new Date(f.forecast_time).getTime();
      const run = new Date(f.forecast_run_time).getTime();
      return run <= target && Math.abs(ft - target) <= 90 * 60 * 1000;
    });
    candidates.sort((a, b) => Math.abs(new Date(a.forecast_time).getTime() - target) - Math.abs(new Date(b.forecast_time).getTime() - target));
    const forecast = candidates[0];
    if (!forecast) continue;

    const probability = forecast.rain_probability_pct == null ? null : Number(forecast.rain_probability_pct) / 100;
    const outcome = observation.did_rain ? 1 : 0;
    const tempError = observation.actual_temperature_c == null || forecast.temperature_c == null
      ? null
      : Math.abs(Number(observation.actual_temperature_c) - Number(forecast.temperature_c));
    matches.push({
      observation_id: observation.id,
      observation_time: observation.observation_time,
      forecast_time: forecast.forecast_time,
      forecast_run_time: forecast.forecast_run_time,
      forecast_temperature_c: forecast.temperature_c,
      actual_temperature_c: observation.actual_temperature_c,
      forecast_rain_probability_pct: forecast.rain_probability_pct,
      did_rain: observation.did_rain,
      rain_result: classifyRainMatch(forecast.rain_probability_pct, observation.did_rain),
      temperature_absolute_error_c: tempError,
      brier_score: probability == null ? null : Math.pow(probability - outcome, 2)
    });
  }

  const comparable = matches.filter(m => m.rain_result !== 'unknown');
  const matched = comparable.filter(m => m.rain_result === 'match').length;
  const temperatureErrors = matches.map(m => m.temperature_absolute_error_c).filter(v => v != null);
  const brierScores = matches.map(m => m.brier_score).filter(v => v != null);
  return {
    total_observations: observations?.length || 0,
    matched_rain_predictions: matched,
    comparable_rain_predictions: comparable.length,
    rain_match_rate_pct: comparable.length ? Math.round((matched / comparable.length) * 100) : null,
    mean_absolute_temperature_error_c: temperatureErrors.length ? Number((temperatureErrors.reduce((a,b) => a+b,0) / temperatureErrors.length).toFixed(2)) : null,
    brier_score: brierScores.length ? Number((brierScores.reduce((a,b) => a+b,0) / brierScores.length).toFixed(4)) : null,
    records: matches.slice(0, 200)
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, databaseConfigured: Boolean(supabase), weatherSource: 'open-meteo', radarSource: 'PAGASA' }));

app.get('/api/branches/validate-location', authenticate, async (req, res) => {
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return res.status(400).json({ valid: false, error: 'Latitude must be between -90 and 90 and longitude between -180 and 180.' });
  }
  try {
    const params = new URLSearchParams({ latitude, longitude, timezone: 'Asia/Manila', forecast_days: '1', current: 'temperature_2m,weather_code' });
    const response = await fetch(`${weatherUrl}?${params}`);
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
    const weather = await response.json();
    res.json({ valid: true, latitude, longitude, timezone: weather.timezone, provider: 'open-meteo', current: weather.current || null });
  } catch (error) {
    res.status(502).json({ valid: false, error: 'Coordinates are valid, but the weather source could not be reached.' });
  }
});

const publicApiPaths = new Set(['/health', '/me', '/cron/snapshots']);
app.use('/api', (req,res,next) => publicApiPaths.has(req.path) ? next() : authenticate(req,res,next));

app.get('/api/me', authenticate, async (req,res) => res.json({ user: req.user ? { id:req.user.id,email:req.user.email } : null, profile:req.profile || null }));

function rainRiskWindows(weather, hours = 24) {
  const h = weather?.hourly;
  if (!h?.time) return [];
  const rows = h.time.slice(0, hours).map((time, i) => ({
    time, prob: Number(h.precipitation_probability?.[i] ?? 0),
    code: h.weather_code?.[i] ?? null,
    rain: Number(h.rain?.[i] ?? 0)
  }));
  const windows = [];
  let active = null;
  for (const row of rows) {
    if (row.prob >= 50) {
      if (!active) active = { start: row.time, end: row.time, peak: row };
      active.end = row.time;
      if (row.prob > active.peak.prob) active.peak = row;
    } else if (active) { windows.push(active); active = null; }
  }
  if (active) windows.push(active);
  return windows;
}

function alertSeverity(peakProbability) {
  return Number(peakProbability) >= 80 ? 'high' : 'watch';
}

async function refreshPersistentAlerts() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: branches, error: branchError } = await supabase.from('branches').select('*').eq('is_active', true);
  if (branchError) throw branchError;
  const now = new Date().toISOString();
  const seenKeys = [];
  for (const branch of branches || []) {
    const weather = await fetchWeather(branch);
    for (const window of rainRiskWindows(weather)) {
      const peak = Number(window.peak.prob);
      const severity = alertSeverity(peak);
      const alertKey = `${severity}:${new Date(window.start).toISOString()}`;
      const payload = {
        branch_id: branch.id, alert_key: alertKey, severity, threshold_pct: 50,
        peak_probability_pct: peak, peak_time: window.peak.time,
        window_start: window.start, window_end: window.end,
        source: 'open-meteo', status: 'open', last_seen_at: now,
        metadata: { weather_code: window.peak.code, rain_mm: window.peak.rain }
      };
      const { error } = await supabase.from('weather_alerts').upsert(payload, { onConflict: 'branch_id,alert_key,window_start' });
      if (error) throw error;
      seenKeys.push({ branch_id: branch.id, alert_key: alertKey, window_start: window.start });
    }
  }
  const { data: openAlerts, error: openError } = await supabase.from('weather_alerts').select('id,branch_id,alert_key,window_start').eq('status','open');
  if (openError) throw openError;
  for (const alert of openAlerts || []) {
    if (!seenKeys.some(x => x.branch_id === alert.branch_id && x.alert_key === alert.alert_key && x.window_start === alert.window_start)) {
      await supabase.from('weather_alerts').update({ status:'cleared', cleared_at:now, last_seen_at:now }).eq('id', alert.id);
    }
  }
  return { checked_branches: (branches || []).length, open_alerts: seenKeys.length, refreshed_at: now };
}

app.get('/api/alerts/history', async (req, res) => {
  if (!requireDb(res)) return;
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
  let query = supabase.from('weather_alerts').select('*, branches(branch_name,address)').order('detected_at', { ascending:false }).limit(limit);
  if (req.query.status && ['open','cleared'].includes(req.query.status)) query = query.eq('status', req.query.status);
  if (req.query.severity && ['watch','high'].includes(req.query.severity)) query = query.eq('severity', req.query.severity);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ generated_at:new Date().toISOString(), alerts:data || [] });
});

app.post('/api/alerts/refresh', requireRole('admin','manager'), async (_req, res) => {
  if (!requireDb(res)) return;
  try { res.json(await refreshPersistentAlerts()); }
  catch (error) { res.status(502).json({ error:error.message || 'Unable to refresh weather alerts.' }); }
});

app.get('/api/monitoring/overview', async (_req, res) => {
  if (!requireDb(res)) return;
  const { data: branches, error } = await supabase.from('branches').select('*').eq('is_active', true).order('branch_name');
  if (error) return res.status(500).json({ error: error.message });
  try {
    const items = await Promise.all((branches || []).map(async (branch) => {
      const weather = await fetchWeather(branch);
      return { branch, weather, fetched_at: new Date().toISOString() };
    }));
    res.json({ generated_at: new Date().toISOString(), branches: items });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Unable to load branch weather overview.' });
  }
});


app.get('/api/users', requireRole('admin'), async (_req, res) => {
  if (!requireDb(res)) return;
  const { data, error } = await supabase.from('profiles').select('id,email,full_name,role,is_active,created_at,updated_at').order('created_at', { ascending:false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/users/invite', requireRole('admin'), async (req, res) => {
  if (!requireDb(res)) return;
  const email = String(req.body.email || '').trim().toLowerCase();
  const full_name = String(req.body.full_name || '').trim() || null;
  const role = ['admin','manager','viewer'].includes(req.body.role) ? req.body.role : 'viewer';
  if (!email || !email.includes('@')) return res.status(400).json({ error:'A valid email address is required.' });
  try {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, { data: { full_name } });
    if (error) throw error;
    const user = data.user;
    const { data: profile, error: profileError } = await supabase.from('profiles').upsert({ id:user.id, email, full_name, role, is_active:true, updated_at:new Date().toISOString() }, { onConflict:'id' }).select().single();
    if (profileError) throw profileError;
    await writeAudit(req.user?.id, 'user_invited', 'profile', user.id, { email, role });
    res.status(201).json(profile);
  } catch (error) { res.status(400).json({ error:error.message || 'Unable to invite user.' }); }
});

app.patch('/api/users/:id', requireRole('admin'), async (req, res) => {
  if (!requireDb(res)) return;
  const patch = {};
  if (['admin','manager','viewer'].includes(req.body.role)) patch.role = req.body.role;
  if (typeof req.body.is_active === 'boolean') patch.is_active = req.body.is_active;
  if (typeof req.body.full_name === 'string') patch.full_name = req.body.full_name.trim() || null;
  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error:error.message });
  await writeAudit(req.user?.id, 'user_updated', 'profile', req.params.id, patch);
  res.json(data);
});

app.get('/api/audit-logs', requireRole('admin'), async (req, res) => {
  if (!requireDb(res)) return;
  const limit = Math.min(Math.max(Number(req.query.limit || 200),1),500);
  const { data, error } = await supabase.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(limit);
  if (error) return res.status(500).json({ error:error.message });
  res.json(data || []);
});

app.get('/api/branches', async (_req, res) => {
  if (!requireDb(res)) return;
  const { data, error } = await supabase.from('branches').select('*').order('branch_name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/branches', requireRole('admin','manager'), async (req, res) => {
  if (!requireDb(res)) return;
  const { branch_name, address, latitude, longitude, timezone = 'Asia/Manila', is_active = true } = req.body;
  const { data, error } = await supabase.from('branches').insert({ branch_name, address, latitude, longitude, timezone, is_active }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

app.patch('/api/branches/:id', requireRole('admin','manager'), async (req, res) => {
  if (!requireDb(res)) return;
  const allowed = ['branch_name', 'address', 'latitude', 'longitude', 'timezone', 'is_active'];
  const patch = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('branches').update(patch).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.delete('/api/branches/:id', requireRole('admin','manager'), async (req, res) => {
  if (!requireDb(res)) return;
  const { error } = await supabase.from('branches').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

app.post('/api/branches/:id/snapshot', requireRole('admin','manager'), async (req, res) => {
  if (!requireDb(res)) return;
  const { data: branch, error: branchError } = await supabase.from('branches').select('*').eq('id', req.params.id).single();
  if (branchError) return res.status(404).json({ error: branchError.message });
  try {
    const weather = await fetchWeather(branch);
    const runTime = new Date().toISOString();
    const rows = forecastRows(branch, weather, runTime);
    const { error: insertError } = await supabase.from('weather_forecasts').insert(rows);
    if (insertError) return res.status(500).json({ error: insertError.message });
    res.json({ branch_id: branch.id, forecast_run_time: runTime, saved_rows: rows.length, weather });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get('/api/branches/:id/forecast-history', async (req, res) => {
  if (!requireDb(res)) return;
  const limit = Math.min(Number(req.query.limit || 500), 5000);
  let query = supabase.from('weather_forecasts').select('*').eq('branch_id', req.params.id).order('forecast_run_time', { ascending: false }).order('forecast_time').limit(limit);
  if (req.query.date) {
    const start = new Date(`${req.query.date}T00:00:00+08:00`).toISOString();
    const end = new Date(`${req.query.date}T23:59:59+08:00`).toISOString();
    query = query.gte('forecast_time', start).lte('forecast_time', end);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/branches/:id/forecast-for-time', async (req, res) => {
  if (!requireDb(res)) return;
  const observationTime = new Date(req.query.observation_time);
  if (Number.isNaN(observationTime.getTime())) return res.status(400).json({ error: 'Invalid observation_time.' });
  const before = new Date(observationTime.getTime() - 90 * 60 * 1000).toISOString();
  const after = new Date(observationTime.getTime() + 90 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('weather_forecasts').select('*').eq('branch_id', req.params.id).lte('forecast_run_time', observationTime.toISOString()).gte('forecast_time', before).lte('forecast_time', after).order('forecast_run_time', { ascending: false }).order('forecast_time');
  if (error) return res.status(500).json({ error: error.message });
  if (!data?.length) return res.status(404).json({ error: 'No saved forecast is available near that observation time.' });
  data.sort((a,b) => {
    const runDiff = new Date(b.forecast_run_time) - new Date(a.forecast_run_time);
    if (runDiff) return runDiff;
    return Math.abs(new Date(a.forecast_time)-observationTime) - Math.abs(new Date(b.forecast_time)-observationTime);
  });
  res.json(data[0]);
});

app.post('/api/branches/:id/observations', requireRole('admin','manager'), async (req, res) => {
  if (!requireDb(res)) return;
  const row = {
    branch_id: req.params.id,
    observation_time: req.body.observation_time,
    did_rain: Boolean(req.body.did_rain),
    rain_intensity: req.body.rain_intensity || null,
    actual_temperature_c: req.body.actual_temperature_c ?? null,
    notes: req.body.notes || null,
    verified_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from('weather_observations').insert(row).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

app.get('/api/branches/:id/observations', async (req, res) => {
  if (!requireDb(res)) return;
  const { data, error } = await supabase.from('weather_observations').select('*').eq('branch_id', req.params.id).order('observation_time', { ascending: false }).limit(500);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/branches/:id/accuracy', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const report = await calculateAccuracy(req.params.id);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/overview', async (_req, res) => {
  if (!requireDb(res)) return;
  try {
    const { data: branches, error: branchError } = await supabase.from('branches').select('*').eq('is_active', true).order('branch_name');
    if (branchError) throw branchError;
    const reports = await Promise.all((branches || []).map(async branch => ({
      branch_id: branch.id,
      branch_name: branch.branch_name,
      ...(await calculateAccuracy(branch.id))
    })));
    const usable = reports.filter(r => r.rain_match_rate_pct != null);
    const totalComparable = usable.reduce((sum, r) => sum + r.comparable_rain_predictions, 0);
    const totalMatched = usable.reduce((sum, r) => sum + r.matched_rain_predictions, 0);
    res.json({
      generated_at: new Date().toISOString(),
      overall_rain_match_rate_pct: totalComparable ? Math.round(totalMatched / totalComparable * 100) : null,
      total_observations: reports.reduce((sum, r) => sum + r.total_observations, 0),
      branches: reports
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/snapshots/run', requireRole('admin','manager'), async (_req, res) => {
  if (!requireDb(res)) return;
  const { data: branches, error } = await supabase.from('branches').select('*').eq('is_active', true);
  if (error) return res.status(500).json({ error: error.message });
  const results = [];
  for (const branch of branches || []) {
    try {
      const weather = await fetchWeather(branch);
      const runTime = new Date().toISOString();
      const rows = forecastRows(branch, weather, runTime);
      const { error: insertError } = await supabase.from('weather_forecasts').insert(rows);
      results.push({ branch_id: branch.id, branch_name: branch.branch_name, ok: !insertError, saved_rows: insertError ? 0 : rows.length, error: insertError?.message || null });
    } catch (err) {
      results.push({ branch_id: branch.id, branch_name: branch.branch_name, ok: false, saved_rows: 0, error: err.message });
    }
  }
  res.json({ run_at: new Date().toISOString(), results });
});


async function writeAudit(actorId, action, entityType, entityId, metadata = {}) {
  if (!supabase) return;
  await supabase.from('audit_logs').insert({ actor_id: actorId || null, action, entity_type: entityType, entity_id: entityId ? String(entityId) : null, metadata });
}

async function scheduledSnapshots() {
  if (!supabase) return { ran: false, reason: 'Supabase not configured' };
  const results = [];
  try {
    const { data: branches } = await supabase.from('branches').select('*').eq('is_active', true);
    for (const branch of branches || []) {
      try {
        const weather = await fetchWeather(branch);
        const runTime = new Date().toISOString();
        const rows = forecastRows(branch, weather, runTime);
        await supabase.from('weather_forecasts').insert(rows);
        results.push({ branch_id: branch.id, branch_name: branch.branch_name, ok: true, saved_rows: rows.length });
      } catch (error) {
        console.error(`Snapshot failed for ${branch.branch_name}:`, error.message);
        results.push({ branch_id: branch.id, branch_name: branch.branch_name, ok: false, error: error.message });
      }
    }
    try {
      await refreshPersistentAlerts();
    } catch (alertError) {
      console.error('Scheduled alert refresh failed:', alertError.message);
    }
  } catch (error) {
    console.error('Scheduled snapshot run failed:', error.message);
    return { ran: false, reason: error.message };
  }
  return { ran: true, run_at: new Date().toISOString(), results };
}

// Triggered by Vercel Cron (see vercel.json). Vercel automatically sends
// `Authorization: Bearer <CRON_SECRET>` when it invokes a scheduled cron path,
// so we verify that instead of requiring a normal user login here.
// NOTE: Vercel Hobby plan only allows once-per-day cron schedules. If you need
// snapshots more often than daily, either upgrade to Pro (per-minute cron) or
// point a free external scheduler (e.g. cron-job.org) at this same URL with
// the same Authorization header -- the endpoint itself doesn't care who calls it.
app.get('/api/cron/snapshots', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  if (secret && authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const result = await scheduledSnapshots();
  res.status(result.ran ? 200 : 503).json(result);
});

export { app, scheduledSnapshots, port };
