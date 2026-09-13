'use strict';

/* ═══════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════ */
const API_KEY = '96d0d50c9d416b7b9f249d42b9bae6e5';
const OWM     = 'https://api.openweathermap.org/data/2.5';

/* ═══════════════════════════════════════════
   STATE
   - All raw weather data stored in metric.
   - Unit preference only affects display layer.
═══════════════════════════════════════════ */
let isCelsius   = true;
let rawWeather  = null;   // OWM /weather response (metric)
let rawForecast = null;   // OWM /forecast response (metric)

/* ═══════════════════════════════════════════
   OWM ICON CODE → WEATHER-ICONS CLASS
═══════════════════════════════════════════ */
const ICON_MAP = {
  '01d': 'wi-day-sunny',         '01n': 'wi-night-clear',
  '02d': 'wi-day-cloudy',        '02n': 'wi-night-alt-cloudy',
  '03d': 'wi-cloud',             '03n': 'wi-cloud',
  '04d': 'wi-cloudy',            '04n': 'wi-cloudy',
  '09d': 'wi-showers',           '09n': 'wi-showers',
  '10d': 'wi-day-rain',          '10n': 'wi-night-alt-rain',
  '11d': 'wi-day-thunderstorm',  '11n': 'wi-night-alt-thunderstorm',
  '13d': 'wi-day-snow',          '13n': 'wi-night-alt-snow',
  '50d': 'wi-fog',               '50n': 'wi-night-fog',
};

/* ═══════════════════════════════════════════
   WEATHER CONDITION → BACKGROUND CLASS
═══════════════════════════════════════════ */
const BG_CLASSES = ['clear-day','clear-night','rain','drizzle','thunderstorm','snow','fog','cloudy'];

function bgClass(conditionId, icon) {
  const isDay = icon ? icon.endsWith('d') : true;
  if (conditionId >= 200 && conditionId < 300) return 'thunderstorm';
  if (conditionId >= 300 && conditionId < 400) return 'drizzle';
  if (conditionId >= 500 && conditionId < 600) return 'rain';
  if (conditionId >= 600 && conditionId < 700) return 'snow';
  if (conditionId >= 700 && conditionId < 800) return 'fog';
  if (conditionId === 800)                      return isDay ? 'clear-day' : 'clear-night';
  return 'cloudy';
}

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  setupSearch();
  setupUnitToggle();
  document.getElementById('retryBtn').addEventListener('click', getUserLocation);
  getUserLocation();
});

/* ═══════════════════════════════════════════
   GEOLOCATION
═══════════════════════════════════════════ */
function getUserLocation() {
  showLoading('Getting your location…');

  if (!navigator.geolocation) {
    fetchByIP();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos  => fetchWeather({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    ()   => fetchByIP(),
    { timeout: 8000 }
  );
}

async function fetchByIP() {
  showLoading('Detecting location…');
  try {
    const res = await fetch('https://ipinfo.io?token=8ff70be1bd282d');
    if (!res.ok) throw new Error();
    const { loc } = await res.json();
    const [lat, lon] = loc.split(',');
    await fetchWeather({ lat, lon });
  } catch {
    showError('Could not detect your location.\nSearch for a city above.');
  }
}

/* ═══════════════════════════════════════════
   FETCH
═══════════════════════════════════════════ */
async function fetchWeather(params) {
  showLoading('Fetching weather…');
  try {
    const qs = new URLSearchParams({ ...params, appid: API_KEY, units: 'metric' });

    const [wRes, fRes] = await Promise.all([
      fetch(`${OWM}/weather?${qs}`),
      fetch(`${OWM}/forecast?${qs}`),
    ]);

    if (!wRes.ok) {
      const msg = wRes.status === 404
        ? 'City not found. Check the spelling and try again.'
        : 'Weather service is unavailable. Try again shortly.';
      throw new Error(msg);
    }

    rawWeather  = await wRes.json();
    rawForecast = await fRes.json();

    displayWeather();
    showMain();

  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
  }
}

/* ═══════════════════════════════════════════
   DISPLAY
═══════════════════════════════════════════ */
function displayWeather() {
  const w       = rawWeather;
  const temp    = cvt(w.main.temp);
  const feels   = cvt(w.main.feels_like);
  const unit    = isCelsius ? '°C' : '°F';
  const wind    = isCelsius
    ? `${Math.round(w.wind.speed * 3.6)} km/h`
    : `${Math.round(w.wind.speed * 2.237)} mph`;

  /* ── Current ── */
  $('cityName')    .textContent = w.name;
  $('countryName') .textContent = w.sys.country;
  $('localDate')   .textContent = localDate(w.dt, w.timezone);
  $('tempBig')     .textContent = temp;
  $('tempUnit')    .textContent = unit;
  $('feelsLike')   .textContent = `Feels like ${feels}${unit}`;
  $('weatherDesc') .textContent = w.weather[0].description;

  /* ── Icon ── */
  const iconEl = $('mainIcon');
  const iconCode = w.weather[0].icon;
  iconEl.className = `wi ${ICON_MAP[iconCode] || 'wi-na'}`;

  /* ── Background + animation ── */
  const condition = bgClass(w.weather[0].id, iconCode);
  document.body.classList.remove(...BG_CLASSES);
  document.body.classList.add(condition);
  startWeatherAnimation(condition);

  /* ── Details ── */
  $('humidity')  .textContent = `${w.main.humidity}%`;
  $('windSpeed') .textContent = wind;
  $('sunrise')   .textContent = localTime(w.sys.sunrise, w.timezone);
  $('sunset')    .textContent = localTime(w.sys.sunset,  w.timezone);

  /* ── Forecast ── */
  renderForecast(rawForecast.list);
}

/* ═══════════════════════════════════════════
   FORECAST
═══════════════════════════════════════════ */
function renderForecast(list) {
  const days = processForecast(list);
  const sym  = '°';

  $('forecastGrid').innerHTML = days.map(d => `
    <div class="forecast-day">
      <span class="fday-name">${d.day}</span>
      <span class="fday-icon"><i class="wi ${ICON_MAP[d.icon] || 'wi-na'}" aria-hidden="true"></i></span>
      <div class="fday-temps">
        <span class="fday-high">${cvt(d.max)}${sym}</span>
        <span class="fday-low">${cvt(d.min)}${sym}</span>
      </div>
    </div>
  `).join('');
}

/**
 * Groups the 3-hourly forecast list by day, skipping today.
 * Returns up to 5 days with min/max temps and representative icon.
 */
function processForecast(list) {
  const days    = new Map();
  const todayKey = utcKey(new Date());

  list.forEach(item => {
    const d   = new Date(item.dt * 1000);
    const key = utcKey(d);
    if (key === todayKey) return;

    if (!days.has(key)) {
      days.set(key, {
        day:   d.toLocaleDateString('en-US', { weekday: 'short' }),
        temps: [],
        icons: [],
      });
    }
    const entry = days.get(key);
    entry.temps.push(item.main.temp);
    entry.icons.push(item.weather[0].icon);
  });

  return [...days.values()].slice(0, 5).map(d => ({
    day:  d.day,
    min:  Math.min(...d.temps),
    max:  Math.max(...d.temps),
    icon: d.icons[Math.floor(d.icons.length / 2)] || d.icons[0],
  }));
}

/* ═══════════════════════════════════════════
   UNIT CONVERSION
   Always store in Celsius; convert on display.
═══════════════════════════════════════════ */
function cvt(celsius) {
  return Math.round(isCelsius ? celsius : celsius * 9 / 5 + 32);
}

/* ═══════════════════════════════════════════
   UNIT TOGGLE
═══════════════════════════════════════════ */
function setupUnitToggle() {
  $('unitToggle').addEventListener('click', () => {
    isCelsius = !isCelsius;
    $('unitToggle').textContent    = isCelsius ? '°F' : '°C';
    $('unitToggle').ariaLabel      = isCelsius ? 'Switch to Fahrenheit' : 'Switch to Celsius';
    if (rawWeather) displayWeather();
  });
}

/* ═══════════════════════════════════════════
   SEARCH
═══════════════════════════════════════════ */
function setupSearch() {
  $('searchForm').addEventListener('submit', e => {
    e.preventDefault();
    const city = $('cityInput').value.trim();
    if (!city) return;
    fetchWeather({ q: city });
    $('cityInput').blur();
  });
}

/* ═══════════════════════════════════════════
   UI STATE
═══════════════════════════════════════════ */
function showLoading(msg) {
  $('loadingText').textContent = msg;
  $('loadingState').hidden = false;
  $('errorState')  .hidden = true;
  $('weatherMain') .hidden = true;
}

function showMain() {
  $('loadingState').hidden = true;
  $('errorState')  .hidden = true;
  $('weatherMain') .hidden = false;
}

function showError(msg) {
  $('errorMsg').textContent = msg;
  $('loadingState').hidden = true;
  $('errorState')  .hidden = false;
  $('weatherMain') .hidden = true;
}

/* ═══════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════ */
const $ = id => document.getElementById(id);

/** UTC date key for grouping forecast days */
function utcKey(d) {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

/**
 * Format a Unix timestamp to a local time string
 * using the city's UTC offset (in seconds).
 */
function localTime(unixSec, offsetSec) {
  const d = new Date((unixSec + offsetSec) * 1000);
  let   h = d.getUTCHours();
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/** Format a Unix timestamp to a readable date using the city's offset */
function localDate(unixSec, offsetSec) {
  const d = new Date((unixSec + offsetSec) * 1000);
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

/* ═══════════════════════════════════════════
   WEATHER CANVAS ANIMATIONS
   Canvas sits fixed behind the UI (z-index 0).
   Each condition gets its own particle/effect loop.
═══════════════════════════════════════════ */
let _animFrame   = null;
let _animResize  = null;

function startWeatherAnimation(condition) {
  const canvas = document.getElementById('weatherCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Stop any existing animation loop
  if (_animFrame)  { cancelAnimationFrame(_animFrame); _animFrame = null; }
  if (_animResize) { window.removeEventListener('resize', _animResize); _animResize = null; }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fit canvas to viewport (drawing buffer, not just CSS size)
  function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  _animResize = resizeCanvas;
  window.addEventListener('resize', _animResize);

  switch (condition) {
    case 'rain':         _animRain(ctx, canvas, false);   break;
    case 'drizzle':      _animRain(ctx, canvas, true);    break;
    case 'thunderstorm': _animThunderstorm(ctx, canvas);  break;
    case 'snow':         _animSnow(ctx, canvas);          break;
    case 'clear-day':    _animClearDay(ctx, canvas);      break;
    case 'clear-night':  _animClearNight(ctx, canvas);    break;
    case 'fog':          _animFog(ctx, canvas);           break;
    // 'cloudy' — no particles, gradient alone is enough
    default: break;
  }
}

/* ── Rain / Drizzle ─────────────────────────────────────
   Diagonal streaks falling across the full viewport.
   isLight=true → drizzle (fewer, slower, thinner lines).
──────────────────────────────────────────────────────── */
function _animRain(ctx, canvas, isLight) {
  const COUNT = isLight ? 90 : 220;
  const drops = Array.from({ length: COUNT }, () => ({
    x:     Math.random() * canvas.width  * 1.3,
    y:     Math.random() * canvas.height,
    speed: isLight ? (2 + Math.random() * 3)  : (9 + Math.random() * 10),
    len:   isLight ? (8 + Math.random() * 12) : (16 + Math.random() * 26),
    alpha: isLight ? (0.10 + Math.random() * 0.15) : (0.16 + Math.random() * 0.22),
  }));
  const angle = 0.22; // radians from vertical

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = isLight ? 0.7 : 1.0;
    drops.forEach(d => {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(180,215,255,${d.alpha})`;
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.len * Math.sin(angle), d.y + d.len * Math.cos(angle));
      ctx.stroke();
      // Advance
      d.y += d.speed;
      d.x += d.speed * Math.sin(angle);
      if (d.y > canvas.height + d.len) {
        d.y = -d.len;
        d.x = Math.random() * canvas.width * 1.3;
      }
    });
    _animFrame = requestAnimationFrame(draw);
  }
  draw();
}

/* ── Thunderstorm ───────────────────────────────────────
   Heavy rain + an occasional full-screen lightning flash.
──────────────────────────────────────────────────────── */
function _animThunderstorm(ctx, canvas) {
  const COUNT = 300;
  const drops = Array.from({ length: COUNT }, () => ({
    x:     Math.random() * canvas.width  * 1.3,
    y:     Math.random() * canvas.height,
    speed: 14 + Math.random() * 12,
    len:   22 + Math.random() * 28,
    alpha: 0.18 + Math.random() * 0.22,
  }));
  const angle    = 0.28;
  let flashAlpha = 0;
  let nextFlash  = 2500 + Math.random() * 5000;
  let lastTs     = null;

  function draw(ts) {
    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs;
    lastTs = ts;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Rain
    ctx.lineWidth = 1.2;
    drops.forEach(d => {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(160,195,255,${d.alpha})`;
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.len * Math.sin(angle), d.y + d.len * Math.cos(angle));
      ctx.stroke();
      d.y += d.speed;
      d.x += d.speed * Math.sin(angle);
      if (d.y > canvas.height + d.len) {
        d.y = -d.len;
        d.x = Math.random() * canvas.width * 1.3;
      }
    });

    // Lightning flash countdown
    nextFlash -= dt;
    if (nextFlash <= 0) {
      flashAlpha = 0.52;
      nextFlash  = 2500 + Math.random() * 6000;
    }
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(210,215,255,${flashAlpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      flashAlpha = Math.max(0, flashAlpha - 0.038);
    }

    _animFrame = requestAnimationFrame(draw);
  }
  _animFrame = requestAnimationFrame(draw);
}

/* ── Snow ───────────────────────────────────────────────
   Soft circular flakes, slow sinusoidal drift sideways.
──────────────────────────────────────────────────────── */
function _animSnow(ctx, canvas) {
  const COUNT = 130;
  const flakes = Array.from({ length: COUNT }, () => ({
    x:     Math.random() * canvas.width,
    y:     Math.random() * canvas.height,
    r:     1.2 + Math.random() * 2.8,
    speed: 0.5 + Math.random() * 1.4,
    drift: (Math.random() - 0.5) * 0.4,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.45 + Math.random() * 0.45,
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    flakes.forEach(f => {
      f.phase += 0.012;
      f.y     += f.speed;
      f.x     += f.drift + Math.sin(f.phase) * 0.4;
      if (f.y > canvas.height + f.r)   { f.y = -f.r;          f.x = Math.random() * canvas.width; }
      if (f.x > canvas.width  + f.r)   { f.x = -f.r; }
      if (f.x < -f.r)                   { f.x = canvas.width + f.r; }
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${f.alpha})`;
      ctx.fill();
    });
    _animFrame = requestAnimationFrame(draw);
  }
  draw();
}

/* ── Clear day ──────────────────────────────────────────
   Warm golden dust motes rising slowly from the bottom.
──────────────────────────────────────────────────────── */
function _animClearDay(ctx, canvas) {
  const COUNT = 55;
  const motes = Array.from({ length: COUNT }, () => ({
    x:     Math.random() * canvas.width,
    y:     canvas.height * (0.4 + Math.random() * 0.8),
    r:     0.8 + Math.random() * 2.2,
    speed: 0.25 + Math.random() * 0.7,
    drift: (Math.random() - 0.5) * 0.35,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.08 + Math.random() * 0.22,
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    motes.forEach(m => {
      m.phase += 0.009;
      m.y     -= m.speed;
      m.x     += m.drift + Math.sin(m.phase) * 0.45;
      if (m.y < -m.r) { m.y = canvas.height + Math.random() * 60; m.x = Math.random() * canvas.width; }
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,210,80,${m.alpha})`;
      ctx.fill();
    });
    _animFrame = requestAnimationFrame(draw);
  }
  draw();
}

/* ── Clear night ────────────────────────────────────────
   Stars that twinkle (opacity pulses with a sine wave).
──────────────────────────────────────────────────────── */
function _animClearNight(ctx, canvas) {
  const COUNT = 160;
  const stars = Array.from({ length: COUNT }, () => ({
    x:     Math.random() * canvas.width,
    y:     Math.random() * canvas.height * 0.82,
    r:     0.5 + Math.random() * 1.5,
    base:  0.25 + Math.random() * 0.45,
    amp:   0.12 + Math.random() * 0.22,
    phase: Math.random() * Math.PI * 2,
    speed: 0.008 + Math.random() * 0.022,
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      s.phase += s.speed;
      const alpha = Math.max(0, s.base + Math.sin(s.phase) * s.amp);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    });
    _animFrame = requestAnimationFrame(draw);
  }
  draw();
}

/* ── Fog ────────────────────────────────────────────────
   Soft oval patches drifting slowly sideways.
──────────────────────────────────────────────────────── */
function _animFog(ctx, canvas) {
  const COUNT = 14;
  const patches = Array.from({ length: COUNT }, () => ({
    x:     Math.random() * canvas.width,
    y:     (0.15 + Math.random() * 0.72) * canvas.height,
    rx:    100 + Math.random() * 220,
    ry:    40  + Math.random() * 70,
    speed: 0.18 + Math.random() * 0.32,
    alpha: 0.035 + Math.random() * 0.07,
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    patches.forEach(p => {
      p.x += p.speed;
      if (p.x - p.rx > canvas.width) p.x = -p.rx;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, p.ry / p.rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.rx);
      g.addColorStop(0, `rgba(200,220,240,${p.alpha})`);
      g.addColorStop(1, 'rgba(200,220,240,0)');
      ctx.beginPath();
      ctx.arc(0, 0, p.rx, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    });
    _animFrame = requestAnimationFrame(draw);
  }
  draw();
}
