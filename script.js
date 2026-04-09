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
  placeResults: []
};

const els = {
  form: document.getElementById("chart-form"),
  birthDate: document.getElementById("birth-date"),
  birthTime: document.getElementById("birth-time"),
  birthPlace: document.getElementById("birth-place"),
  birthLat: document.getElementById("birth-lat"),
  birthLon: document.getElementById("birth-lon"),
  birthTimezone: document.getElementById("birth-timezone"),
  placeSuggestions: document.getElementById("place-suggestions"),
  placeStatus: document.getElementById("place-status"),
  clearBtn: document.getElementById("clear-highlights")
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
});

function bindEvents() {
  if (els.form) {
    els.form.addEventListener("submit", handleFormSubmit);
  }

  if (els.clearBtn) {
    els.clearBtn.addEventListener("click", clearHighlightsAndInputs);
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

  els.birthLat.value = "";
  els.birthLon.value = "";
  if (els.birthTimezone) els.birthTimezone.value = "";

  if (query.length < 2) {
    renderPlaceSuggestions([]);
    setPlaceStatus("");
    return;
  }

  try {
    setPlaceStatus("Searching places...");

    const response = await fetch(`/api/places?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`Place lookup failed with ${response.status}`);
    }

    const results = await response.json();
    state.placeResults = Array.isArray(results) ? results : [];

    renderPlaceSuggestions(state.placeResults);

    if (state.placeResults.length > 0) {
      setPlaceStatus("Choose a suggested place to lock coordinates.");
    } else {
      setPlaceStatus("No matching places found.");
    }
  } catch (error) {
    console.error("Place search failed:", error);
    renderPlaceSuggestions([]);
    setPlaceStatus("Could not load place suggestions.");
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

function handlePlaceSelection() {
  const typed = els.birthPlace?.value?.trim() || "";

  const exact = state.placeResults.find(
    (place) => place.display_name.trim().toLowerCase() === typed.toLowerCase()
  );

  const prefix = state.placeResults.find(
    (place) => place.display_name.toLowerCase().startsWith(typed.toLowerCase())
  );

  const match = exact || prefix;

  if (!match) {
    els.birthLat.value = "";
    els.birthLon.value = "";
    if (els.birthTimezone) els.birthTimezone.value = "";
    return;
  }

  els.birthLat.value = String(match.lat);
  els.birthLon.value = String(match.lon);
  if (els.birthTimezone) els.birthTimezone.value = match.timezone || "";
  els.birthPlace.value = match.display_name;
  setPlaceStatus("Place selected.");
}

async function handleFormSubmit(event) {
  event.preventDefault();

  const birthDate = els.birthDate?.value?.trim() || "";
  const birthTime = els.birthTime?.value?.trim() || "";
  const birthPlace = els.birthPlace?.value?.trim() || "";
  const lat = Number(els.birthLat?.value || "");
  const lon = Number(els.birthLon?.value || "");
  const timeZone = els.birthTimezone?.value?.trim() || "";

  if (!birthDate || !birthTime || !birthPlace || Number.isNaN(lat) || Number.isNaN(lon) || !timeZone) {
    alert("Enter date and time, then choose a birth place from the suggestions.");
    return;
  }

  state.birthInput = { birthDate, birthTime, birthPlace, lat, lon, timeZone };

  try {
    setFormBusy(true);

    const date = buildUTCDateFromLocalInputs(birthDate, birthTime, timeZone);

    const sky = getSkySnapshot(date);
    const lagna = getAscendant({ date, lat, lon });

    const result = {
      moonNakshatra: normalizeNakshatraName(sky.planets.Moon.nakshatra.name),
      moonPada: String(sky.planets.Moon.nakshatraPada),
      sunNakshatra: normalizeNakshatraName(sky.planets.Sun.nakshatra.name),
      sunPada: String(sky.planets.Sun.nakshatraPada),
      ascNakshatra: normalizeNakshatraName(lagna.nakshatra.name),
      ascPada: String(lagna.nakshatraPada)
    };

    state.apiResult = result;

    highlightUserPlacements(result);

    setPlaceStatus(
      `Moon ${result.moonNakshatra} (${result.moonPada}) · Sun ${result.sunNakshatra} (${result.sunPada}) · Asc ${result.ascNakshatra} (${result.ascPada})`
    );
  } catch (error) {
    console.error("Astrology calculation failed:", error);
    alert(`Could not calculate chart: ${error.message}`);
  } finally {
    setFormBusy(false);
  }
}

function buildUTCDateFromLocalInputs(birthDate, birthTime, timeZone) {
  const { year, month, day } = parseDateParts(birthDate);
  const { hour, minute } = parseTimeParts(birthTime);

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, utcGuess);

  const utcMillis =
    Date.UTC(year, month - 1, day, hour, minute, 0) -
    offsetMinutes * 60 * 1000;

  const date = new Date(utcMillis);

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("Failed to build a valid UTC Date.");
  }

  return date;
}

function getTimeZoneOffsetMinutes(timeZone, date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
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
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );

  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return (asUTC - date.getTime()) / 60000;
}

function highlightUserPlacements({
  moonNakshatra,
  moonPada,
  sunNakshatra,
  sunPada,
  ascNakshatra,
  ascPada
}) {
  clearHighlights();
  highlightSingle("moon", moonNakshatra, moonPada);
  highlightSingle("sun", sunNakshatra, sunPada);
  highlightSingle("asc", ascNakshatra, ascPada);
}

function highlightSingle(column, nakshatra, pada) {
  if (!nakshatra) return;

  const matches = document.querySelectorAll(
    `.nak[data-column="${cssEscape(column)}"][data-nakshatra="${cssEscape(nakshatra)}"]`
  );

  matches.forEach((el) => {
    const sub = el.querySelector(".pill-sub");
    const subText = sub ? sub.textContent.replace(/[()]/g, "").trim() : "";

    if (!subText) return;

    const options = subText.split("/").map((v) => v.trim());
    if (options.includes(String(pada))) {
      el.classList.add("is-user-match");
      el.setAttribute("aria-current", "true");
    }
  });
}

function clearHighlights() {
  document.querySelectorAll(".nak.is-user-match").forEach((el) => {
    el.classList.remove("is-user-match");
    el.removeAttribute("aria-current");
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

  if (els.birthLat) els.birthLat.value = "";
  if (els.birthLon) els.birthLon.value = "";
  if (els.birthTimezone) els.birthTimezone.value = "";

  state.birthInput = null;
  state.apiResult = null;
  state.placeResults = [];
  setPlaceStatus("");
}

function setFormBusy(isBusy) {
  const controls = [
    els.birthDate,
    els.birthTime,
    els.birthPlace,
    els.clearBtn,
    els.form?.querySelector('button[type="submit"]')
  ].filter(Boolean);

  controls.forEach((control) => {
    control.disabled = isBusy;
  });

  const submitBtn = els.form?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = isBusy ? "Calculating..." : "Highlight placements";
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
    Purva Bhadrapada: "Purva Bhadrapadha",
    Uttara Bhadrapada: "Uttara Bhadrapadha"
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
