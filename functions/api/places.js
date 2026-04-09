export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (!q || q.length < 2) {
    return json([]);
  }

  const searchUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  searchUrl.searchParams.set("name", q);
  searchUrl.searchParams.set("count", "5");
  searchUrl.searchParams.set("language", "en");
  searchUrl.searchParams.set("format", "json");

  const response = await fetch(searchUrl.toString());

  if (!response.ok) {
    return json([], 500);
  }

  const data = await response.json();
  const results = Array.isArray(data?.results) ? data.results : [];

  const cleaned = results.map((item) => {
    const parts = [
      item.name,
      item.admin1,
      item.country
    ].filter(Boolean);

    return {
      display_name: parts.join(", "),
      lat: Number(item.latitude),
      lon: Number(item.longitude)
    };
  });

  return json(cleaned);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
