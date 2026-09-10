import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const template = await readFile(
  new URL("../scripts/service-worker.js", import.meta.url),
  "utf8",
);
const base = "https://example.github.io/CuocDuaKyThu/";
const prefix = "turbo-buddies:/CuocDuaKyThu/:";

// Exercise the shipped worker's callbacks against an in-memory CacheStorage.
// addAll models the browser's atomic batch commit, including download failures.
function harness() {
  const records = new Map();
  const failures = new Set();
  let claims = 0;
  const caches = {
    has: async (key) => records.has(key),
    keys: async () => [...records.keys()],
    delete: async (key) => records.delete(key),
    async open(key) {
      if (!records.has(key)) records.set(key, new Map());
      const entries = records.get(key);
      return {
        async addAll(requests) {
          const downloaded = await Promise.all(
            requests.map(async (request) => {
              if (failures.has(request.url)) throw new Error("HTTP 503");
              return [request.url, `cached:${request.url}`];
            }),
          );
          for (const [url, body] of downloaded) entries.set(url, body);
        },
        keys: async () => [...entries.keys()].map((url) => new Request(url)),
        match: async (url) =>
          entries.has(url) ? new Response(entries.get(url)) : undefined,
      };
    },
  };
  function worker(version) {
    const listeners = new Map();
    const files = ["index.html", `assets/${version}.js`, "icons/icon.png"];
    vm.runInNewContext(
      template
        .replace("__BUILD_VERSION__", JSON.stringify(version))
        .replace("__PRECACHE_FILES__", JSON.stringify(files)),
      {
        URL,
        Request,
        caches,
        fetch: async (request) => new Response(`network:${request.url}`),
        self: {
          location: { href: base + "sw.js" },
          addEventListener: (name, listener) => listeners.set(name, listener),
          clients: {
            claim: async () => {
              claims++;
            },
          },
        },
      },
    );
    return {
      async dispatch(type, event = {}) {
        let pending;
        listeners.get(type)({
          ...event,
          waitUntil: (promise) => {
            pending = promise;
          },
          respondWith: (promise) => {
            pending = promise;
          },
        });
        return await pending;
      },
      async status() {
        let response;
        await this.dispatch("message", {
          source: { url: base },
          data: { type: "APP_STATUS" },
          ports: [
            {
              postMessage: (data) => {
                response = data;
              },
            },
          ],
        });
        return response;
      },
    };
  }
  return {
    records,
    failures,
    worker,
    get claims() {
      return claims;
    },
  };
}

test("failed release cannot displace the working release or a sibling app's cache", async () => {
  const app = harness();
  const sibling = "turbo-buddies:/AnotherGame/:v1";
  app.records.set(
    sibling,
    new Map([
      ["https://example.github.io/AnotherGame/index.html", "other app"],
    ]),
  );
  await app.worker("v1").dispatch("install");
  app.failures.add(base + "icons/icon.png");
  await assert.rejects(app.worker("v2").dispatch("install"), /HTTP 503/);
  assert.equal(app.records.has(prefix + "v2"), false);
  assert.equal(app.records.get(prefix + "v1").size, 3);
  app.failures.clear();
  const newest = app.worker("v3");
  await newest.dispatch("install");
  await newest.dispatch("activate");
  assert.deepEqual(
    [...app.records.keys()],
    [sibling, prefix + "v1", prefix + "v3"],
  );
  assert.equal((await newest.status()).ready, true);
  assert.equal(app.claims, 1);
  const oldAsset = await newest.dispatch("fetch", {
    request: new Request(base + "assets/v1.js"),
  });
  assert.equal(await oldAsset.text(), `cached:${base}assets/v1.js`);
  assert.equal(app.records.get(sibling).values().next().value, "other app");
});

test("failed reinstall preserves an existing complete cache atomically", async () => {
  const app = harness();
  const worker = app.worker("v1");
  await worker.dispatch("install");
  const original = [...app.records.get(prefix + "v1")];
  app.failures.add(base + "icons/icon.png");
  await assert.rejects(worker.dispatch("install"), /HTTP 503/);
  assert.deepEqual([...app.records.get(prefix + "v1")], original);
  assert.equal((await worker.status()).ready, true);
  assert.equal(app.claims, 0);
});

test("activation drops incomplete and stale releases only within this app's scope", async () => {
  const app = harness();
  const sibling = "turbo-buddies:/CuocDuaKyThuExtra/:v1";
  app.records.set(sibling, new Map([["sibling", "keep"]]));
  await app.worker("v0").dispatch("install");
  await app.worker("v1").dispatch("install");
  app.records.set(prefix + "failed-legacy", new Map());
  const worker = app.worker("v3");
  await worker.dispatch("install");
  await worker.dispatch("activate");
  assert.deepEqual(
    [...app.records.keys()],
    [sibling, prefix + "v1", prefix + "v3"],
  );
  for (const url of [
    "https://example.github.io/CuocDuaKyThuExtra/assets/v1.js",
    "https://other.example/CuocDuaKyThu/assets/v1.js",
  ])
    assert.equal(
      await worker.dispatch("fetch", { request: new Request(url) }),
      undefined,
    );
  const shell = await worker.dispatch("fetch", {
    request: { url: base + "?room=ABC123", method: "GET", mode: "navigate" },
  });
  assert.equal(await shell.text(), `cached:${base}index.html`);
});
