/**
 * A CORS shim for Technocore, small enough to read in one sitting.
 *
 * Why this exists: https://technocore.chat runs with `CHAT_CORS_ORIGINS` unset, which is
 * the server's default and means no browser origin is trusted. A page can send it requests
 * but never read the replies — confirmed in Firefox as
 *
 *     Cross-Origin Request Blocked: … (Reason: CORS header
 *     'Access-Control-Allow-Origin' missing). Status code: 200.
 *
 * Status 200: the request arrived and was answered. Only the browser withheld it. Reading a
 * room is the entire product, so Agent Relay cannot work against that instance from a
 * browser without either the operator setting `CHAT_CORS_ORIGINS`, you running your own
 * Technocore, or this.
 *
 * Deploy:
 *   npx wrangler deploy proxy/cloudflare-worker.js --name technocore-cors
 *   npx wrangler secret put ALLOWED_ORIGINS      # e.g. https://you.github.io
 *
 * Then open Agent Relay with ?technocore=https://technocore-cors.<you>.workers.dev
 * (it is remembered), or set the TECHNOCORE_BASE_URL repository variable to bake it in.
 *
 * ── What this costs you, stated plainly ───────────────────────────────────────────────
 *
 * 1. RATE LIMITS COLLAPSE ONTO ONE IP. Technocore's token buckets are per client IP, and
 *    every request through this worker arrives from the worker. Its whole userbase shares
 *    one budget: 120 reads and 30 writes a minute, and 20 new rooms a day. Fine for you and
 *    a few relays; not something to hand to strangers, which is why ALLOWED_ORIGINS is not
 *    optional and does not default to `*`.
 *
 * 2. IT CAN SEE AND CHANGE EVERYTHING. Relay rooms are world-readable already, so a proxy
 *    reading them leaks nothing new. Integrity is the real cost: whatever this returns is
 *    what the page believes, including the `from` field that decides whether a writer shows
 *    as verified. Run your own. Do not point Agent Relay at somebody else's CORS proxy, and
 *    do not point it at a public one.
 *
 * It forwards to Technocore and nowhere else, passes only GET, POST and OPTIONS, and adds
 * no credentials — there are none to add.
 */

const DEFAULT_UPSTREAM = "https://technocore.chat";
const ALLOWED_METHODS = new Set(["GET", "POST", "OPTIONS"]);

/** Set UPSTREAM if you point this at your own Technocore rather than the public one. */
function upstreamOf(env) {
  return String(env.UPSTREAM ?? DEFAULT_UPSTREAM).replace(/\/+$/, "");
}

/** Origins this worker will answer for. No wildcard: see note 1 above. */
function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    // The origin decides the response, so caches must not serve one origin's reply to
    // another's request.
    vary: "Origin",
  };
}

const handler = {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";
    const allowed = allowedOrigins(env);

    if (allowed.length === 0) {
      return new Response(
        "This proxy has no ALLOWED_ORIGINS configured, so it will not forward anything.\n" +
          "Set it to the origin you serve Agent Relay from:\n" +
          "  npx wrangler secret put ALLOWED_ORIGINS\n",
        { status: 500, headers: { "content-type": "text/plain" } },
      );
    }

    if (!allowed.includes(origin)) {
      // No CORS headers on this reply, deliberately: an origin this proxy does not serve
      // should fail the same way it would without a proxy at all.
      return new Response(`Origin not allowed by this proxy.\n`, {
        status: 403,
        headers: { "content-type": "text/plain" },
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!ALLOWED_METHODS.has(request.method)) {
      return new Response("Method not allowed.\n", {
        status: 405,
        headers: { ...corsHeaders(origin), "content-type": "text/plain" },
      });
    }

    // Path and query only. The upstream is fixed, so nothing a caller sends can redirect
    // this at another host.
    const incoming = new URL(request.url);
    const target = new URL(incoming.pathname + incoming.search, upstreamOf(env));

    let upstream;
    try {
      upstream = await fetch(target, {
        method: request.method,
        // Technocore needs no headers at all, and forwarding the browser's would only
        // widen what this passes along. Content-type is the one a JSON POST depends on.
        headers:
          request.method === "POST"
            ? { "content-type": request.headers.get("content-type") ?? "application/json" }
            : {},
        body: request.method === "POST" ? request.body : undefined,
        redirect: "follow",
      });
    } catch (err) {
      return new Response(`Upstream request failed: ${err}\n`, {
        status: 502,
        headers: { ...corsHeaders(origin), "content-type": "text/plain" },
      });
    }

    // Pass the body and status through untouched; replace the headers with our own, so an
    // upstream header can never contradict the CORS decision made above.
    const headers = new Headers(corsHeaders(origin));
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) headers.set("retry-after", retryAfter);
    headers.set("cache-control", "no-store");
    headers.set("x-content-type-options", "nosniff");

    return new Response(upstream.body, { status: upstream.status, headers });
  },
};

export default handler;
