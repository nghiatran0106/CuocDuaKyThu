import { test, expect } from "@playwright/test";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test.describe(`race navigation at ${viewport.width} × ${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true });

    test("maps the circuit and moving racers without covering touch controls", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.clock.install();
      await page.goto("/");
      await page
        .getByRole("button", { name: "Bắt đầu đua", exact: true })
        .click();
      await page.clock.runFor(7000);

      const map = page.getByRole("complementary", { name: "Bản đồ đường đua" });
      const route = page.locator(".minimap-road");
      const player = page.locator('.minimap-racer[data-player="true"]');
      await expect(map).toBeVisible();
      await expect(route).toHaveAttribute("d", /Z$/);
      await expect(page.locator(".minimap-start")).toHaveCount(1);
      await expect(page.locator(".minimap-racer")).toHaveCount(4);
      await expect(player).toHaveCount(1);
      const transforms = await page
        .locator(".minimap-racer")
        .evaluateAll((markers) =>
          markers.map((marker) => marker.getAttribute("transform")),
        );
      const originalRoute = await route.elementHandle();
      await page.clock.runFor(1300);
      const nextTransforms = await page
        .locator(".minimap-racer")
        .evaluateAll((markers) =>
          markers.map((marker) => marker.getAttribute("transform")),
        );
      transforms.forEach((transform, index) =>
        expect(nextTransforms[index]).not.toBe(transform),
      );
      expect(
        await route.evaluate(
          (node, original) => node === original,
          originalRoute,
        ),
      ).toBe(true);
      await expect(page.locator("#hud-corner-name")).not.toHaveText(
        "Đường đua sẵn sàng",
      );
      await expect(page.locator("#hud-corner-speed")).not.toBeEmpty();

      const bounds = await page
        .locator(
          ".race-minimap, .corner-advice, .game-top-right, [data-input], .powerup-slot",
        )
        .evaluateAll((elements) =>
          elements.map((element) => {
            const rectangle = element.getBoundingClientRect();
            return {
              x: rectangle.x,
              y: rectangle.y,
              right: rectangle.right,
              bottom: rectangle.bottom,
              name: element.className || element.getAttribute("aria-label"),
            };
          }),
        );
      const navigation = bounds.filter(
        (entry) =>
          entry.name === "race-minimap" ||
          String(entry.name).startsWith("corner-advice"),
      );
      const controls = bounds.filter((entry) => !navigation.includes(entry));
      for (const panel of navigation) {
        expect(panel.x).toBeGreaterThanOrEqual(0);
        expect(panel.y).toBeGreaterThanOrEqual(0);
        expect(panel.right).toBeLessThanOrEqual(viewport.width);
        expect(panel.bottom).toBeLessThanOrEqual(viewport.height);
        for (const control of controls) {
          const overlap =
            panel.x < control.right &&
            panel.right > control.x &&
            panel.y < control.bottom &&
            panel.bottom > control.y;
          expect(overlap, `${panel.name} overlaps ${control.name}`).toBe(false);
        }
      }
      await expect(
        page.getByRole("button", { name: "Phanh", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Drift", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `/tmp/turbo-hud-${viewport.width}x${viewport.height}.png`,
      });
      expect(errors).toEqual([]);
    });
  });
}
