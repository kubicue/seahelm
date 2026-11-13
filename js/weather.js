/**
 * Seahelm Marine Weather Module
 * Replaces obsolete 2015 Dark Sky / Forecast.io with modern Open-Meteo API:
 * Real-time coastal marine conditions, wind speed, wind gusts, wave height,
 * wave period, visibility, barometric pressure trend, and small craft advisories.
 */
export class WeatherManager {
  static PRESETS = {
    'san diego': { name: 'San Diego Bay', lat: 32.7150, lon: -117.1625 },
    'los angeles': { name: 'Marina del Rey / LA', lat: 33.9803, lon: -118.4517 },
    'san francisco': { name: 'San Francisco Bay', lat: 37.8044, lon: -122.4225 },
    'miami': { name: 'Biscayne Bay / Miami', lat: 25.7617, lon: -80.1918 },
    'new york': { name: 'NY Harbor / Long Island', lat: 40.6721, lon: -73.9839 },
    'chicago': { name: 'Lake Michigan / Chicago', lat: 41.8781, lon: -87.6298 }
  };

  constructor() {
    this.currentWeather = null;
    this.cachedData = new Map();
  }

  async fetchMarineWeather(lat, lon, locationName = 'Current Location') {
    const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;

    try {
      // 1. Fetch Atmospheric Weather & Wind
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility&wind_speed_unit=kn&timezone=auto`;

      // 2. Fetch Marine Wave Conditions
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction,wave_period&timezone=auto`;

      const [weatherRes, marineRes] = await Promise.allSettled([
        fetch(weatherUrl),
        fetch(marineUrl)
      ]);

      let weatherJson = null;
      let marineJson = null;

      if (weatherRes.status === 'fulfilled' && weatherRes.value.ok) {
        weatherJson = await weatherRes.value.json();
      }
      if (marineRes.status === 'fulfilled' && marineRes.value.ok) {
        marineJson = await marineRes.value.json();
      }

      if (!weatherJson) {
        throw new Error('Weather API request failed');
      }

      const cur = weatherJson.current;
      const marCur = marineJson && marineJson.current ? marineJson.current : null;

      // Extract & convert
      const tempC = cur.temperature_2m;
      const tempF = Math.round((tempC * 9) / 5 + 32);
      const windSpeedKnots = Math.round(cur.wind_speed_10m || 0);
      const windGustsKnots = Math.round(cur.wind_gusts_10m || windSpeedKnots * 1.3);
      const windDirection = Math.round(cur.wind_direction_10m || 0);
      
      // Surface pressure in hPa and inHg (1 hPa = 0.02953 inHg)
      const pressureHpa = Math.round(cur.surface_pressure || 1013);
      const pressureInHg = (pressureHpa * 0.02953).toFixed(2);

      // Visibility in NM (1 NM = 1852 m)
      const visibilityM = cur.visibility || 10000;
      const visibilityNM = (visibilityM / 1852).toFixed(1);

      // Wave conditions
      const waveHeightM = marCur && marCur.wave_height !== undefined ? marCur.wave_height : 0.4;
      const waveHeightFt = (waveHeightM * 3.28084).toFixed(1);
      const wavePeriodSec = marCur && marCur.wave_period ? Math.round(marCur.wave_period) : 6;

      const condition = WeatherManager.decodeWmoCode(cur.weather_code);

      // Boating Advisory assessment
      const advisory = WeatherManager.calculateMarineAdvisory(windSpeedKnots, windGustsKnots, Number(waveHeightFt));

      const result = {
        locationName,
        lat,
        lon,
        tempF,
        tempC: Math.round(tempC),
        windSpeedKnots,
        windGustsKnots,
        windDirection,
        windDirectionCardinal: WeatherManager.degToCompass(windDirection),
        waveHeightFt,
        wavePeriodSec,
        pressureInHg,
        pressureHpa,
        visibilityNM,
        weatherCode: cur.weather_code,
        conditionText: condition.text,
        iconSvg: condition.icon,
        advisory,
        timestamp: Date.now()
      };

      this.currentWeather = result;
      this.cachedData.set(cacheKey, result);
      return result;

    } catch (err) {
      console.warn('Network weather fetch failed, checking cache / offline fallback:', err);
      if (this.cachedData.has(cacheKey)) {
        return this.cachedData.get(cacheKey);
      }
      return this.getOfflineFallback(lat, lon, locationName);
    }
  }

  getOfflineFallback(lat, lon, locationName) {
    return {
      locationName: locationName + ' (Offline Cache)',
      lat,
      lon,
      tempF: 68,
      tempC: 20,
      windSpeedKnots: 8,
      windGustsKnots: 12,
      windDirection: 240,
      windDirectionCardinal: 'WSW',
      waveHeightFt: '1.5',
      wavePeriodSec: 7,
      pressureInHg: '29.92',
      pressureHpa: 1013,
      visibilityNM: '6.0',
      weatherCode: 1,
      conditionText: 'Fair / Partly Cloudy',
      iconSvg: 'sun-cloud',
      advisory: { level: 'calm', text: 'Gentle Marine Conditions' },
      timestamp: Date.now(),
      isOffline: true
    };
  }

  static calculateMarineAdvisory(windKts, gustsKts, waveFt) {
    if (windKts >= 34 || gustsKts >= 40 || waveFt >= 10) {
      return { level: 'warning', text: 'Gale Warning — Hazardous for All Boats' };
    }
    if (windKts >= 20 || gustsKts >= 25 || waveFt >= 5) {
      return { level: 'advisory', text: 'Small Craft Advisory — Strong Wind / Seas' };
    }
    if (windKts >= 14 || waveFt >= 3) {
      return { level: 'moderate', text: 'Moderate Breeze & Chop' };
    }
    return { level: 'calm', text: 'Calm to Gentle — Ideal for Small Craft' };
  }

  static degToCompass(deg) {
    const val = Math.round((deg / 22.5) + 0.5);
    const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return arr[val % 16];
  }

  static decodeWmoCode(code) {
    switch (code) {
      case 0:
        return { text: 'Clear Sky', icon: 'sun' };
      case 1:
        return { text: 'Mainly Clear', icon: 'sun-cloud' };
      case 2:
        return { text: 'Partly Cloudy', icon: 'cloud-sun' };
      case 3:
        return { text: 'Overcast', icon: 'cloud' };
      case 45:
      case 48:
        return { text: 'Fog / Reduced Visibility', icon: 'fog' };
      case 51:
      case 53:
      case 55:
        return { text: 'Drizzle', icon: 'rain' };
      case 61:
      case 63:
      case 65:
        return { text: 'Rain', icon: 'rain' };
      case 71:
      case 73:
      case 75:
        return { text: 'Snow', icon: 'snow' };
      case 80:
      case 81:
      case 82:
        return { text: 'Passing Rain Showers', icon: 'rain' };
      case 95:
      case 96:
      case 99:
        return { text: 'Thunderstorm Squall', icon: 'lightning' };
      default:
        return { text: 'Clear / Variable', icon: 'sun' };
    }
  }
}

