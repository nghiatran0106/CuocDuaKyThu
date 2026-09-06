import { RaceAudio } from "./audio";

export type GameEvent = { type: string; [key: string]: unknown };
export type RaceOptions = {
  character: string;
  track: string;
  difficulty: "easy" | "normal" | "hard";
  sound: boolean;
  onEvent: (event: GameEvent) => void;
  multiplayer?: boolean;
  startAt?: number;
  playerId?: string;
  players?: { id: string; name: string; character: string }[];
  seed?: number;
};

export type RemotePlayer = {
  id: string;
  name: string;
  character: string;
  progress: number;
  lane: number;
  speed: number;
  finished?: boolean;
  time?: number;
};

type Powerup =
  "nitro" | "shield" | "rocket" | "magnet" | "banana" | "lightning";
type Track = {
  sky: string;
  skyTop: string;
  water: string;
  grass: string;
  grassAlt: string;
  road: string;
  roadAlt: string;
  rim: string;
  mountain: string;
  mountainBack: string;
  accent: string;
};
type Point = { x: number; y: number; w: number; scale: number };
type Segment = {
  index: number;
  curve: number;
  hill: number;
  p1: Point;
  p2: Point;
  visible: boolean;
  clip: number;
  z: number;
};
type Opponent = {
  id: number;
  character: string;
  distance: number;
  x: number;
  speed: number;
  phase: number;
  slow: number;
  color: string;
};
type Pickup = {
  z: number;
  x: number;
  kind: "coin" | "box" | "pad";
  collectedLap: number;
};
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
};

export const POWERUPS: Record<
  Powerup,
  { name: string; description: string; icon: string }
> = {
  nitro: {
    name: "TĂNG TỐC!",
    description: "Bứt phá hết tốc lực trong 3 giây",
    icon: "⚡",
  },
  shield: {
    name: "KHIÊN BONG BÓNG",
    description: "Bảo vệ bạn khỏi va chạm trong 7 giây",
    icon: "🫧",
  },
  rocket: {
    name: "TÊN LỬA CẦU VỒNG",
    description: "Làm chậm đối thủ phía trước",
    icon: "🚀",
  },
  magnet: {
    name: "NAM CHÂM VÀNG",
    description: "Hút tất cả xu gần bạn trong 8 giây",
    icon: "🧲",
  },
  banana: {
    name: "CHUỐI TINH NGHỊCH",
    description: "Khiến đối thủ phía sau trượt bánh",
    icon: "🍌",
  },
  lightning: {
    name: "SẤM SÉT TÍ HON",
    description: "Làm chậm mọi đối thủ trong 4 giây",
    icon: "🌩️",
  },
};

const THEMES: Record<string, Track> = {
  tropical: {
    sky: "#b9eafa",
    skyTop: "#69ccef",
    water: "#50cad6",
    grass: "#8cdc86",
    grassAlt: "#86d880",
    road: "#eeeae0",
    roadAlt: "#eae6dd",
    rim: "#ffb9a6",
    mountain: "#56bfaa",
    mountainBack: "#91d8bd",
    accent: "#ffc97e",
  },
  candy: {
    sky: "#fbe7f6",
    skyTop: "#d9cbfc",
    water: "#b79fea",
    grass: "#ffc4dc",
    grassAlt: "#f7bcd8",
    road: "#fff2df",
    roadAlt: "#f8e9da",
    rim: "#b3a0ef",
    mountain: "#d493ce",
    mountainBack: "#e7bbdf",
    accent: "#fe91b7",
  },
  sunset: {
    sky: "#ffdcaa",
    skyTop: "#ebaaae",
    water: "#bcb3e1",
    grass: "#dcc186",
    grassAlt: "#d7ba80",
    road: "#ece1d3",
    roadAlt: "#e6d9cc",
    rim: "#ed9a88",
    mountain: "#b6a0b7",
    mountainBack: "#d2b1bc",
    accent: "#ffb87d",
  },
};

const SEGMENT_LENGTH = 210;
const SEGMENT_COUNT = 280;
const TRACK_LENGTH = SEGMENT_LENGTH * SEGMENT_COUNT;
const ROAD_WIDTH = 2000;
const CAMERA_HEIGHT = 1020;
const CAMERA_DEPTH = 0.85;
const MAX_SPEED = 2120;
const DRAW_DISTANCE = 135;
const CHARACTER_TUNING: Record<
  string,
  { speed: number; handling: number; boost: number }
> = {
  fox: { speed: 1, handling: 1, boost: 1 },
  bunny: { speed: 0.975, handling: 1.16, boost: 1 },
  panda: { speed: 1, handling: 0.9, boost: 1.16 },
  cat: { speed: 1.035, handling: 0.92, boost: 1 },
};
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mod = (v: number, n: number) => ((v % n) + n) % n;

/** Self-contained pseudo-3D racer. The app owns menus; this class owns one race. */
export class RaceGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly options: RaceOptions;
  private readonly audio: RaceAudio;
  private readonly theme: Track;
  private readonly tuning: { speed: number; handling: number; boost: number };
  private readonly segments: Segment[] = [];
  private readonly opponents: Opponent[] = [];
  private readonly pickups: Pickup[] = [];
  private readonly particles: Particle[] = [];
  private remotePlayers: RemotePlayer[] = [];
  private readonly keys = new Set<string>();
  private readonly resizeObserver: ResizeObserver;
  private width = 1;
  private height = 1;
  private frame = 0;
  private lastFrame = 0;
  private running = false;
  private paused = false;
  private destroyed = false;
  private finished = false;
  private intro = 0;
  private raceStarted = false;
  private countdown = "";
  private distance = 0;
  private speed = 0;
  private playerX = 0;
  private steering = 0;
  private elapsed = 0;
  private coins = 0;
  private lap = 1;
  private position = 4;
  private hudTimer = 0;
  private powerup: Powerup | null = null;
  private boostTimer = 0;
  private shieldTimer = 0;
  private magnetTimer = 0;
  private hitTimer = 0;
  private lightningTimer = 0;
  private driftCharge = 0;
  private wasDrifting = false;
  private boosts = 0;
  private drifts = 0;
  private effectCooldown = 0;
  private lastPickupIndex = -1;
  private visualTime = 0;
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        " ",
        "Shift",
      ].includes(event.key)
    )
      event.preventDefault();
    if (
      (event.key === "Escape" || event.key.toLowerCase() === "p") &&
      !event.repeat
    ) {
      if (!this.paused) this.pause();
      return;
    }
    if (event.key === " " && !event.repeat) this.usePowerup();
    this.setInput(event.key, true);
  };
  private readonly onKeyUp = (event: KeyboardEvent) =>
    this.setInput(event.key, false);
  private readonly onBlur = () => {
    if (this.running && !this.paused && !this.finished) this.pause();
  };
  private readonly onVisibility = () => {
    if (document.hidden) this.onBlur();
  };

  constructor(canvas: HTMLCanvasElement, options: RaceOptions) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Trình duyệt chưa hỗ trợ Canvas 2D.");
    this.canvas = canvas;
    this.ctx = ctx;
    this.options = options;
    this.theme = THEMES[options.track] || THEMES.tropical;
    this.tuning = CHARACTER_TUNING[options.character] || CHARACTER_TUNING.fox;
    this.audio = new RaceAudio(options.sound);
    this.createWorld();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private emit(event: GameEvent) {
    if (!this.destroyed) this.options.onEvent(event);
  }

  private createWorld() {
    const bends =
      this.options.track === "sunset"
        ? 1.55
        : this.options.track === "candy"
          ? 1.2
          : 1;
    const elevation =
      this.options.track === "sunset"
        ? 1.7
        : this.options.track === "candy"
          ? 0.8
          : 1;
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const phase = (i / SEGMENT_COUNT) * Math.PI * 2;
      this.segments.push({
        index: i,
        curve:
          (Math.sin(phase * 2) * 0.86 + Math.sin(phase * 3) * 0.45) * bends,
        hill:
          (Math.sin(phase * 2) * 180 + Math.sin(phase * 3) * 80) * elevation,
        p1: { x: 0, y: 0, w: 0, scale: 0 },
        p2: { x: 0, y: 0, w: 0, scale: 0 },
        visible: false,
        clip: 0,
        z: 0,
      });
      if (i > 9 && i % 7 === 0) {
        const lane = Math.sin(i * 0.13) * 0.57;
        this.pickups.push({
          z: i * SEGMENT_LENGTH,
          x: lane,
          kind: "coin",
          collectedLap: -1,
        });
        this.pickups.push({
          z: (i + 1.4) * SEGMENT_LENGTH,
          x: lane,
          kind: "coin",
          collectedLap: -1,
        });
      }
      if (i > 10 && i % 36 === 18) {
        [-0.65, 0, 0.65].forEach((x) =>
          this.pickups.push({
            z: i * SEGMENT_LENGTH,
            x,
            kind: "box",
            collectedLap: -1,
          }),
        );
      }
      if (i === 78 || i === 189)
        this.pickups.push({
          z: i * SEGMENT_LENGTH,
          x: i === 78 ? -0.42 : 0.42,
          kind: "pad",
          collectedLap: -1,
        });
    }
    const roster = ["fox", "bunny", "panda", "cat"];
    const selectedCharacter = roster.includes(this.options.character)
      ? this.options.character
      : "fox";
    const characters = roster.filter(
      (character) => character !== selectedCharacter,
    );
    const adjustment =
      this.options.difficulty === "easy"
        ? -125
        : this.options.difficulty === "hard"
          ? 105
          : 0;
    if (!this.options.multiplayer)
      characters.forEach((character, i) =>
        this.opponents.push({
          id: i,
          character,
          distance: 550 + i * 740,
          x: ((i % 3) - 1) * 0.55,
          speed: 1820 + i * 24 + adjustment,
          phase: i * 1.7,
          slow: 0,
          color: ["#bb9df8", "#80c9ac", "#fac16e"][i],
        }),
      );
    if (this.options.multiplayer) {
      this.position = 1;
      this.remotePlayers = (this.options.players || [])
        .filter((p) => p.id !== this.options.playerId)
        .map((p) => ({ ...p, progress: 0, lane: 0, speed: 0 }));
    }
  }

  private resize() {
    const bounds = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, bounds.width);
    this.height = Math.max(1, bounds.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.running) this.render();
  }

  start() {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.audio.start();
    this.lastFrame = performance.now();
    this.tick(this.lastFrame);
  }

  pause() {
    if (!this.running || this.paused || this.finished || this.destroyed) return;
    if (this.options.multiplayer) {
      this.keys.clear();
      this.emit({ type: "pause" });
      return;
    }
    this.paused = true;
    this.keys.clear();
    this.audio.quiet();
    this.emit({ type: "pause" });
  }

  resume() {
    if (this.destroyed || this.finished) return;
    this.paused = false;
    this.keys.clear();
    this.audio.start();
    this.lastFrame = performance.now();
  }

  setInput(key: string, pressed: boolean) {
    const normalized = key.toLowerCase();
    if (pressed) this.keys.add(normalized);
    else this.keys.delete(normalized);
  }

  setSound(enabled: boolean) {
    this.audio.setEnabled(enabled);
  }

  getNetworkState() {
    return {
      progress: clamp(this.distance / TRACK_LENGTH, 0, 3),
      lane: this.playerX,
      speed: this.speed,
      finished: this.finished,
      time: this.elapsed,
    };
  }

  setRemotePlayers(players: RemotePlayer[]) {
    this.remotePlayers = players
      .filter(
        (p) =>
          p.id !== this.options.playerId &&
          Number.isFinite(p.progress) &&
          Number.isFinite(p.lane),
      )
      .map((p) => ({
        ...p,
        progress: clamp(p.progress, 0, 3),
        lane: clamp(p.lane, -1.65, 1.65),
        speed: Number.isFinite(p.speed) ? p.speed : 0,
      }));
  }

  applyRemotePowerup(type: string) {
    if (
      !this.options.multiplayer ||
      this.finished ||
      this.destroyed ||
      this.intro < 4
    )
      return;
    if (this.shieldTimer > 0) {
      this.emit({
        type: "effect",
        name: "KHIÊN ĐÃ CHẶN!",
        description: "Bong bóng bảo vệ bạn khỏi đòn tấn công",
        icon: "🫧",
      });
      this.audio.play("coin");
      return;
    }
    if (!["rocket", "lightning", "banana"].includes(type)) return;
    this.hitTimer = type === "lightning" ? 2.5 : 1.8;
    this.lightningTimer = type === "lightning" ? 0.6 : 0;
    this.audio.play("hit");
    this.burst(this.width / 2, this.height * 0.72, "#ffe398", 18);
    this.emit({
      type: "effect",
      name:
        type === "banana"
          ? "ÚI, TRƯỢT CHUỐI!"
          : type === "lightning"
            ? "SẤM SÉT TÍ HON!"
            : "TÊN LỬA TRÚNG ĐÍCH!",
      description: "Giữ tay lái, bạn sẽ hồi phục ngay",
      icon: type === "banana" ? "🍌" : type === "lightning" ? "🌩️" : "🚀",
    });
  }

  usePowerup() {
    if (
      !this.powerup ||
      this.paused ||
      this.finished ||
      this.intro < 4 ||
      this.destroyed
    )
      return;
    const id = this.powerup;
    this.powerup = null;
    if (id === "nitro") this.boost(3.2);
    if (id === "shield") this.shieldTimer = 7;
    if (id === "magnet") this.magnetTimer = 8;
    if (id === "rocket" && !this.options.multiplayer) {
      const target = this.opponents
        .filter((o) => o.distance > this.distance)
        .sort((a, b) => a.distance - b.distance)[0];
      if (target) {
        target.slow = 4;
        this.burst(this.width * 0.5, this.height * 0.44, "#ff8fbb", 20);
      } else this.boost(1.6);
    }
    if (id === "banana" && !this.options.multiplayer) {
      const target = [...this.opponents]
        .filter((o) => o.distance < this.distance + 500)
        .sort((a, b) => b.distance - a.distance)[0];
      if (target) target.slow = 4.5;
      this.burst(this.width / 2, this.height * 0.85, "#ffda65", 20);
    }
    if (id === "lightning" && !this.options.multiplayer) {
      this.opponents.forEach((o) => {
        o.slow = 4;
      });
      this.lightningTimer = 0.6;
    }
    if (
      this.options.multiplayer &&
      ["rocket", "lightning", "banana"].includes(id)
    )
      this.emit({ type: "attack", id });
    this.audio.play(id === "nitro" ? "boost" : "pickup");
    this.emit({ type: "effect", id, ...POWERUPS[id] });
    this.sendHud();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.audio.destroy();
  }

  private tick = (now: number) => {
    if (this.destroyed) return;
    const dt = Math.min((now - this.lastFrame) / 1000, 0.045);
    this.lastFrame = now;
    if (!this.paused) {
      this.visualTime += dt;
      if (!this.finished) this.update(dt);
      this.updateParticles(dt);
    }
    this.render();
    this.frame = requestAnimationFrame(this.tick);
  };

  private update(dt: number) {
    if (this.finished || this.destroyed) return;
    if (this.options.multiplayer && this.options.startAt && this.intro < 4)
      this.intro = clamp(4 - (this.options.startAt - Date.now()) / 1000, 0, 4);
    else this.intro += dt;
    if (this.intro < 4) {
      const value =
        this.intro < 1
          ? "3"
          : this.intro < 2
            ? "2"
            : this.intro < 3
              ? "1"
              : "GO!";
      if (value !== this.countdown) {
        this.countdown = value;
        this.emit({ type: "countdown", value });
        this.audio.play(value === "GO!" ? "go" : "countdown");
      }
      this.sendHud();
      return;
    }
    if (!this.raceStarted) {
      this.raceStarted = true;
      // A delayed network packet or a background tab can skip the final countdown frame.
      // Always dismiss the app's cinematic when actual racing begins.
      if (this.countdown !== "GO!") {
        this.emit({ type: "countdown", value: "GO!" });
        this.audio.play("go");
      }
    }
    if (this.countdown !== "") {
      this.countdown = "";
      this.emit({ type: "countdown", value: "" });
    }
    this.elapsed += dt;
    const left =
      this.keys.has("arrowleft") || this.keys.has("a") || this.keys.has("left");
    const right =
      this.keys.has("arrowright") ||
      this.keys.has("d") ||
      this.keys.has("right");
    const brake =
      this.keys.has("arrowdown") ||
      this.keys.has("s") ||
      this.keys.has("brake");
    const drift =
      (this.keys.has("shift") || this.keys.has("drift")) &&
      (left || right) &&
      this.speed > 900;
    const direction = Number(right) - Number(left);
    this.steering = lerp(this.steering, direction, Math.min(1, dt * 9));
    const segment =
      this.segments[
        Math.floor(mod(this.distance, TRACK_LENGTH) / SEGMENT_LENGTH)
      ];
    const offroad = Math.abs(this.playerX) > 0.99;
    const targetSpeed =
      (this.boostTimer > 0 ? MAX_SPEED * 1.42 : MAX_SPEED) *
      this.tuning.speed *
      (brake ? 0.56 : 1) *
      (offroad ? 0.68 : 1) *
      (this.hitTimer > 0 ? 0.6 : 1);
    this.speed += clamp(targetSpeed - this.speed, -dt * 2000, dt * 1000);
    this.playerX +=
      direction *
      dt *
      (drift ? 0.99 : 0.76) *
      this.tuning.handling *
      (0.4 + (this.speed / MAX_SPEED) * 0.6);
    this.playerX -= ((segment.curve * this.speed) / MAX_SPEED) * dt * 0.16;
    this.playerX = clamp(this.playerX, -1.65, 1.65);
    const previousDistance = this.distance;
    this.distance += this.speed * dt;
    this.lap = Math.min(3, Math.floor(this.distance / TRACK_LENGTH) + 1);
    if (drift) {
      this.driftCharge = Math.min(1, this.driftCharge + dt * 0.65);
      if (Math.random() < 0.65)
        this.burst(
          this.width * 0.5 + (Math.random() - 0.5) * 95,
          this.height * 0.875,
          this.driftCharge > 0.7 ? "#91efff" : "#ffcc6c",
          1,
        );
    } else if (this.wasDrifting) {
      if (this.driftCharge > 0.4) {
        this.drifts++;
        this.boost(0.7 + this.driftCharge * 1.25);
        this.audio.play("drift");
        this.emit({
          type: "effect",
          name: "DRIFT HOÀN HẢO!",
          description: "Thả drift để nhận mini turbo",
          icon: "💨",
        });
      }
      this.driftCharge = 0;
    }
    this.wasDrifting = drift;
    this.boostTimer = Math.max(0, this.boostTimer - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    this.hitTimer = Math.max(0, this.hitTimer - dt);
    this.lightningTimer = Math.max(0, this.lightningTimer - dt);
    this.effectCooldown = Math.max(0, this.effectCooldown - dt);
    for (const opponent of this.opponents) {
      opponent.slow = Math.max(0, opponent.slow - dt);
      const rubber = clamp(
        (this.distance - opponent.distance) / 18000,
        -0.035,
        0.075,
      );
      opponent.distance +=
        opponent.speed *
        (1 + rubber + Math.sin(this.elapsed * 0.7 + opponent.phase) * 0.025) *
        (opponent.slow > 0 ? 0.5 : 1) *
        dt;
      opponent.x = clamp(
        opponent.x + Math.sin(this.elapsed * 0.8 + opponent.phase) * dt * 0.07,
        -0.78,
        0.78,
      );
      if (
        Math.abs(opponent.distance - this.distance) < 170 &&
        Math.abs(opponent.x - this.playerX) < 0.18 &&
        this.hitTimer === 0 &&
        this.shieldTimer === 0 &&
        this.boostTimer === 0
      ) {
        this.hitTimer = 0.5;
        this.playerX += this.playerX < opponent.x ? -0.17 : 0.17;
        this.audio.play("hit");
        this.burst(this.width / 2, this.height * 0.75, "#ffe888", 10);
      }
    }
    this.position = this.options.multiplayer
      ? 1 +
        this.remotePlayers.filter(
          (p) =>
            p.progress * TRACK_LENGTH > this.distance ||
            (p.finished && p.progress >= 3),
        ).length
      : 1 + this.opponents.filter((o) => o.distance > this.distance).length;
    this.collectPickups(previousDistance);
    if (this.boostTimer > 0 && Math.random() < 0.5)
      this.burst(
        this.width * 0.5 + (Math.random() - 0.5) * 60,
        this.height * 0.88,
        "#8cebff",
        2,
      );
    if (offroad && Math.random() < 0.5)
      this.burst(
        this.width * 0.5 + (Math.random() - 0.5) * 90,
        this.height * 0.88,
        "#e3dab3",
        2,
      );
    this.audio.speed(this.speed / MAX_SPEED, drift);
    this.hudTimer += dt;
    if (this.hudTimer > 0.075) {
      this.hudTimer = 0;
      this.sendHud();
    }
    if (this.distance >= TRACK_LENGTH * 3) {
      this.finished = true;
      this.audio.quiet();
      this.audio.play("finish");
      this.burst(this.width / 2, this.height * 0.3, "#c1f377", 90);
      this.sendHud();
      this.emit({
        type: "finish",
        position: this.position,
        time: this.elapsed,
        coins: this.coins,
        boosts: this.boosts,
        drifts: this.drifts,
      });
    }
  }

  private boost(seconds: number) {
    this.boostTimer = Math.max(this.boostTimer, seconds * this.tuning.boost);
    this.boosts++;
    this.audio.play("boost");
  }

  private collectPickups(previousDistance: number) {
    for (let i = 0; i < this.pickups.length; i++) {
      const pickup = this.pickups[i];
      const currentLap = Math.floor(this.distance / TRACK_LENGTH);
      for (
        let lap = Math.floor(previousDistance / TRACK_LENGTH);
        lap <= currentLap;
        lap++
      ) {
        const at = lap * TRACK_LENGTH + pickup.z;
        if (
          pickup.collectedLap === lap ||
          at < previousDistance - 110 ||
          at > this.distance + 110
        )
          continue;
        const range =
          pickup.kind === "coin" && this.magnetTimer > 0
            ? 2.7
            : pickup.kind === "box"
              ? 0.33
              : pickup.kind === "pad"
                ? 0.37
                : 0.3;
        if (Math.abs(this.playerX - pickup.x) > range) continue;
        pickup.collectedLap = lap;
        if (pickup.kind === "coin") {
          this.coins++;
          this.audio.play("coin");
          this.burst(this.width / 2, this.height * 0.69, "#ffcf5c", 6);
        } else if (pickup.kind === "box") {
          if (this.powerup || this.lastPickupIndex === Math.floor(pickup.z))
            continue;
          this.lastPickupIndex = Math.floor(pickup.z);
          const ids: Powerup[] = [
            "nitro",
            "shield",
            "rocket",
            "magnet",
            "banana",
            "lightning",
          ];
          this.powerup =
            this.elapsed < 9
              ? "nitro"
              : ids[Math.floor(Math.random() * ids.length)];
          this.audio.play("pickup");
          this.burst(this.width / 2, this.height * 0.57, "#b396f2", 24);
          this.emit({
            type: "powerup",
            id: this.powerup,
            ...POWERUPS[this.powerup],
          });
        } else {
          this.boost(1.75);
          if (this.effectCooldown <= 0) {
            this.emit({
              type: "effect",
              name: "VÙNG TĂNG TỐC!",
              description: "Giữ tay lái, bứt phá nào!",
              icon: "⚡",
            });
            this.effectCooldown = 2;
          }
        }
      }
    }
  }

  private sendHud() {
    this.emit({
      type: "hud",
      speed: Math.round((this.speed / MAX_SPEED) * 180),
      position: this.position,
      lap: this.lap,
      totalLaps: 3,
      coins: this.coins,
      time: this.elapsed,
      progress: clamp(this.distance / (TRACK_LENGTH * 3), 0, 1),
      drift: this.driftCharge,
      powerup: this.powerup,
      boost: this.boostTimer > 0,
    });
  }

  private burst(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count && this.particles.length < 220; i++)
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 270,
        vy: -50 - Math.random() * 160,
        age: 0,
        life: 0.3 + Math.random() * 0.65,
        size: 3 + Math.random() * 7,
        color,
      });
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
      if (p.age > p.life) this.particles.splice(i, 1);
    }
  }

  private project(
    z: number,
    hill: number,
    cameraX: number,
    cameraY: number,
  ): Point {
    const scale = CAMERA_DEPTH / Math.max(z, 1);
    return {
      x: this.width / 2 - (scale * cameraX * this.width) / 2,
      y: this.height * 0.43 - (scale * (hill - cameraY) * this.height) / 2,
      w: (scale * ROAD_WIDTH * this.width) / 2,
      scale,
    };
  }

  private render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const theme = this.theme;
    this.drawSky();
    const cameraDistance = this.distance - 950;
    const trackPosition = mod(cameraDistance, TRACK_LENGTH);
    const baseIndex = Math.floor(trackPosition / SEGMENT_LENGTH);
    const basePercent = (trackPosition % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const playerIndex = Math.floor(
      mod(this.distance, TRACK_LENGTH) / SEGMENT_LENGTH,
    );
    const playerPercent = mod(this.distance, SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const playerY = lerp(
      this.segments[playerIndex].hill,
      this.segments[(playerIndex + 1) % SEGMENT_COUNT].hill,
      playerPercent,
    );
    let x = 0;
    let dx = -this.segments[baseIndex].curve * basePercent;
    let maxY = h;
    const visible: Segment[] = [];
    const introLift = this.intro < 3 ? (1 - this.intro / 3) * 170 : 0;
    for (let n = 0; n < DRAW_DISTANCE; n++) {
      const segment = this.segments[(baseIndex + n) % SEGMENT_COUNT];
      const next = this.segments[(baseIndex + n + 1) % SEGMENT_COUNT];
      const z = (n - basePercent) * SEGMENT_LENGTH;
      segment.z = cameraDistance + z;
      segment.p1 = this.project(
        z,
        segment.hill,
        this.playerX * ROAD_WIDTH - x,
        playerY + CAMERA_HEIGHT + introLift,
      );
      segment.p2 = this.project(
        z + SEGMENT_LENGTH,
        next.hill,
        this.playerX * ROAD_WIDTH - x - dx,
        playerY + CAMERA_HEIGHT + introLift,
      );
      segment.clip = maxY;
      x += dx;
      dx += segment.curve;
      segment.visible =
        z > CAMERA_DEPTH && segment.p2.y < maxY && segment.p1.y > segment.p2.y;
      if (segment.visible) {
        maxY = segment.p2.y;
        visible.push(segment);
      }
    }
    ctx.fillStyle = theme.grass;
    ctx.fillRect(0, maxY, w, h - maxY);
    for (let n = visible.length - 1; n >= 0; n--) {
      const segment = visible[n];
      const p1 = segment.p1;
      const p2 = segment.p2;
      const alternate = Math.floor(segment.index / 3) % 2 === 0;
      this.polygon(theme.grass, [0, p1.y, w, p1.y, w, p2.y, 0, p2.y]);
      // A warm sand shoulder and candy-striped curb give the road a toy-like finish.
      this.polygon(this.options.track === "candy" ? "#fce1eb" : "#f3dfae", [
        p1.x - p1.w * 1.24,
        p1.y,
        p1.x + p1.w * 1.24,
        p1.y,
        p2.x + p2.w * 1.24,
        p2.y,
        p2.x - p2.w * 1.24,
        p2.y,
      ]);
      this.polygon(alternate ? theme.rim : "#fff9eb", [
        p1.x - p1.w * 1.055,
        p1.y,
        p1.x + p1.w * 1.055,
        p1.y,
        p2.x + p2.w * 1.055,
        p2.y,
        p2.x - p2.w * 1.055,
        p2.y,
      ]);
      this.polygon(alternate ? theme.road : theme.roadAlt, [
        p1.x - p1.w,
        p1.y,
        p1.x + p1.w,
        p1.y,
        p2.x + p2.w,
        p2.y,
        p2.x - p2.w,
        p2.y,
      ]);
      if (Math.floor(segment.index / 3) % 3 !== 0) {
        for (const lane of [-1 / 3, 1 / 3])
          this.polygon("#fffdf2", [
            p1.x + p1.w * (lane - 0.007),
            p1.y,
            p1.x + p1.w * (lane + 0.007),
            p1.y,
            p2.x + p2.w * (lane + 0.007),
            p2.y,
            p2.x + p2.w * (lane - 0.007),
            p2.y,
          ]);
      }
      if (segment.index < 3) this.drawFinishLine(segment);
    }
    // Draw scenery and racers from the horizon toward the camera.
    for (let n = visible.length - 1; n >= 0; n--) {
      const segment = visible[n];
      const p = segment.p1;
      const scale = p.w / ROAD_WIDTH;
      if (scale > 0.65 || scale < 0.003) continue;
      if (segment.index % 11 === 0) {
        const side = segment.index % 22 === 0 ? -1 : 1;
        this.drawScenery(
          p.x + p.w * (1.3 + (segment.index % 3) * 0.12) * side,
          p.y,
          scale * 1100,
          segment.index,
        );
      }
      if (segment.index % 17 === 4)
        this.drawScenery(p.x - p.w * 1.6, p.y, scale * 740, segment.index + 1);
      for (const pickup of this.pickups) {
        if (Math.floor(pickup.z / SEGMENT_LENGTH) !== segment.index) continue;
        const lap = Math.floor(segment.z / TRACK_LENGTH);
        if (pickup.collectedLap === lap) continue;
        const t = mod(pickup.z, SEGMENT_LENGTH) / SEGMENT_LENGTH;
        const px = lerp(p.x, segment.p2.x, t);
        const py = lerp(p.y, segment.p2.y, t);
        const pw = lerp(p.w, segment.p2.w, t);
        this.drawPickup(px + pw * pickup.x, py, pw / ROAD_WIDTH, pickup.kind);
      }
      for (const opponent of this.opponents) {
        const relative = opponent.distance - cameraDistance;
        if (relative < 280 || relative > DRAW_DISTANCE * SEGMENT_LENGTH)
          continue;
        if (
          Math.floor(mod(opponent.distance, TRACK_LENGTH) / SEGMENT_LENGTH) !==
          segment.index
        )
          continue;
        const t = mod(opponent.distance, SEGMENT_LENGTH) / SEGMENT_LENGTH;
        const px = lerp(p.x, segment.p2.x, t);
        const py = lerp(p.y, segment.p2.y, t);
        const pw = lerp(p.w, segment.p2.w, t);
        const size = (pw / ROAD_WIDTH) * 430;
        if (size < 4) continue;
        this.drawKart(
          px + pw * opponent.x,
          py,
          size,
          opponent.character,
          Math.sin(opponent.phase + this.visualTime) * 0.035,
          opponent.slow > 0,
          opponent.color,
        );
      }
      for (const opponent of this.remotePlayers) {
        const distance = opponent.progress * TRACK_LENGTH;
        const relative = distance - cameraDistance;
        if (relative < 280 || relative > DRAW_DISTANCE * SEGMENT_LENGTH)
          continue;
        if (
          Math.floor(mod(distance, TRACK_LENGTH) / SEGMENT_LENGTH) !==
          segment.index
        )
          continue;
        const t = mod(distance, SEGMENT_LENGTH) / SEGMENT_LENGTH;
        const px = lerp(p.x, segment.p2.x, t);
        const py = lerp(p.y, segment.p2.y, t);
        const pw = lerp(p.w, segment.p2.w, t);
        const size = (pw / ROAD_WIDTH) * 430;
        if (size < 4) continue;
        this.drawKart(
          px + pw * opponent.lane,
          py,
          size,
          opponent.character,
          0,
          false,
        );
        if (size > 14) {
          ctx.save();
          ctx.font = `700 ${clamp(size * 0.16, 10, 15)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const label = opponent.name.slice(0, 18);
          const labelWidth = ctx.measureText(label).width + 18;
          this.roundRect(
            px + pw * opponent.lane - labelWidth / 2,
            py - size * 1.45 - 11,
            labelWidth,
            22,
            9,
            "#ffffffde",
          );
          ctx.fillStyle = "#4b475d";
          ctx.fillText(label, px + pw * opponent.lane, py - size * 1.45);
          ctx.restore();
        }
      }
    }
    if (this.boostTimer > 0) this.drawSpeedLines();
    const bob =
      this.speed > 100
        ? Math.sin(this.visualTime * 28) * Math.min(2, this.speed / 1200)
        : Math.sin(this.visualTime * 2) * 1.2;
    const kartSize = clamp(w * 0.135, 100, 166);
    const kartX = w / 2 + this.steering * -14;
    const kartY = h * 0.9 + bob;
    if (this.shieldTimer > 0) {
      ctx.save();
      const shield = ctx.createRadialGradient(
        kartX,
        kartY - kartSize * 0.5,
        kartSize * 0.2,
        kartX,
        kartY - kartSize * 0.5,
        kartSize * 0.95,
      );
      shield.addColorStop(0, "#a9f4ff08");
      shield.addColorStop(0.82, "#a9f4ff28");
      shield.addColorStop(1, "#b1faffaa");
      ctx.fillStyle = shield;
      ctx.beginPath();
      ctx.ellipse(
        kartX,
        kartY - kartSize * 0.48,
        kartSize * 0.85,
        kartSize,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }
    if (this.boostTimer > 0) {
      for (const side of [-1, 1]) {
        this.ellipse(
          kartX + side * kartSize * 0.25,
          kartY - kartSize * 0.04,
          kartSize * 0.11,
          kartSize * (0.3 + Math.sin(this.visualTime * 45) * 0.08),
          "#a9f5ff",
        );
        this.ellipse(
          kartX + side * kartSize * 0.25,
          kartY - kartSize * 0.04,
          kartSize * 0.06,
          kartSize * 0.19,
          "#fffbc3",
        );
      }
    }
    this.drawKart(
      kartX,
      kartY,
      kartSize,
      this.options.character,
      this.steering * (this.wasDrifting ? -0.13 : -0.045),
      this.hitTimer > 0,
    );
    if (this.magnetTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(this.visualTime * 6) * 0.15;
      ctx.strokeStyle = "#ffbc63";
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(
          kartX,
          kartY - kartSize * 0.1,
          kartSize * (0.7 + i * 0.3),
          kartSize * (0.2 + i * 0.15),
          0,
          Math.PI,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const particle of this.particles) {
      ctx.globalAlpha = 1 - particle.age / particle.life;
      this.ellipse(
        particle.x,
        particle.y,
        particle.size,
        particle.size * 0.6,
        particle.color,
      );
    }
    ctx.globalAlpha = 1;
    if (this.lightningTimer > 0) {
      ctx.fillStyle = `rgba(244,240,255,${this.lightningTimer * 0.58})`;
      ctx.fillRect(0, 0, w, h);
    }
    // Subtle vignette anchors the player in the scene without muting the palette.
    const vignette = ctx.createLinearGradient(0, h * 0.8, 0, h);
    vignette.addColorStop(0, "#27332a00");
    vignette.addColorStop(1, "#27332a0c");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, h * 0.8, w, h * 0.2);
  }

  private drawSky() {
    const { ctx, width: w, height: h, theme } = this;
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
    sky.addColorStop(0, theme.skyTop);
    sky.addColorStop(1, theme.sky);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const sunX = w * 0.79;
    const sunY = h * 0.17;
    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, h * 0.17);
    glow.addColorStop(0, "#fff8d48a");
    glow.addColorStop(1, "#fff9d400");
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - h * 0.18, sunY - h * 0.18, h * 0.36, h * 0.36);
    this.ellipse(
      sunX,
      sunY,
      h * 0.048,
      h * 0.048,
      this.options.track === "sunset" ? "#fff0bd" : "#fff9da",
    );
    const cloudShift =
      Math.sin((this.distance / TRACK_LENGTH) * Math.PI * 4) * w * 0.06;
    [
      [0.13, 0.16, 1],
      [0.48, 0.1, 0.7],
      [0.87, 0.28, 0.66],
      [0.34, 0.3, 0.52],
    ].forEach(([x, y, s]) =>
      this.drawCloud(x * w + cloudShift, y * h, clamp(w * 0.07, 40, 86) * s),
    );
    ctx.fillStyle = theme.water;
    ctx.fillRect(0, h * 0.41, w, h * 0.22);
    const drift =
      Math.sin((this.distance / TRACK_LENGTH) * Math.PI * 4) * w * 0.09;
    this.drawMountain(
      -w * 0.06 + drift,
      h * 0.48,
      w * 0.44,
      h * 0.23,
      theme.mountainBack,
    );
    this.drawMountain(
      w * 0.44 + drift,
      h * 0.46,
      w * 0.4,
      h * 0.19,
      theme.mountainBack,
    );
    this.drawMountain(
      w * 0.04 + drift,
      h * 0.49,
      w * 0.31,
      h * 0.15,
      theme.mountain,
    );
    this.drawMountain(
      w * 0.72 + drift,
      h * 0.49,
      w * 0.35,
      h * 0.24,
      theme.mountain,
    );
    ctx.strokeStyle = "#ffffff45";
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const x = mod(i * w * 0.159 + this.visualTime * 9, w);
      const y = h * (0.45 + (i % 3) * 0.025);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 25 + i * 3, y);
      ctx.stroke();
    }
  }

  private drawCloud(x: number, y: number, size: number) {
    this.ellipse(x, y + size * 0.1, size, size * 0.25, "#ffffffb9");
    this.ellipse(
      x - size * 0.38,
      y - size * 0.1,
      size * 0.43,
      size * 0.39,
      "#ffffffc9",
    );
    this.ellipse(
      x + size * 0.2,
      y - size * 0.21,
      size * 0.5,
      size * 0.49,
      "#ffffffdc",
    );
  }

  private drawMountain(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + width * 0.1,
      y - height * 0.45,
      x + width * 0.24,
      y - height * 0.17,
      x + width * 0.37,
      y - height * 0.72,
    );
    ctx.bezierCurveTo(
      x + width * 0.53,
      y - height * 1.3,
      x + width * 0.7,
      y - height * 0.44,
      x + width,
      y,
    );
    ctx.closePath();
    ctx.fill();
  }

  private drawScenery(x: number, y: number, size: number, seed: number) {
    if (
      size < 3 ||
      x < -size ||
      x > this.width + size ||
      y > this.height + size
    )
      return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 100, size / 100);
    this.ellipse(0, 0, 30, 7, "#3775541b");
    if (this.options.track === "candy") {
      ctx.strokeStyle = "#fff4e4";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -88);
      ctx.stroke();
      this.ellipse(0, -92, 31, 31, seed % 2 ? "#b69cea" : "#ff9fc4");
      ctx.strokeStyle = "#fff1eb";
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let t = 0; t < 15; t += 0.15) {
        const r = t * 1.8;
        const px = Math.cos(t) * r;
        const py = -92 + Math.sin(t) * r;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (seed % 3 !== 1) {
      ctx.strokeStyle = "#bfa06f";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(5, -54, -5, -104);
      ctx.stroke();
      ctx.strokeStyle = "#9b825c";
      ctx.lineWidth = 2;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(-2, -i * 15);
        ctx.lineTo(5, -i * 15 - 2);
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        ctx.save();
        ctx.translate(-5, -104);
        ctx.rotate(angle);
        ctx.fillStyle = i % 2 ? "#4aaa74" : "#69bf7d";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(25, -29, 55, -1);
        ctx.quadraticCurveTo(25, -9, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      this.ellipse(-2, -98, 6, 7, "#caa068");
      this.ellipse(7, -103, 5, 6, "#dcc090");
    } else {
      this.ellipse(-13, -18, 27, 24, "#6bc280");
      this.ellipse(15, -23, 24, 29, "#7bd08a");
      this.ellipse(1, -35, 19, 23, "#8ada98");
      [
        [-12, -19],
        [14, -34],
        [3, -47],
      ].forEach(([fx, fy]) => {
        this.ellipse(fx, fy, 4, 4, this.theme.accent);
        this.ellipse(fx, fy, 1.5, 1.5, "#fffbdc");
      });
    }
    ctx.restore();
  }

  private drawPickup(
    x: number,
    y: number,
    scale: number,
    kind: Pickup["kind"],
  ) {
    const ctx = this.ctx;
    const size = scale * (kind === "box" ? 265 : 160);
    if (
      size < 2 ||
      x < -size ||
      x > this.width + size ||
      y > this.height + size
    )
      return;
    if (kind === "pad") {
      const padW = scale * 670;
      this.polygon("#bce871", [
        x - padW,
        y,
        x + padW,
        y,
        x + padW * 0.85,
        y - size * 0.34,
        x - padW * 0.85,
        y - size * 0.34,
      ]);
      ctx.strokeStyle = "#fbffdf";
      ctx.lineWidth = Math.max(1, size * 0.08);
      for (const dx of [-0.45, 0, 0.45]) {
        ctx.beginPath();
        ctx.moveTo(x + padW * dx - size * 0.2, y - size * 0.09);
        ctx.lineTo(x + padW * dx, y - size * 0.25);
        ctx.lineTo(x + padW * dx + size * 0.2, y - size * 0.09);
        ctx.stroke();
      }
      return;
    }
    this.ellipse(x, y - 1, size * 0.5, size * 0.12, "#57634018");
    const bob = Math.sin(this.visualTime * 3 + x * 0.03) * size * 0.08;
    ctx.save();
    ctx.translate(x, y - size * 0.65 + bob);
    if (kind === "coin") {
      const squeeze =
        0.65 + Math.abs(Math.sin(this.visualTime * 2 + x * 0.01)) * 0.35;
      ctx.scale(squeeze, 1);
      this.ellipse(0, 0, size * 0.44, size * 0.55, "#df9f3f");
      this.ellipse(
        -size * 0.05,
        -size * 0.03,
        size * 0.37,
        size * 0.48,
        "#ffdc6b",
      );
      ctx.strokeStyle = "#edb749";
      ctx.lineWidth = Math.max(1, size * 0.06);
      ctx.beginPath();
      ctx.ellipse(
        -size * 0.04,
        -size * 0.02,
        size * 0.25,
        size * 0.34,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.fillStyle = "#fff2ad";
      ctx.font = `900 ${size * 0.48}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", -size * 0.04, 0);
    } else {
      ctx.rotate(Math.sin(this.visualTime * 2 + x) * 0.09);
      ctx.shadowColor = "#c3a1f7";
      ctx.shadowBlur = size * 0.22;
      this.roundRect(
        -size * 0.5,
        -size * 0.5,
        size,
        size,
        size * 0.2,
        "#b99bed",
      );
      ctx.shadowBlur = 0;
      this.roundRect(
        -size * 0.43,
        -size * 0.43,
        size * 0.86,
        size * 0.76,
        size * 0.16,
        "#d3bcfa",
      );
      ctx.strokeStyle = "#f2eaff";
      ctx.lineWidth = Math.max(1, size * 0.04);
      ctx.strokeRect(-size * 0.32, -size * 0.32, size * 0.64, size * 0.56);
      ctx.fillStyle = "#fffdf5";
      ctx.font = `900 ${size * 0.7}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", 0, -size * 0.015);
      this.ellipse(
        -size * 0.3,
        -size * 0.34,
        size * 0.07,
        size * 0.05,
        "#ffffffa0",
      );
    }
    ctx.restore();
  }

  private drawKart(
    x: number,
    y: number,
    size: number,
    character: string,
    angle: number,
    hit: boolean,
    bodyColor?: string,
  ) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(size / 100, size / 100);
    const color =
      bodyColor ||
      (character === "bunny"
        ? "#b4a0e7"
        : character === "panda"
          ? "#7cc9ac"
          : character === "cat"
            ? "#f3be6e"
            : "#fa997f");
    this.ellipse(0, -3, 53, 13, "#45524728");
    if (hit) ctx.translate(Math.sin(this.visualTime * 60) * 4, 0);
    // Rounded tires, broad rear bumper and visible suspension.
    for (const side of [-1, 1]) {
      this.roundRect(side * 38 - 11, -42, 22, 34, 8, "#414954");
      this.roundRect(side * 40 - 8, -38, 16, 29, 6, "#555c65");
      this.roundRect(side * 40 - 5, -34, 10, 19, 4, "#777c83");
      this.roundRect(side * 33 - 8, -61, 16, 23, 6, "#525863");
    }
    this.roundRect(-37, -49, 74, 38, 15, color);
    this.ellipse(0, -49, 33, 16, color);
    this.roundRect(-24, -59, 48, 26, 10, "#59536b");
    this.roundRect(-20, -56, 40, 21, 8, "#77708a");
    // Character silhouettes remain legible at the horizon.
    const animal =
      character === "bunny"
        ? "#faf1ed"
        : character === "panda"
          ? "#f5f3e9"
          : character === "cat"
            ? "#b9a1dc"
            : "#eeac76";
    this.ellipse(0, -62, 24, 19, animal);
    if (character === "bunny") {
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * 13, -93);
        ctx.rotate(side * 0.13);
        this.ellipse(0, -14, 9, 25, animal);
        this.ellipse(0, -14, 4.5, 18, "#edb8c0");
        ctx.restore();
      }
    } else if (character === "panda") {
      this.ellipse(-22, -96, 11, 11, "#535762");
      this.ellipse(22, -96, 11, 11, "#535762");
    } else {
      this.polygon(animal, [-28, -84, -27, -112, -8, -96]);
      this.polygon(animal, [28, -84, 27, -112, 8, -96]);
      this.polygon(
        character === "fox" ? "#744e48" : "#e8bdcd",
        [-24, -91, -24, -105, -14, -96],
      );
      this.polygon(
        character === "fox" ? "#744e48" : "#e8bdcd",
        [24, -91, 24, -105, 14, -96],
      );
    }
    this.ellipse(0, -83, 29, 25, animal);
    if (character === "fox") {
      this.ellipse(-16, -75, 14, 13, "#fff0d8");
      this.ellipse(16, -75, 14, 13, "#fff0d8");
      this.polygon("#fff0d8", [-13, -75, 13, -75, 0, -63]);
    }
    if (character === "panda") {
      this.ellipse(-12, -82, 9, 10, "#595967");
      this.ellipse(12, -82, 9, 10, "#595967");
    }
    // Looking back at the camera is part of the friendly mascot style.
    this.ellipse(-11, -82, 2.8, 3.8, "#3f4050");
    this.ellipse(11, -82, 2.8, 3.8, "#3f4050");
    this.ellipse(-10.4, -83.2, 0.9, 1.1, "#fffdf5");
    this.ellipse(11.6, -83.2, 0.9, 1.1, "#fffdf5");
    this.ellipse(-19, -73, 4.4, 2.5, "#eda5a188");
    this.ellipse(19, -73, 4.4, 2.5, "#eda5a188");
    this.ellipse(0, -75, 3.3, 2.5, "#66515c");
    ctx.strokeStyle = "#76565f";
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -73);
    ctx.quadraticCurveTo(-2, -68, -5, -71);
    ctx.moveTo(0, -73);
    ctx.quadraticCurveTo(2, -68, 5, -71);
    ctx.stroke();
    this.roundRect(-28, -43, 56, 19, 8, color);
    this.roundRect(-35, -25, 70, 15, 7, "#fff3df");
    this.roundRect(-28, -25, 56, 8, 4, color);
    this.roundRect(-17, -25, 34, 8, 3, "#fdf6e9");
    this.roundRect(-24, -18, 10, 5, 2, "#ef847b");
    this.roundRect(14, -18, 10, 5, 2, "#ef847b");
    this.roundRect(-28, -8, 56, 7, 3, "#60616b");
    this.ellipse(-22, -7, 5, 4, "#424652");
    this.ellipse(22, -7, 5, 4, "#424652");
    ctx.restore();
  }

  private drawFinishLine(segment: Segment) {
    const p1 = segment.p1;
    const p2 = segment.p2;
    for (let i = 0; i < 12; i++) {
      const a = -1 + i / 6;
      const b = a + 1 / 6;
      this.polygon((i + segment.index) % 2 ? "#737383" : "#fff8e8", [
        p1.x + p1.w * a,
        p1.y,
        p1.x + p1.w * b,
        p1.y,
        p2.x + p2.w * b,
        p2.y,
        p2.x + p2.w * a,
        p2.y,
      ]);
    }
  }

  private drawSpeedLines() {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const progress = mod(this.visualTime * 2.4 + i * 0.173, 1);
      const radius = lerp(0.38, 0.9, progress);
      const x = this.width / 2 + Math.cos(angle) * this.width * radius;
      const y = this.height * 0.45 + Math.sin(angle) * this.height * radius;
      ctx.strokeStyle = `rgba(255,255,245,${0.18 + progress * 0.4})`;
      ctx.lineWidth = 1 + progress * 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x + Math.cos(angle) * 90 * progress,
        y + Math.sin(angle) * 65 * progress,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  private polygon(color: string, points: number[]) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2)
      ctx.lineTo(points[i], points[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  private ellipse(x: number, y: number, rx: number, ry: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    color: string,
  ) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, width, height, radius);
    this.ctx.fill();
  }
}
