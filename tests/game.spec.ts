import { test, expect } from "@playwright/test";

test("solo race has a cutscene, working powerups, pause, and a clean return to the lobby", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.clock.install();
  await page.goto("/");
  await page.locator('[data-character="panda"]').click();
  await page.locator('[data-track="candy"]').click();
  await page.reload();
  await expect(page.locator('[data-character="panda"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#track-select")).toHaveValue("candy");
  await page.getByRole("button", { name: "Bắt đầu đua", exact: true }).click();
  await expect(page.locator("#race-canvas")).toBeVisible();
  await expect(page.locator("#cinematic")).toContainText("Thung Lũng Kẹo");
  await expect(page.locator("#countdown")).not.toBeEmpty();
  await page.clock.runFor(8500);
  await expect(page.locator("#cinematic")).toHaveClass(/finished/);
  expect(Number(await page.locator("#hud-speed").innerText())).toBeGreaterThan(
    50,
  );
  await expect(page.locator("#use-powerup")).toHaveClass(/has-powerup/);
  await expect(page.locator("#powerup-popup")).toContainText(
    "NHẶT ĐƯỢC POWER-UP!",
  );
  await page.getByRole("button", { name: "Kích hoạt power-up" }).click();
  await page.clock.runFor(120);
  await expect(page.locator("#use-powerup")).not.toHaveClass(/has-powerup/);
  await expect(page.locator("#powerup-popup")).toHaveClass(/show/);
  await expect(page.locator("#powerup-popup")).toContainText(
    "KHOẢNH KHẮC BỨT PHÁ",
  );
  await page.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hít thở. Rồi lại hết ga." }),
  ).toBeVisible();
  const pausedTime = await page.locator("#hud-time").innerText();
  await page.clock.runFor(2000);
  await expect(page.locator("#hud-time")).toHaveText(pausedTime);
  await page.getByRole("button", { name: "Tiếp tục đua" }).click();
  await page.clock.runFor(1000);
  await expect(page.locator("#hud-time")).not.toHaveText(pausedTime);
  await page.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await page.getByRole("button", { name: "Về sảnh đua", exact: true }).click();
  await expect(page.locator("#race-screen")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveClass(/is-racing/);
  await expect(
    page.getByRole("heading", { name: "Chào tay đua, lên xe thôi!" }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("finishing three laps saves a result that survives reload", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 800, height: 600 });
  await page.clock.install();
  await page.addInitScript(() => {
    // The preceding test checks pixels and controls. Here we run every physics
    // frame and natural finish event, but sample raster output to keep the full
    // three-lap persistence check fast on machines using software rendering.
    let frames = 0;
    let paintFrame = true;
    const drawingMethods = [
      "fillRect",
      "strokeRect",
      "clearRect",
      "beginPath",
      "closePath",
      "moveTo",
      "lineTo",
      "arc",
      "ellipse",
      "quadraticCurveTo",
      "bezierCurveTo",
      "roundRect",
      "rect",
      "fill",
      "stroke",
      "save",
      "restore",
      "translate",
      "rotate",
      "scale",
      "transform",
      "setTransform",
      "resetTransform",
      "fillText",
      "strokeText",
      "drawImage",
      "clip",
    ];
    const context = CanvasRenderingContext2D.prototype as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    for (const method of drawingMethods) {
      const original = context[method];
      if (original)
        context[method] = function (...args: unknown[]) {
          if (paintFrame) return original.apply(this, args);
        };
    }
    window.requestAnimationFrame = (callback) =>
      window.setTimeout(() => {
        frames += 1;
        paintFrame = frames < 4 || frames % 250 === 0;
        callback(performance.now());
      }, 40);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Bắt đầu đua", exact: true }).click();
  // Advance browser time through real animation frames, physics and pickups.
  // No synthetic finish event or direct mutation of the game's private state.
  // Driving without steering now loses time on the shoulder and finishes last.
  await page.clock.runFor(220_000);
  await expect(page.locator(".finish-panel")).toBeVisible();
  const result = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("turbo-buddies-profile") || "{}"),
  );
  expect(result.races).toBe(1);
  expect(result.results).toHaveLength(1);
  expect(result.results[0].time).toBeGreaterThan(60);
  expect(result.results[0].position).toBe(4);
  expect(result.results[0].online).toBe(false);
  await page.getByRole("button", { name: "Về sảnh đua", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Thành tích", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await expect(page.locator(".history-row")).toContainText("Đảo Nắng Vàng");
  await expect(page.locator(".badge-card.unlocked").first()).toContainText(
    "Chặng đầu tiên",
  );
});

test("mobile layout exposes playable touch controls without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Bắt đầu đua", exact: true }).click();
  await page.clock.runFor(7000);
  await expect(
    page.getByRole("button", { name: "Rẽ trái", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rẽ phải", exact: true }),
  ).toBeVisible();
  const speed = Number(await page.locator("#hud-speed").innerText());
  const brake = page.getByRole("button", { name: "Phanh", exact: true });
  const brakeBounds = await brake.boundingBox();
  expect(brakeBounds).not.toBeNull();
  await page.mouse.move(
    brakeBounds!.x + brakeBounds!.width / 2,
    brakeBounds!.y + brakeBounds!.height / 2,
  );
  await page.mouse.down();
  await page.clock.runFor(1200);
  expect(Number(await page.locator("#hud-speed").innerText())).toBeLessThan(
    speed - 15,
  );
  await page.mouse.up();
  await page.clock.runFor(1500);
  expect(Number(await page.locator("#hud-speed").innerText())).toBeGreaterThan(
    speed - 20,
  );
  await page.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await page.getByRole("button", { name: "Về sảnh đua", exact: true }).click();
  await expect(page.locator("#race-canvas")).toHaveCount(0);
});
