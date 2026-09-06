import { test, expect } from "@playwright/test";

test("malformed saved results cannot inject markup or crash achievements", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      "turbo-buddies-profile",
      JSON.stringify({
        name: "<img src=x>",
        coins: "<img src=x onerror=alert(1)>",
        results: [
          {
            position: 1,
            time: 90,
            date: "2026-09-06T00:00:00Z",
            track: "tropical",
            character: "fox",
            coins: "<img src=x onerror=alert(1)>",
            drifts: {},
            boosts: null,
          },
          {
            position: 1,
            time: 90,
            date: {},
            track: "tropical",
            character: "fox",
            coins: 10,
          },
        ],
      }),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Thành tích", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await expect(page.locator(".history-coins")).toHaveText("+0");
  await expect(page.locator("img")).toHaveCount(0);
  expect(errors).toEqual([]);
});
