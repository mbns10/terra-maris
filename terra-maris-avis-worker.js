// TERRA MARIS : avis Google en direct (Cloudflare Worker)
// Variables à définir dans Cloudflare (Settings > Variables) :
//   PLACE_ID        l'identifiant de lieu Google (commence par ChIJ...)
//   GOOGLE_API_KEY  clé API Google Cloud (Places API (New)), en "Secret"
//   ALLOWED_ORIGIN  l'adresse de votre site, ex. https://terramaris.ma
// Résultat mis en cache 6 h pour limiter les appels à Google.

export default {
  async fetch(req, env, ctx) {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Cache-Control": "public, max-age=21600",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers });

    const cache = caches.default;
    const key = new Request(new URL(req.url).origin + "/avis");
    const hit = await cache.match(key);
    if (hit) return hit;

    const g = await fetch(
      `https://places.googleapis.com/v1/places/${env.PLACE_ID}?languageCode=fr`,
      {
        headers: {
          "X-Goog-Api-Key": env.GOOGLE_API_KEY,
          "X-Goog-FieldMask": "rating,userRatingCount,reviews",
        },
      }
    );
    if (!g.ok) {
      return new Response(JSON.stringify({ error: "google_" + g.status }), {
        status: 502,
        headers: { ...headers, "Cache-Control": "no-store" },
      });
    }
    const p = await g.json();
    const body = JSON.stringify({
      rating: p.rating || null,
      count: p.userRatingCount || 0,
      // Google renvoie au maximum 5 avis ; ils sont affichés tels quels.
      reviews: (p.reviews || [])
        .map((v) => ({
          text: (v.text && v.text.text) || (v.originalText && v.originalText.text) || "",
          author: (v.authorAttribution && v.authorAttribution.displayName) || "",
          stars: v.rating || 5,
          when: v.relativePublishTimeDescription || "",
        }))
        .filter((v) => v.text),
    });
    const res = new Response(body, { headers });
    ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  },
};
