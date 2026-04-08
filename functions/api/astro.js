export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    const body = await request.json().catch(() => null);

    if (!body) {
      return jsonResponse({ error: "Invalid JSON body." }, 400);
    }

    const birthDate = String(body.birthDate || "").trim();
    const birthTime = String(body.birthTime || "").trim();
    const birthPlace = String(body.birthPlace || "").trim();

    if (!birthDate || !birthTime || !birthPlace) {
      return jsonResponse(
        { error: "birthDate, birthTime, and birthPlace are required." },
        400
      );
    }

    const dateMatch = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = birthTime.match(/^(\d{2}):(\d{2})$/);

    if (!dateMatch) {
      return jsonResponse({ error: "birthDate must be YYYY-MM-DD." }, 400);
    }

    if (!timeMatch) {
      return jsonResponse({ error: "birthTime must be HH:MM." }, 400);
    }

    const [, year, month, day] = dateMatch;
    const [, hour, minute] = timeMatch;

    const coords = await geocodePlace(birthPlace);

    if (!coords) {
      return jsonResponse(
        { error: `Could not find coordinates for "${birthPlace}".` },
        400
      );
    }

    if (!env.ASTROLOGY_API_USER_ID || !env.ASTROLOGY_API_KEY) {
      return jsonResponse(
        { error: "Missing ASTROLOGY_API_USER_ID or ASTROLOGY_API_KEY." },
        500
      );
    }

    const astroPayload = {
      day: Number(day),
      month: Number(month),
      year: Number(year),
      hour: Number(hour),
      min: Number(minute),
      lat: Number(coords.lat),
      lon: Number(coords.lon),
      tzone: Number(coords.timezoneOffsetHours)
    };

    const authValue = btoa(
      `${env.ASTROLOGY_API_USER_ID}:${env.ASTROLOGY_API_KEY}`
    );

    const [moonRes, sunRes, ascRes] = await Promise.all([
      callAstrologyApi("https://json.astrologyapi.com/v1/planets/extended", astroPayload, authValue, "Moon"),
      callAstrologyApi("https://json.astrologyapi.com/v1/planets/extended", astroPayload, authValue, "Sun"),
      callAstrologyApi("https://json.astrologyapi.com/v1/ascendant_report", astroPayload, authValue, null)
    ]);

    const moonNakshatra = extractPlanetNakshatra(moonRes, "Moon");
    const sunNakshatra = extractPlanetNakshatra(sunRes, "Sun");
    const ascNakshatra = extractAscNakshatra(ascRes);

    return jsonResponse({
      moonNakshatra: normalizeNakshatraName(moonNakshatra),
      sunNakshatra: normalizeNakshatraName(sunNakshatra),
      ascNakshatra: normalizeNakshatraName(ascNakshatra),
      coords: {
        lat: coords.lat,
        lon: coords.lon,
        resolvedPlace: coords.displayName
      }
    });
  } catch (error) {
    return jsonResponse(
      {
        error: "Unexpected server error.",
        detail: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
}

async function geocodePlace(place) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", place);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "compatibility-site/1.0"
    }
  });

  if (!res.ok) {
    throw new Error(`Geocoding failed with status ${res.status}.`);
  }

  const data = await res.json();

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const top = data[0];
  const lat = Number(top.lat);
  const lon = Number(top.lon);

  const timezoneOffsetHours = await getTimezoneOffsetHours(lat, lon);

  return {
    lat,
    lon,
    timezoneOffsetHours,
    displayName: top.display_name || place
  };
}

async function getTimezoneOffsetHours(lat, lon) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`Timezone lookup failed with status ${res.status}.`);
  }

  const data = await res.json();

  const utcOffsetSeconds = Number(data.utc_offset_seconds || 0);
  return utcOffsetSeconds / 3600;
}

async function callAstrologyApi(url, payload, authValue, filterPlanetName) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authValue}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Astrology API failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  if (!filterPlanetName) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.find((item) => item?.name === filterPlanetName) || data;
  }

  return data;
}

function extractPlanetNakshatra(data, expectedPlanet) {
  if (!data) return "";

  if (Array.isArray(data)) {
    const found = data.find((item) => item?.name === expectedPlanet);
    return (
      found?.nakshatra ||
      found?.nakshatra_name ||
      found?.nakshtra ||
      ""
    );
  }

  return (
    data?.nakshatra ||
    data?.nakshatra_name ||
    data?.nakshtra ||
    ""
  );
}

function extractAscNakshatra(data) {
  if (!data) return "";

  return (
    data?.nakshatra ||
    data?.nakshatra_name ||
    data?.ascendant?.nakshatra ||
    data?.ascendant?.nakshatra_name ||
    ""
  );
}

function normalizeNakshatraName(name) {
  const value = String(name || "").trim();

  const aliases = {
    Jyeshtha: "Jyestha",
    Shatabisha: "Shatabhisha"
  };

  return aliases[value] || value;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
