import "@fontsource/be-vietnam-pro/vietnamese-400.css";
import "@fontsource/be-vietnam-pro/vietnamese-500.css";
import "@fontsource/be-vietnam-pro/vietnamese-600.css";
import "@fontsource/be-vietnam-pro/vietnamese-700.css";
import "@fontsource/be-vietnam-pro/latin-400.css";
import "@fontsource/be-vietnam-pro/latin-500.css";
import "@fontsource/be-vietnam-pro/latin-600.css";
import "@fontsource/be-vietnam-pro/latin-700.css";
import "@fontsource/barlow-condensed/vietnamese-700.css";
import "@fontsource/barlow-condensed/vietnamese-800.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "./style.css";
import { characterArt, heroArt, trackArt, powerupArt } from "./art";
import { icon } from "./icons";
import {
  characters,
  tracks,
  powerups,
  readProfile,
  saveProfile,
  escapeHtml,
  formatTime,
  type Result,
} from "./data";
import { RaceGame, type GameEvent } from "./game/engine";
import { RaceMinimap, type MapPoint, type MapRacer } from "./game/minimap";
import { MultiplayerSession, type MultiplayerEvent } from "./multiplayer";
import {
  getAppState,
  subscribeAppState,
  installApp,
  applyAppUpdate,
  initPwa,
  type AppState,
} from "./pwa";

const app = document.querySelector<HTMLDivElement>("#app")!;
const overlay = document.querySelector<HTMLDivElement>("#overlay-root")!;
const profile = readProfile();
let page = "home",
  game: RaceGame | null = null,
  network: MultiplayerSession | null = null,
  networkInterval = 0,
  racing = false,
  raceOnline = false,
  currentPowerup: string | null = null,
  toastTimer = 0,
  lastFocus: HTMLElement | null = null;
let popupTimeout = 0;
let minimap: RaceMinimap | null = null;
let cornerSymbol = "";
let updatingApp = false;
type CornerAdvice = {
  direction: "left" | "right" | "straight";
  severity: "hairpin" | "sharp" | "bend" | "straight";
  distance: number;
  speed: number;
  name: string;
};
const nav = [
  ["home", "home", "Sảnh đua"],
  ["characters", "users", "Nhân vật"],
  ["tracks", "map", "Đường đua"],
  ["powerups", "bolt", "Power-up"],
  ["achievements", "trophy", "Thành tích"],
];
const getCharacter = () => characters.find((c) => c.id === profile.character)!;
const getTrack = () => tracks.find((t) => t.id === profile.track)!;
function persist() {
  saveProfile(profile);
}
function toast(message: string) {
  const root = document.querySelector("#toast-root")!;
  root.innerHTML = `${icon("spark")}<span>${escapeHtml(message)}</span>`;
  root.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => root.classList.remove("visible"), 3600);
}
function appInstallCard() {
  return `<section class="app-install-card" id="app-install-card" aria-label="Ứng dụng Turbo Buddies"><span class="app-install-art" aria-hidden="true"><svg width="30" height="34" viewBox="0 0 30 34" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="18" height="30" rx="4"/><path d="M12 6h6m-4 22h2M15 11v10m-4-4 4 4 4-4"/></svg></span><div class="app-install-copy"><span class="eyebrow">ĐƯỜNG ĐUA TRONG TÚI BẠN</span><strong id="app-install-title">Mang Turbo Buddies lên điện thoại</strong><p>Mở từ màn hình chính. Chơi với máy cả khi mất mạng.</p><span class="app-install-status" id="app-install-status" role="status"></span></div><div class="app-install-actions"><span class="app-installed-badge" hidden>${icon("check", 14)}Đã cài trên thiết bị</span><button class="btn dark app-install-button" id="app-install-button" data-action="install" aria-label="Cài Turbo Buddies">Cài Turbo Buddies ${icon("arrow", 15)}</button><button class="btn outlined app-update-button" id="app-update-button" data-action="update-app" aria-label="Cập nhật ứng dụng" hidden>Cập nhật ứng dụng ${icon("spark", 14)}</button><button class="text-button app-install-guide-button" data-action="install-info">Cách cài trên điện thoại ${icon("chevron", 12)}</button></div></section>`;
}
function updateAppInstallCard(state: AppState = getAppState()) {
  const card = document.getElementById("app-install-card");
  if (!card) return;
  card.dataset.installed = String(state.installed);
  card.dataset.offlineReady = String(state.offlineReady);
  card.dataset.online = String(state.online);
  document.getElementById("app-install-title")!.textContent = state.installed
    ? "Turbo Buddies đã có trên thiết bị của bạn"
    : "Mang Turbo Buddies lên điện thoại";
  const status = document.getElementById("app-install-status")!;
  const statusText = state.offlineReady
    ? state.online
      ? "Sẵn sàng đua ngoại tuyến"
      : "Đang ngoại tuyến · Đua với máy vẫn sẵn sàng"
    : state.offlineError
      ? "Chưa lưu được game · Cần mạng để mở lại"
      : state.online
        ? "Chơi ngoại tuyến chưa sẵn sàng"
        : "Đang ngoại tuyến · Chưa có bản lưu đầy đủ";
  if (status.textContent !== statusText) status.textContent = statusText;
  const installButton = document.getElementById(
    "app-install-button",
  ) as HTMLButtonElement;
  installButton.hidden = state.installed;
  installButton.disabled = updatingApp;
  card.querySelector<HTMLElement>(".app-installed-badge")!.hidden =
    !state.installed;
  const updateButton = document.getElementById(
    "app-update-button",
  ) as HTMLButtonElement;
  updateButton.hidden = !state.updateAvailable || racing || page !== "home";
  updateButton.disabled = updatingApp;
  updateButton.textContent = updatingApp
    ? "Đang cập nhật…"
    : "Cập nhật ứng dụng";
}
function showAppInstallInfo() {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const iosSteps = `<ol class="app-install-steps"><li>Mở trang game này trong <strong>Safari</strong>.</li><li>Chạm <strong>Chia sẻ</strong>, rồi chọn <strong>Thêm vào MH chính</strong>.</li><li>Bật <strong>Mở dưới dạng ứng dụng web</strong> nếu thấy tùy chọn này, rồi chạm <strong>Thêm</strong>.</li></ol>`;
  showModal(
    `<div id="app-install-guide"><span class="modal-symbol">${icon("gamepad", 30)}</span><span class="eyebrow">CHẠM BIỂU TƯỢNG. VÀO ĐƯỜNG ĐUA.</span><h2>Cài Turbo Buddies</h2><p>Thêm game vào màn hình chính để mở như một ứng dụng. Bạn xác nhận việc cài đặt trên thiết bị của mình.</p>${ios ? iosSteps : `<ol class="app-install-steps"><li>Trên Android, mở game bằng <strong>Chrome</strong>.</li><li>Mở menu <strong>⋮</strong>, chọn <strong>Cài đặt ứng dụng</strong> hoặc <strong>Thêm vào màn hình chính</strong>, rồi xác nhận.</li><li>Trên máy tính, tìm biểu tượng cài đặt trong thanh địa chỉ hoặc menu trình duyệt.</li></ol><details class="app-ios-guide"><summary>Dùng iPhone hoặc iPad?</summary>${iosSteps}</details>`}<div class="tip-box">${icon("check")}<span>Chờ trạng thái <strong>Sẵn sàng đua ngoại tuyến</strong> ở sảnh trước khi ngắt mạng. Đua với máy không cần mạng; đua cùng bạn bè cần kết nối.</span></div><p class="small-note">Nếu đang mở game bên trong ứng dụng nhắn tin, hãy mở lại bằng trình duyệt của điện thoại.</p><button class="btn primary full-width" data-close>Đã hiểu ${icon("check")}</button></div>`,
  );
}
async function requestAppInstall() {
  if (racing || updatingApp) return;
  try {
    // Keep the native prompt in the button's user gesture.
    const result = await installApp();
    if (result === "unavailable") showAppInstallInfo();
    else if (result === "dismissed")
      toast("Bạn có thể cài game bất cứ lúc nào ở sảnh đua.");
    else toast("Đã gửi yêu cầu cài Turbo Buddies lên thiết bị.");
  } catch {
    showAppInstallInfo();
  }
}
async function updateInstalledApp() {
  if (racing || updatingApp || page !== "home" || network || overlay.innerHTML)
    return;
  updatingApp = true;
  updateAppInstallCard();
  try {
    await applyAppUpdate();
  } catch (error) {
    updatingApp = false;
    updateAppInstallCard();
    toast(
      error instanceof Error
        ? error.message
        : "Chưa cập nhật được ứng dụng. Hãy thử lại khi có mạng.",
    );
  }
}
function statsBars(n: number) {
  return `<span class="stat-bars">${Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? "filled" : ""}"></i>`).join("")}</span>`;
}
function characterCards(expanded = false) {
  return `<div class="character-grid ${expanded ? "expanded" : ""}">${characters.map((c) => `<button class="character-card ${profile.character === c.id ? "selected" : ""}" data-character="${c.id}" aria-pressed="${profile.character === c.id}" style="--card-bg:${c.color};--character-accent:${c.accent}"><span class="selected-mark">${icon("check", 13)}</span><span class="character-portrait">${characterArt(c.id)}</span><span class="character-details"><strong>${c.name}</strong><span>${c.title}</span></span>${expanded ? `<span class="character-tag">${c.tag}</span><p>${c.description}</p><span class="stat-line">Tốc độ ${statsBars(c.speed)}</span><span class="stat-line">Tay lái ${statsBars(c.handling)}</span><span class="stat-line">Tăng tốc ${statsBars(c.boost)}</span>` : ""}</button>`).join("")}</div>`;
}
function trackCards() {
  return `<div class="track-grid">${tracks.map((t) => `<button class="track-card ${profile.track === t.id ? "selected" : ""}" data-track="${t.id}" aria-pressed="${profile.track === t.id}"><span class="track-image">${trackArt(t.id).replace("<svg ", '<svg preserveAspectRatio="xMidYMid slice" ')}<span class="track-badge">${t.tag}</span><span class="track-select">${icon("check", 14)}</span></span><span class="track-info"><strong>${t.name}</strong><span>${t.subtitle}</span><span class="track-meta"><span><i class="level-dot ${t.id}"></i>${t.level}</span><span>${icon("flag", 13)} ${t.length}</span>${icon("arrow", 17)}</span></span></button>`).join("")}</div>`;
}
function sectionHeader(
  kicker: string,
  title: string,
  action?: string,
  target?: string,
) {
  return `<div class="section-heading"><div><span class="eyebrow">${kicker}</span><h2>${title}</h2></div>${action ? `<button class="text-button" data-page="${target}">${action}${icon("arrow", 16)}</button>` : ""}</div>`;
}
function render() {
  const c = getCharacter(),
    title = nav.find((n) => n[0] === page)?.[2] || "Sảnh đua";
  app.innerHTML = `<aside class="sidebar"><a class="brand" href="#" data-page="home" aria-label="Turbo Buddies - Sảnh đua"><span class="brand-icon">${icon("flag", 28)}</span><span>TURBO<span>BUDDIES<span class="brand-dot">.</span></span></span></a><div class="sidebar-caption">LET'S MAKE SOME FUN</div><span class="nav-label">KHÁM PHÁ</span><nav aria-label="Điều hướng chính">${nav.map(([id, ic, label]) => `<button class="nav-item ${id === page ? "active" : ""}" data-page="${id}" aria-label="${label}" ${id === page ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span>${id === "powerups" ? "<small>6</small>" : ""}${id === page ? "<i></i>" : ""}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="friends-note"><span class="friend-icons">${icon("users", 24)}<i>+</i></span><strong>Vui hơn khi có hội!</strong><p>Tạo phòng, rủ bạn bè.<br>Cùng đua, cùng cười.</p><button data-action="friends">Đua cùng bạn ${icon("arrow", 15)}</button></div><button class="nav-item" data-action="help" aria-label="Cách chơi">${icon("help")}<span>Cách chơi</span></button><button class="nav-item" data-action="settings" aria-label="Cài đặt">${icon("gear")}<span>Cài đặt</span></button><div class="sidebar-footer"><span class="status-dot"></span> Sẵn sàng lăn bánh <span>v1.0</span></div></div></aside>
 <div class="main-shell"><header class="topbar"><div class="breadcrumb">PLAYGROUND ${icon("chevron", 12)} <strong>${title}</strong></div><div class="topbar-actions"><span class="coin-balance">${icon("coin", 18)}<strong>${profile.coins.toLocaleString("vi-VN")}</strong><span>xu</span></span><span class="top-divider"></span><button class="icon-button sound-toggle" data-action="sound" aria-label="${profile.sound ? "Tắt" : "Bật"} âm thanh">${icon(profile.sound ? "sound" : "mute")}</button><button class="profile-button" data-action="settings" aria-label="Hồ sơ và cài đặt"><span class="avatar" style="background:${c.color}">${characterArt(c.id)}</span><span><strong>${escapeHtml(profile.name)}</strong><small>Tay đua cấp ${1 + Math.floor(profile.races / 3)}</small></span>${icon("down", 14)}</button></div></header>
 <main id="main-content"><div class="page-intro"><div><span class="eyebrow">MỖI VÒNG ĐUA, MỘT NIỀM VUI</span><h1>${page === "home" ? "Chào tay đua, lên xe thôi!" : title}<span class="heading-spark">${icon(page === "home" ? "spark" : nav.find((n) => n[0] === page)?.[1] || "flag", 25)}</span></h1></div><span class="play-badge"><span class="status-dot"></span>Chơi ngay trên trình duyệt</span></div>${page === "home" ? homeContent() : page === "characters" ? `<div class="page-description">Bốn cá tính. Bốn phong cách. Chọn người bạn đồng hành của bạn.</div>${characterCards(true)}<div class="page-bottom-cta"><span>${icon("check")} Đã chọn <strong>${c.name}</strong> — cùng nhau chinh phục đường đua!</span><button class="btn primary" data-action="race">Vào đường đua ${icon("arrow")}</button></div>` : page === "tracks" ? `<div class="page-description">Một chuyến đi nhỏ, vô vàn điều bất ngờ. Cả 3 đường đua đã sẵn sàng.</div>${trackCards()}<div class="page-bottom-cta"><span>${icon("map")} Đường đua đã chọn: <strong>${getTrack().name}</strong></span><button class="btn primary" data-action="race">Đua ngay ${icon("arrow")}</button></div>` : page === "powerups" ? powerupPage() : achievementPage()}
 <footer class="main-footer"><span>${icon("flag", 14)} TURBO BUDDIES <i>·</i> Cuộc đua kỳ thú</span><span>Ít luật chơi. Nhiều niềm vui. ${icon("heart", 13)}</span></footer></main></div>`;
  bindApp();
  updateAppInstallCard();
}
function homeContent() {
  return `${appInstallCard()}<section class="hero"><div class="hero-art">${heroArt().replace("<svg ", '<svg preserveAspectRatio="xMidYMid slice" ')}</div><div class="hero-content"><span class="hero-tag"><span></span> ĐƯỜNG ĐUA NHỎ. NIỀM VUI LỚN.</span><h2>ĐẠP GA.<br><em>BẬT CHẤT.</em></h2><p>Những người bạn đáng yêu. Những cú bứt tốc bất ngờ.<br>Cuộc đua vui nhất hôm nay đang chờ bạn!</p><div class="hero-buttons"><button class="btn primary" data-action="race">${icon("play", 18)} Đua ngay ${icon("arrow", 18)}</button><button class="btn glass" data-action="friends">${icon("users", 17)} Rủ bạn cùng đua</button></div><div class="hero-features"><span>${icon("gamepad", 15)} Dễ chơi, khó dừng</span><span>${icon("bolt", 15)} Power-up cực vui</span><span>${icon("heart", 15)} Miễn phí</span></div></div><div class="hero-sticker">100%<span>GOOD VIBES</span>${icon("spark", 15)}</div><div class="hero-bottom-label"><span class="status-dot"></span> ĐẢO NẮNG VÀNG <span>01 / 03</span></div></section>
 <div class="lobby-layout"><div class="lobby-main"><section>${sectionHeader("BIỆT ĐỘI SIÊU QUẬY", "Chọn bạn đồng hành", "Khám phá nhân vật", "characters")}${characterCards()}</section><section class="tracks-section">${sectionHeader("MỖI NƠI MỘT CUỘC VUI", "Hôm nay, mình đua ở đâu?", "Xem đường đua", "tracks")}${trackCards()}</section><section class="powerup-banner"><span class="powerup-banner-art">${powerupArt("nitro")}${powerupArt("shield")}${powerupArt("lightning")}</span><div><span class="eyebrow">MỘT CHÚT BẤT NGỜ</span><h3>Lật ngược cuộc đua trong một nốt nhạc.</h3><p>Nhặt hộp bí ẩn. Bật power-up. Tạo khoảnh khắc của riêng bạn.</p></div><button class="round-button" data-page="powerups" aria-label="Khám phá power-up">${icon("arrow")}</button></section></div><aside class="race-sidebar">${racePanel()}<section class="mission-card"><div class="small-section-heading"><span>${icon("medal", 18)} THỬ THÁCH TÂN BINH</span><span class="mission-tag">${Math.min(profile.races, 3)}/3</span></div><h3>Khởi động nào!</h3><p>Hoàn thành 3 cuộc đua đầu tiên<br>để mở huy hiệu Tân binh.</p><div class="progress-track"><i style="width:${Math.min((profile.races / 3) * 100, 100)}%"></i></div><div class="mission-footer"><span>${icon("trophy", 15)} Huy hiệu Tân binh</span><span>${profile.races >= 3 ? "Đã mở khóa ✓" : `${Math.min(profile.races, 3)} / 3`}</span></div></section><section class="quick-help"><span class="eyebrow">BÍ KÍP NHỎ, CUỘC VUI LỚN</span><h3>Vào cua cho thật ngầu.</h3><p>Phanh trước cua gấp. Giữ <kbd>Shift</kbd><br>khi ôm cua, thả ra để bứt tốc!</p><button class="text-button" data-action="help">Xem cách chơi ${icon("arrow", 15)}</button><span class="help-decoration">${icon("bolt", 50)}</span></section></aside></div>`;
}
function racePanel() {
  return `<section class="race-panel"><div class="small-section-heading"><span><i class="status-dot"></i> SẴN SÀNG XUẤT PHÁT</span>${icon("flag", 20)}</div><h3>Cuộc đua của bạn</h3><div class="race-mode-switch" role="group" aria-label="Chế độ chơi"><button class="active" data-mode="solo">${icon("gamepad", 16)} Đua với máy</button><button data-action="friends">${icon("users", 16)} Cùng bạn bè</button></div><label class="field-label" for="track-select">ĐƯỜNG ĐUA</label><div class="select-wrap">${icon("map", 17)}<select id="track-select">${tracks.map((t) => `<option value="${t.id}" ${profile.track === t.id ? "selected" : ""}>${t.name}</option>`).join("")}</select>${icon("down", 13)}</div><div class="race-details"><span>${icon("flag", 15)} 3 vòng đua</span><span>${icon("users", 15)} 4 tay đua</span></div><div class="race-driver"><span class="mini-portrait" style="background:${getCharacter().color}">${characterArt(profile.character)}</span><div><small>TAY ĐUA CỦA BẠN</small><strong>${getCharacter().name}</strong></div><span class="driver-check">${icon("check", 16)}</span></div><button class="btn primary start-button" data-action="race">Bắt đầu đua ${icon("arrow", 20)}</button><span class="race-hint">${icon("spark", 12)} Không cần tải. Vào là vui!</span></section>`;
}
function powerupPage() {
  return `<div class="page-description">Mỗi vòng có 3 trạm hộp dấu hỏi. Chọn hướng nhặt, rồi nhấn <kbd>Space</kbd> để sử dụng đúng lúc!</div><div class="powerup-grid">${powerups.map((p) => `<article class="powerup-card" style="--power-color:${p.color}"><span class="powerup-picture">${powerupArt(p.id)}</span><span class="eyebrow">${p.key}</span><h2>${p.name}</h2><p>${p.description}</p><button class="text-button" data-preview-powerup="${p.id}">Thử hiệu ứng ${icon("spark", 15)}</button></article>`).join("")}</div><div class="page-bottom-cta"><span>${icon("bolt")} Chỉ giữ được một power-up. Dùng đúng lúc để dẫn đầu!</span><button class="btn primary" data-action="race">Thử trên đường đua ${icon("arrow")}</button></div>`;
}
function achievementPage() {
  const badges = [
    {
      name: "Chặng đầu tiên",
      text: "Hoàn thành 1 cuộc đua",
      unlocked: profile.races >= 1,
      ic: "flag",
    },
    {
      name: "Tân binh lên ga",
      text: "Hoàn thành 3 cuộc đua",
      unlocked: profile.races >= 3,
      ic: "medal",
    },
    {
      name: "Nhà vô địch",
      text: "Về đích ở vị trí số 1",
      unlocked: profile.wins >= 1,
      ic: "trophy",
    },
    {
      name: "Bậc thầy drift",
      text: "Thực hiện 10 lần drift",
      unlocked: profile.drifts >= 10,
      ic: "bolt",
    },
  ];
  return `<div class="page-description">Mỗi vòng đua đều đáng nhớ. Thành tích được lưu trên trình duyệt này.</div><div class="stats-grid">${[
    ["flag", profile.races, "Cuộc đua hoàn thành"],
    ["trophy", profile.wins, "Lần về nhất"],
    ["coin", profile.coins, "Xu thu thập"],
    ["bolt", profile.drifts, "Cú drift thành công"],
  ]
    .map(
      ([ic, n, t]) =>
        `<div>${icon(String(ic), 23)}<strong>${n}</strong><span>${t}</span></div>`,
    )
    .join(
      "",
    )}</div>${sectionHeader("KHOẢNH KHẮC CỦA BẠN", "Bộ sưu tập huy hiệu")}<div class="badge-grid">${badges.map((b) => `<article class="badge-card ${b.unlocked ? "unlocked" : ""}"><span>${icon(b.ic, 36)}</span><h3>${b.name}</h3><p>${b.text}</p><small>${b.unlocked ? "Đã mở khóa ✓" : "Đang chờ bạn"}</small></article>`).join("")}</div>${sectionHeader("THÊM MỘT VÒNG NỮA?", "Những cuộc đua gần đây")}<div class="history-list">${
    profile.results.length
      ? profile.results
          .slice(0, 8)
          .map(
            (r) =>
              `<div class="history-row"><span class="result-place">#${r.position}</span><div><strong>${tracks.find((t) => t.id === r.track)?.name || "Đường đua"}</strong><small>${r.online ? "Cùng bạn bè" : "Đua với máy"} · ${new Date(r.date).toLocaleDateString("vi-VN")}</small></div><span>${formatTime(r.time)}</span><span class="history-coins">+${r.coins} ${icon("coin", 16)}</span></div>`,
          )
          .join("")
      : `<div class="empty-state">${icon("flag", 40)}<h3>Đường đua đang chờ bạn</h3><p>Hoàn thành cuộc đua đầu tiên để viết nên câu chuyện của mình.</p><button class="btn primary" data-action="race">Đua ngay ${icon("arrow")}</button></div>`
  }</div>`;
}
function bindApp() {
  app.querySelectorAll<HTMLElement>("[data-page]").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      page = el.dataset.page!;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }),
  );
  app.querySelectorAll<HTMLElement>("[data-character]").forEach((el) =>
    el.addEventListener("click", () => {
      profile.character = el.dataset.character!;
      persist();
      render();
    }),
  );
  app.querySelectorAll<HTMLElement>("[data-track]").forEach((el) =>
    el.addEventListener("click", () => {
      profile.track = el.dataset.track!;
      persist();
      render();
    }),
  );
  app
    .querySelector<HTMLSelectElement>("#track-select")
    ?.addEventListener("change", (e) => {
      profile.track = (e.target as HTMLSelectElement).value;
      persist();
      render();
    });
  app
    .querySelectorAll<HTMLElement>("[data-action]")
    .forEach((el) =>
      el.addEventListener("click", () => action(el.dataset.action!)),
    );
  app.querySelectorAll<HTMLElement>("[data-preview-powerup]").forEach((el) =>
    el.addEventListener("click", () => {
      const p = powerups.find((p) => p.id === el.dataset.previewPowerup)!;
      showModal(
        `<div class="power-preview" style="--power-color:${p.color}"><div class="preview-burst">${powerupArt(p.id)}</div><span class="eyebrow">POWER-UP ĐÃ KÍCH HOẠT!</span><h2>${p.name}</h2><p>${p.description}</p><button class="btn primary" data-close>Đã hiểu ${icon("check")}</button></div>`,
      );
    }),
  );
}
function action(type: string) {
  if (type === "install") void requestAppInstall();
  if (type === "install-info") showAppInstallInfo();
  if (type === "update-app") void updateInstalledApp();
  if (type === "race") startRace();
  if (type === "friends") friendsModal();
  if (type === "settings") settingsModal();
  if (type === "help") helpModal();
  if (type === "sound") {
    profile.sound = !profile.sound;
    persist();
    render();
    toast(profile.sound ? "Đã bật âm thanh" : "Đã tắt âm thanh");
  }
}
function showModal(content: string, extraClass = "") {
  lastFocus = document.activeElement as HTMLElement;
  overlay.innerHTML = `<div class="modal-backdrop"><section class="modal ${extraClass}" role="dialog" aria-modal="true" aria-label="Turbo Buddies"><button class="modal-close icon-button" data-close aria-label="Đóng">${icon("close")}</button>${content}</section></div>`;
  overlay
    .querySelectorAll("[data-close]")
    .forEach((el) => el.addEventListener("click", closeModal));
  overlay.querySelector(".modal-backdrop")!.addEventListener("click", (e) => {
    if (e.target === e.currentTarget && !network) closeModal();
  });
  document.body.classList.add("modal-open");
  setTimeout(
    () =>
      overlay
        .querySelector<HTMLElement>("input,button:not(.modal-close),select")
        ?.focus(),
    0,
  );
}
function closeModal() {
  if (network && !racing) {
    const n = network;
    network = null;
    n.leave();
  }
  overlay.innerHTML = "";
  document.body.classList.remove("modal-open");
  lastFocus?.focus();
}
function helpModal() {
  showModal(
    `<span class="modal-symbol">${icon("gamepad", 30)}</span><span class="eyebrow">30 GIÂY LÀ BIẾT CHƠI</span><h2>Dễ chơi. Vui hết cỡ.</h2><p>Xe tự tăng ga. Xem bản đồ, phanh trước cua gấp rồi giữ hướng để ôm cua!</p><div class="controls-list"><div><span><kbd>←</kbd> <kbd>→</kbd> / <kbd>A</kbd> <kbd>D</kbd></span><strong>Rẽ trái / phải</strong></div><div><span><kbd>↓</kbd> / <kbd>S</kbd></span><strong>Phanh trước cua gấp, cua kẹp tóc</strong></div><div><span><kbd>Shift</kbd> + rẽ</span><strong>Ôm cua để tích drift, thả để tăng tốc</strong></div><div><span><kbd>Space</kbd></span><strong>Kích hoạt power-up</strong></div><div><span><kbd>Esc</kbd></span><strong>Tạm dừng cuộc đua với máy</strong></div></div><div class="tip-box">${icon("bolt")}<span>Mỗi vòng chỉ có <strong>3 trạm vật phẩm</strong>: chọn vị trí nhặt và dùng đúng lúc. Drift chỉ tích khi bạn thật sự ôm cua, giữ Shift trên đường thẳng không tích lực. Xem tốc độ gợi ý trước cua kẹp tóc; trên điện thoại, dùng nút Phanh và Drift.</span></div><button class="btn primary full-width" data-close>Sẵn sàng rồi! ${icon("check")}</button>`,
  );
}
function settingsModal() {
  showModal(
    `<span class="eyebrow">THEO CÁCH CỦA BẠN</span><h2>Góc tay đua</h2><form id="settings-form"><label class="input-label">Tên tay đua<input id="player-name" name="name" value="${escapeHtml(profile.name)}" maxlength="20" required placeholder="Tên của bạn" autocomplete="nickname"></label><label class="input-label">Độ khó khi đua với máy<select name="difficulty"><option value="easy" ${profile.difficulty === "easy" ? "selected" : ""}>Thư giãn — đối thủ phanh sớm, dễ vượt</option><option value="normal" ${profile.difficulty === "normal" ? "selected" : ""}>Vừa sức — đối thủ ôm cua, biết vượt</option><option value="hard" ${profile.difficulty === "hard" ? "selected" : ""}>Thử thách — phanh muộn, drift và bứt tốc</option></select></label><label class="toggle-row"><span>${icon("sound")} Âm thanh trò chơi</span><input type="checkbox" name="sound" ${profile.sound ? "checked" : ""}></label><p class="small-note">Tên, lựa chọn và thành tích được lưu trên trình duyệt của bạn.</p><button class="btn primary full-width" type="submit">Lưu lựa chọn ${icon("check")}</button></form><div class="settings-app-link"><span>${icon("gamepad", 18)} Turbo Buddies trên màn hình chính</span><button class="text-button" data-app-install-info>Cách cài ứng dụng ${icon("arrow", 14)}</button></div>`,
  );
  overlay
    .querySelector("[data-app-install-info]")!
    .addEventListener("click", showAppInstallInfo);
  overlay.querySelector("form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    profile.name =
      String(form.get("name")).trim().slice(0, 20) || "Tay đua mới";
    profile.difficulty = String(
      form.get("difficulty"),
    ) as typeof profile.difficulty;
    profile.sound = form.has("sound");
    persist();
    closeModal();
    render();
    toast("Đã lưu. Tay đua sẵn sàng!");
  });
}
function friendsModal() {
  if (updatingApp) return;
  if (!getAppState().online) {
    showModal(
      `<div id="offline-friends"><span class="modal-symbol">${icon("wifi", 30)}</span><span class="eyebrow">ĐANG NGOẠI TUYẾN</span><h2>Đua cùng bạn cần có mạng</h2><p>Bật Wi-Fi hoặc dữ liệu di động để tạo và tham gia phòng. Bạn vẫn có thể luyện ôm cua và drift khi đua với máy.</p><button class="btn primary full-width" id="offline-solo">Đua với máy ${icon("play", 16)}</button><button class="text-button" data-close>Trở lại sảnh</button></div>`,
    );
    overlay
      .querySelector("#offline-solo")!
      .addEventListener("click", () => startRace());
    return;
  }
  showModal(
    `<span class="modal-symbol">${icon("users", 30)}</span><span class="eyebrow">CÀNG ĐÔNG, CÀNG VUI</span><h2>Hẹn nhau ở vạch xuất phát.</h2><p>Tạo phòng riêng cho 2–4 người hoặc nhập mã phòng của bạn bè.</p><label class="input-label">Tên của bạn<input id="room-name" maxlength="20" value="${escapeHtml(profile.name)}" autocomplete="nickname"></label><button class="btn primary full-width" id="create-room">${icon("users")} Tạo phòng mới ${icon("arrow")}</button><div class="or-divider"><span>hoặc tham gia phòng</span></div><form id="join-room-form" class="join-room-form"><input aria-label="Mã phòng" id="room-code" placeholder="NHẬP MÃ 6 KÝ TỰ" maxlength="6" minlength="6" pattern="[A-Za-z0-9]{6}" autocomplete="off" required><button class="btn dark" type="submit">Vào phòng ${icon("arrow", 16)}</button></form><p id="network-status" class="network-status" role="status"></p><p class="small-note">Giữ tab mở khi chơi. Kết nối trực tiếp giữa các tay đua; một số mạng hạn chế WebRTC có thể không kết nối được.</p>`,
  );
  const connect = async (code?: string) => {
    if (!getAppState().online) {
      const status = overlay.querySelector("#network-status");
      if (status)
        status.textContent = "Đang ngoại tuyến. Hãy kết nối mạng rồi thử lại.";
      return;
    }
    const name = (
      overlay.querySelector<HTMLInputElement>("#room-name")?.value.trim() ||
      profile.name
    ).slice(0, 20);
    profile.name = name;
    persist();
    const status = overlay.querySelector("#network-status")!;
    status.textContent = "Đang kết nối đường đua…";
    overlay
      .querySelectorAll<HTMLButtonElement>("button:not(.modal-close)")
      .forEach((b) => (b.disabled = true));
    network?.leave();
    const session = new MultiplayerSession(handleNetworkEvent);
    network = session;
    try {
      if (code)
        await session.join(code, { name, character: profile.character });
      else await session.create({ name, character: profile.character });
      if (network === session) renderRoom();
    } catch (e) {
      if (network !== session) return;
      network.leave();
      network = null;
      const s = overlay.querySelector("#network-status");
      if (s)
        s.textContent =
          e instanceof Error
            ? e.message
            : "Không thể kết nối phòng. Vui lòng thử lại.";
      overlay
        .querySelectorAll<HTMLButtonElement>("button")
        .forEach((b) => (b.disabled = false));
    }
  };
  overlay
    .querySelector("#create-room")!
    .addEventListener("click", () => connect());
  overlay.querySelector("form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    connect(
      overlay
        .querySelector<HTMLInputElement>("#room-code")!
        .value.toUpperCase()
        .trim(),
    );
  });
  const code = new URLSearchParams(location.search).get("room");
  if (code && /^[A-Z0-9]{6}$/i.test(code))
    overlay.querySelector<HTMLInputElement>("#room-code")!.value =
      code.toUpperCase();
}
function renderRoom() {
  if (!network || racing) return;
  const n = network;
  showModal(
    `<span class="eyebrow">${n.isHost ? "PHÒNG CỦA BẠN" : "ĐÃ VÀO PHÒNG"}</span><h2>Biệt đội, tập hợp!</h2><p>Gửi mã này cho bạn bè để cùng vào đường đua.</p><button class="room-code-display" id="copy-code" aria-label="Sao chép mã phòng"><strong>${escapeHtml(n.roomCode)}</strong>${icon("copy", 22)}</button><div class="room-players">${Array.from(
      { length: 4 },
      (_, i) => {
        const p = n.players[i];
        return p
          ? `<div class="room-player">${characterArt(p.character)}<strong>${escapeHtml(p.name)}</strong><small>${i === 0 ? "Chủ phòng" : "Sẵn sàng"}</small></div>`
          : `<div class="room-player empty">${icon("users", 26)}<span>Chờ bạn bè…</span></div>`;
      },
    ).join(
      "",
    )}</div><div class="room-track">${icon("map")}<span>${n.isHost ? "Đường đua: <strong>" + getTrack().name + "</strong>" : "Đường đua do chủ phòng lựa chọn"}</span></div>${n.isHost ? `<button class="btn primary full-width" id="start-online" ${n.players.length < 2 ? "disabled" : ""}>${n.players.length < 2 ? "Chờ thêm ít nhất 1 người" : "Cả đội xuất phát!"} ${icon("flag")}</button>` : '<div class="tip-box">Chờ chủ phòng bắt đầu cuộc đua…</div>'}<button class="text-button room-share" id="share-room">${icon("copy", 16)} Sao chép liên kết mời bạn</button><p class="network-status" id="network-status" role="status"></p>`,
    "room-modal",
  );
  overlay
    .querySelector("#copy-code")
    ?.addEventListener("click", () =>
      copyText(n.roomCode, "Đã sao chép mã phòng"),
    );
  overlay
    .querySelector("#share-room")
    ?.addEventListener("click", () =>
      copyText(
        `${location.origin}${location.pathname}?room=${n.roomCode}`,
        "Đã sao chép liên kết mời",
      ),
    );
  overlay
    .querySelector("#start-online")
    ?.addEventListener("click", () => n.start(profile.track));
}
async function copyText(value: string, message: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast(message);
  } catch {
    toast(`Mã phòng: ${network?.roomCode || value}`);
  }
}
function handleNetworkEvent(event: MultiplayerEvent) {
  if (event.type === "room") renderRoom();
  if (event.type === "start") {
    const track = String(event.track);
    if (tracks.some((t) => t.id === track)) profile.track = track;
    startRace(true, Number(event.startAt));
  }
  if (event.type === "state" && game)
    game.setRemotePlayers(
      event.players as Parameters<RaceGame["setRemotePlayers"]>[0],
    );
  if (
    event.type === "powerup" &&
    game &&
    network &&
    event.from !== network.playerId &&
    (event.id === "lightning" || event.target === network.playerId)
  )
    game.applyRemotePowerup(String(event.id));
  if (event.type === "error") {
    const s = overlay.querySelector("#network-status");
    if (s) s.textContent = String(event.message);
    else toast(String(event.message));
  }
  if (event.type === "closed") {
    if (overlay.querySelector("#join-room-form")) return;
    if (racing && raceOnline) {
      leaveRace();
      toast("Phòng đã đóng hoặc mất kết nối. Hãy tạo phòng mới.");
    } else if (network) {
      network = null;
      closeModal();
      toast("Phòng đã đóng. Bạn có thể tạo phòng mới.");
    }
  }
}
function raceNavigation() {
  return `<aside class="race-minimap" aria-label="Bản đồ đường đua"><div class="minimap-heading">${icon("map", 12)}<span>LỘ TRÌNH</span>${icon("flag", 12)}</div><svg id="hud-minimap" viewBox="0 0 200 152" role="img" aria-label="Lộ trình và vị trí các tay đua"></svg><div class="minimap-legend"><span><i class="minimap-player-key"></i>Bạn</span><span><i class="minimap-rivals-key"></i>Đối thủ</span><span>${icon("flag", 9)}Đích</span></div></aside><div class="corner-advice" id="hud-corner" aria-label="Hướng dẫn vào cua"><div class="corner-main"><svg class="corner-arrow" viewBox="0 0 40 44" aria-hidden="true"><path id="hud-corner-arrow" d="M20 37V9m-8 8 8-8 8 8"/></svg><div class="corner-copy"><small id="hud-corner-distance">PHÍA TRƯỚC</small><strong id="hud-corner-name">Đường đua sẵn sàng</strong><span id="hud-corner-speed">Quan sát bản đồ để chọn hướng</span></div></div><div id="hud-grip" class="grip-warning" role="status" hidden></div></div>`;
}
function updateCornerAdvice(
  corner: CornerAdvice,
  speed: number,
  offroad: boolean,
  gripWarning: boolean,
) {
  const panel = document.getElementById("hud-corner");
  if (!panel) return;
  const straight = corner.severity === "straight";
  const direction = corner.direction === "left" ? "trái" : "phải";
  const name = straight
    ? "Đường thẳng"
    : `${corner.severity === "hairpin" ? "Kẹp tóc" : corner.severity === "sharp" ? "Cua gấp" : "Cua"} ${direction}`;
  const braking =
    !straight && speed > corner.speed + 8 && corner.distance < 220;
  panel.classList.toggle("is-braking", braking);
  panel.title = corner.name;
  document.getElementById("hud-corner-name")!.textContent = name;
  document.getElementById("hud-corner-distance")!.textContent = straight
    ? "QUAN SÁT LỘ TRÌNH"
    : corner.distance < 8
      ? "ĐANG VÀO CUA"
      : `CÒN ${Math.ceil(corner.distance / 10) * 10} M`;
  document.getElementById("hud-corner-speed")!.textContent = straight
    ? "Giữ ga, chuẩn bị cho cua tiếp theo"
    : `${braking ? "Phanh xuống" : "Tốc độ vào cua"} ${Math.round(corner.speed)} km/h`;
  const symbol = `${corner.severity}:${corner.direction}`;
  if (cornerSymbol !== symbol) {
    cornerSymbol = symbol;
    const arrow = document.getElementById("hud-corner-arrow")!;
    const paths = {
      straight: "M20 37V9m-8 8 8-8 8 8",
      bend: "M30 37V28Q30 15 17 15H9m8-8-8 8 8 8",
      sharp: "M30 37V15H9m8-8-8 8 8 8",
      hairpin: "M31 37V17a10 10 0 0 0-20 0V28m-7-7 7 7 7-7",
    };
    arrow.setAttribute("d", paths[corner.severity]);
    arrow.setAttribute(
      "transform",
      corner.direction === "right" ? "translate(40 0) scale(-1 1)" : "",
    );
  }
  const warning = document.getElementById("hud-grip")!;
  const warningText = offroad
    ? "Ra lề · Đưa xe trở lại đường"
    : gripWarning
      ? "Mất độ bám · Phanh và ôm cua"
      : "";
  if (warning.textContent !== warningText) warning.textContent = warningText;
  warning.hidden = !warningText;
}
function startRace(online = false, startAt?: number) {
  if (racing || updatingApp) return;
  overlay.innerHTML = "";
  document.body.classList.remove("modal-open");
  racing = true;
  updateAppInstallCard();
  raceOnline = online;
  currentPowerup = null;
  cornerSymbol = "";
  const c = getCharacter();
  const race = document.createElement("section");
  race.id = "race-screen";
  race.setAttribute("aria-label", "Đường đua Turbo Buddies");
  race.innerHTML = `<canvas id="race-canvas" aria-label="Đường đua. Mũi tên trái/phải để rẽ, xuống để phanh, Shift khi rẽ để drift, Space dùng power-up. Bản đồ và hướng dẫn vào cua ở hai góc trên."></canvas><div class="race-vignette"></div><div class="game-top"><div class="position-panel"><strong id="hud-position">1<span>/${online ? network?.players.length || 2 : 4}</span></strong><small>VỊ TRÍ</small></div><div class="lap-panel"><span id="hud-lap">VÒNG 1 / 3</span><strong id="hud-time">00:00.00</strong></div><div class="game-top-right"><span class="game-coins">${icon("coin")}<strong id="hud-coins">0</strong></span><button class="game-icon-button" id="game-sound" aria-label="Bật/tắt âm thanh">${icon(profile.sound ? "sound" : "mute")}</button><button class="game-icon-button" id="game-fullscreen" aria-label="Toàn màn hình">${icon("fullscreen")}</button><button class="game-icon-button" id="game-pause" aria-label="${online ? "Menu cuộc đua" : "Tạm dừng"}">${icon("pause")}</button></div></div><div class="game-progress"><i id="hud-progress"></i></div>${raceNavigation()}<div id="cinematic" class="cinematic"><span class="eyebrow">${online ? "CÙNG BẠN BÈ" : "TURBO BUDDIES PRESENTS"}</span><h2>${getTrack().name}</h2><p>3 vòng đua · ${c.name} đã sẵn sàng</p></div><div id="countdown" class="countdown" aria-live="assertive"></div><div id="powerup-popup" class="powerup-popup" role="status"></div><div class="game-bottom"><div class="speed-panel"><strong id="hud-speed">0</strong><span>KM/H</span><div class="drift-meter"><i id="hud-drift"></i></div><small>GIỮ SHIFT + RẼ ĐỂ DRIFT</small></div><div class="game-control-hint"><span><kbd>←</kbd><kbd>→</kbd> Rẽ</span><span><kbd>↓</kbd> Phanh</span><span><kbd>Shift</kbd> + rẽ Drift</span><span><kbd>Space</kbd> Vật phẩm</span></div><button class="powerup-slot" id="use-powerup" aria-label="Kích hoạt power-up"><span id="held-powerup">?</span><span id="powerup-label">NHẶT VẬT PHẨM</span><kbd>SPACE</kbd></button></div><div class="touch-controls"><div class="touch-steering"><button data-input="ArrowLeft" aria-label="Rẽ trái">${icon("arrow", 26)}</button><button data-input="ArrowRight" aria-label="Rẽ phải">${icon("arrow", 26)}</button></div><div class="touch-actions"><button data-input="ArrowDown" aria-label="Phanh">PHANH</button><button data-input="Shift" aria-label="Drift">DRIFT</button></div></div><div id="race-modal"></div>`;
  document.body.appendChild(race);
  document.body.classList.add("is-racing");
  minimap = new RaceMinimap(race.querySelector<SVGSVGElement>("#hud-minimap")!);
  try {
    game = new RaceGame(race.querySelector("canvas")!, {
      character: profile.character,
      track: profile.track,
      difficulty: profile.difficulty,
      sound: profile.sound,
      onEvent: handleGameEvent,
      multiplayer: online,
      startAt,
      playerId: network?.playerId,
      players: online ? network?.players : undefined,
    });
    game.start();
  } catch (e) {
    leaveRace();
    toast("Trình duyệt chưa khởi tạo được đường đua. Vui lòng tải lại.");
    console.error(e);
    return;
  }
  race.querySelector("#game-pause")!.addEventListener("click", () => {
    if (online) showPause();
    else game?.pause();
  });
  race
    .querySelector("#use-powerup")!
    .addEventListener("click", () => game?.usePowerup());
  race.querySelector("#game-sound")!.addEventListener("click", () => {
    profile.sound = !profile.sound;
    persist();
    game?.setSound(profile.sound);
    race.querySelector("#game-sound")!.innerHTML = icon(
      profile.sound ? "sound" : "mute",
    );
  });
  race
    .querySelector("#game-fullscreen")!
    .addEventListener("click", async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await race.requestFullscreen();
      } catch {
        toast("Trình duyệt này không hỗ trợ toàn màn hình.");
      }
    });
  race.querySelectorAll<HTMLButtonElement>("[data-input]").forEach((b) => {
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      game?.setInput(b.dataset.input!, true);
    });
    const release = () => game?.setInput(b.dataset.input!, false);
    b.addEventListener("pointerup", release);
    b.addEventListener("pointercancel", release);
    b.addEventListener("lostpointercapture", release);
  });
  if (online) {
    networkInterval = window.setInterval(() => {
      if (game && network) network.broadcastState(game.getNetworkState());
    }, 80);
  }
}
function handleGameEvent(e: GameEvent) {
  if (!racing) return;
  const set = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  if (e.type === "circuit") minimap?.setCircuit(e.points as MapPoint[]);
  if (e.type === "hud") {
    if (e.racers) minimap?.update(e.racers as MapRacer[]);
    if (e.corner)
      updateCornerAdvice(
        e.corner as CornerAdvice,
        Number(e.speed),
        Boolean(e.offroad),
        Boolean(e.gripWarning),
      );
    set("hud-speed", String(Math.round(Number(e.speed))));
    const p = document.getElementById("hud-position");
    if (p)
      p.innerHTML = `${e.position}<span>/${raceOnline ? network?.players.length || 2 : 4}</span>`;
    set("hud-lap", `VÒNG ${e.lap} / ${e.totalLaps}`);
    set("hud-time", formatTime(Number(e.time)));
    set("hud-coins", String(e.coins));
    const progress = document.getElementById("hud-progress");
    if (progress)
      progress.style.width = `${Math.min(100, Number(e.progress) * 100)}%`;
    const drift = document.getElementById("hud-drift");
    if (drift) drift.style.width = `${Math.min(100, Number(e.drift) * 100)}%`;
    document
      .getElementById("race-screen")
      ?.classList.toggle("boost-active", Boolean(e.boost));
    const power = e.powerup as string | null;
    if (currentPowerup !== power) {
      currentPowerup = power;
      const held = document.getElementById("held-powerup");
      if (held) held.innerHTML = power ? powerupArt(power) : "?";
      set("powerup-label", power ? "SẴN SÀNG BẬT!" : "NHẶT VẬT PHẨM");
      document
        .getElementById("use-powerup")
        ?.classList.toggle("has-powerup", !!power);
    }
  }
  if (e.type === "countdown") {
    const el = document.getElementById("countdown");
    if (el) {
      el.textContent = String(e.value);
      el.classList.remove("pop");
      void el.offsetWidth;
      el.classList.add("pop");
      if (["GO!", "GO", "ĐUA!"].includes(String(e.value))) {
        document.getElementById("cinematic")?.classList.add("finished");
        window.setTimeout(() => {
          if (el.isConnected) el.textContent = "";
        }, 850);
      }
    }
  }
  if (e.type === "powerup" || e.type === "effect") {
    const p = powerups.find((p) => p.id === e.id);
    const popup = document.getElementById("powerup-popup");
    if (popup) {
      popup.innerHTML = `<span class="popup-art">${p ? powerupArt(p.id) : icon("bolt", 36)}</span><span><small>${e.type === "powerup" ? "NHẶT ĐƯỢC POWER-UP!" : "KHOẢNH KHẮC BỨT PHÁ"}</small><strong>${escapeHtml(String(e.name || p?.name || "Tăng tốc!"))}</strong><span>${escapeHtml(String(e.description || "Nhấn Space để sử dụng"))}</span></span>`;
      popup.classList.remove("show");
      void popup.offsetWidth;
      popup.classList.add("show");
      clearTimeout(popupTimeout);
      popupTimeout = window.setTimeout(
        () => popup.classList.remove("show"),
        2400,
      );
    }
  }
  if (e.type === "pause") showPause();
  if (e.type === "attack" && raceOnline) network?.sendPowerup(String(e.id));
  if (e.type === "finish") finishRace(e);
}
function showPause() {
  const container = document.getElementById("race-modal");
  if (!container || container.innerHTML) return;
  container.innerHTML = `<div class="race-modal-backdrop"><section class="pause-panel"><span class="modal-symbol">${icon("pause", 28)}</span><span class="eyebrow">${raceOnline ? "CUỘC ĐUA VẪN TIẾP TỤC" : "NGHỈ MỘT NHỊP"}</span><h2>${raceOnline ? "Menu cuộc đua" : "Hít thở. Rồi lại hết ga."}</h2><p>${raceOnline ? "Đua cùng bạn bè không tạm dừng khi mở menu." : "Đường đua vẫn ở đây, chờ bạn trở lại."}</p><button class="btn primary full-width" id="resume-race">Tiếp tục đua ${icon("play")}</button>${raceOnline ? "" : '<button class="btn outlined full-width" id="restart-race">Đua lại từ đầu</button>'}<button class="text-button" id="leave-race">Về sảnh đua</button></section></div>`;
  container.querySelector("#resume-race")!.addEventListener("click", () => {
    container.innerHTML = "";
    game?.resume();
  });
  container.querySelector("#restart-race")?.addEventListener("click", () => {
    leaveRace();
    startRace();
  });
  container.querySelector("#leave-race")!.addEventListener("click", leaveRace);
}
function finishRace(e: GameEvent) {
  const result: Result = {
    position: Number(e.position),
    time: Number(e.time),
    coins: Number(e.coins),
    boosts: Number(e.boosts),
    drifts: Number(e.drifts),
    track: profile.track,
    character: profile.character,
    date: new Date().toISOString(),
    online: raceOnline,
  };
  profile.races++;
  profile.coins += result.coins;
  profile.drifts += result.drifts;
  if (result.position === 1) profile.wins++;
  profile.results.unshift(result);
  profile.results = profile.results.slice(0, 30);
  persist();
  if (raceOnline && game) network?.broadcastState(game.getNetworkState());
  const container = document.getElementById("race-modal");
  if (!container) return;
  container.innerHTML = `<div class="race-modal-backdrop finish-backdrop"><div class="confetti">${Array.from({ length: 32 }, (_, i) => `<i style="--i:${i};--confetti-color:${["#c7f466", "#ffb96b", "#92ddec", "#d8b2ff"][i % 4]}"></i>`).join("")}</div><section class="finish-panel"><span class="eyebrow">${result.position === 1 ? "NHÀ VÔ ĐỊCH LÀ BẠN!" : "THÊM MỘT CUỘC ĐUA ĐÁNG NHỚ"}</span><h2>${result.position === 1 ? "QUÁ ĐỈNH, TAY ĐUA!" : "VỀ ĐÍCH RỒI!"}</h2><div class="winner-art">${characterArt(profile.character)}<span>#${result.position}</span></div><p>${getCharacter().name} đã chinh phục ${getTrack().name}.</p><div class="finish-stats"><div>${icon("clock")}<strong>${formatTime(result.time)}</strong><span>Thời gian</span></div><div>${icon("coin")}<strong>+${result.coins}</strong><span>Xu thu thập</span></div><div>${icon("bolt")}<strong>${result.drifts}</strong><span>Cú drift</span></div></div>${raceOnline ? '<p class="small-note">Vị trí tại thời điểm về đích. Các tay đua còn lại tiếp tục cuộc đua.</p>' : ""}<button class="btn primary full-width" id="race-again">${raceOnline ? "Trở về sảnh đua" : "Thêm một vòng vui nữa"} ${icon("arrow")}</button>${raceOnline ? "" : '<button class="text-button" id="finish-home">Về sảnh đua</button>'}</section></div>`;
  container.querySelector("#race-again")!.addEventListener("click", () => {
    const online = raceOnline;
    leaveRace();
    if (!online) startRace();
  });
  container.querySelector("#finish-home")?.addEventListener("click", leaveRace);
}
function leaveRace() {
  racing = false;
  raceOnline = false;
  game?.destroy();
  game = null;
  minimap = null;
  clearInterval(networkInterval);
  clearTimeout(popupTimeout);
  if (network) {
    const n = network;
    network = null;
    n.leave();
  }
  racing = false;
  raceOnline = false;
  document.getElementById("race-screen")?.remove();
  document.body.classList.remove("is-racing");
  render();
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlay.innerHTML) {
    closeModal();
    return;
  }
  if (e.key === "Escape" && racing) {
    const modal = document.getElementById("race-modal");
    if (modal?.querySelector("#resume-race")) {
      e.preventDefault();
      modal.innerHTML = "";
      game?.resume();
    }
  }
  if (e.key === "Tab" && overlay.innerHTML) {
    const focusable = Array.from(
      overlay.querySelectorAll<HTMLElement>(
        "button:not([disabled]),input,select,a[href]",
      ),
    );
    const first = focusable[0],
      last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
});
render();
subscribeAppState(updateAppInstallCard);
void initPwa();
if (new URLSearchParams(location.search).has("room")) friendsModal();
