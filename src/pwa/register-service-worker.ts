export async function registerServiceWorker(onUpdateAvailable: () => void): Promise<ServiceWorkerRegistration | null> {
  if (!import.meta.env.PROD) {
    return null;
  }
  if (!("serviceWorker" in navigator)) {
    throw new Error("Браузер не поддерживает Service Worker.");
  }

  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
  const registration = await navigator.serviceWorker.register(new URL("sw.js", baseUrl), {
    scope: baseUrl.pathname,
  });
  const checkForWaitingWorker = () => {
    if (registration.waiting && navigator.serviceWorker.controller) {
      onUpdateAvailable();
    }
  };
  registration.addEventListener("updatefound", () => {
    registration.installing?.addEventListener("statechange", checkForWaitingWorker);
  });
  checkForWaitingWorker();
  return registration;
}
