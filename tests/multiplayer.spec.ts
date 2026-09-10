import { test, expect, type Page } from "@playwright/test";
import {
  createCircuit,
  cornerSpeed,
  SEGMENT_COUNT,
  TRACK_LENGTH,
} from "../src/game/circuit";

type PaintedName = { x: number; y: number; count: number };
type DrivingSample = { progress: number; lane: number; speed: number };
type CanvasWindow = Window & {
  paintedNames: Record<string, PaintedName>;
  sentState?: DrivingSample;
  sentPowerups: string[];
  stopDriving?: () => void;
};

async function watchRenderedPlayers(page: Page, playerName: string) {
  await page.addInitScript((name) => {
    const target = window as unknown as CanvasWindow;
    target.paintedNames = {};
    target.sentPowerups = [];
    // Read the real JSON packets sent to WebRTC. Forward every packet unchanged;
    // the driver uses the same position updates that the remote player receives.
    const send = RTCDataChannel.prototype.send as (data: unknown) => void;
    const decoder = new TextDecoder();
    RTCDataChannel.prototype.send = function (data: unknown) {
      const json =
        typeof data === "string"
          ? data
          : data instanceof ArrayBuffer || ArrayBuffer.isView(data)
            ? decoder.decode(data)
            : null;
      if (json) {
        try {
          const packet = JSON.parse(json);
          if (packet.type === "state") {
            target.sentState =
              packet.state ||
              packet.players?.find(
                (player: { name: string }) => player.name === name,
              );
          }
          if (packet.type === "powerup") target.sentPowerups.push(packet.id);
        } catch {
          // Non-JSON transport traffic is not a game state update.
        }
      }
      send.call(this, data);
    };
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      maxWidth,
    ) {
      // Observe pixels the game actually draws; do not replace physics or network data.
      if (
        this.canvas.id === "race-canvas" &&
        ["Host Test", "Guest Test"].includes(text)
      ) {
        target.paintedNames[text] = {
          x,
          y,
          count: (target.paintedNames[text]?.count || 0) + 1,
        };
      }
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
  }, playerName);
}

async function driveCircuit(page: Page, collectBoxes: boolean) {
  const handling = collectBoxes ? 1.16 : 1;
  const route = createCircuit("candy");
  const circuit = {
    samples: route.samples.map((road) => ({
      curve: road.curve,
      width: road.width,
      safeSpeed: 2120 * cornerSpeed(road.curve, handling) * 0.95,
    })),
    boxStations: route.boxStations,
  };
  await page.evaluate(
    ({ collect, handling, circuit, segmentCount, trackLength }) => {
      const target = window as unknown as CanvasWindow;
      const held = new Set<string>();
      const press = (key: string, down: boolean) => {
        if (held.has(key) === down) return;
        if (down) held.add(key);
        else held.delete(key);
        window.dispatchEvent(
          new KeyboardEvent(down ? "keydown" : "keyup", {
            key,
            code: key,
            bubbles: true,
          }),
        );
      };
      let steeringRemainder = 0;
      const tick = () => {
        const state = target.sentState;
        if (!state || !document.getElementById("race-canvas")) return;
        const sample = (state.progress % 1) * segmentCount;
        const index = Math.floor(sample);
        const a = circuit.samples[index],
          b = circuit.samples[(index + 1) % segmentCount];
        const curve = a.curve + (b.curve - a.curve) * (sample - index);
        let targetLane = 0;
        if (collect) {
          // Approach each actual station in its lane, rather than expecting boxes
          // to appear on a timer or staying on the brake around the whole circuit.
          const station = circuit.boxStations
            .map((box) => ({
              ...box,
              ahead: (box.index - sample + segmentCount) % segmentCount,
            }))
            .sort((first, second) => first.ahead - second.ahead)[0];
          if (station.ahead < 32)
            targetLane = station.x * circuit.samples[station.index].width;
        }
        let safeSpeed = 2120;
        const ahead = Math.max(
          4,
          Math.ceil((state.speed * 1.4) / (trackLength / segmentCount)),
        );
        for (let offset = 0; offset <= ahead; offset++) {
          const road = circuit.samples[(index + offset) % segmentCount];
          safeSpeed = Math.min(safeSpeed, road.safeSpeed);
        }
        const remoteProgress = Number(
          document.querySelector<SVGGElement>(
            '.minimap-racer[data-player="false"]',
          )?.dataset.progress || 0,
        );
        // Leave the host ahead so firing a collected rocket has a real target.
        const followingHost =
          collect && remoteProgress - state.progress < 0.025;
        press("ArrowDown", state.speed > safeSpeed + 40 || followingHost);
        const ratio = state.speed / 2120;
        const correction =
          (curve * ratio * ratio * 0.34) /
          (0.92 * handling * (0.35 + ratio * 0.65));
        const steering = Math.max(
          -1,
          Math.min(1, correction + (targetLane - state.lane) * 3.5),
        );
        // Alternate ordinary left/right key presses to make small lane corrections.
        // The engine's existing steering smoothing remains responsible for motion.
        steeringRemainder += steering;
        const direction =
          steeringRemainder > 0.5 ? 1 : steeringRemainder < -0.5 ? -1 : 0;
        steeringRemainder -= direction;
        press("ArrowLeft", direction < 0);
        press("ArrowRight", direction > 0);
      };
      const timer = window.setInterval(tick, 50);
      tick();
      target.stopDriving = () => {
        window.clearInterval(timer);
        for (const key of [...held]) press(key, false);
      };
    },
    {
      collect: collectBoxes,
      handling,
      circuit,
      segmentCount: SEGMENT_COUNT,
      trackLength: TRACK_LENGTH,
    },
  );
}

async function requireConnection(
  page: Page,
  selector: string,
  externalFailures: string[],
) {
  try {
    await expect(page.locator(selector)).toBeVisible({ timeout: 16_000 });
  } catch (error) {
    const message = await page
      .locator("#network-status, #toast-root")
      .allTextContents();
    const reason = message.join(" ").trim();
    if (
      externalFailures.length ||
      /Kết nối quá 12 giây|Mất kết nối dịch vụ|Hai thiết bị chưa kết nối|Không kết nối được với chủ phòng/.test(
        reason,
      )
    ) {
      test.skip(
        true,
        `Public PeerJS/WebRTC unavailable: ${reason || externalFailures.join("; ")}`,
      );
    }
    throw error;
  }
}

test("two browser sessions join the same room, race together, and close cleanly", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const guestContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const externalFailures: string[] = [];
  const pageErrors: string[] = [];
  for (const page of [host, guest]) {
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      if (request.url().includes("peerjs.com"))
        externalFailures.push(
          request.failure()?.errorText || "PeerJS request failed",
        );
    });
    await watchRenderedPlayers(
      page,
      page === host ? "Host Test" : "Guest Test",
    );
  }

  try {
    await Promise.all([host.goto(baseURL!), guest.goto(baseURL!)]);
    await host.locator('[data-track="candy"]').click();
    await guest.locator('[data-character="bunny"]').click();
    await host.getByRole("button", { name: "Rủ bạn cùng đua" }).click();
    await host.locator("#room-name").fill("Host Test");
    await host.getByRole("button", { name: "Tạo phòng mới" }).click();
    await requireConnection(host, ".room-code-display", externalFailures);
    const code = (
      await host.locator(".room-code-display strong").innerText()
    ).trim();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    await expect(host.locator("#start-online")).toBeDisabled();

    await guest.getByRole("button", { name: "Rủ bạn cùng đua" }).click();
    await guest.locator("#room-name").fill("Guest Test");
    await guest.getByRole("textbox", { name: "Mã phòng" }).fill(code);
    await guest.getByRole("button", { name: "Vào phòng", exact: true }).click();
    await requireConnection(guest, ".room-code-display", externalFailures);
    for (const page of [host, guest]) {
      await expect(page.locator(".room-player:not(.empty)")).toHaveCount(2);
      await expect(page.locator(".room-players")).toContainText("Host Test");
      await expect(page.locator(".room-players")).toContainText("Guest Test");
    }
    await expect(guest.locator("#start-online")).toHaveCount(0);
    await host.getByRole("button", { name: "Cả đội xuất phát!" }).click();
    await Promise.all([
      expect(host.locator("#race-canvas")).toBeVisible(),
      expect(guest.locator("#race-canvas")).toBeVisible(),
    ]);
    // Keep later mystery-box rewards deterministic; pickups still require driving
    // into real boxes, and the first introductory reward is still the game's nitro.
    await guest.evaluate(() => {
      Math.random = () => 0.42;
    });
    for (const page of [host, guest]) {
      await expect(page.locator("#cinematic")).toContainText("Thung Lũng Kẹo");
      await expect(page.locator("#hud-position")).toContainText("/2");
    }

    await expect
      .poll(() => host.locator("#hud-speed").innerText(), { timeout: 10_000 })
      .not.toBe("0");
    await expect
      .poll(() => guest.locator("#hud-speed").innerText())
      .not.toBe("0");
    const elapsedSeconds = (value: string) => {
      const [minutes, seconds] = value.split(":");
      return Number(minutes) * 60 + Number(seconds);
    };
    const [hostTime, guestTime] = await Promise.all([
      host.locator("#hud-time").innerText(),
      guest.locator("#hud-time").innerText(),
    ]);
    expect(
      Math.abs(elapsedSeconds(hostTime) - elapsedSeconds(guestTime)),
    ).toBeLessThan(1);

    // Both views draw the other real player's name above the corresponding kart.
    await expect
      .poll(() =>
        host.evaluate(
          () =>
            (window as unknown as CanvasWindow).paintedNames["Guest Test"]
              ?.count || 0,
        ),
      )
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        guest.evaluate(
          () =>
            (window as unknown as CanvasWindow).paintedNames["Host Test"]
              ?.count || 0,
        ),
      )
      .toBeGreaterThan(0);
    expect(
      await host.evaluate(
        () => (window as unknown as CanvasWindow).paintedNames["Host Test"],
      ),
    ).toBeUndefined();

    // A braking guest falls behind an independently controlled host.
    await guest.keyboard.down("ArrowDown");
    await expect
      .poll(
        async () =>
          Number(await host.locator("#hud-speed").innerText()) -
          Number(await guest.locator("#hud-speed").innerText()),
      )
      .toBeGreaterThan(25);
    await guest.keyboard.up("ArrowDown");
    await expect(guest.locator("#hud-position")).toHaveText("2/2");

    // Both drivers now negotiate the same physical bends as a player. The guest
    // aligns with the sparse item stations and follows behind the host.
    await Promise.all([driveCircuit(host, false), driveCircuit(guest, true)]);
    let firedRocket = false;
    for (let pickup = 0; pickup < 4; pickup++) {
      await expect(guest.locator("#use-powerup")).toHaveClass(/has-powerup/, {
        timeout: 40_000,
      });
      const itemName = await guest.locator("#powerup-popup strong").innerText();
      if (pickup === 0) expect(itemName).toContain("TĂNG TỐC");
      if (itemName.includes("TÊN LỬA CẦU VỒNG"))
        await expect(guest.locator("#hud-position")).toHaveText("2/2");
      await guest.getByRole("button", { name: "Kích hoạt power-up" }).click();
      await expect(guest.locator("#use-powerup")).not.toHaveClass(
        /has-powerup/,
      );
      if (itemName.includes("TÊN LỬA CẦU VỒNG")) {
        firedRocket = true;
        break;
      }
    }
    expect(firedRocket, "The player should collect and use a real rocket").toBe(
      true,
    );
    await expect(host.locator("#powerup-popup")).toContainText(
      "TÊN LỬA TRÚNG ĐÍCH!",
    );
    await expect(guest.locator("#powerup-popup")).toContainText(
      "TÊN LỬA CẦU VỒNG",
    );
    await expect(guest.locator("#powerup-popup")).not.toContainText(
      "TRÚNG ĐÍCH",
    );
    expect(
      await guest.evaluate(
        () => (window as unknown as CanvasWindow).sentPowerups,
      ),
    ).toContain("rocket");
    expect(
      await host.evaluate(
        () => (window as unknown as CanvasWindow).sentPowerups,
      ),
    ).toContain("rocket");
    await Promise.all(
      [host, guest].map((page) =>
        page.evaluate(() =>
          (window as unknown as CanvasWindow).stopDriving?.(),
        ),
      ),
    );

    await host
      .getByRole("button", { name: "Menu cuộc đua", exact: true })
      .click();
    await host
      .getByRole("button", { name: "Về sảnh đua", exact: true })
      .click();
    for (const page of [host, guest]) {
      await expect(page.locator("#race-screen")).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Chào tay đua, lên xe thôi!" }),
      ).toBeVisible();
      await expect(page.locator("body")).not.toHaveClass(/is-racing/);
    }
    await guest.getByRole("button", { name: "Rủ bạn cùng đua" }).click();
    await expect(
      guest.getByRole("button", { name: "Tạo phòng mới" }),
    ).toBeEnabled();
    expect(pageErrors).toEqual([]);
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()]);
  }
});
