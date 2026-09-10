import { expect, test } from "@playwright/test";

type SimEvent = { type: string; [key: string]: any };
type SimGame = {
  segments: { curve: number; width: number; mapX: number; mapY: number }[];
  pickups: { z: number; x: number; kind: string; collectedLap: number }[];
  opponents: { distance: number; speed: number; x: number; slow: number }[];
  distance: number;
  speed: number;
  playerX: number;
  elapsed: number;
  intro: number;
  finished: boolean;
  position: number;
  driftCharge: number;
  boostTimer: number;
  hitTimer: number;
  boosts: number;
  drifts: number;
  powerup: string | null;
  roadAt(distance: number): { curve: number; width: number };
  update(dt: number): void;
  collectPickups(previousDistance: number): void;
  sendHud(): void;
  setInput(key: string, pressed: boolean): void;
  setRemotePlayers(players: any[]): void;
  usePowerup(): void;
  destroy(): void;
};
type Simulation = {
  game: SimGame;
  events: SimEvent[];
  dispose(): void;
};

declare global {
  interface Window {
    gameplay: {
      create(options?: Record<string, unknown>): Simulation;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    // Import the same engine served to players. Advance actual physics frames
    // without starting requestAnimationFrame or paying for thousands of paints.
    const entry = document.querySelector<HTMLScriptElement>(
      'script[type="module"][src*="/src/main.ts"]',
    )!;
    const modulePath = new URL("./game/engine.ts", entry.src).href;
    const { RaceGame } = await import(modulePath);
    window.gameplay = {
      create(options = {}) {
        const canvas = document.createElement("canvas");
        canvas.style.cssText = "width:320px;height:200px";
        document.body.append(canvas);
        const events: SimEvent[] = [];
        const game: SimGame = new RaceGame(canvas, {
          character: "fox",
          track: "tropical",
          difficulty: "normal",
          sound: false,
          seed: 7,
          ...options,
          onEvent: (event: SimEvent) => events.push(event),
        });
        return {
          game,
          events,
          dispose() {
            game.destroy();
            canvas.remove();
          },
        };
      },
    };
  });
});

test("each circuit has its own route, both turn directions, and scarce item stations", async ({
  page,
}) => {
  const circuits = await page.evaluate(() => {
    return ["tropical", "candy", "sunset"].map((track) => {
      const simulation = window.gameplay.create({ track });
      try {
        const { game, events } = simulation;
        const route = events.find((event) => event.type === "circuit")!;
        const points = route.points as { x: number; y: number }[];
        const lengths = points.map((point, index) => {
          const next = points[(index + 1) % points.length];
          return Math.hypot(next.x - point.x, next.y - point.y);
        });
        return {
          track,
          shape: points.map(({ x, y }) => [x, y]),
          finite: points.every(({ x, y }) => Number.isFinite(x + y)),
          closure: lengths[lengths.length - 1],
          meanStep:
            lengths.reduce((sum, length) => sum + length, 0) / lengths.length,
          leftTurns: game.segments.filter(({ curve }) => curve < -0.5).length,
          rightTurns: game.segments.filter(({ curve }) => curve > 0.5).length,
          sharpTurns: game.segments.filter(
            ({ curve }) => Math.abs(curve) >= 3.5,
          ).length,
          stations: new Set(
            game.pickups.filter(({ kind }) => kind === "box").map(({ z }) => z),
          ).size,
          boxes: game.pickups.filter(({ kind }) => kind === "box").length,
          pads: game.pickups.filter(({ kind }) => kind === "pad").length,
        };
      } finally {
        simulation.dispose();
      }
    });
  });
  for (const circuit of circuits) {
    expect(circuit.finite).toBe(true);
    expect(circuit.shape.length).toBeGreaterThan(100);
    // A closed route should not have a discontinuity at its finish line.
    expect(circuit.closure).toBeLessThan(circuit.meanStep * 3);
    expect(circuit.leftTurns).toBeGreaterThan(5);
    expect(circuit.rightTurns).toBeGreaterThan(5);
    expect(circuit.stations).toBe(3);
    expect(circuit.boxes).toBe(3);
    expect(circuit.pads).toBe(1);
  }
  expect(circuits[0].shape).not.toEqual(circuits[1].shape);
  expect(circuits[1].shape).not.toEqual(circuits[2].shape);
  expect(circuits[2].sharpTurns).toBeGreaterThan(circuits[0].sharpTurns);
});

test("hard opponents travel farther than easy opponents and accelerate out of corners", async ({
  page,
}) => {
  const runs = await page.evaluate(() => {
    return ["easy", "normal", "hard"].map((difficulty) => {
      const simulation = window.gameplay.create({
        difficulty,
        track: "sunset",
      });
      try {
        const { game } = simulation;
        const cornerSpeeds: number[] = [];
        const straightSpeeds: number[] = [];
        let largestStep = 0;
        // No steering or items: the baseline must lose to opponents.
        for (let frame = 0; frame < 60 * 65; frame++) {
          const before = game.opponents[0].distance;
          game.update(1 / 60);
          const opponent = game.opponents[0];
          largestStep = Math.max(largestStep, opponent.distance - before);
          if (game.elapsed < 10) continue;
          const index = Math.floor((opponent.distance % (280 * 210)) / 210);
          const curve = Math.abs(game.segments[index].curve);
          if (curve > 2) cornerSpeeds.push(opponent.speed);
          if (curve < 0.25) straightSpeeds.push(opponent.speed);
        }
        const mean = (values: number[]) =>
          values.reduce((sum, value) => sum + value, 0) / values.length;
        return {
          difficulty,
          opponentDistance: game.opponents.map(({ distance }) => distance),
          position: game.position,
          cornerSpeed: mean(cornerSpeeds),
          straightSpeed: mean(straightSpeeds),
          largestStep,
        };
      } finally {
        simulation.dispose();
      }
    });
  });
  await test.info().attach("opponent-pace.json", {
    body: JSON.stringify(runs, null, 2),
    contentType: "application/json",
  });
  for (const run of runs) {
    expect(run.position).toBe(4);
    expect(run.straightSpeed).toBeGreaterThan(run.cornerSpeed * 1.1);
    // At 60Hz a physical kart cannot jump hundreds of world units to catch up.
    expect(run.largestStep).toBeLessThan(60);
  }
  for (let opponent = 0; opponent < 3; opponent++) {
    expect(runs[2].opponentDistance[opponent]).toBeGreaterThan(
      runs[1].opponentDistance[opponent],
    );
    expect(runs[1].opponentDistance[opponent]).toBeGreaterThan(
      runs[0].opponentDistance[opponent],
    );
  }
});

test("an occupied item slot is preserved and the same station works on the next lap", async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const simulation = window.gameplay.create({ multiplayer: true });
    try {
      const { game, events } = simulation;
      game.intro = 5;
      const boxes = game.pickups.filter(({ kind }) => kind === "box");
      const cross = (box: (typeof boxes)[number], lap: number) => {
        game.playerX = box.x;
        game.distance = lap * (280 * 210) + box.z + 20;
        game.collectPickups(game.distance - 40);
      };
      cross(boxes[0], 0);
      const first = game.powerup;
      // Travel long enough for the station cooldown to expire, while holding
      // the item. The occupied-slot check must work independently of cooldown.
      for (let frame = 0; frame < 60 * 6; frame++) game.update(1 / 60);
      cross(boxes[1], 0);
      const held = game.powerup;
      const pickupCountWhileHeld = events.filter(
        ({ type }) => type === "powerup",
      ).length;
      game.usePowerup();
      const afterUse = game.powerup;
      cross(boxes[0], 1);
      const nextLap = game.powerup;
      game.usePowerup();
      cross(boxes[0], 1);
      return {
        first,
        held,
        pickupCountWhileHeld,
        afterUse,
        nextLap,
        duplicate: game.powerup,
        totalPickups: events.filter(({ type }) => type === "powerup").length,
      };
    } finally {
      simulation.dispose();
    }
  });
  expect(result.first).not.toBeNull();
  expect(result.held).toBe(result.first);
  expect(result.pickupCountWhileHeld).toBe(1);
  expect(result.afterUse).toBeNull();
  expect(result.nextLap).not.toBeNull();
  expect(result.duplicate).toBeNull();
  expect(result.totalPickups).toBe(2);
});

test("mini turbo requires a controlled corner drift and a release on the road", async ({
  page,
}) => {
  const results = await page.evaluate(() => {
    return [
      "straight",
      "wrong-way",
      "offroad",
      "corner",
      "leave-road",
      "exit-release",
      "late-release",
    ].map((scenario) => {
      const simulation = window.gameplay.create({ multiplayer: true });
      try {
        const { game } = simulation;
        // Controlled road conditions isolate drift rules from pickup rewards,
        // traffic, and the time taken to reach a particular bend in a layout.
        game.pickups.length = 0;
        for (const segment of game.segments) {
          segment.curve = scenario === "straight" ? 0 : 2.6;
          segment.width = 1;
        }
        game.intro = 5;
        game.speed = 1500;
        game.playerX = scenario === "offroad" ? 1.5 : -0.4;
        game.setInput(scenario === "wrong-way" ? "left" : "right", true);
        game.setInput("drift", true);
        for (let frame = 0; frame < 60; frame++) game.update(1 / 60);
        if (scenario === "exit-release" || scenario === "late-release") {
          // A player needs a brief release window on the straight after the
          // apex; holding Shift along the straight must still expire charge.
          for (const segment of game.segments) segment.curve = 0;
          const exitFrames = scenario === "exit-release" ? 6 : 24;
          for (let frame = 0; frame < exitFrames; frame++) game.update(1 / 60);
        }
        const charge = game.driftCharge;
        const beforeRelease = game.boostTimer;
        if (scenario === "leave-road") game.playerX = 1.5;
        game.setInput("drift", false);
        game.update(1 / 60);
        return {
          scenario,
          charge,
          beforeRelease,
          turbo: game.boostTimer,
          drifts: game.drifts,
        };
      } finally {
        simulation.dispose();
      }
    });
  });
  for (const result of results) {
    expect(result.beforeRelease).toBe(0);
    if (result.scenario === "corner" || result.scenario === "exit-release") {
      expect(result.charge).toBeGreaterThan(0.4);
      expect(result.turbo).toBeGreaterThan(0);
      expect(result.drifts).toBe(1);
    } else {
      expect(result.turbo).toBe(0);
      expect(result.drifts).toBe(0);
      if (result.scenario !== "leave-road") expect(result.charge).toBe(0);
    }
  }
});

test("contact slows both karts and separates their lanes", async ({ page }) => {
  const result = await page.evaluate(() => {
    const simulation = window.gameplay.create();
    try {
      const { game } = simulation;
      game.intro = 5;
      game.pickups.length = 0;
      game.opponents.splice(1);
      const opponent = game.opponents[0];
      game.distance = 5000;
      game.playerX = 0;
      game.speed = 1700;
      opponent.distance = 5080;
      opponent.x = 0;
      opponent.speed = 1700;
      for (let frame = 0; frame < 12; frame++) game.update(1 / 60);
      return {
        playerSpeed: game.speed,
        opponentSpeed: opponent.speed,
        playerHit: game.hitTimer,
        opponentHit: opponent.slow,
        laneGap: Math.abs(game.playerX - opponent.x),
      };
    } finally {
      simulation.dispose();
    }
  });
  expect(result.playerHit).toBeGreaterThan(0);
  expect(result.opponentHit).toBeGreaterThan(0);
  expect(result.playerSpeed).toBeLessThan(1650);
  expect(result.opponentSpeed).toBeLessThan(1650);
  expect(result.laneGap).toBeGreaterThan(0.2);
});

test("braking before bends and steering through them improves three-lap race time", async ({
  page,
}) => {
  const runs = await page.evaluate(() => {
    return [false, true].map((controlled) => {
      const simulation = window.gameplay.create({
        track: "sunset",
        multiplayer: true,
      });
      try {
        const { game } = simulation;
        // Compare driving alone without item activation, so improvement comes
        // from braking, steering and drift rather than random attacks.
        game.pickups.length = 0;
        let roadFrames = 0;
        let raceFrames = 0;
        for (let frame = 0; frame < 60 * 240 && !game.finished; frame++) {
          if (controlled) {
            const road = game.roadAt(game.distance);
            let tightest = Math.abs(road.curve);
            for (let ahead = 210; ahead <= 1260; ahead += 210)
              tightest = Math.max(
                tightest,
                Math.abs(game.roadAt(game.distance + ahead).curve),
              );
            const wantedSpeed = 2120 / Math.sqrt(1 + tightest * 0.6) + 240;
            game.setInput("brake", game.speed > wantedSpeed + 50);
            // A simple feedback driver taps into the turn and recentres after
            // the apex. Inputs use the same digital controls available in UI.
            const steer = road.curve * 0.24 - game.playerX * 2.5;
            game.setInput("left", steer < -0.15);
            game.setInput("right", steer > 0.15);
            game.setInput(
              "drift",
              Math.abs(road.curve) > 0.7 && steer * road.curve > 0,
            );
          }
          game.update(1 / 60);
          if (game.elapsed > 0) {
            raceFrames++;
            if (
              Math.abs(game.playerX) <=
              game.roadAt(game.distance).width * 0.97
            )
              roadFrames++;
          }
        }
        return {
          controlled,
          finished: game.finished,
          time: game.elapsed,
          onroad: roadFrames / raceFrames,
        };
      } finally {
        simulation.dispose();
      }
    });
  });
  await test.info().attach("driving-comparison.json", {
    body: JSON.stringify(runs, null, 2),
    contentType: "application/json",
  });
  expect(runs[0].finished).toBe(true);
  expect(runs[1].finished).toBe(true);
  expect(runs[1].time).toBeLessThan(runs[0].time * 0.9);
  expect(runs[1].onroad).toBeGreaterThan(0.9);
  expect(runs[1].onroad).toBeGreaterThan(runs[0].onroad);
});

test("minimap HUD follows local and remote racers across the lap boundary", async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const simulation = window.gameplay.create({
      multiplayer: true,
      playerId: "local",
      players: [
        { id: "local", name: "You", character: "fox" },
        { id: "friend", name: "Friend", character: "bunny" },
      ],
    });
    try {
      const { game, events } = simulation;
      game.distance = 1.2 * (280 * 210);
      game.setRemotePlayers([
        {
          id: "local",
          name: "You",
          character: "fox",
          progress: 0,
          lane: 0,
          speed: 0,
        },
        {
          id: "friend",
          name: "Friend",
          character: "bunny",
          progress: 0.9,
          lane: 0.3,
          speed: 1600,
        },
      ]);
      game.sendHud();
      const first = events.filter(({ type }) => type === "hud").at(-1)!;
      game.setRemotePlayers([
        {
          id: "friend",
          name: "Friend",
          character: "bunny",
          progress: 1.05,
          lane: -0.3,
          speed: 1700,
        },
      ]);
      game.sendHud();
      const second = events.filter(({ type }) => type === "hud").at(-1)!;
      return { first: first.racers, second: second.racers };
    } finally {
      simulation.dispose();
    }
  });
  expect(result.first).toHaveLength(2);
  expect(result.second).toHaveLength(2);
  expect(
    result.first.find((racer: any) => racer.id === "local")?.progress,
  ).toBeCloseTo(1.2);
  expect(
    result.first.find((racer: any) => racer.id === "friend")?.progress,
  ).toBeCloseTo(0.9);
  expect(
    result.second.find((racer: any) => racer.id === "friend")?.progress,
  ).toBeCloseTo(1.05);
});
