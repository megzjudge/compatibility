import { getSkySnapshot, getAscendant } from "./vedic-ephemeris.mjs";

const baseColors = [
  { planet: "Sun", hex: "#EAA565" },
  { planet: "Moon", hex: "#CACACA" },
  { planet: "Mercury", hex: "#3CB371" },
  { planet: "Venus", hex: "#EAF5EA" },
  { planet: "Mars", hex: "#FF4040" },
  { planet: "Jupiter", hex: "#F4E87C" },
  { planet: "Saturn", hex: "#00167E" },
  { planet: "Rahu", hex: "#6D6D6D" },
  { planet: "Ketu", hex: "#B2A38B" }
];

const nakshatras = [
  { label: "🐎 Ashwini",            ruler: "Ketu"    },
  { label: "🐘 Bharani",            ruler: "Venus"   },
  { label: "🐐 Krittika",           ruler: "Sun"     },
  { label: "🐍 Rohini",             ruler: "Moon"    },
  { label: "🐍 Mrigashirsha",       ruler: "Mars"    },
  { label: "🐕 Ardra",              ruler: "Rahu"    },
  { label: "🐈‍⬛ Punarvasu",        ruler: "Jupiter" },
  { label: "🐐 Pushya",             ruler: "Saturn"  },
  { label: "🐈‍⬛ Ashlesha",         ruler: "Mercury" },
  { label: "🐀 Magha",              ruler: "Ketu"    },
  { label: "🐀 Purva Phalguni",     ruler: "Venus"   },
  { label: "🐄 Uttara Phalguni",    ruler: "Sun"     },
  { label: "🐃 Hasta",              ruler: "Moon"    },
  { label: "🐅 Chitra",             ruler: "Mars"    },
  { label: "🐃 Swati",              ruler: "Rahu"    },
  { label: "🐅 Vishakha",           ruler: "Jupiter" },
  { label: "🦌 Anuradha",           ruler: "Saturn"  },
  { label: "🦌 Jyestha",            ruler: "Mercury" },
  { label: "🐕 Mula",               ruler: "Ketu"    },
  { label: "🐒 Purva Ashadha",      ruler: "Venus"   },
  { label: "🦦 Uttara Ashadha",     ruler: "Sun"     },
  { label: "🐒 Shravana",           ruler: "Moon"    },
  { label: "🦁 Dhanishta",          ruler: "Mars"    },
  { label: "🐎 Shatabhisha",        ruler: "Rahu"    },
  { label: "🦁 Purva Bhadrapadha",  ruler: "Jupiter" },
  { label: "🐄 Uttara Bhadrapadha", ruler: "Saturn"  },
  { label: "🐘 Revati",             ruler: "Mercury" }
];

const planetSymbolMap = {
  Sun: "☀️",
  Moon: "🌙",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Rahu: "☊",
  Ketu: "☋"
};

const planetColorMap = Object.fromEntries(
  baseColors.map(({ planet, hex }) => [planet, hex])
);

const nakshatraMap = Object.fromEntries(
  nakshatras.map(({ label, ruler }) => {
    const firstSpace = label.indexOf(" ");
    const animal = label.slice(0, firstSpace);
    const name = label.slice(firstSpace + 1);
    return [name, { animal, ruler }];
  })
);

if (nakshatraMap["Jyestha"]) {
  nakshatraMap["Jyeshtha"] = nakshatraMap["Jyestha"];
}
if (nakshatraMap["Shatabhisha"]) {
  nakshatraMap["Shatabisha"] = nakshatraMap["Shatabhisha"];
}

const state = {
  birthInput: null,
  apiResult: null,
  placeResults: [],
  placeLookupSeq: 0,
  lastCalculationKey: null,
  lastMoonDebug: null
};

const els = {
  form: document.getElementById("chart-form"),
  birthDate: document.getElementById("birth-date"),
  birthTime: document.getElementById("birth-time"),
  noBirthTime: document.getElementById("no-birth-time"),
  birthPlace: document.getElementById("birth-place"),
  birthLat: document.getElementById("birth-lat"),
  birthLon: document.getElementById("birth-lon"),
  birthTimezone: document.getElementById("birth-timezone"),
  placeSuggestions: document.getElementById("place-suggestions"),
  placeStatus: document.getElementById("place-status"),
  clearBtn: document.getElementById("clear-highlights")
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("script loaded", {
    formFound: !!els.form,
    birthPlaceFound: !!els.birthPlace,
    timezoneFound: !!els.birthTimezone,
    noBirthTimeFound: !!els.noBirthTime
  });
  bindEvents();
  syncNoBirthTimeUI();
});

function bindEvents() {
  console.log("bindEvents ran", {
    formFound: !!els.form,
    birthPlaceFound: !!els.birthPlace,
    timezoneFound: !!els.birthTimezone
  });

  if (els.form) {
    els.form.addEventListener("submit", handleFormSubmit);
  }

  if (els.clearBtn) {
    els.clearBtn.addEventListener("click", clearHighlightsAndInputs);
  }

  if (els.noBirthTime) {
    els.noBirthTime.addEventListener("change", syncNoBirthTimeUI);
  }

  if (els.birthPlace) {
    els.birthPlace.addEventListener("input", debounce(handlePlaceInput, 300));
    els.birthPlace.addEventListener("change", handlePlaceSelection);
    els.birthPlace.addEventListener("blur", handlePlaceSelection);
  }

  window.addEventListener("beforeunload", () => {
    state.birthInput = null;
    state.apiResult = null;
    state.placeResults = [];
  });
}

async function handlePlaceInput() {
  const query = els.birthPlace?.value?.trim() || "";
  const lookupSeq = ++state.placeLookupSeq;

  if (query.length < 2) {
    clearLockedPlaceFields();
    renderPlaceSuggestions([]);
    setPlaceStatus("");
    return;
  }

  try {
    const response = await fetch(`/api/places?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`Place lookup failed with ${response.status}`);
    }

    const currentQuery = els.birthPlace?.value?.trim() || "";
    if (lookupSeq !== state.placeLookupSeq || currentQuery !== query) {
      console.log("Ignoring stale place lookup result", {
        requested: query,
        current: currentQuery,
        lookupSeq,
        activeSeq: state.placeLookupSeq
      });
      return;
    }

    const results = await response.json();
    state.placeResults = Array.isArray(results) ? results : [];

    console.log("places fetched", {
      query,
      count: state.placeResults.length,
      first: state.placeResults[0] || null
    });

    renderPlaceSuggestions(state.placeResults);

    const existingMatch = findMatchingPlace(query);

    if (existingMatch) {
      lockPlace(existingMatch);
      return;
    }

    clearLockedPlaceFields();

    if (state.placeResults.length > 0) {
      setPlaceStatus("Choose a suggested place to lock coordinates.");
    } else {
      setPlaceStatus("");
    }
  } catch (error) {
    if (lookupSeq !== state.placeLookupSeq) {
      console.log("Ignoring stale place lookup error", {
        requested: query,
        lookupSeq,
        activeSeq: state.placeLookupSeq,
        error
      });
      return;
    }

    console.error("Place search failed:", error);
    clearLockedPlaceFields();
    renderPlaceSuggestions([]);
    setPlaceStatus("");
  }
}

function renderPlaceSuggestions(results) {
  if (!els.placeSuggestions) return;

  els.placeSuggestions.innerHTML = "";

  results.forEach((place) => {
    const option = document.createElement("option");
    option.value = place.display_name;
    els.placeSuggestions.appendChild(option);
  });
}

async function handlePlaceSelection() {
  const typed = els.birthPlace?.value?.trim() || "";
  console.log("handlePlaceSelection fired", { typed });

  if (!typed) {
    clearLockedPlaceFields();
    setPlaceStatus("");
    return;
  }

  let match = findMatchingPlace(typed);

  if (!match) {
    console.log("no local match, trying fallback fetch");
    match = await resolvePlaceFromText(typed);
  }

  if (!match) {
    clearLockedPlaceFields();
    setPlaceStatus("Selected place did not lock coordinates.");
    console.warn("place selection failed to lock", { typed, placeResults: state.placeResults });
    return;
  }

  lockPlace(match);
}

function findMatchingPlace(typed) {
  const lower = typed.trim().toLowerCase();

  const exact = state.placeResults.find(
    (place) => place.display_name.trim().toLowerCase() === lower
  );
  if (exact) return exact;

  const prefix = state.placeResults.find(
    (place) => place.display_name.toLowerCase().startsWith(lower)
  );
  if (prefix) return prefix;

  const contains = state.placeResults.find(
    (place) => place.display_name.toLowerCase().includes(lower)
  );

  return contains || null;
}

function lockPlace(match) {
  els.birthLat.value = String(match.lat);
  els.birthLon.value = String(match.lon);
  if (els.birthTimezone) els.birthTimezone.value = match.timezone || "";
  els.birthPlace.value = match.display_name;

  console.log("Place locked:", {
    display_name: match.display_name,
    lat: match.lat,
    lon: match.lon,
    timezone: match.timezone || ""
  });

  if (!match.timezone) {
    setPlaceStatus("Place selected, but timezone is missing.");
  } else {
    setPlaceStatus(`Place selected. Timezone: ${match.timezone}`);
  }
}

function clearLockedPlaceFields() {
  els.birthLat.value = "";
  els.birthLon.value = "";
  if (els.birthTimezone) els.birthTimezone.value = "";
}

async function resolvePlaceFromText(placeText) {
  const typed = placeText.trim().toLowerCase();

  const localMatch = findMatchingPlace(typed);
  if (localMatch) return localMatch;

  const lookupSeq = ++state.placeLookupSeq;

  try {
    const response = await fetch(`/api/places?q=${encodeURIComponent(placeText)}`);
    if (!response.ok) {
      throw new Error(`Place lookup failed with ${response.status}`);
    }

    const currentTyped = els.birthPlace?.value?.trim().toLowerCase() || "";
    if (currentTyped && currentTyped !== typed) {
      console.log("Ignoring stale fallback place result", {
        requested: placeText,
        current: els.birthPlace?.value || "",
        lookupSeq,
        activeSeq: state.placeLookupSeq
      });
      return null;
    }

    const results = await response.json();
    const places = Array.isArray(results) ? results : [];
    state.placeResults = places;
    renderPlaceSuggestions(places);

    console.log("fallback places fetched", {
      query: placeText,
      count: places.length,
      first: places[0] || null
    });

    const exactFetched = places.find(
      (place) => place.display_name.trim().toLowerCase() === typed
    );

    const prefixFetched = places.find(
      (place) => place.display_name.toLowerCase().startsWith(typed)
    );

    const containsFetched = places.find(
      (place) => place.display_name.toLowerCase().includes(typed)
    );

    return exactFetched || prefixFetched || containsFetched || places[0] || null;
  } catch (error) {
    console.error("Fallback place resolution failed:", error);
    return null;
  }
}

async function handleFormSubmit(event) {
  console.log("SUBMIT CLICKED - handleFormSubmit entered");
  event.preventDefault();

  let birthDate = els.birthDate?.value?.trim() || "";
  let birthTime = els.birthTime?.value?.trim() || "";
  const noBirthTime = !!els.noBirthTime?.checked;
  const calculationTime = noBirthTime ? "12:00" : birthTime;
  let birthPlace = els.birthPlace?.value?.trim() || "";
  let latRaw = els.birthLat?.value ?? "";
  let lonRaw = els.birthLon?.value ?? "";
  let timeZone = els.birthTimezone?.value?.trim() || "";

  console.log("Raw form values at submit:", {
    birthDate,
    birthTime,
    noBirthTime,
    calculationTime,
    birthPlace,
    latRaw,
    lonRaw,
    timeZone
  });

  if (birthPlace && (!latRaw || !lonRaw || !timeZone)) {
    console.log("Attempting fallback place resolution...");
    const resolved = await resolvePlaceFromText(birthPlace);

    console.log("Fallback place resolution result:", resolved);

    if (resolved) {
      lockPlace(resolved);
      latRaw = els.birthLat.value;
      lonRaw = els.birthLon.value;
      timeZone = els.birthTimezone?.value?.trim() || "";
      birthPlace = els.birthPlace.value.trim();
    }
  }

  const lat = Number(latRaw);
  const lon = Number(lonRaw);

  const missing = [];

  if (!birthDate) missing.push("birth date");
  if (!birthTime && !noBirthTime) missing.push("birth time");
  if (!birthPlace) missing.push("birth place");
  if (!noBirthTime && (!latRaw || Number.isNaN(lat))) missing.push("latitude");
  if (!noBirthTime && (!lonRaw || Number.isNaN(lon))) missing.push("longitude");
  if (!timeZone) missing.push("timezone");

  if (missing.length) {
    console.error("Form validation failed:", {
      birthDate,
      birthTime,
      noBirthTime,
      calculationTime,
      birthPlace,
      latRaw,
      lonRaw,
      lat,
      lon,
      timeZone,
      missing,
      placeResults: state.placeResults
    });

    alert(
      `Missing or invalid: ${missing.join(", ")}.

` +
      `Date: ${birthDate || "missing"}
` +
      `Time: ${noBirthTime ? "not required" : birthTime || "missing"}
` +
      `No birth time: ${noBirthTime ? "yes" : "no"}
` +
      `Place: ${birthPlace || "missing"}
` +
      `Latitude: ${latRaw || (noBirthTime ? "not required" : "missing")}
` +
      `Longitude: ${lonRaw || (noBirthTime ? "not required" : "missing")}
` +
      `Timezone: ${timeZone || "missing"}`
    );
    return;
  }

  state.birthInput = {
    birthDate,
    birthTime: noBirthTime ? null : birthTime,
    noBirthTime,
    birthPlace,
    lat: Number.isNaN(lat) ? null : lat,
    lon: Number.isNaN(lon) ? null : lon,
    timeZone
  };

  try {
    setFormBusy(true);

    const dateDebug = buildUTCDateFromLocalInputsWithDebug(birthDate, calculationTime, timeZone);
    const date = dateDebug.date;

    console.log("Time conversion debug:", dateDebug);

    const sky = getSkySnapshot(date);
    const lagna = noBirthTime ? null : getAscendant({ date, lat, lon });
    const moonDayDebug = noBirthTime ? buildMoonNakshatraDayDebug(birthDate, timeZone) : null;

    const moonDebug = buildBodyDebug("Moon", sky.planets.Moon);
    const sunDebug = buildBodyDebug("Sun", sky.planets.Sun);
    const ascDebug = lagna ? buildBodyDebug("Ascendant", lagna) : null;

    const moonPlacements = moonDayDebug
      ? moonDayDebug.uniquePlacements.map((placement) => ({
          nakshatra: placement.nakshatra,
          pada: null
        }))
      : [];

    const result = {
      moonNakshatra: normalizeNakshatraName(moonDebug.nakshatra),
      moonPada: noBirthTime ? "" : String(moonDebug.pada),
      moonPlacements,
      sunNakshatra: normalizeNakshatraName(sunDebug.nakshatra),
      sunPada: String(sunDebug.pada),
      ascNakshatra: ascDebug ? normalizeNakshatraName(ascDebug.nakshatra) : "",
      ascPada: ascDebug ? String(ascDebug.pada) : "",
      skipAsc: noBirthTime
    };

    const calculationKey = [
      birthDate,
      noBirthTime ? "NO_BIRTH_TIME" : birthTime,
      calculationTime,
      birthPlace,
      noBirthTime ? "NO_ASC" : lat,
      noBirthTime ? "NO_ASC" : lon,
      timeZone,
      date.toISOString()
    ].join("|");

    if (
      !noBirthTime &&
      state.lastCalculationKey === calculationKey &&
      state.lastMoonDebug &&
      (state.lastMoonDebug.nakshatra !== moonDebug.nakshatra ||
        String(state.lastMoonDebug.pada) !== String(moonDebug.pada) ||
        state.lastMoonDebug.siderealLon !== moonDebug.siderealLon)
    ) {
      console.warn("Moon changed for the exact same calculation key", {
        calculationKey,
        previousMoon: state.lastMoonDebug,
        currentMoon: moonDebug
      });
    }

    state.lastCalculationKey = calculationKey;
    state.lastMoonDebug = moonDebug;
    state.apiResult = result;

    console.log("Astrology calculation success:", {
      calculationKey,
      input: {
        birthDate,
        birthTime,
        noBirthTime,
        calculationTime,
        birthPlace,
        lat,
        lon,
        timeZone
      },
      timeDebug: dateDebug,
      moonDayDebug,
      moonDebug,
      sunDebug,
      ascDebug,
      result
    });

    highlightUserPlacements(result);

    const moonStatus = noBirthTime
      ? formatMoonDayStatus(moonDayDebug, timeZone)
      : `Moon ${result.moonNakshatra} (${result.moonPada})`;
    const ascStatus = noBirthTime
      ? "Asc skipped (no birth time)"
      : `Asc ${result.ascNakshatra} (${result.ascPada})`;

    setPlaceStatus(
      `${moonStatus} · Sun ${result.sunNakshatra} (${result.sunPada}) · ${ascStatus}`
    );
  } catch (error) {
    console.error("Astrology calculation failed:", {
      input: {
        birthDate,
        birthTime,
        noBirthTime,
        calculationTime,
        birthPlace,
        lat,
        lon,
        timeZone
      },
      error
    });

    alert(`Could not calculate chart: ${error.message}`);
  } finally {
    setFormBusy(false);
    syncNoBirthTimeUI();
  }
}

function buildUTCDateFromLocalInputsWithDebug(birthDate, birthTime, timeZone) {
  const { year, month, day } = parseDateParts(birthDate);
  const { hour, minute } = parseTimeParts(birthTime);

  validateTimeZone(timeZone);

  const localAsUtcMillis = Date.UTC(year, month - 1, day, hour, minute, 0);
  const candidates = [];

  /*
    A local birth time is not the same thing as a UTC time.
    Rather than guessing the timezone offset from a possibly-wrong instant,
    scan every possible UTC offset and keep the instant(s) that format back
    to the exact local date and time in the selected IANA timezone.

    This is safer for:
    - daylight-saving changes
    - half-hour and 45-minute timezones
    - historical timezone offsets
    - ambiguous repeated local times during DST rollback
  */
  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 1) {
    const candidate = new Date(localAsUtcMillis - offsetMinutes * 60 * 1000);
    const parts = getZonedDateTimeParts(timeZone, candidate);

    if (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === hour &&
      parts.minute === minute
    ) {
      candidates.push({
        date: candidate,
        offsetMinutes,
        offsetHours: offsetMinutes / 60,
        finalUtcIso: candidate.toISOString()
      });
    }
  }

  if (!candidates.length) {
    throw new Error(
      `The local time ${birthDate} ${birthTime} does not exist in ${timeZone}. ` +
      `This can happen during daylight-saving time changes.`
    );
  }

  /*
    If the same wall-clock time occurs twice during a DST rollback,
    choose the earlier real instant by default and expose both matches in debug.
  */
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());

  const chosen = candidates[0];

  return {
    inputDate: birthDate,
    inputTime: birthTime,
    timeZone,
    possibleMatches: candidates.map((candidate) => ({
      finalUtcIso: candidate.finalUtcIso,
      offsetMinutes: candidate.offsetMinutes,
      offsetHours: candidate.offsetHours
    })),
    ambiguousLocalTime: candidates.length > 1,
    offsetMinutes: chosen.offsetMinutes,
    offsetHours: chosen.offsetHours,
    finalUtcIso: chosen.finalUtcIso,
    date: chosen.date
  };
}

function buildUTCDateFromLocalInputs(birthDate, birthTime, timeZone) {
  return buildUTCDateFromLocalInputsWithDebug(birthDate, birthTime, timeZone).date;
}

function validateTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw new Error(`Invalid timezone: ${timeZone}`);
  }
}

function getZonedDateTimeParts(timeZone, date) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    dtf.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function getTimeZoneOffsetMinutes(timeZone, date) {
  const parts = getZonedDateTimeParts(timeZone, date);

  const asUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return (asUTC - date.getTime()) / 60000;
}

function highlightUserPlacements({
  moonNakshatra,
  moonPada,
  moonPlacements = [],
  sunNakshatra,
  sunPada,
  ascNakshatra,
  ascPada,
  skipAsc = false
}) {
  clearHighlights();

  if (Array.isArray(moonPlacements) && moonPlacements.length > 0) {
    moonPlacements.forEach((placement) => {
      highlightSingle("moon", placement.nakshatra, placement.pada ?? null);
    });
  } else {
    highlightSingle("moon", moonNakshatra, moonPada);
  }

  highlightSingle("sun", sunNakshatra, sunPada);

  if (!skipAsc) {
    highlightSingle("asc", ascNakshatra, ascPada);
  }
}

function highlightSingle(column, nakshatra, pada) {
  if (!nakshatra) return;

  const matches = document.querySelectorAll(
    `.nak[data-column="${cssEscape(column)}"][data-nakshatra="${cssEscape(nakshatra)}"]`
  );

  matches.forEach((el) => {
    const sub = el.querySelector(".pill-sub");
    const subText = sub ? sub.textContent.replace(/[()]/g, "").trim() : "";
    const wantsAnyPada = pada === null || typeof pada === "undefined" || String(pada).trim() === "";

    let padaMatches = false;

    if (wantsAnyPada || !subText) {
      padaMatches = true;
    } else {
      const options = subText.split("/").map((v) => v.trim());
      padaMatches = options.includes(String(pada));
    }

    if (!padaMatches) return;

    el.classList.add("is-user-match");
    el.setAttribute("aria-current", "true");

    const valueCell = el.closest("td");
    if (valueCell) {
      valueCell.classList.add("cell-match");

      const row = valueCell.closest("tr");
      if (row) {
        row.classList.add("row-match");

        const rankCell = row.querySelector("td.rank");
        if (rankCell) {
          rankCell.classList.add("rank-match", `rank-match-${column}`);
        }
      }

      const scoreCell = valueCell.nextElementSibling;
      if (scoreCell && scoreCell.classList.contains("score")) {
        scoreCell.classList.add("score-match");
      }
    }
  });
}

function clearHighlights() {
  document.querySelectorAll(".nak.is-user-match").forEach((el) => {
    el.classList.remove("is-user-match");
    el.removeAttribute("aria-current");
  });

  document.querySelectorAll("td.cell-match").forEach((td) => {
    td.classList.remove("cell-match");
  });

  document.querySelectorAll("td.score-match").forEach((td) => {
    td.classList.remove("score-match");
  });

  document.querySelectorAll("td.rank-match").forEach((td) => {
    td.classList.remove("rank-match", "rank-match-sun", "rank-match-moon", "rank-match-asc");
  });

  document.querySelectorAll("tr.row-match").forEach((row) => {
    row.classList.remove("row-match");
  });
}

function clearHighlightsAndInputs() {
  clearHighlights();

  if (els.form) {
    els.form.reset();
  }

  if (els.placeSuggestions) {
    els.placeSuggestions.innerHTML = "";
  }

  clearLockedPlaceFields();

  state.birthInput = null;
  state.apiResult = null;
  state.placeResults = [];
  state.lastCalculationKey = null;
  state.lastMoonDebug = null;
  syncNoBirthTimeUI();
  setPlaceStatus("");
}

function buildMoonNakshatraDayDebug(birthDate, timeZone) {
  const dayStart = buildUTCDateFromLocalInputs(birthDate, "00:00", timeZone);
  const nextBirthDate = addDaysToDateString(birthDate, 1);
  const dayEnd = buildUTCDateFromLocalInputs(nextBirthDate, "00:00", timeZone);
  const sampleStepMs = 10 * 60 * 1000;

  const segments = [];
  let previousDate = dayStart;
  let previousPlacement = getMoonPlacementAt(dayStart);

  segments.push({
    start: dayStart,
    end: null,
    placement: previousPlacement
  });

  for (
    let cursorMs = dayStart.getTime() + sampleStepMs;
    cursorMs < dayEnd.getTime();
    cursorMs += sampleStepMs
  ) {
    const cursor = new Date(Math.min(cursorMs, dayEnd.getTime()));
    const currentPlacement = getMoonPlacementAt(cursor);

    if (currentPlacement.nakshatra !== previousPlacement.nakshatra) {
      const boundary = findMoonNakshatraBoundary(previousDate, cursor, previousPlacement.nakshatra);
      const boundaryPlacement = getMoonPlacementAt(boundary);
      segments[segments.length - 1].end = boundary;
      segments.push({
        start: boundary,
        end: null,
        placement: boundaryPlacement
      });
      previousPlacement = boundaryPlacement;
      previousDate = boundary;
    } else {
      previousPlacement = currentPlacement;
      previousDate = cursor;
    }
  }

  segments[segments.length - 1].end = dayEnd;

  const uniquePlacements = [];
  const seen = new Set();

  segments.forEach((segment) => {
    const key = segment.placement.nakshatra;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePlacements.push(segment.placement);
    }
  });

  return {
    birthDate,
    timeZone,
    dayStartIso: dayStart.toISOString(),
    dayEndIso: dayEnd.toISOString(),
    segments: segments.map((segment) => ({
      startIso: segment.start.toISOString(),
      endIso: segment.end.toISOString(),
      startLocal: formatLocalTime(segment.start, timeZone),
      endLocal: formatLocalTime(segment.end, timeZone),
      placement: segment.placement
    })),
    uniquePlacements
  };
}

function getMoonPlacementAt(date) {
  const moon = getSkySnapshot(date).planets.Moon;
  return {
    nakshatra: normalizeNakshatraName(moon.nakshatra.name),
    pada: String(moon.nakshatraPada),
    siderealLon: roundNumber(moon.siderealLon, 6)
  };
}

function findMoonNakshatraBoundary(oldDate, newDate, oldNakshatra) {
  let low = oldDate.getTime();
  let high = newDate.getTime();

  for (let i = 0; i < 32; i += 1) {
    const mid = Math.floor((low + high) / 2);
    const midPlacement = getMoonPlacementAt(new Date(mid));

    if (midPlacement.nakshatra === oldNakshatra) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return new Date(high);
}

function formatMoonDayStatus(moonDayDebug, timeZone) {
  if (!moonDayDebug || !Array.isArray(moonDayDebug.segments) || moonDayDebug.segments.length === 0) {
    return "No birth time selected: Moon range unavailable";
  }

  const segments = moonDayDebug.segments;

  if (segments.length === 1) {
    return `No birth time selected: Moon stayed in ${segments[0].placement.nakshatra} for this birth date; Ascendant skipped`;
  }

  if (segments.length === 2) {
    const first = segments[0];
    const second = segments[1];
    const flipTime = formatLocalTime(new Date(first.endIso), timeZone);
    return `No birth time selected: Moon may be ${first.placement.nakshatra} before ${flipTime}, then ${second.placement.nakshatra} after ${flipTime}; both Moon placements highlighted; Ascendant skipped`;
  }

  const parts = segments.map((segment) => {
    return `${segment.placement.nakshatra} ${segment.startLocal}–${segment.endLocal}`;
  });

  return `No birth time selected: Moon changed across the day (${parts.join(", ")}); all possible Moon placements highlighted; Ascendant skipped`;
}

function addDaysToDateString(dateString, days) {
  const { year, month, day } = parseDateParts(dateString);
  const date = new Date(Date.UTC(year, month - 1, day + days, 0, 0, 0));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatLocalTime(date, timeZone) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
    .format(date)
    .replace(/\s+/g, "")
    .toLowerCase();
}

function buildBodyDebug(label, body) {
  return {
    label,
    siderealLon: roundNumber(body.siderealLon, 6),
    rashi: body.rashi?.name || "",
    rashiDeg: roundNumber(body.rashiDeg, 6),
    nakshatra: body.nakshatra?.name || "",
    pada: String(body.nakshatraPada || "")
  };
}

function roundNumber(value, decimals = 6) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** decimals;
  return Math.round(number * factor) / factor;
}

function setFormBusy(isBusy) {
  const controls = [
    els.birthDate,
    els.birthPlace,
    els.noBirthTime,
    els.clearBtn,
    els.form?.querySelector('button[type="submit"]')
  ].filter(Boolean);

  controls.forEach((control) => {
    control.disabled = isBusy;
  });

  if (els.birthTime) {
    els.birthTime.disabled = isBusy || !!els.noBirthTime?.checked;
  }

  const submitBtn = els.form?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = isBusy ? "Calculating..." : "Highlight placements";
  }
}

function syncNoBirthTimeUI() {
  const noBirthTime = !!els.noBirthTime?.checked;

  document.body.classList.toggle("no-birth-time", noBirthTime);

  if (els.birthTime) {
    els.birthTime.disabled = noBirthTime;
    els.birthTime.required = !noBirthTime;
    els.birthTime.setAttribute("aria-disabled", noBirthTime ? "true" : "false");
  }

  const timeGroup = els.birthTime?.closest(".field-group");
  if (timeGroup) {
    timeGroup.classList.toggle("is-disabled", noBirthTime);
  }

  if (noBirthTime) {
    document.querySelectorAll('.nak[data-column="asc"].is-user-match').forEach((el) => {
      el.classList.remove("is-user-match");
      el.removeAttribute("aria-current");

      const valueCell = el.closest("td");
      if (valueCell) {
        valueCell.classList.remove("cell-match");

        const scoreCell = valueCell.nextElementSibling;
        if (scoreCell && scoreCell.classList.contains("score")) {
          scoreCell.classList.remove("score-match");
        }

        const row = valueCell.closest("tr");
        const rankCell = row?.querySelector("td.rank");
        if (rankCell) {
          rankCell.classList.remove("rank-match-asc");
          if (!rankCell.classList.contains("rank-match-sun") && !rankCell.classList.contains("rank-match-moon")) {
            rankCell.classList.remove("rank-match");
          }
        }
      }
    });
  }
}

function setPlaceStatus(text) {
  if (els.placeStatus) {
    els.placeStatus.textContent = text;
  }
}

function parseDateParts(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Birth date must be YYYY-MM-DD.");
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function parseTimeParts(value) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error("Birth time must be HH:MM.");
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

function normalizeNakshatraName(name) {
  const value = String(name || "").trim();

  const aliases = {
    Mrigashira: "Mrigashirsha",
    Jyeshtha: "Jyestha",
    Dhanishtha: "Dhanishta",
    Shatabisha: "Shatabhisha",
    "Purva Bhadrapada": "Purva Bhadrapadha",
    "Uttara Bhadrapada": "Uttara Bhadrapadha"
  };

  return aliases[value] || value;
}

function debounce(fn, wait = 250) {
  let timeout;

  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }

  return String(value).replace(/["\\]/g, "\\$&");
}
