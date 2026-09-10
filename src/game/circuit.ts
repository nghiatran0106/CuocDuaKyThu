export const SEGMENT_LENGTH = 210;
export const SEGMENT_COUNT = 280;
export const TRACK_LENGTH = SEGMENT_LENGTH * SEGMENT_COUNT;

export type CircuitSample = {
  curve: number;
  hill: number;
  /** Half-width relative to the standard road; lanes still use road coordinates. */
  width: number;
  /** Coordinates in a unit square, with the circuit's aspect ratio preserved. */
  mapX: number;
  mapY: number;
  name: string;
};

export type Circuit = {
  samples: CircuitSample[];
  boxStations: { index: number; x: number }[];
  boostPads: { index: number; x: number }[];
};

type Waypoint = [
  x: number,
  y: number,
  rounding: number,
  width: number,
  name: string,
];
type PathPoint = { x: number; y: number; width: number; name: string };

// Each layout is a closed circuit, starting partway along the main straight.
// Small rounding distances create braking zones; alternating corners create S bends.
const LAYOUTS: Record<string, Waypoint[]> = {
  tropical: [
    [0, 0, 0, 1, "Đường thẳng bãi biển"],
    [320, 0, 48, 0.94, "Cua hải đăng"],
    [370, 55, 29, 0.78, "Kẹp tóc hải đăng"],
    [320, 110, 35, 0.83, "Lối ra hải đăng"],
    [170, 110, 30, 0.84, "Chữ S vườn dừa"],
    [125, 155, 30, 0.78, "Chữ S vườn dừa"],
    [195, 220, 38, 0.9, "Cầu gỗ"],
    [280, 220, 32, 0.72, "Cầu gỗ"],
    [340, 280, 35, 0.83, "Cua vịnh xanh"],
    [260, 360, 48, 0.94, "Bờ vịnh xanh"],
    [70, 360, 35, 0.93, "Chicane bãi đá"],
    [15, 290, 25, 0.77, "Chicane bãi đá"],
    [-50, 360, 34, 0.84, "Chicane bãi đá"],
    [-160, 310, 46, 0.92, "Dốc hàng dừa"],
    [-175, 100, 48, 0.94, "Cua về bãi biển"],
    [-100, 0, 48, 1, "Đường thẳng bãi biển"],
  ],
  candy: [
    [0, 0, 0, 1, "Đại lộ kẹo ngọt"],
    [380, 0, 42, 0.94, "Cua bánh vòng"],
    [410, 60, 27, 0.77, "Kẹp tóc bánh vòng"],
    [350, 100, 32, 0.87, "Lối ra bánh vòng"],
    [255, 100, 27, 0.86, "Chữ S caramel"],
    [225, 155, 24, 0.74, "Chữ S caramel"],
    [285, 195, 28, 0.84, "Cầu bánh quy"],
    [375, 195, 27, 0.7, "Cầu bánh quy"],
    [415, 255, 25, 0.77, "Kẹp tóc kem dâu"],
    [375, 310, 30, 0.87, "Lối ra kem dâu"],
    [140, 310, 42, 0.93, "Cua kẹo xoắn"],
    [95, 245, 26, 0.77, "Chicane kẹo xoắn"],
    [140, 185, 26, 0.76, "Chicane kẹo xoắn"],
    [75, 155, 29, 0.81, "Chữ S chocolate"],
    [-30, 235, 37, 0.85, "Chữ S chocolate"],
    [-100, 210, 29, 0.86, "Dốc marshmallow"],
    [-145, 115, 43, 0.94, "Cua về đại lộ"],
    [-100, 0, 43, 1, "Đại lộ kẹo ngọt"],
  ],
  sunset: [
    [0, 0, 0, 1, "Đường thẳng chân núi"],
    [420, 0, 50, 0.94, "Dốc hoàng hôn"],
    [475, 90, 33, 0.77, "Kẹp tóc đỉnh núi"],
    [380, 145, 35, 0.85, "Sườn núi"],
    [210, 145, 34, 0.82, "Cua vực đá"],
    [180, 200, 23, 0.7, "Kẹp tóc vực đá"],
    [245, 245, 27, 0.78, "Cầu treo"],
    [370, 245, 32, 0.7, "Cầu treo"],
    [405, 315, 25, 0.75, "Kẹp tóc cầu treo"],
    [335, 365, 32, 0.86, "Đổ đèo"],
    [95, 365, 48, 0.92, "Cua thung lũng"],
    [45, 300, 25, 0.78, "Chicane thung lũng"],
    [100, 255, 26, 0.74, "Chicane thung lũng"],
    [55, 205, 25, 0.77, "Chữ S vách núi"],
    [-60, 285, 32, 0.8, "Chữ S vách núi"],
    [-125, 240, 25, 0.77, "Cua khe núi"],
    [-115, 110, 33, 0.83, "Chicane khe núi"],
    [-190, 65, 28, 0.79, "Chicane khe núi"],
    [-130, 0, 44, 1, "Đường thẳng chân núi"],
  ],
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

function roundedPath(waypoints: Waypoint[]): PathPoint[] {
  const corners = waypoints.map((point, i) => {
    const previous = waypoints[(i + waypoints.length - 1) % waypoints.length];
    const next = waypoints[(i + 1) % waypoints.length];
    const incoming = Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    const outgoing = Math.hypot(next[0] - point[0], next[1] - point[1]);
    const cut = Math.min(point[2], incoming * 0.44, outgoing * 0.44);
    return {
      entry: {
        x: point[0] - ((point[0] - previous[0]) / incoming) * cut,
        y: point[1] - ((point[1] - previous[1]) / incoming) * cut,
      },
      exit: {
        x: point[0] + ((next[0] - point[0]) / outgoing) * cut,
        y: point[1] + ((next[1] - point[1]) / outgoing) * cut,
      },
      point,
    };
  });
  const path: PathPoint[] = [{ x: 0, y: 0, width: 1, name: waypoints[0][4] }];
  for (let i = 1; i <= corners.length; i++) {
    const previous = corners[i - 1];
    const current = corners[i % corners.length];
    const lineLength = Math.hypot(
      current.entry.x - previous.exit.x,
      current.entry.y - previous.exit.y,
    );
    const steps = Math.max(1, Math.ceil(lineLength / 2));
    for (let j = 1; j <= steps; j++) {
      const t = j / steps;
      path.push({
        x: lerp(previous.exit.x, current.entry.x, t),
        y: lerp(previous.exit.y, current.entry.y, t),
        width: lerp(previous.point[3], current.point[3], t * t * (3 - 2 * t)),
        name: current.point[4],
      });
    }
    if (current.point[2] === 0) continue;
    for (let j = 1; j <= 36; j++) {
      const t = j / 36;
      const a = (1 - t) ** 2;
      const b = 2 * (1 - t) * t;
      const c = t * t;
      path.push({
        x: a * current.entry.x + b * current.point[0] + c * current.exit.x,
        y: a * current.entry.y + b * current.point[1] + c * current.exit.y,
        width: current.point[3],
        name: current.point[4],
      });
    }
  }
  return path;
}

/** Advisory grip limit shared by player understeer and opponent braking. */
export function cornerSpeed(
  curve: number,
  handling = 1,
  drifting = false,
): number {
  const bend = Math.max(0, Math.abs(curve) - 0.4);
  return clamp(
    1 / Math.sqrt(1 + (bend * 0.64) / handling) + (drifting ? 0.14 : 0),
    0.48,
    1,
  );
}

export function createCircuit(track: string): Circuit {
  const layout = LAYOUTS[track] || LAYOUTS.tropical;
  const path = roundedPath(layout);
  const distances = [0];
  for (let i = 1; i < path.length; i++)
    distances.push(
      distances[i - 1] +
        Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y),
    );
  const length = distances[distances.length - 1];
  const points: PathPoint[] = [];
  let cursor = 1;
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const distance = (i * length) / SEGMENT_COUNT;
    while (cursor < path.length - 1 && distances[cursor] < distance) cursor++;
    const a = path[cursor - 1];
    const b = path[cursor];
    const t =
      (distance - distances[cursor - 1]) /
      (distances[cursor] - distances[cursor - 1]);
    points.push({
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      width: lerp(a.width, b.width, t),
      name: b.name,
    });
  }
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const scale = Math.max(maxX - minX, maxY - minY);
  const hills = track === "sunset" ? 430 : track === "candy" ? 155 : 235;
  const samples = points.map((point, i): CircuitSample => {
    const previous = points[(i + SEGMENT_COUNT - 1) % SEGMENT_COUNT];
    const next = points[(i + 1) % SEGMENT_COUNT];
    const incoming = Math.atan2(point.y - previous.y, point.x - previous.x);
    const outgoing = Math.atan2(next.y - point.y, next.x - point.x);
    const angle = Math.atan2(
      Math.sin(outgoing - incoming),
      Math.cos(outgoing - incoming),
    );
    const phase = (i / SEGMENT_COUNT) * Math.PI * 2;
    return {
      // Positive map turns are clockwise (right), matching the road renderer.
      curve: clamp(angle * 17, -5, 5),
      hill: hills * (Math.sin(phase * 2) + Math.sin(phase * 3) * 0.35),
      width: point.width,
      mapX: (point.x - (minX + maxX) / 2) / scale + 0.5,
      mapY: (point.y - (minY + maxY) / 2) / scale + 0.5,
      name: i < 30 ? layout[0][4] : point.name,
    };
  });
  // Sparse stations offer lane choices. Turbo belongs to the long finishing
  // straight, where its full duration can be used without a blind hairpin.
  const exitStation = (from: number, to: number) => {
    let best = from;
    let score = Infinity;
    for (let i = from; i < to; i++) {
      const candidate =
        Math.abs(samples[i].curve) +
        Math.abs(samples[(i + 5) % SEGMENT_COUNT].curve) * 0.6;
      if (candidate < score) {
        score = candidate;
        best = i;
      }
    }
    return best;
  };
  return {
    samples,
    boxStations: [
      { index: 18, x: 0 },
      { index: exitStation(100, 133), x: -0.48 },
      { index: exitStation(184, 215), x: 0.48 },
    ],
    boostPads: [{ index: exitStation(270, 280), x: -0.38 }],
  };
}
