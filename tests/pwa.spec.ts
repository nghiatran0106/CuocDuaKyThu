import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pwa-chromium",
    "Run against a production build with npm run test:pwa.",
  );
});

async function readyOffline(page: Page) {
  await page.goto("./");
  await expect(page.locator('script[src*="/@vite/client"]')).toHaveCount(0);
  await expect(page.locator('script[src*="/assets/"]')).toHaveCount(1);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect(page.locator("#app-install-card")).toHaveAttribute(
    "data-offline-ready",
    "true",
  );
  // The next navigation must actually be served under this worker's control.
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await expect(page.locator("#app-install-card")).toHaveAttribute(
    "data-offline-ready",
    "true",
  );
}

test("production manifest and real PNG icons install within the deployed subpath", async ({
  page,
}) => {
  await page.goto("./");
  const manifestURL = await page
    .locator('link[rel="manifest"]')
    .evaluate((link: HTMLLinkElement) => link.href);
  const response = await page.request.get(manifestURL);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toContain("Turbo Buddies");
  expect(manifest.start_url).toBe("./");
  expect(manifest.scope).toBe("./");
  expect(manifest.display).toBe("standalone");
  expect(new URL(manifest.start_url, manifestURL).pathname).toBe(
    "/CuocDuaKyThu/",
  );
  expect(new URL(manifest.scope, manifestURL).pathname).toBe("/CuocDuaKyThu/");
  const icons = manifest.icons as {
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }[];
  expect(icons.some(({ sizes }) => sizes === "192x192")).toBe(true);
  expect(icons.some(({ sizes }) => sizes === "512x512")).toBe(true);
  expect(
    icons.some(
      ({ sizes, purpose }) =>
        sizes === "512x512" && purpose?.split(" ").includes("maskable"),
    ),
  ).toBe(true);
  for (const icon of icons) {
    expect(icon.type).toBe("image/png");
    const iconResponse = await page.request.get(
      new URL(icon.src, manifestURL).href,
    );
    expect(iconResponse.ok()).toBe(true);
    const png = await iconResponse.body();
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
  }
  const appleIconURL = await page
    .locator('link[rel="apple-touch-icon"]')
    .evaluate((link: HTMLLinkElement) => link.href);
  const appleIcon = await page.request.get(appleIconURL);
  expect(appleIcon.ok()).toBe(true);
  const applePNG = await appleIcon.body();
  expect([...applePNG.subarray(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  expect([applePNG.readUInt32BE(16), applePNG.readUInt32BE(20)]).toEqual([
    180, 180,
  ]);
});

test("offline-ready means the production shell, scripts, styles, fonts and icons are cached", async ({
  page,
  baseURL,
}) => {
  await readyOffline(page);
  const cache = await page.evaluate(async () => {
    const requests = (
      await Promise.all(
        (await caches.keys()).map(async (name) =>
          (await caches.open(name)).keys(),
        ),
      )
    ).flat();
    const resources = [...new Set(requests.map(({ url }) => url))];
    const required = [
      ...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
        'script[src], link[rel="stylesheet"], link[rel="manifest"], link[rel="apple-touch-icon"]',
      ),
    ].map((node) => (node instanceof HTMLScriptElement ? node.src : node.href));
    return {
      resources,
      required,
      controlledURL: navigator.serviceWorker.controller?.scriptURL,
    };
  });
  expect(cache.controlledURL?.startsWith(baseURL!)).toBe(true);
  for (const url of cache.required) expect(cache.resources).toContain(url);
  expect(cache.resources.some((url) => /\/assets\/.*\.js$/.test(url))).toBe(
    true,
  );
  expect(cache.resources.some((url) => /\/assets\/.*\.css$/.test(url))).toBe(
    true,
  );
  expect(cache.resources.some((url) => /\.woff2?$/.test(url))).toBe(true);
  expect(cache.resources.some((url) => /\.png$/.test(url))).toBe(true);
  expect(
    cache.resources.some(
      (url) => url === baseURL || url === new URL("index.html", baseURL).href,
    ),
  ).toBe(true);
});

test("cached app reloads offline, preserves choices, and runs a solo race", async ({
  page,
  context,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await readyOffline(page);
  await page.locator('[data-track="candy"]').click();
  await page.locator('[data-character="bunny"]').click();
  await page
    .getByRole("button", { name: "Hồ sơ và cài đặt", exact: true })
    .click();
  await page.locator("#player-name").fill("Offline Racer");
  await page.getByRole("button", { name: "Lưu lựa chọn" }).click();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Chào tay đua, lên xe thôi!" }),
  ).toBeVisible();
  await expect(page.locator("#app-install-card")).toHaveAttribute(
    "data-online",
    "false",
  );
  await expect(page.locator("#app-install-status")).toContainText(
    "ngoại tuyến",
  );
  await expect(page.locator("#track-select")).toHaveValue("candy");
  await expect(page.locator('[data-character="bunny"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Hồ sơ và cài đặt", exact: true }),
  ).toContainText("Offline Racer");
  // Clock installation follows service-worker activation and precaching. Fake
  // browser timers during SW startup can otherwise leave readiness unresolved.
  await page.clock.install();
  await page.getByRole("button", { name: "Bắt đầu đua", exact: true }).click();
  await expect(page.locator("#race-canvas")).toBeVisible();
  await expect(page.locator("#cinematic")).toContainText("Thung Lũng Kẹo");
  await page.clock.runFor(8500);
  expect(Number(await page.locator("#hud-speed").innerText())).toBeGreaterThan(
    50,
  );
  await expect(page.locator("#hud-time")).not.toHaveText("00:00");
  await page.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await page.getByRole("button", { name: "Về sảnh đua", exact: true }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("turbo-buddies-profile") || "{}"),
  );
  expect(saved).toMatchObject({
    name: "Offline Racer",
    track: "candy",
    character: "bunny",
  });
  expect(pageErrors).toEqual([]);
});

test("an uncached room query opens offline with a useful multiplayer explanation", async ({
  page,
  context,
  baseURL,
}) => {
  await readyOffline(page);
  await context.setOffline(true);
  // This query was never visited online; navigation must normalize to the
  // cached application shell instead of needing a cache entry per room code.
  await page.goto(new URL("?room=ABC123&source=offline-test", baseURL).href);
  await expect(
    page.getByRole("heading", { name: "Chào tay đua, lên xe thôi!" }),
  ).toBeVisible();
  await expect(page.locator("#app-install-card")).toHaveAttribute(
    "data-online",
    "false",
  );
  await expect(page.locator("#offline-friends")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Đua cùng bạn cần có mạng",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("#create-room")).toHaveCount(0);
  await expect(page.locator("#join-room-form")).toHaveCount(0);
  await page
    .locator("#offline-friends")
    .getByRole("button", { name: "Đua với máy", exact: true })
    .click();
  await expect(page.locator("#race-canvas")).toBeVisible();
});

test("install CTA invokes the captured browser prompt and disappears after installation", async ({
  page,
}) => {
  await readyOffline(page);
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    const choice = Promise.resolve({ outcome: "accepted", platform: "web" });
    (window as any).installPromptCalls = 0;
    Object.assign(event, {
      platforms: ["web"],
      userChoice: choice,
      prompt: async () => {
        (window as any).installPromptCalls++;
        return choice;
      },
    });
    window.dispatchEvent(event);
    (window as any).installPromptPrevented = event.defaultPrevented;
  });
  await expect(page.locator("#app-install-button")).toBeVisible();
  await page
    .getByRole("button", { name: "Cài Turbo Buddies", exact: true })
    .click();
  expect(await page.evaluate(() => (window as any).installPromptCalls)).toBe(1);
  expect(
    await page.evaluate(() => (window as any).installPromptPrevented),
  ).toBe(true);
  // appinstalled represents the browser's completion notification. A mocked
  // prompt alone does not claim an actual operating-system installation.
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(page.locator("#app-install-card")).toHaveAttribute(
    "data-installed",
    "true",
  );
  await expect(page.locator("#app-install-button")).toBeHidden();
  await expect(page.locator(".app-installed-badge")).toContainText(
    "Đã cài trên thiết bị",
  );
});

test("phone layouts keep installation controls readable and explain the iOS steps", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await readyOffline(page);
  for (const [width, height] of [
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.locator("#app-install-card").scrollIntoViewIfNeeded();
    await expect(page.locator("#app-install-button")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const screenshot = await page.screenshot({ fullPage: true });
    await test.info().attach(`install-${width}.png`, {
      body: screenshot,
      contentType: "image/png",
    });
    await page.screenshot({
      path: `/tmp/turbo-install-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  // Select the iOS-specific instructions without pretending Chromium is Safari.
  await page.evaluate(() =>
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Cách cài trên điện thoại" }).click();
  const guide = page.locator("#app-install-guide");
  await expect(guide).toBeVisible();
  for (const step of [
    "Safari",
    "Chia sẻ",
    "Thêm vào MH chính",
    "Mở dưới dạng ứng dụng web",
  ])
    await expect(guide).toContainText(step);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/turbo-install-ios-guide.png",
    fullPage: true,
  });
});

test("a waiting production worker preserves active races across tabs until a safe lobby update", async ({
  page,
  context,
}) => {
  await readyOffline(page);
  const otherLobby = await context.newPage();
  await readyOffline(otherLobby);
  let otherNavigations = 0;
  otherLobby.on("framenavigated", (frame) => {
    if (frame === otherLobby.mainFrame()) otherNavigations++;
  });
  await page.bringToFront();
  const initialController = await page.evaluate(
    () => navigator.serviceWorker.controller!.scriptURL,
  );
  await page.locator('[data-track="candy"]').click();
  await page.getByRole("button", { name: "Bắt đầu đua", exact: true }).click();
  await expect(page.locator("#race-canvas")).toBeVisible();
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  const updateURL = await page.evaluate(async () => {
    const registration = (await navigator.serviceWorker.getRegistration())!;
    const revision = new URL(registration.active!.scriptURL);
    // Changing only this test context's registered script URL exercises the
    // actual production worker lifecycle, with no app source or server edits.
    revision.searchParams.set("pwa-test-revision", "race-update");
    await navigator.serviceWorker.register(revision, {
      scope: registration.scope,
      updateViaCache: "none",
    });
    return revision.href;
  });
  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
      ),
    )
    .toBe(true);
  await expect(page.locator("#race-canvas")).toBeVisible();
  await expect(page.locator("#app-update-button")).toBeHidden();
  expect(
    await page.evaluate(() => navigator.serviceWorker.controller!.scriptURL),
  ).toBe(initialController);
  expect(navigations).toBe(0);
  await expect
    .poll(async () => Number(await page.locator("#hud-speed").innerText()))
    .toBeGreaterThan(50);
  await otherLobby.bringToFront();
  const otherUpdate = otherLobby.getByRole("button", {
    name: "Cập nhật ứng dụng",
    exact: true,
  });
  await expect(otherUpdate).toBeVisible();
  await otherUpdate.click();
  await expect(otherLobby.locator("#toast-root")).toContainText(
    "cửa sổ Turbo Buddies khác",
  );
  await expect(otherUpdate).toBeEnabled();
  expect(
    await otherLobby.evaluate(
      () => navigator.serviceWorker.controller!.scriptURL,
    ),
  ).toBe(initialController);
  expect(navigations).toBe(0);
  expect(otherNavigations).toBe(0);
  await page.bringToFront();
  // Switching tabs may already pause the race. Either way it remains protected
  // until the player explicitly exits the race screen.
  if (
    !(await page
      .getByRole("button", { name: "Về sảnh đua", exact: true })
      .isVisible())
  )
    await page.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await page.getByRole("button", { name: "Về sảnh đua", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cập nhật ứng dụng", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cập nhật ứng dụng", exact: true })
    .click();
  await expect.poll(() => navigations).toBe(1);
  await expect(
    page.getByRole("heading", { name: "Chào tay đua, lên xe thôi!" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => navigator.serviceWorker.controller!.scriptURL),
  ).toBe(updateURL);
  await expect(page.locator("#track-select")).toHaveValue("candy");
  expect(otherNavigations).toBe(0);
  await otherLobby.close();
});

test("an online revisit repairs evicted caches without unregistering the app", async ({
  page,
  context,
}) => {
  await readyOffline(page);
  const initial = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) =>
      name.startsWith("turbo-buddies:"),
    );
    const controllerURL = navigator.serviceWorker.controller!.scriptURL;
    await Promise.all(names.map((name) => caches.delete(name)));
    return { names, controllerURL, remaining: await caches.keys() };
  });
  expect(initial.names.length).toBeGreaterThan(0);
  for (const name of initial.names)
    expect(initial.remaining).not.toContain(name);
  // Keep the installed registration intact, as happens when browser storage
  // pressure removes Cache Storage. The same app version must repair itself.
  await page.reload();
  await expect(page.locator("#app-install-card")).toHaveAttribute(
    "data-offline-ready",
    "true",
    { timeout: 25_000 },
  );
  const repaired = await page.evaluate(async () => ({
    names: await caches.keys(),
    controllerURL: navigator.serviceWorker.controller!.scriptURL,
  }));
  expect(repaired.controllerURL).toBe(initial.controllerURL);
  for (const name of initial.names) expect(repaired.names).toContain(name);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Chào tay đua, lên xe thôi!" }),
  ).toBeVisible();
  await expect(page.locator("#app-install-card")).toHaveAttribute(
    "data-online",
    "false",
  );
  await expect(page.locator("#app-install-card")).toHaveAttribute(
    "data-offline-ready",
    "true",
  );
});
