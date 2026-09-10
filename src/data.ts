export const characters = [
  {
    id: "fox",
    name: "Foxy",
    title: "Cáo tốc độ",
    color: "#fff0df",
    accent: "#ed9546",
    tag: "CÂN BẰNG",
    speed: 4,
    handling: 4,
    boost: 4,
    description:
      "Tự tin ở mọi khúc cua. Người bạn đồng hành hoàn hảo cho chặng đua đầu tiên.",
  },
  {
    id: "bunny",
    name: "Bun Bun",
    title: "Thỏ tinh nghịch",
    color: "#f4eaff",
    accent: "#ac7bdc",
    tag: "LINH HOẠT",
    speed: 3,
    handling: 5,
    boost: 4,
    description:
      "Nhỏ nhắn, lanh lợi và mê drift. Lướt qua những khúc cua như một cơn gió.",
  },
  {
    id: "panda",
    name: "Bao",
    title: "Gấu trúc mê đua",
    color: "#e5f4ee",
    accent: "#5baf8c",
    tag: "ỔN ĐỊNH",
    speed: 4,
    handling: 3,
    boost: 5,
    description:
      "Bình tĩnh giữ tay lái, chờ đúng thời điểm và bứt tốc về đích.",
  },
  {
    id: "cat",
    name: "Mochi",
    title: "Mèo mộng mơ",
    color: "#e8efff",
    accent: "#6d92db",
    tag: "BỨT PHÁ",
    speed: 5,
    handling: 3,
    boost: 4,
    description:
      "Trông đáng yêu nhưng đua rất cừ. Luôn sẵn sàng bật nitro và dẫn đầu.",
  },
];
export const tracks = [
  {
    id: "tropical",
    name: "Đảo Nắng Vàng",
    subtitle: "Kẹp tóc hải đăng, chữ S vườn dừa.",
    tag: "NHIỆT ĐỚI",
    level: "Kỹ thuật",
    length: "3 vòng",
    color: "#deeee0",
  },
  {
    id: "candy",
    name: "Thung Lũng Kẹo",
    subtitle: "Chicane liên tiếp, cầu bánh quy hẹp.",
    tag: "NGỌT NGÀO",
    level: "Thử thách",
    length: "3 vòng",
    color: "#f5e5ef",
  },
  {
    id: "sunset",
    name: "Đèo Hoàng Hôn",
    subtitle: "Phanh gấp, ôm cua tay áo trên đèo.",
    tag: "PHIÊU LƯU",
    level: "Chuyên gia",
    length: "3 vòng",
    color: "#f9e8d8",
  },
];
export const powerups = [
  {
    id: "nitro",
    name: "Tên lửa Nitro",
    description:
      "Tăng tốc cực mạnh trong thời gian ngắn. Bật ngay trên đoạn thẳng!",
    color: "#fff2cc",
    key: "BỨT TỐC",
  },
  {
    id: "shield",
    name: "Khiên bong bóng",
    description:
      "Bong bóng bảo vệ giúp bạn an toàn trước đòn tấn công của đối thủ.",
    color: "#dff5fc",
    key: "PHÒNG THỦ",
  },
  {
    id: "rocket",
    name: "Rocket truy đuổi",
    description: "Gửi một bất ngờ đến tay đua phía trước và giành lại lợi thế.",
    color: "#ffe5df",
    key: "TẤN CÔNG",
  },
  {
    id: "magnet",
    name: "Nam châm xu",
    description: "Hút những đồng xu xung quanh mà không cần đổi làn.",
    color: "#f0e5ff",
    key: "THU THẬP",
  },
  {
    id: "banana",
    name: "Chuối trượt vỏ",
    description: "Thả một chiếc bẫy tinh nghịch cho tay đua theo sau.",
    color: "#fff5d0",
    key: "ĐẶT BẪY",
  },
  {
    id: "lightning",
    name: "Sấm sét tí hon",
    description: "Làm chậm đối thủ để bạn có cơ hội vượt lên.",
    color: "#e8efdb",
    key: "ĐẢO NGƯỢC",
  },
];
export type Result = {
  position: number;
  time: number;
  coins: number;
  boosts: number;
  drifts: number;
  track: string;
  character: string;
  date: string;
  online: boolean;
};
export type Profile = {
  name: string;
  character: string;
  track: string;
  sound: boolean;
  difficulty: "easy" | "normal" | "hard";
  coins: number;
  races: number;
  wins: number;
  drifts: number;
  results: Result[];
};
const safeCount = (n: unknown, max = 1_000_000) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.min(max, Math.max(0, Math.floor(n)))
    : 0;
function readResult(value: unknown): Result | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (
    typeof r.time !== "number" ||
    !Number.isFinite(r.time) ||
    r.time < 0 ||
    r.time > 36000
  )
    return null;
  if (
    typeof r.position !== "number" ||
    !Number.isInteger(r.position) ||
    r.position < 1 ||
    r.position > 4
  )
    return null;
  if (typeof r.date !== "string" || !Number.isFinite(Date.parse(r.date)))
    return null;
  if (
    !tracks.some((t) => t.id === r.track) ||
    !characters.some((c) => c.id === r.character)
  )
    return null;
  return {
    position: r.position,
    time: r.time,
    coins: safeCount(r.coins),
    boosts: safeCount(r.boosts),
    drifts: safeCount(r.drifts),
    track: String(r.track),
    character: String(r.character),
    date: new Date(r.date).toISOString(),
    online: r.online === true,
  };
}
export function readProfile(): Profile {
  const defaults: Profile = {
    name: "Tay đua mới",
    character: "fox",
    track: "tropical",
    sound: true,
    difficulty: "normal",
    coins: 0,
    races: 0,
    wins: 0,
    drifts: 0,
    results: [],
  };
  try {
    const s = JSON.parse(
      localStorage.getItem("turbo-buddies-profile") || "null",
    );
    if (!s || typeof s !== "object") return defaults;
    return {
      name: typeof s.name === "string" ? s.name.slice(0, 20) : defaults.name,
      character: characters.some((c) => c.id === s.character)
        ? s.character
        : "fox",
      track: tracks.some((t) => t.id === s.track) ? s.track : "tropical",
      sound: typeof s.sound === "boolean" ? s.sound : true,
      difficulty: ["easy", "normal", "hard"].includes(s.difficulty)
        ? s.difficulty
        : "normal",
      coins: safeCount(s.coins),
      races: safeCount(s.races),
      wins: safeCount(s.wins),
      drifts: safeCount(s.drifts),
      results: Array.isArray(s.results)
        ? s.results
            .slice(0, 30)
            .map(readResult)
            .filter((r: Result | null): r is Result => r !== null)
        : [],
    };
  } catch {
    return defaults;
  }
}
export function saveProfile(profile: Profile) {
  try {
    localStorage.setItem("turbo-buddies-profile", JSON.stringify(profile));
  } catch {}
}
export function escapeHtml(s: string) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function formatTime(s: number) {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}.${Math.floor((s % 1) * 100)
    .toString()
    .padStart(2, "0")}`;
}
