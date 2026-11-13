/**
 * Seahelm Maritime Distress & Urgency Assistant (MAYDAY / PAN-PAN)
 * Formats official IMO / US Coast Guard radio distress scripts,
 * phonetic coordinates, Web Speech synthesis broadcast, and emergency dispatch.
 */
import { GeoTracker } from './geo.js';

export class DistressManager {
  static NATURE_TYPES = [
    { id: 'capsized', label: 'Capsized / Swamped Boat', defaultDesc: 'Craft has capsized and is taking on water.' },
    { id: 'medical', label: 'Medical Emergency', defaultDesc: 'Crew member has severe medical emergency requiring urgent evacuation.' },
    { id: 'mob', label: 'Person Overboard', defaultDesc: 'Person fell overboard, currently searching water.' },
    { id: 'adrift', label: 'Adrift / Lost Propulsion', defaultDesc: 'Lost paddle/oar or disabled rudder, drifting into danger.' },
    { id: 'sinking', label: 'Taking on Water / Sinking', defaultDesc: 'Rapidly taking on water, bailing insufficient.' },
    { id: 'fog', label: 'Lost in Heavy Fog / Disoriented', defaultDesc: 'Disoriented in dense fog near shipping channel.' },
    { id: 'grounded', label: 'Hard Aground on Reef / Shoal', defaultDesc: 'Stranded on exposed rocks with incoming tide.' }
  ];

  static PHONETIC_DIGITS = {
    '0': 'ZEE-RO',
    '1': 'WUN',
    '2': 'TOO',
    '3': 'TREE',
    '4': 'FOW-ER',
    '5': 'FIFE',
    '6': 'SIX',
    '7': 'SEVEN',
    '8': 'AIT',
    '9': 'NINER',
    '.': 'DECIMAL'
  };

  /**
   * Convert GPS coordinates to phonetic text
   */
  static toPhoneticCoords(lat, lon) {
    const latDir = lat >= 0 ? 'NORTH' : 'SOUTH';
    const lonDir = lon >= 0 ? 'EAST' : 'WEST';

    const absLat = Math.abs(lat);
    const latDeg = Math.floor(absLat);
    const latMin = ((absLat - latDeg) * 60).toFixed(2);

    const absLon = Math.abs(lon);
    const lonDeg = Math.floor(absLon);
    const lonMin = ((absLon - lonDeg) * 60).toFixed(2);

    const speakNumbers = (numStr) => {
      return numStr
        .split('')
        .map(char => DistressManager.PHONETIC_DIGITS[char] || char)
        .join(' ');
    };

    return {
      text: `${latDeg}° ${latMin}' ${latDir}, ${lonDeg}° ${lonMin}' ${lonDir}`,
      phonetic: `${speakNumbers(String(latDeg))} DEGREES ${speakNumbers(String(latMin))} MINUTES ${latDir}, BY ${speakNumbers(String(lonDeg))} DEGREES ${speakNumbers(String(lonMin))} MINUTES ${lonDir}`
    };
  }

  /**
   * Generate official USCG / IMO Radio Transmission Script
   */
  static generateScript(type = 'MAYDAY', vesselProfile = {}, currentPos = null) {
    const callWord = type.toUpperCase(); // 'MAYDAY' or 'PAN-PAN'
    const vesselName = (vesselProfile.name || 'UNNAMED VESSEL').toUpperCase();
    const craftType = vesselProfile.craftType || 'Small Kayak';
    const hullColor = vesselProfile.hullColor || 'Yellow Deck, White Hull';
    const pob = vesselProfile.pob || 1;
    const pfd = vesselProfile.pfd || 'Wearing PFD Life Jackets';
    const nature = vesselProfile.natureText || 'Vessel in distress requiring immediate assistance.';

    const lat = currentPos ? currentPos.lat : 32.7150;
    const lon = currentPos ? currentPos.lon : -117.1625;
    const speed = currentPos && currentPos.speedKnots ? currentPos.speedKnots.toFixed(1) : '0';
    const heading = currentPos && currentPos.heading ? Math.round(currentPos.heading) : '000';

    const coords = DistressManager.toPhoneticCoords(lat, lon);
    const timeUtc = new Date().toISOString().substring(11, 16) + ' UTC';

    // Step 1: Hail Call (Repeat 3 times)
    const hail = `${callWord}, ${callWord}, ${callWord}. THIS IS ${vesselName}, ${vesselName}, ${vesselName}.`;

    // Step 2: Identification & Position
    const positionPart = `${callWord}, THIS IS ${vesselName}. OUR POSITION IS ${coords.text} (${coords.phonetic}). TIME IS ${timeUtc}.`;

    // Step 3: Situation & Request
    const situationPart = `${nature} WE HAVE ${pob} PERSON(S) ON BOARD. WE ARE A ${craftType.toUpperCase()}, ${hullColor.toUpperCase()}. ${pfd.toUpperCase()}. CURRENT SPEED ${speed} KNOTS, HEADING ${heading} DEGREES. WE REQUIRE IMMEDIATE ASSISTANCE. OVER.`;

    const fullScript = `${hail}\n\n${positionPart}\n\n${situationPart}`;

    const emergencySmsText = `${callWord}: ${vesselName} (${craftType}, ${hullColor}). ${nature}. Pos: ${lat.toFixed(5)}, ${lon.toFixed(5)} (https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}). POB: ${pob}. PFDs: Yes. Speed: ${speed}kts.`;

    return {
      type: callWord,
      vesselName,
      fullScript,
      emergencySmsText,
      lat,
      lon,
      coordsText: coords.text,
      phoneticCoords: coords.phonetic
    };
  }

  /**
   * Audible Voice Broadcast via Web Speech API (speechSynthesis)
   */
  static speakBroadcast(scriptText, onEndCallback = () => {}) {
    if (!('speechSynthesis' in window)) {
      console.warn('SpeechSynthesis is not supported in this browser.');
      return false;
    }

    window.speechSynthesis.cancel(); // Stop any pending speech

    const utterance = new SpeechSynthesisUtterance(scriptText);
    utterance.rate = 0.88; // Slightly deliberate pacing for marine radio clarity
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    utterance.onend = () => onEndCallback();
    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      onEndCallback();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  }

  static stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * One-Tap Emergency SMS / Web Share Dispatch
   */
  static async dispatchDistressMessage(smsText) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'MARITIME DISTRESS (MAYDAY / PAN-PAN)',
          text: smsText
        });
        return true;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Web Share failed, fallback to SMS:', err);
        }
      }
    }

    // Direct SMS link fallback
    const encodedText = encodeURIComponent(smsText);
    window.location.href = `sms:?body=${encodedText}`;
    return true;
  }
}

