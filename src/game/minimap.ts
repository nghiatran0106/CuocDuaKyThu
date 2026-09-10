import { characters } from "../data";

export type MapPoint = { x: number; y: number };
export type MapRacer = {
  id: string;
  character: string;
  progress: number;
  player: boolean;
  finished: boolean;
};

const SVG_NS = "http://www.w3.org/2000/svg";

/** The route and markers share the engine's distance along the closed circuit. */
export class RaceMinimap {
  private points: MapPoint[] = [];
  private markers = new Map<string, SVGGElement>();
  private markerLayer: SVGGElement | null = null;

  constructor(private readonly svg: SVGSVGElement) {}

  setCircuit(points: MapPoint[]) {
    if (points.length < 3) return;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const scale = Math.min(
      164 / Math.max(1e-6, maxX - minX),
      116 / Math.max(1e-6, maxY - minY),
    );
    this.points = points.map((point) => ({
      x: 100 + (point.x - (minX + maxX) / 2) * scale,
      y: 76 + (point.y - (minY + maxY) / 2) * scale,
    }));
    const path =
      this.points
        .map(
          (point, index) =>
            `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`,
        )
        .join(" ") + " Z";
    const start = this.points[0];
    const angle = this.sample(0).angle;
    this.svg.innerHTML = `<title>Lộ trình đường đua, vạch xuất phát và vị trí các tay đua</title><path class="minimap-road-edge" d="${path}"/><path class="minimap-road" d="${path}"/><g class="minimap-start" transform="translate(${start.x} ${start.y}) rotate(${angle})"><title>Xuất phát / về đích</title><rect x="-9" y="-4" width="18" height="8" rx="1" fill="#fff"/><path d="M-9-4h4.5v4H-9zM0-4h4.5v4H0zM-4.5 0H0v4h-4.5zM4.5 0H9v4H4.5z" fill="#183c3c"/></g><g class="minimap-markers"></g>`;
    this.markerLayer = this.svg.querySelector<SVGGElement>(".minimap-markers");
    this.markers.clear();
  }

  update(racers: MapRacer[]) {
    if (!this.points.length || !this.markerLayer) return;
    const activeIds = new Set(racers.map((racer) => racer.id));
    for (const [id, marker] of this.markers) {
      if (!activeIds.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }
    // Append the player last, so their arrow remains visible in a tight pack.
    for (const racer of [...racers].sort(
      (a, b) => Number(a.player) - Number(b.player),
    )) {
      let marker = this.markers.get(racer.id);
      if (!marker) {
        marker = document.createElementNS(SVG_NS, "g");
        marker.classList.add("minimap-racer");
        marker.classList.toggle("is-player", racer.player);
        marker.dataset.racer = racer.id;
        marker.dataset.player = String(racer.player);
        const character = characters.find(
          (entry) => entry.id === racer.character,
        );
        const title = document.createElementNS(SVG_NS, "title");
        title.textContent = racer.player ? "Bạn" : character?.name || "Đối thủ";
        marker.appendChild(title);
        const shape = document.createElementNS(
          SVG_NS,
          racer.player ? "path" : "circle",
        );
        if (racer.player) shape.setAttribute("d", "M0-8 6 6 0 3-6 6Z");
        else shape.setAttribute("r", "4.6");
        shape.setAttribute(
          "fill",
          racer.player ? "#d1ff78" : character?.accent || "#f8b985",
        );
        marker.appendChild(shape);
        this.markers.set(racer.id, marker);
        this.markerLayer.appendChild(marker);
      }
      const point = this.sample(racer.finished ? 0 : racer.progress);
      marker.setAttribute(
        "transform",
        `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) rotate(${point.angle.toFixed(1)})`,
      );
      marker.dataset.progress = String(racer.progress);
      marker.classList.toggle("is-finished", racer.finished);
      if (racer.player && marker !== this.markerLayer.lastElementChild)
        this.markerLayer.appendChild(marker);
    }
  }

  private sample(progress: number) {
    const index = (((progress % 1) + 1) % 1) * this.points.length;
    const start = this.points[Math.floor(index) % this.points.length];
    const end = this.points[(Math.floor(index) + 1) % this.points.length];
    const fraction = index - Math.floor(index);
    return {
      x: start.x + (end.x - start.x) * fraction,
      y: start.y + (end.y - start.y) * fraction,
      angle:
        (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI + 90,
    };
  }
}
