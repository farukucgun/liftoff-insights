// Lets Android install the site as an app (and list it in the share menu), and keeps the
// app usable without a connection (weak signal at the gym, Tailscale off).
// Always network first, so online you get the server's latest code and data; the copy
// cached here is only used when the network fails. Settings (/api/) are never cached.
const CACHE = "liftoff-insights";
// The guest copy (registered as sw.js?guest) has no server to take a shared file, so it's
// handed to the page through this cache instead. See takeLocalShare() in js/app.js.
const GUEST = new URL(location.href).searchParams.has("guest");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (GUEST && req.method === "POST" && url.href === new URL("share", self.registration.scope).href) return e.respondWith(takeShare(req));
  if (req.method !== "GET" || url.pathname.startsWith("/api/")) return;
  if (url.origin !== location.origin && url.hostname !== "cdnjs.cloudflare.com") return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        // Libraries from cdnjs load as opaque responses; those are fine to keep too.
        if (res.ok || res.type === "opaque") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || Response.error())),
  );
});

async function takeShare(req) {
  try {
    const file = (await req.formData()).get("file");
    if (file) {
      const cache = await caches.open("liftoff-shared");
      await cache.put("__shared.csv", new Response(file));
    }
  } catch (err) { /* the page reports a missing file */ }
  return Response.redirect(new URL("./?import=local", self.registration.scope).href, 303);
}
