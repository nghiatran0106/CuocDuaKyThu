import Peer, { type DataConnection } from "peerjs";

export type PlayerProfile = { name: string; character: string };
export type NetworkState = {
  /** Total fractional laps, from 0 through 3. */
  progress: number;
  /** Horizontal position including offroad shoulders, from -1.65 through 1.65. */
  lane: number;
  speed: number;
  finished?: boolean;
  time?: number;
};
export type NetworkPlayer = PlayerProfile & NetworkState & { id: string };
export type MultiplayerEvent = { type: string; [key: string]: unknown };

const PROTOCOL = 1;
const PREFIX = "turbo-buddies-v1-";
const TIMEOUT = 12_000;
const MAX_PLAYERS = 4;
const POWERUPS = new Set([
  "nitro",
  "shield",
  "rocket",
  "magnet",
  "banana",
  "lightning",
]);
const INITIAL_STATE: NetworkState = {
  progress: 0,
  lane: 0,
  speed: 0,
  finished: false,
  time: 0,
};
type Packet = { v: number; type: string; [key: string]: unknown };
type Phase = "idle" | "connecting" | "lobby" | "racing";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

function profile(value: unknown): PlayerProfile | null {
  if (
    !record(value) ||
    typeof value.name !== "string" ||
    typeof value.character !== "string"
  )
    return null;
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(value.character)) return null;
  const name =
    value.name
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 20) || "Tay đua";
  return { name, character: value.character };
}

function state(value: unknown): NetworkState | null {
  if (
    !record(value) ||
    !finite(value.progress, 0, 3) ||
    !finite(value.lane, -1.65, 1.65) ||
    !finite(value.speed, 0, 3200)
  )
    return null;
  if (value.finished !== undefined && typeof value.finished !== "boolean")
    return null;
  if (value.time !== undefined && !finite(value.time, 0, 3_600_000))
    return null;
  return {
    progress: value.progress,
    lane: value.lane,
    speed: value.speed,
    ...(typeof value.finished === "boolean"
      ? { finished: value.finished }
      : {}),
    ...(typeof value.time === "number" ? { time: value.time } : {}),
  };
}

function roster(value: unknown): NetworkPlayer[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_PLAYERS)
    return null;
  const result: NetworkPlayer[] = [];
  const ids = new Set<string>();
  for (const raw of value) {
    if (
      !record(raw) ||
      typeof raw.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(raw.id) ||
      ids.has(raw.id)
    )
      return null;
    const player = profile(raw);
    const snapshot = state(raw);
    if (!player || !snapshot) return null;
    ids.add(raw.id);
    result.push({ id: raw.id, ...player, ...snapshot });
  }
  return result;
}

function roomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join(
    "",
  );
}

function errorMessage(error: unknown): string {
  const type = record(error) ? error.type : undefined;
  if (type === "peer-unavailable")
    return "Không tìm thấy phòng. Kiểm tra mã phòng và nhờ chủ phòng mở lại nhé.";
  if (type === "browser-incompatible")
    return "Trình duyệt này chưa hỗ trợ chơi cùng bạn. Hãy dùng Chrome, Edge, Firefox hoặc Safari mới.";
  if (type === "unavailable-id")
    return "Mã phòng đang được sử dụng. Hãy tạo phòng mới.";
  if (type === "webrtc")
    return "Hai thiết bị chưa kết nối được. Hãy thử một mạng Wi-Fi khác hoặc tắt VPN.";
  return "Mất kết nối dịch vụ phòng chơi. Kiểm tra mạng và thử lại nhé.";
}

/** A real WebRTC room. The host owns membership, start time and the state relay. */
export class MultiplayerSession {
  public isHost = false;
  public roomCode = "";
  public playerId = "";
  public players: NetworkPlayer[] = [];

  private peer: Peer | null = null;
  private phase: Phase = "idle";
  private connections = new Map<string, DataConnection>();
  private lastSeen = new Map<string, number>();
  private lastState = new Map<string, number>();
  private lastPowerup = new Map<string, number>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private pendingFailure: ((error: Error) => void) | null = null;
  private pendingSuccess: (() => void) | null = null;
  private generation = 0;
  private hostOffset = 0;
  private bestRoundTrip = Infinity;
  private pendingPings = new Set<number>();
  private raceStartAt = 0;

  constructor(private readonly onEvent: (event: MultiplayerEvent) => void) {}

  create(player: PlayerProfile): Promise<string> {
    return this.connectRoom(true, player).then(() => this.roomCode);
  }

  join(code: string, player: PlayerProfile): Promise<void> {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      const message = "Mã phòng cần có 6 chữ cái hoặc chữ số.";
      this.onEvent({ type: "error", message });
      return Promise.reject(new Error(message));
    }
    return this.connectRoom(false, player, normalized);
  }

  start(track: string): void {
    if (!this.isHost || this.phase !== "lobby") return;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(track)) return;
    this.phase = "racing";
    this.raceStartAt = Date.now() + 5000;
    this.players = this.players.map((player) => ({
      ...player,
      ...INITIAL_STATE,
    }));
    this.broadcast({ type: "start", track, startAt: this.raceStartAt });
    this.onEvent({ type: "start", track, startAt: this.raceStartAt });
  }

  broadcastState(value: NetworkState): void {
    if (this.phase !== "racing") return;
    const snapshot = state(value);
    if (!snapshot) return;
    if (this.isHost) {
      this.updatePlayer(this.playerId, snapshot);
      this.sendState();
    } else {
      this.sendToHost({ type: "state", state: snapshot });
    }
  }

  sendPowerup(type: string): void {
    if (
      this.phase !== "racing" ||
      Date.now() < this.raceStartAt ||
      !POWERUPS.has(type)
    )
      return;
    if (this.isHost) this.relayPowerup(type, this.playerId);
    else this.sendToHost({ type: "powerup", id: type });
  }

  leave(): void {
    const active = this.phase !== "idle";
    if (this.isHost) this.broadcast({ type: "closed" });
    else this.sendToHost({ type: "leave" });
    this.cleanup(new Error("Đã hủy kết nối."));
    if (active) this.onEvent({ type: "closed" });
  }

  private connectRoom(
    host: boolean,
    value: PlayerProfile,
    code = "",
  ): Promise<void> {
    const player = profile(value);
    if (!player) return Promise.reject(new Error("Nhân vật không hợp lệ."));
    this.cleanup(new Error("Đã chuyển sang phòng khác."));
    this.isHost = host;
    this.phase = "connecting";
    this.roomCode = code;
    const generation = this.generation;

    return new Promise<void>((resolve, reject) => {
      this.pendingFailure = reject;
      this.pendingSuccess = () => {
        this.pendingFailure = null;
        this.pendingSuccess = null;
        this.cancelTimer(timeout);
        this.beginHeartbeat();
        resolve();
      };
      const timeout = this.schedule(
        () =>
          this.fail(
            "Kết nối quá 12 giây. Kiểm tra mã phòng, đổi mạng hoặc thử lại nhé.",
          ),
        TIMEOUT,
      );
      let attempts = 0;
      const open = () => {
        if (generation !== this.generation) return;
        attempts += 1;
        if (host) this.roomCode = roomCode();
        let peer: Peer;
        try {
          peer = host
            ? new Peer(PREFIX + this.roomCode, { debug: 0 })
            : new Peer({ debug: 0 });
        } catch (error) {
          this.fail(errorMessage(error));
          return;
        }
        this.peer = peer;
        const current = () =>
          generation === this.generation && this.peer === peer;
        peer.on("open", (id) => {
          if (!current()) return;
          this.playerId = id;
          if (host) {
            this.players = [{ id, ...player, ...INITIAL_STATE }];
            this.phase = "lobby";
            this.pendingSuccess?.();
            this.emitRoom();
          } else {
            try {
              const connection = peer.connect(PREFIX + this.roomCode, {
                reliable: true,
                serialization: "json",
                label: "turbo-buddies-v1",
              });
              this.attachHost(connection, player);
            } catch (error) {
              this.fail(errorMessage(error));
            }
          }
        });
        peer.on("connection", (connection) => {
          if (!current() || !host) {
            connection.on("error", () => {});
            connection.close();
            return;
          }
          this.acceptGuest(connection);
        });
        peer.on("error", (error) => {
          if (!current()) return;
          if (
            host &&
            this.phase === "connecting" &&
            error.type === "unavailable-id" &&
            attempts < 4
          ) {
            this.peer = null;
            peer.destroy();
            open();
          } else if (this.phase === "connecting" || peer.destroyed) {
            this.fail(errorMessage(error));
          } else {
            this.onEvent({ type: "error", message: errorMessage(error) });
          }
        });
        peer.on("disconnected", () => {
          if (!current() || peer.destroyed) return;
          // Existing data channels survive a signaling outage; try to restore discovery.
          this.schedule(() => {
            if (!current() || peer.destroyed || !peer.disconnected) return;
            try {
              peer.reconnect();
            } catch {
              this.onEvent({
                type: "error",
                message: "Tạm mất kết nối dịch vụ tìm phòng.",
              });
            }
          }, 1500);
        });
        peer.on("close", () => {
          if (current())
            this.fail(
              "Kết nối phòng đã đóng. Hãy tạo hoặc tham gia một phòng mới.",
            );
        });
      };
      open();
    });
  }

  private acceptGuest(connection: DataConnection): void {
    const generation = this.generation;
    // Bound half-open handshakes as well as the four admitted players.
    if (this.connections.has(connection.peer) || this.connections.size >= 8) {
      connection.on("error", () => {});
      connection.on("open", () => {
        this.send(connection, {
          type: "reject",
          message: "Phòng đang bận. Hãy thử lại nhé.",
        });
        this.schedule(() => connection.close(), 200);
      });
      this.schedule(() => connection.close(), 3000);
      return;
    }
    this.connections.set(connection.peer, connection);
    let admitted = false;
    const current = () =>
      generation === this.generation &&
      this.connections.get(connection.peer) === connection;
    const handshakeTimeout = this.schedule(() => {
      if (current() && !admitted) this.dropGuest(connection.peer);
    }, 6000);
    connection.on("data", (raw: unknown) => {
      if (!current() || !this.isPacket(raw)) return;
      this.lastSeen.set(connection.peer, Date.now());
      if (!admitted) {
        if (raw.type !== "hello") return;
        const player = profile(raw.player);
        const reason =
          this.phase !== "lobby"
            ? "Cuộc đua đã bắt đầu. Hẹn bạn ở phòng tiếp theo nhé!"
            : this.players.length >= MAX_PLAYERS
              ? "Phòng đã đủ 4 tay đua."
              : !player
                ? "Thông tin tay đua không hợp lệ."
                : "";
        if (reason) {
          this.send(connection, { type: "reject", message: reason });
          this.schedule(() => this.dropGuest(connection.peer), 250);
          return;
        }
        admitted = true;
        this.cancelTimer(handshakeTimeout);
        this.players.push({
          id: connection.peer,
          ...player!,
          ...INITIAL_STATE,
        });
        this.send(connection, {
          type: "welcome",
          code: this.roomCode,
          players: this.snapshot(),
          hostTime: Date.now(),
        });
        this.publishRoom();
        return;
      }
      if (
        raw.type === "ping" &&
        finite(raw.sentAt, 0, Number.MAX_SAFE_INTEGER)
      ) {
        this.send(connection, {
          type: "pong",
          sentAt: raw.sentAt,
          hostTime: Date.now(),
        });
      } else if (raw.type === "leave") {
        this.dropGuest(connection.peer);
      } else if (raw.type === "state" && this.phase === "racing") {
        const now = Date.now();
        if (now - (this.lastState.get(connection.peer) ?? 0) < 25) return;
        const snapshot = state(raw.state);
        if (!snapshot) return;
        this.lastState.set(connection.peer, now);
        this.updatePlayer(connection.peer, snapshot);
        this.sendState();
      } else if (
        raw.type === "powerup" &&
        typeof raw.id === "string" &&
        POWERUPS.has(raw.id) &&
        this.phase === "racing" &&
        Date.now() >= this.raceStartAt
      ) {
        this.relayPowerup(raw.id, connection.peer);
      }
    });
    connection.on("close", () => {
      if (current()) this.dropGuest(connection.peer);
    });
    connection.on("error", () => {
      if (current()) this.dropGuest(connection.peer);
    });
  }

  private attachHost(connection: DataConnection, player: PlayerProfile): void {
    const generation = this.generation;
    this.connections.set(connection.peer, connection);
    const current = () =>
      generation === this.generation &&
      this.connections.get(connection.peer) === connection;
    connection.on("open", () => {
      if (!current()) return;
      this.lastSeen.set(connection.peer, Date.now());
      this.send(connection, { type: "hello", player });
      this.pingHost();
    });
    connection.on("data", (raw: unknown) => {
      if (!current() || !this.isPacket(raw)) return;
      this.lastSeen.set(connection.peer, Date.now());
      if (raw.type === "reject" && this.phase === "connecting") {
        this.fail(
          typeof raw.message === "string"
            ? raw.message.slice(0, 160)
            : "Không thể tham gia phòng.",
        );
      } else if (raw.type === "welcome" || raw.type === "room") {
        const players = roster(raw.players);
        if (
          !players ||
          raw.code !== this.roomCode ||
          players[0].id !== connection.peer ||
          !players.some((entry) => entry.id === this.playerId)
        )
          return;
        if (raw.type === "welcome" && this.phase === "connecting") {
          // Give an immediate clock estimate even if the host starts before the first pong.
          if (finite(raw.hostTime, 0, Number.MAX_SAFE_INTEGER))
            this.hostOffset = raw.hostTime - Date.now();
          this.players = players;
          this.phase = "lobby";
          this.pendingSuccess?.();
          this.emitRoom();
        } else if (raw.type === "room" && this.phase !== "connecting") {
          this.players = players;
          this.emitRoom();
        }
      } else if (
        raw.type === "pong" &&
        finite(raw.sentAt, 0, Number.MAX_SAFE_INTEGER) &&
        finite(raw.hostTime, 0, Number.MAX_SAFE_INTEGER)
      ) {
        if (!this.pendingPings.delete(raw.sentAt)) return;
        const elapsed = Date.now() - raw.sentAt;
        if (elapsed >= 0 && elapsed < this.bestRoundTrip) {
          this.bestRoundTrip = elapsed;
          this.hostOffset = raw.hostTime - (raw.sentAt + elapsed / 2);
        }
      } else if (
        raw.type === "start" &&
        this.phase === "lobby" &&
        typeof raw.track === "string" &&
        /^[a-zA-Z0-9_-]{1,64}$/.test(raw.track) &&
        finite(raw.startAt, 0, Number.MAX_SAFE_INTEGER)
      ) {
        const localStart = raw.startAt - this.hostOffset;
        if (
          localStart < Date.now() - TIMEOUT ||
          localStart > Date.now() + 30_000
        )
          return;
        this.phase = "racing";
        this.raceStartAt = localStart;
        this.players = this.players.map((entry) => ({
          ...entry,
          ...INITIAL_STATE,
        }));
        this.onEvent({ type: "start", track: raw.track, startAt: localStart });
      } else if (raw.type === "state" && this.phase === "racing") {
        const players = roster(raw.players);
        if (
          !players ||
          players.length !== this.players.length ||
          players.some(
            (entry) => !this.players.some((known) => known.id === entry.id),
          )
        )
          return;
        this.players = players;
        this.onEvent({ type: "state", players: this.snapshot() });
      } else if (
        raw.type === "powerup" &&
        this.phase === "racing" &&
        typeof raw.id === "string" &&
        POWERUPS.has(raw.id) &&
        typeof raw.from === "string" &&
        this.players.some((entry) => entry.id === raw.from)
      ) {
        if (raw.id === "rocket" || raw.id === "banana") {
          if (
            typeof raw.target !== "string" ||
            (raw.target !== "" &&
              (raw.target === raw.from ||
                !this.players.some((entry) => entry.id === raw.target)))
          )
            return;
          this.onEvent({
            type: "powerup",
            id: raw.id,
            from: raw.from,
            target: raw.target,
          });
        } else {
          this.onEvent({ type: "powerup", id: raw.id, from: raw.from });
        }
      } else if (raw.type === "closed") {
        this.fail(
          "Chủ phòng đã rời đi. Hãy tạo một phòng mới để đua tiếp nhé.",
        );
      }
    });
    connection.on("close", () => {
      if (current())
        this.fail(
          "Mất kết nối với chủ phòng. Hãy tạo hoặc tham gia phòng mới.",
        );
    });
    connection.on("error", () => {
      if (current())
        this.fail(
          "Không kết nối được với chủ phòng. Hãy thử lại hoặc đổi mạng.",
        );
    });
  }

  private isPacket(raw: unknown): raw is Packet {
    return (
      record(raw) &&
      raw.v === PROTOCOL &&
      typeof raw.type === "string" &&
      raw.type.length < 24
    );
  }

  private updatePlayer(id: string, value: NetworkState): void {
    const player = this.players.find((entry) => entry.id === id);
    if (!player || player.finished) return;
    // The connection identifies the sender; packets cannot write another kart's state.
    Object.assign(player, value);
  }

  private relayPowerup(id: string, from: string): void {
    const now = Date.now();
    const sender = this.players.find((entry) => entry.id === from);
    if (!sender || sender.finished) return;
    if (now - (this.lastPowerup.get(from) ?? 0) < 500) return;
    this.lastPowerup.set(from, now);
    let target: string | undefined;
    if (id === "rocket" || id === "banana") {
      const opponents = this.players.filter(
        (entry) => entry.id !== from && !entry.finished,
      );
      const candidates =
        id === "rocket"
          ? opponents
              .filter((entry) => entry.progress > sender.progress)
              .sort((a, b) => a.progress - b.progress)
          : opponents
              .filter((entry) => entry.progress < sender.progress)
              .sort((a, b) => b.progress - a.progress);
      target = candidates[0]?.id ?? "";
    }
    const event = {
      type: "powerup",
      id,
      from,
      ...(target !== undefined ? { target } : {}),
    };
    this.broadcast(event);
    this.onEvent(event);
  }

  private sendState(): void {
    const players = this.snapshot();
    this.broadcast({ type: "state", players });
    this.onEvent({ type: "state", players });
  }

  private publishRoom(): void {
    this.broadcast({
      type: "room",
      code: this.roomCode,
      players: this.snapshot(),
    });
    this.emitRoom();
  }

  private emitRoom(): void {
    this.onEvent({
      type: "room",
      code: this.roomCode,
      players: this.snapshot(),
      isHost: this.isHost,
    });
  }

  private snapshot(): NetworkPlayer[] {
    return this.players.map((player) => ({ ...player }));
  }

  private send(connection: DataConnection, data: Omit<Packet, "v">): void {
    if (!connection.open) return;
    // Preserve control messages but discard stale position updates on a congested link.
    if (
      data.type === "state" &&
      connection.dataChannel?.bufferedAmount > 64_000
    )
      return;
    try {
      connection.send({ ...data, v: PROTOCOL });
    } catch {
      connection.close();
    }
  }

  private sendToHost(data: Omit<Packet, "v">): void {
    const connection = this.connections.get(PREFIX + this.roomCode);
    if (connection) this.send(connection, data);
  }

  private broadcast(data: Omit<Packet, "v">): void {
    for (const player of this.players) {
      if (player.id === this.playerId) continue;
      const connection = this.connections.get(player.id);
      if (connection) this.send(connection, data);
    }
  }

  private pingHost(): void {
    const sentAt = Date.now();
    for (const timestamp of this.pendingPings) {
      if (sentAt - timestamp > TIMEOUT) this.pendingPings.delete(timestamp);
    }
    this.pendingPings.add(sentAt);
    this.sendToHost({ type: "ping", sentAt });
  }

  private beginHeartbeat(): void {
    this.heartbeat = setInterval(() => {
      const now = Date.now();
      if (this.isHost) {
        for (const player of [...this.players]) {
          if (
            player.id !== this.playerId &&
            now - (this.lastSeen.get(player.id) ?? now) > TIMEOUT
          )
            this.dropGuest(player.id);
        }
      } else {
        const seen = this.lastSeen.get(PREFIX + this.roomCode) ?? now;
        if (now - seen > TIMEOUT)
          this.fail("Chủ phòng không còn phản hồi. Hãy thử tham gia lại nhé.");
        else this.pingHost();
      }
    }, 2000);
  }

  private dropGuest(id: string): void {
    const connection = this.connections.get(id);
    this.connections.delete(id);
    this.lastSeen.delete(id);
    this.lastState.delete(id);
    this.lastPowerup.delete(id);
    connection?.close();
    const admitted = this.players.some((player) => player.id === id);
    this.players = this.players.filter((player) => player.id !== id);
    if (admitted && this.phase !== "idle") this.publishRoom();
  }

  private fail(message: string): void {
    if (this.phase === "idle") return;
    this.cleanup(new Error(message));
    this.onEvent({ type: "error", message });
    this.onEvent({ type: "closed" });
  }

  private schedule(
    callback: () => void,
    delay: number,
  ): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    this.timers.add(timer);
    return timer;
  }

  private cancelTimer(timer: ReturnType<typeof setTimeout>): void {
    clearTimeout(timer);
    this.timers.delete(timer);
  }

  private cleanup(reason: Error): void {
    this.generation += 1;
    this.phase = "idle";
    const reject = this.pendingFailure;
    this.pendingFailure = null;
    this.pendingSuccess = null;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    if (this.heartbeat !== null) clearInterval(this.heartbeat);
    this.heartbeat = null;
    const peer = this.peer;
    this.peer = null;
    for (const connection of this.connections.values()) connection.close();
    this.connections.clear();
    peer?.destroy();
    this.lastSeen.clear();
    this.lastState.clear();
    this.lastPowerup.clear();
    this.pendingPings.clear();
    this.players = [];
    this.roomCode = "";
    this.playerId = "";
    this.isHost = false;
    this.hostOffset = 0;
    this.bestRoundTrip = Infinity;
    this.raceStartAt = 0;
    reject?.(reason);
  }
}
