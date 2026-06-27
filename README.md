# Compatibility

A single-page **Vedic (sidereal) Nakshatra compatibility table**. Enter your birth details and the app highlights your Moon, Sun, and Ascendant placements across a ranked compatibility chart — each nakshatra shown with its planetary ruler, its *yoni* animal icon, and colour-coding by ruling planet.

All chart maths runs in the browser. Nothing about your birth details is stored — everything clears on refresh.

## What it does

- Renders a ranked **Ashtakoota (guna milan)** compatibility table — the traditional `/36` scoring used in Vedic astrology for marriage matching.
- Lets you enter a **birth date, time, and place** (or tick "No birth time" to skip the Ascendant), then highlights where your **Moon**, **Sun**, and **Ascendant** fall in the table.
- Computes sidereal planetary positions and nakshatras **locally** from a lightweight pure-JavaScript ephemeris — no external astrology API.
- Looks up birth places via a small serverless function that proxies the Open-Meteo geocoding API for autocomplete (returns name, latitude, longitude, and timezone).

## The scoring, briefly

The `/36` total is the sum of the eight kootas (gunas): **Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot, and Nadi**. As a rough convention, a score below 18 sits under the usual suitability threshold and 18+ meets it, with higher totals indicating an easier match. The Moon placement is traditionally weighted most heavily for compatibility, while the Sun and Ascendant speak more to soul/self and outward expression.

The full 36-guna framework appears in later Jyotish texts; in-app links point to reference material if you want to read further or run a full chart yourself.

## How it works

| Piece | Role |
|---|---|
| `index.html` | Page structure and the static compatibility table |
| `styles.css` | Layout, colour theming, planet/animal pill styling |
| `script.js` | Form handling, place autocomplete, and the highlight logic |
| `vedic-ephemeris.mjs` | Zero-dependency sidereal ephemeris — computes tropical longitudes via Jean Meeus algorithms, subtracts the Lahiri ayanamsa, and derives nakshatras, rashis, and the Ascendant |
| `functions/api/places.js` | Cloudflare Pages Function that proxies Open-Meteo geocoding for place search |
| `*.png` | Glyphs for planets (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn) and nodes (Rahu and Ketu) |

The ephemeris is accurate to roughly an arcminute for the Sun and Moon, and to within about half a degree for the outer planets.

## Tech stack

- Vanilla **HTML / CSS / JavaScript** (ES modules — no build step, no framework)
- **Cloudflare Pages** for hosting, with a **Pages Function** for the geocoding proxy
- **Open-Meteo** geocoding API for place lookup

## Privacy

Birth details are used only to compute placements in your browser for the current session. They aren't persisted, logged, or sent anywhere except the place name you type, which goes to the geocoding proxy purely to resolve coordinates.

## Credits

- Sidereal ephemeris adapted from [`vedic-ephemeris`](https://github.com/heirmez/vedic-ephemeris) (MIT).
- Geocoding by [Open-Meteo](https://open-meteo.com/).

## License

The bundled ephemeris is MIT-licensed (see credits). The rest of this repository has no license file yet — if you'd like others to be able to reuse it, consider adding one (e.g. MIT). Until then, default copyright applies.
