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

  /* ── Background ── */
  document.body.classList.remove(...BG_CLASSES);
  document.body.classList.add(bgClass(w.weather[0].id, iconCode));

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
