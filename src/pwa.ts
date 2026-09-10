export type AppState = {
  installed: boolean;
  canInstall: boolean;
  offlineReady: boolean;
  offlineError: boolean;
  online: boolean;
  updateAvailable: boolean;
};
type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const standalone = window.matchMedia("(display-mode: standalone)");
const isInstalled = () =>
  standalone.matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
let state: AppState = {
  installed: isInstalled(),
  canInstall: false,
  offlineReady: false,
  offlineError: false,
  online: navigator.onLine,
  updateAvailable: false,
};
const listeners = new Set<(state: AppState) => void>();
let deferredPrompt: InstallPrompt | null = null;
let registration: ServiceWorkerRegistration | null = null;
let initialized = false;
let reloadRequested = false;
let controllerChanged = false;
let lastUpdateCheck = 0;
const activationWatch = new WeakSet<ServiceWorker>();
const safeToUpdate = () =>
  !document.body.classList.contains("is-racing") &&
  !document.querySelector(".room-code-display, #start-online");

export function getAppState(): AppState {
  return { ...state };
}
function publish(next: Partial<AppState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener(getAppState());
}
export function subscribeAppState(listener: (state: AppState) => void) {
  listeners.add(listener);
  listener(getAppState());
  return () => {
    listeners.delete(listener);
  };
}

// Attach early so installation readiness cannot be missed while the lobby loads.
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event as InstallPrompt;
  publish({ canInstall: !state.installed });
});
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  publish({ installed: true, canInstall: false });
});
standalone.addEventListener("change", () =>
  publish({
    installed: isInstalled(),
    canInstall: !isInstalled() && !!deferredPrompt,
  }),
);

export async function installApp(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  const prompt = deferredPrompt;
  if (!prompt || state.installed) return "unavailable";
  deferredPrompt = null;
  publish({ canInstall: false });
  try {
    // Called directly from the player's button click, before any other await.
    await prompt.prompt();
    return (await prompt.userChoice).outcome;
  } catch {
    return "unavailable";
  }
}

function workerMessage(
  worker: ServiceWorker,
  type: string,
  timeout = 5000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => {
      channel.port1.close();
      resolve({});
    }, timeout);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer);
      channel.port1.close();
      resolve(event.data || {});
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}

async function refreshOfflineState() {
  const worker = registration?.active;
  if (!worker) return;
  if (worker.state !== "activated") {
    // ready/controllerchange can fire while clients.claim() is still inside
    // activate. Observe completion rather than leaving the first load pending.
    if (!activationWatch.has(worker) && worker.state !== "redundant") {
      activationWatch.add(worker);
      const activated = () => {
        if (worker.state !== "activated" && worker.state !== "redundant")
          return;
        worker.removeEventListener("statechange", activated);
        activationWatch.delete(worker);
        if (worker.state === "activated") void refreshOfflineState();
      };
      worker.addEventListener("statechange", activated);
    }
    return;
  }
  let result = await workerMessage(worker, "APP_STATUS");
  if (result.ready === false && navigator.onLine)
    result = await workerMessage(worker, "CACHE_APP", 20000);
  publish({
    offlineReady: result.ready === true,
    offlineError: result.ready !== true,
  });
}

export async function applyAppUpdate(): Promise<void> {
  if (!safeToUpdate())
    throw new Error("Về sảnh đua trước khi cập nhật ứng dụng.");
  if (controllerChanged && !registration?.waiting) {
    location.reload();
    return;
  }
  const waiting = registration?.waiting;
  if (!waiting) {
    publish({ updateAvailable: false });
    throw new Error("Ứng dụng đang dùng phiên bản mới nhất.");
  }
  reloadRequested = true;
  const result = await workerMessage(waiting, "ACTIVATE_UPDATE");
  if (result.activated !== true) {
    reloadRequested = false;
    throw new Error(
      "Hãy về sảnh đua ở các cửa sổ Turbo Buddies khác rồi cập nhật lại.",
    );
  }
  if (navigator.serviceWorker.controller !== waiting) {
    await new Promise<void>((resolve, reject) => {
      const changed = () => {
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(() => {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          changed,
        );
        reloadRequested = false;
        reject(
          new Error("Chưa cập nhật được ứng dụng. Hãy thử lại ở sảnh đua."),
        );
      }, 8000);
      navigator.serviceWorker.addEventListener("controllerchange", changed, {
        once: true,
      });
    });
  }
}

export function initPwa() {
  if (initialized) return;
  initialized = true;
  const checkForUpdate = () => {
    if (
      !registration ||
      !navigator.onLine ||
      Date.now() - lastUpdateCheck < 60000
    )
      return;
    lastUpdateCheck = Date.now();
    void registration.update().catch(() => {});
    void refreshOfflineState();
  };
  window.addEventListener("online", () => {
    publish({ online: true });
    checkForUpdate();
  });
  window.addEventListener("offline", () => publish({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkForUpdate();
  });
  if (
    !import.meta.env.PROD ||
    !isSecureContext ||
    !("serviceWorker" in navigator)
  )
    return;
  let previousController = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "CAN_UPDATE")
      event.ports[0]?.postMessage({ safe: safeToUpdate() });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (previousController) {
      controllerChanged = true;
      publish({ updateAvailable: true });
      if (reloadRequested && safeToUpdate()) location.reload();
    }
    previousController = navigator.serviceWorker.controller;
    void refreshOfflineState();
  });
  const base = new URL(import.meta.env.BASE_URL, location.origin);
  void navigator.serviceWorker
    .register(new URL("sw.js", base), {
      scope: base.pathname,
      updateViaCache: "none",
    })
    .then((result) => {
      registration = result;
      publish({ updateAvailable: !!result.waiting });
      const observe = () => {
        const worker = result.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed")
            publish({ updateAvailable: !!result.waiting });
          if (worker.state === "redundant")
            publish({ offlineError: !state.offlineReady });
        });
      };
      observe();
      result.addEventListener("updatefound", observe);
      void navigator.serviceWorker.ready.then(() => refreshOfflineState());
    })
    .catch(() => publish({ offlineError: true }));
}
