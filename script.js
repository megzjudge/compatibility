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
  apiResult: null
};

const els = {
  form: document.getElementById("chart-form"),
  birthDate: document.getElementById("birth-date"),
  birthTime: document.getElementById("birth-time"),
  birthPlace: document.getElementById("birth-place"),
  moonSelect: document.getElementById("moon-placement"),
  sunSelect: document.getElementById("sun-placement"),
  ascSelect: document.getElementById("asc-placement"),
  clearBtn: document.getElementById("clear-highlights")
};

document.addEventListener("DOMContentLoaded", () => {
  populateDropdowns();
  bindEvents();
});

function populateDropdowns() {
  const placementNames = Object.keys(nakshatraMap)
    .filter((name) => name !== "Jyeshtha" && name !== "Shatabisha")
    .sort((a, b) => a.localeCompare(b));

  fillSelect(els.moonSelect, placementNames, "Select Moon");
  fillSelect(els.sunSelect, placementNames, "Select Sun");
  fillSelect(els.ascSelect, placementNames, "Select Ascendant");
}

function fillSelect(selectEl, names, placeholder) {
  if (!selectEl) return;

  selectEl.innerHTML = "";

  const firstOption = document.createElement("option");
  firstOption.value = "";
  firstOption.textContent = placeholder;
  selectEl.appendChild(firstOption);

  names.forEach((name) => {
    const info = nakshatraMap[name];
    const option = document.createElement("option");
    option.value = name;
    option.textContent = `${planetSymbolMap[info.ruler]} ${info.animal} ${name}`;
    selectEl.appendChild(option);
  });
}

function bindEvents() {
  if (els.form) {
    els.form.addEventListener("submit", handleFormSubmit);
  }

  if (els.clearBtn) {
    els.clearBtn.addEventListener("click", clearHighlightsAndInputs);
  }

  [els.moonSelect, els.sunSelect, els.ascSelect].forEach((selectEl) => {
    if (!selectEl) return;
    selectEl.addEventListener("change", handleManualSelectionChange);
  });

  window.addEventListener("beforeunload", () => {
    state.birthInput = null;
    state.apiResult = null;
  });
}

async function handleFormSubmit(event) {
  event.preventDefault();

  const birthDate = els.birthDate?.value?.trim() || "";
  const birthTime = els.birthTime?.value?.trim() || "";
  const birthPlace = els.birthPlace?.value?.trim() || "";

  const moonManual = els.moonSelect?.value || "";
  const sunManual = els.sunSelect?.value || "";
  const ascManual = els.ascSelect?.value || "";

  if (moonManual || sunManual || ascManual) {
    highlightUserPlacements({
      moonNakshatra: moonManual,
      sunNakshatra: sunManual,
      ascNakshatra: ascManual
    });
    return;
  }

  if (!birthDate || !birthTime || !birthPlace) {
    alert("Enter birth date, birth time, and birth place, or choose placements manually.");
    return;
  }

  state.birthInput = {
    birthDate,
    birthTime,
    birthPlace
  };

  try {
    setFormBusy(true);

    const payload = {
      birthDate,
      birthTime,
      birthPlace
    };

    const response = await fetch("/api/astro", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await safeReadText(response);
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    const result = await response.json();
    state.apiResult = result;

    const normalized = normalizeApiResult(result);

    if (normalized.moonNakshatra && els.moonSelect) {
      els.moonSelect.value = normalized.moonNakshatra;
    }
    if (normalized.sunNakshatra && els.sunSelect) {
      els.sunSelect.value = normalized.sunNakshatra;
    }
    if (normalized.ascNakshatra && els.ascSelect) {
      els.ascSelect.value = normalized.ascNakshatra;
    }

    highlightUserPlacements(normalized);
  } catch (error) {
    console.error("Astrology lookup failed:", error);
    alert(`Could not fetch chart details: ${error.message}`);
  } finally {
    setFormBusy(false);
  }
}

function handleManualSelectionChange() {
  const moonNakshatra = els.moonSelect?.value || "";
  const sunNakshatra = els.sunSelect?.value || "";
  const ascNakshatra = els.ascSelect?.value || "";

  if (!moonNakshatra && !sunNakshatra && !ascNakshatra) {
    clearHighlights();
    return;
  }

  highlightUserPlacements({
    moonNakshatra,
    sunNakshatra,
    ascNakshatra
  });
}

function highlightUserPlacements({ moonNakshatra, sunNakshatra, ascNakshatra }) {
  clearHighlights();

  const targets = [
    { column: "moon", value: moonNakshatra },
    { column: "sun", value: sunNakshatra },
    { column: "asc", value: ascNakshatra }
  ];

  targets.forEach(({ column, value }) => {
    if (!value) return;

    const selector =
      `.nak[data-column="${cssEscape(column)}"][data-nakshatra="${cssEscape(value)}"]`;

    document.querySelectorAll(selector).forEach((el) => {
      el.classList.add("is-user-match");
      el.setAttribute("aria-current", "true");
    });
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

  state.birthInput = null;
  state.apiResult = null;
}

function setFormBusy(isBusy) {
  const controls = [
    els.birthDate,
    els.birthTime,
    els.birthPlace,
    els.moonSelect,
    els.sunSelect,
    els.ascSelect,
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

function normalizeApiResult(result) {
  const moonNakshatra =
    result?.moonNakshatra ||
    result?.moon?.nakshatra ||
    result?.placements?.moon?.nakshatra ||
    "";

  const sunNakshatra =
    result?.sunNakshatra ||
    result?.sun?.nakshatra ||
    result?.placements?.sun?.nakshatra ||
    "";

  const ascNakshatra =
    result?.ascNakshatra ||
    result?.ascendantNakshatra ||
    result?.asc?.nakshatra ||
    result?.placements?.asc?.nakshatra ||
    result?.placements?.ascendant?.nakshatra ||
    "";

  return {
    moonNakshatra: normalizeNakshatraName(moonNakshatra),
    sunNakshatra: normalizeNakshatraName(sunNakshatra),
    ascNakshatra: normalizeNakshatraName(ascNakshatra)
  };
}

function normalizeNakshatraName(name) {
  if (!name) return "";

  const trimmed = String(name).trim();

  const aliases = {
    Jyeshtha: "Jyestha",
    Shatabisha: "Shatabhisha"
  };

  return aliases[trimmed] || trimmed;
}

function safeReadText(response) {
  return response.text().catch(() => "");
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }

  return String(value).replace(/["\\]/g, "\\$&");
}
