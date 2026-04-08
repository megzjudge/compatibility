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

  if (query.length < 3) {
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
    setPlaceStatus("Could not load place suggestions.");
    renderPlaceSuggestions([]);
  }
}

function renderPlaceSuggestions(results) {
  els.placeSuggestions.innerHTML = "";

  results.forEach((place) => {
    const option = document.createElement("option");
    option.value = place.display_name;
    els.placeSuggestions.appendChild(option);
  });
}

function handlePlaceSelection() {
  const typed = els.birthPlace?.value?.trim() || "";
  const match = state.placeResults.find((place) => place.display_name === typed);

  if (!match) {
    els.birthLat.value = "";
    els.birthLon.value = "";
    if (typed) {
      setPlaceStatus("Pick a place from the suggestions.");
    }
    return;
  }

  els.birthLat.value = String(match.lat);
  els.birthLon.value = String(match.lon);
  setPlaceStatus("Place selected.");
}

async function handleFormSubmit(event) {
  event.preventDefault();

  const birthDate = els.birthDate?.value?.trim() || "";
  const birthTime = els.birthTime?.value?.trim() || "";
  const birthPlace = els.birthPlace?.value?.trim() || "";
  const lat = els.birthLat?.value?.trim() || "";
  const lon = els.birthLon?.value?.trim() || "";

  if (!birthDate || !birthTime || !birthPlace || !lat || !lon) {
    alert("Enter date and time, then choose a birth place from the suggestions.");
    return;
  }

  state.birthInput = { birthDate, birthTime, birthPlace, lat, lon };

  try {
    setFormBusy(true);

    const response = await fetch("/api/astro", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        birthDate,
        birthTime,
        birthPlace,
        lat: Number(lat),
        lon: Number(lon)
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    const result = await response.json();
    state.apiResult = result;

    highlightUserPlacements(normalizeApiResult(result));
  } catch (error) {
    console.error("Astrology lookup failed:", error);
    alert(`Could not fetch chart details: ${error.message}`);
  } finally {
    setFormBusy(false);
  }
}

function normalizeApiResult(result) {
  return {
    moonNakshatra: normalizeNakshatraName(
      result?.moonNakshatra || result?.moon?.nakshatra || ""
    ),
    moonPada: String(result?.moonPada || result?.moon?.pada || "").trim(),

    sunNakshatra: normalizeNakshatraName(
      result?.sunNakshatra || result?.sun?.nakshatra || ""
    ),
    sunPada: String(result?.sunPada || result?.sun?.pada || "").trim(),

    ascNakshatra: normalizeNakshatraName(
      result?.ascNakshatra || result?.ascendant?.nakshatra || result?.asc?.nakshatra || ""
    ),
    ascPada: String(result?.ascPada || result?.ascendant?.pada || result?.asc?.pada || "").trim()
  };
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

    if (!pada || !subText || subText === pada || subText.split("/").includes(pada)) {
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
    submitBtn.textContent = isBusy ? "Looking up chart..." : "Highlight placements";
  }
}

function setPlaceStatus(text) {
  if (els.placeStatus) {
    els.placeStatus.textContent = text;
  }
}

function normalizeNakshatraName(name) {
  const value = String(name || "").trim();
  const aliases = {
    Jyeshtha: "Jyestha",
    Shatabisha: "Shatabhisha"
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
