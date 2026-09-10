// This template is emitted as dist/sw.js by build-pwa.mjs.
const VERSION = __BUILD_VERSION__;
const FILES = __PRECACHE_FILES__;
const BASE = new URL("./", self.location.href);
const PREFIX = `turbo-buddies:${BASE.pathname}:`;
const CACHE = PREFIX + VERSION;
const URLS = FILES.map((file) => new URL(file, BASE).href);
const SHELL = new URL("index.html", BASE).href;

self.addEventListener("install", (event) => {
  // addAll is atomic: a failed download never marks a partial app as ready.
  event.waitUntil(
    (async () => {
      const existed = await caches.has(CACHE);
      const cache = await caches.open(CACHE);
      try {
        await cache.addAll(
          URLS.map((url) => new Request(url, { cache: "reload" })),
        );
      } catch (error) {
        // An empty failed release must not displace the previous working one.
        // A script URL change may reuse an active release's cache; preserve it.
        if (!existed) await caches.delete(CACHE);
        throw error;
      }
    })(),
  );
  // Updates wait for an explicit safe activation from the lobby.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const previous = (await caches.keys()).filter(
        (key) => key.startsWith(PREFIX) && key !== CACHE,
      );
      // Keep one prior release for assets still referenced by another open tab.
      const completed = [];
      for (const key of previous) {
        if (await (await caches.open(key)).match(SHELL)) completed.push(key);
        else await caches.delete(key);
      }
      await Promise.all(
        completed.slice(0, -1).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== BASE.origin ||
    !url.pathname.startsWith(BASE.pathname)
  )
    return;
  if (request.mode === "navigate") {
    // One app shell serves room query links too. Keep HTML and hashed assets
    // on the same release until the player chooses to update.
    event.respondWith(
      caches
        .open(CACHE)
        .then(async (cache) => (await cache.match(SHELL)) || fetch(request)),
    );
    return;
  }
  const cleanURL = url.origin + url.pathname;
  if (
    !URLS.includes(cleanURL) &&
    !url.pathname.startsWith(BASE.pathname + "assets/")
  )
    return;
  event.respondWith(
    (async () => {
      const cached = await (await caches.open(CACHE)).match(cleanURL);
      if (cached) return cached;
      const previous = (await caches.keys()).filter(
        (key) => key.startsWith(PREFIX) && key !== CACHE,
      );
      for (const key of previous) {
        const old = await (await caches.open(key)).match(cleanURL);
        if (old) return old;
      }
      return fetch(request);
    })(),
  );
});

function canUpdate(client) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      resolve(false);
    }, 1800);
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(event.data?.safe === true);
    };
    client.postMessage({ type: "CAN_UPDATE" }, [channel.port2]);
  });
}

self.addEventListener("message", (event) => {
  const sourceURL = event.source?.url;
  if (!sourceURL || !sourceURL.startsWith(BASE.href)) return;
  if (event.data?.type === "APP_STATUS") {
    event.waitUntil(
      (async () => {
        const keys = await (await caches.open(CACHE)).keys();
        const cached = new Set(keys.map((key) => key.url));
        event.ports[0]?.postMessage({
          ready: URLS.every((url) => cached.has(url)),
          version: VERSION,
        });
      })(),
    );
  }
  if (event.data?.type === "CACHE_APP") {
    // Storage cleanup can evict the cache while leaving the worker registered.
    // Restore the same release when the player next opens the game online.
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(CACHE);
          await cache.addAll(
            URLS.map((url) => new Request(url, { cache: "reload" })),
          );
          event.ports[0]?.postMessage({ ready: true, version: VERSION });
        } catch {
          event.ports[0]?.postMessage({ ready: false, version: VERSION });
        }
      })(),
    );
  }
  if (event.data?.type === "ACTIVATE_UPDATE") {
    event.waitUntil(
      (async () => {
        const clients = (
          await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
          })
        ).filter((client) => client.url.startsWith(BASE.href));
        const safe = (await Promise.all(clients.map(canUpdate))).every(Boolean);
        event.ports[0]?.postMessage({ activated: safe });
        if (safe) await self.skipWaiting();
      })(),
    );
  }
});
