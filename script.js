import { getSkySnapshot, getAscendant } from "./vedic-ephemeris.mjs";

const baseColors = [
  { planet: "Sun", hex: "#EAA565" },
  { planet: "Moon", hex: "#CACACA" },
  { planet: "Mercury", hex: "#3CB371" },
  { planet: "Venus", hex: "#EAF5EA" },
  { planet: "Mars", hex: "#FF4040" },
  { planet: "Jupiter", hex: "#F4E87C" },
  { planet: "Saturn", hex: "#00167E" },
  { planet: "Rahu", hex: "#111213" },
  { planet: "Ketu", hex: "#B2A38B" }
];

const nakshatras = [
  { label: "🐎 Ashwini",            ruler: "Ketu"    },
  { label: "🐘 Bharani",            ruler: "Venus"   },
  { label: "🐐 Krittika",           ruler: "Sun"     },
  { label: "🐍 Rohini",             ruler: "Moon"    },
  { label: "🐍 Mrigashirsha",       ruler: "Mars"    },
  { label: "🐕 Ardra",              ruler: "Rahu"    },
  { label: "🐈‍⬛ Punarvasu",          ruler: "Jupiter" },
  { label: "🐐 Pushya",             ruler: "Saturn"  },
  { label: "🐈‍⬛ Ashlesha",           ruler: "Mercury" },
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

const planetIconMap = {
  Sun: "sun.png",
  Moon: "moon.png",
  Mercury: "mercury.png",
  Venus: "venus.png",
  Mars: "mars.png",
  Jupiter: "jupiter.png",
  Saturn: "saturn.png",
  Rahu: "rahu.png",
  Ketu: "ketu.png"
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
  selectedPlace: null,
  placeLookupSeq: 0,
  lastCalculationKey: null,
  lastMoonDebug: null,
  activeHighlightResult: null,
  highlightVersion: 0
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
  placeDropdown: null,
  placeStatus: document.getElementById("place-status"),
  clearBtn: document.getElementById("clear-highlights")
};

document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("footer-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  console.log("script loaded", {
    formFound: !!els.form,
    birthPlaceFound: !!els.birthPlace,
    timezoneFound: !!els.birthTimezone,
    noBirthTimeFound: !!els.noBirthTime
  });
  ensurePlaceDropdown();
  replacePlanetSymbolPillsWithIcons();
  bindEvents();
  syncNoBirthTimeUI();
});

function getPlanetNameFromClassList(classList) {
  if (!classList) return "";

  const classMatch = Array.from(classList).find((className) => className.startsWith("nak-"));
  if (!classMatch) return "";

  const slug = classMatch.replace("nak-", "");
  return Object.keys(planetIconMap).find((planet) => planet.toLowerCase() === slug) || "";
}

function replacePlanetSymbolPillsWithIcons() {
  document.querySelectorAll(".pill-planet").forEach((pill) => {
    if (pill.querySelector(".planet-icon")) return;

    const nak = pill.closest(".nak");
    const planet = getPlanetNameFromClassList(nak?.classList);
    const iconSrc = planetIconMap[planet];

    if (!planet || !iconSrc) return;

    pill.textContent = "";

    const icon = document.createElement("img");
    icon.className = "planet-icon";
    icon.src = iconSrc;
    icon.alt = planet;
    icon.title = planet;
    icon.loading = "lazy";
    icon.decoding = "async";

    icon.addEventListener("error", () => {
      console.warn(`Planet icon failed to load: ${iconSrc}`);
      pill.textContent = planet;
    }, { once: true });

    pill.appendChild(icon);
  });
}

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
    els.birthPlace.removeAttribute("list");
    els.birthPlace.setAttribute("autocomplete", "off");
    els.birthPlace.addEventListener("input", debounce(handlePlaceInput, 300));
  }

  if (els.placeDropdown) {
    els.placeDropdown.addEventListener("change", handlePlaceDropdownSelection);
  }

  window.addEventListener("beforeunload", () => {
    state.birthInput = null;
    state.apiResult = null;
    state.placeResults = [];
    state.selectedPlace = null;
  });
}

function ensurePlaceDropdown() {
  if (!els.birthPlace) return;

  els.birthPlace.removeAttribute("list");
  els.birthPlace.setAttribute("autocomplete", "off");

  if (els.placeSuggestions) {
    els.placeSuggestions.innerHTML = "";
  }

  if (els.placeDropdown) return;

  const dropdown = document.createElement("select");
  dropdown.id = "place-dropdown";
  dropdown.className = "place-dropdown";
  dropdown.hidden = true;
  dropdown.setAttribute("aria-label", "Choose a birth place from the search results");

  els.birthPlace.insertAdjacentElement("afterend", dropdown);
  els.placeDropdown = dropdown;
}

async function handlePlaceInput() {
  const query = els.birthPlace?.value?.trim() || "";
  const lookupSeq = ++state.placeLookupSeq;

  state.selectedPlace = null;
  clearLockedPlaceFields();

  if (query.length < 2) {
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

    if (state.placeResults.length > 0) {
      setPlaceStatus("Choose one of the dropdown place options to lock coordinates.");
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
  ensurePlaceDropdown();

  if (els.placeSuggestions) {
    els.placeSuggestions.innerHTML = "";
  }

  if (!els.placeDropdown) return;

  els.placeDropdown.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = results.length
    ? "Select the correct place..."
    : "No place options found";
  placeholder.disabled = true;
  placeholder.selected = true;
  els.placeDropdown.appendChild(placeholder);

  results.forEach((place, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = place.display_name;
    els.placeDropdown.appendChild(option);
  });

  els.placeDropdown.hidden = results.length === 0;
}

function handlePlaceDropdownSelection(event) {
  const selectedIndex = Number(event.currentTarget?.value);
  const match = Number.isInteger(selectedIndex) ? state.placeResults[selectedIndex] : null;

  console.log("handlePlaceDropdownSelection fired", { selectedIndex, match });

  if (!match) {
    clearLockedPlaceFields();
    setPlaceStatus("Choose one of the dropdown place options to lock coordinates.");
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
  state.selectedPlace = match;

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

  if (els.placeDropdown) {
    els.placeDropdown.hidden = true;
    els.placeDropdown.value = "";
  }

  if (!match.timezone) {
    setPlaceStatus("Place selected, but timezone is missing.");
  } else {
    setPlaceStatus(`Place selected. Timezone: ${match.timezone}`);
  }
}

function clearLockedPlaceFields() {
  state.selectedPlace = null;
  els.birthLat.value = "";
  els.birthLon.value = "";
  if (els.birthTimezone) els.birthTimezone.value = "";
}

async function resolvePlaceFromText(placeText) {
  const typed = placeText.trim().toLowerCase();
  const lookupSeq = ++state.placeLookupSeq;

  try {
    const response = await fetch(`/api/places?q=${encodeURIComponent(placeText)}`);
    if (!response.ok) {
      throw new Error(`Place lookup failed with ${response.status}`);
    }

    const currentTyped = els.birthPlace?.value?.trim().toLowerCase() || "";
    if (currentTyped && currentTyped !== typed) {
      console.log("Ignoring stale place options result", {
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

    console.log("place options fetched", {
      query: placeText,
      count: places.length,
      first: places[0] || null
    });

    if (places.length > 0) {
      setPlaceStatus("Choose one of the dropdown place options to lock coordinates.");
    }

    return null;
  } catch (error) {
    console.error("Place option refresh failed:", error);
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
    console.log("Place typed but not selected from dropdown. Waiting for explicit selection.", {
      birthPlace,
      latRaw,
      lonRaw,
      timeZone
    });
    await resolvePlaceFromText(birthPlace);
  }

  const lat = Number(latRaw);
  const lon = Number(lonRaw);

  const missing = [];

  if (!birthDate) missing.push("birth date");
  if (!birthTime && !noBirthTime) missing.push("birth time");
  if (!birthPlace) {
    missing.push("birth place");
  } else if (!latRaw || !lonRaw || !timeZone) {
    missing.push("birth place selection");
  }
  if (!noBirthTime && latRaw && Number.isNaN(lat)) missing.push("latitude");
  if (!noBirthTime && lonRaw && Number.isNaN(lon)) missing.push("longitude");

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
          pada: placement.pada
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

    if (noBirthTime) {
      setPlaceStatus(
        `Sun ${result.sunNakshatra} (${result.sunPada}) · ${ascStatus} ·\n${moonStatus}`
      );
    } else {
      setPlaceStatus(
        `${moonStatus} · Sun ${result.sunNakshatra} (${result.sunPada}) · ${ascStatus}`
      );
    }
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

function highlightUserPlacements(result) {
  const safeResult = normalizeHighlightResult(result);

  state.highlightVersion += 1;
  state.activeHighlightResult = safeResult;

  clearHighlights();
  applyHighlightResult(safeResult);
  scheduleHighlightFailsafe("highlightUserPlacements");
}

function normalizeHighlightResult({
  moonNakshatra,
  moonPada,
  moonPlacements = [],
  sunNakshatra,
  sunPada,
  ascNakshatra,
  ascPada,
  skipAsc = false
}) {
  return {
    moonNakshatra: normalizeNakshatraName(moonNakshatra),
    moonPada: String(moonPada ?? ""),
    moonPlacements: Array.isArray(moonPlacements)
      ? moonPlacements
          .map((placement) => ({
            nakshatra: normalizeNakshatraName(placement?.nakshatra),
            pada: placement?.pada ?? null
          }))
          .filter((placement) => placement.nakshatra)
      : [],
    sunNakshatra: normalizeNakshatraName(sunNakshatra),
    sunPada: String(sunPada ?? ""),
    ascNakshatra: normalizeNakshatraName(ascNakshatra),
    ascPada: String(ascPada ?? ""),
    skipAsc: !!skipAsc
  };
}

function applyHighlightResult(result) {
  const moonCount = applyMoonHighlights(result);
  const sunCount = highlightWithPadaFallback("sun", result.sunNakshatra, result.sunPada);

  if (!sunCount) {
    console.warn("Sun highlight could not find a matching table cell.", {
      sunNakshatra: result.sunNakshatra,
      sunPada: result.sunPada
    });
  }

  if (!moonCount) {
    console.warn("Moon highlight could not find a matching table cell.", {
      moonNakshatra: result.moonNakshatra,
      moonPada: result.moonPada,
      moonPlacements: result.moonPlacements
    });
  }

  if (!result.skipAsc) {
    highlightWithPadaFallback("asc", result.ascNakshatra, result.ascPada);
  }
}

function applyMoonHighlights(result) {
  const placements = getMoonHighlightPlacements(result);

  return placements.reduce((count, placement) => {
    return count + highlightWithPadaFallback("moon", placement.nakshatra, placement.pada);
  }, 0);
}

function getMoonHighlightPlacements(result) {
  if (result.skipAsc && Array.isArray(result.moonPlacements) && result.moonPlacements.length > 0) {
    return result.moonPlacements;
  }

  return [
    {
      nakshatra: result.moonNakshatra,
      // When no birth time is supplied and the day-range calculation did not
      // return placements, keep the Moon broad: highlight every matching pada
      // for that nakshatra instead of accidentally using the noon fallback.
      pada: result.skipAsc ? null : result.moonPada
    }
  ];
}

function highlightWithPadaFallback(column, nakshatra, pada) {
  const exactCount = highlightSingle(column, nakshatra, pada);

  if (exactCount > 0) {
    return exactCount;
  }

  // Final fallback: if a table row groups padas differently from the calculated
  // value, still highlight the nakshatra so Sun/Moon cannot disappear.
  const wantsAnyPada = pada === null || typeof pada === "undefined" || String(pada).trim() === "";
  if (!wantsAnyPada) {
    return highlightSingle(column, nakshatra, null);
  }

  return exactCount;
}

function scheduleHighlightFailsafe(reason = "") {
  const version = state.highlightVersion;
  const run = () => enforceMandatoryHighlights(version, reason);

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(run);
  }

  window.setTimeout(run, 0);
}

function enforceMandatoryHighlights(version = state.highlightVersion, reason = "") {
  if (version !== state.highlightVersion || !state.activeHighlightResult) {
    return;
  }

  const result = state.activeHighlightResult;

  // Sun and Moon are mandatory. Re-apply them after any later UI sync/DOM class
  // cleanup so they cannot be accidentally removed by another JS branch.
  applyMoonHighlights(result);
  const sunCount = highlightWithPadaFallback("sun", result.sunNakshatra, result.sunPada);

  if (!sunCount) {
    console.warn("Sun highlight failsafe found no matching table cell.", {
      reason,
      sunNakshatra: result.sunNakshatra,
      sunPada: result.sunPada
    });
  }

  if (!result.skipAsc) {
    highlightWithPadaFallback("asc", result.ascNakshatra, result.ascPada);
  }
}

function highlightSingle(column, nakshatra, pada) {
  if (!nakshatra) return 0;

  const matches = document.querySelectorAll(
    `.nak[data-column="${cssEscape(column)}"][data-nakshatra="${cssEscape(nakshatra)}"]`
  );

  let appliedCount = 0;

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

    appliedCount += 1;
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

  return appliedCount;
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
  state.highlightVersion += 1;
  state.activeHighlightResult = null;
  clearHighlights();

  if (els.form) {
    els.form.reset();
  }

  renderPlaceSuggestions([]);

  clearLockedPlaceFields();

  state.birthInput = null;
  state.apiResult = null;
  state.placeResults = [];
  state.selectedPlace = null;
  state.lastCalculationKey = null;
  state.lastMoonDebug = null;
  state.activeHighlightResult = null;
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

    if (!moonPlacementMatches(currentPlacement, previousPlacement)) {
      const boundary = findMoonPlacementBoundary(previousDate, cursor, previousPlacement);
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
    const key = moonPlacementKey(segment.placement);
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

function moonPlacementKey(placement) {
  return `${placement.nakshatra}|${placement.pada}`;
}

function moonPlacementMatches(a, b) {
  return moonPlacementKey(a) === moonPlacementKey(b);
}

function findMoonPlacementBoundary(oldDate, newDate, oldPlacement) {
  let low = oldDate.getTime();
  let high = newDate.getTime();
  const oldKey = moonPlacementKey(oldPlacement);

  for (let i = 0; i < 32; i += 1) {
    const mid = Math.floor((low + high) / 2);
    const midPlacement = getMoonPlacementAt(new Date(mid));

    if (moonPlacementKey(midPlacement) === oldKey) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return new Date(high);
}

function formatMoonDayStatus(moonDayDebug, timeZone) {
  if (!moonDayDebug || !Array.isArray(moonDayDebug.segments) || moonDayDebug.segments.length === 0) {
    return "Moon range unavailable.";
  }

  const segments = moonDayDebug.segments;

  if (segments.length === 1) {
    return `Moon stayed in ${formatMoonPlacementLabel(segments[0].placement)} for this birth date.`;
  }

  const parts = segments.map((segment, index) => {
    const label = formatMoonPlacementLabel(segment.placement);

    if (index === 0) {
      const endTime = formatLocalTime(new Date(segment.endIso), timeZone);
      return `${label} before ${endTime}`;
    }

    const startTime = formatLocalTime(new Date(segment.startIso), timeZone);

    if (index === segments.length - 1) {
      return `${label} after ${startTime} until midnight`;
    }

    return `${label} after ${startTime}`;
  });

  return formatMoonRangeLines(parts);
}

function formatMoonRangeLines(parts) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return "Moon range unavailable.";
  }

  const lines = [`Moon may be; ${parts[0]};`];

  for (let index = 1; index < parts.length; index += 2) {
    const chunk = parts.slice(index, index + 2);
    const isLastChunk = index + chunk.length >= parts.length;
    const ending = isLastChunk ? "." : ";";
    lines.push(`${chunk.join("; ")}${ending}`);
  }

  return lines.join("\n");
}

function formatMoonPlacementLabel(placement) {
  return `${placement.nakshatra} (${placement.pada})`;
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

  enforceMandatoryHighlights(state.highlightVersion, "syncNoBirthTimeUI");
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
