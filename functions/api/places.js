export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (!q || q.length < 3) {
    return json([]);
  }

  const searchUrl = new URL("https://nominatim.openstreetmap.org/search");
  searchUrl.searchParams.set("q", q);
  searchUrl.searchParams.set("format", "jsonv2");
  searchUrl.searchParams.set("limit", "5");
  searchUrl.searchParams.set("addressdetails", "1");

  const response = await fetch(searchUrl.toString(), {
    headers: {
      "User-Agent": "compatibility-site/1.0"
    }
  });

  if (!response.ok) {
    return json([], 500);
  }

  const data = await response.json();

  const cleaned = (Array.isArray(data) ? data : []).map((item) => ({
    display_name: item.display_name,
    lat: item.lat,
    lon: item.lon
  }));

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
