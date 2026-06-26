export function isStandalone(matchMedia, navigatorLike) {
  const media = matchMedia || (typeof window !== 'undefined' ? window.matchMedia : null);
  const nav = navigatorLike || (typeof navigator !== 'undefined' ? navigator : null);
  return Boolean(
    (media && media('(display-mode: standalone)').matches) ||
    (nav && nav.standalone)
  );
}

export function shouldShowInstallPrompt(event, standalone) {
  return Boolean(event && !standalone);
}

export async function promptInstall(event) {
  if (!event || typeof event.prompt !== 'function') {
    return null;
  }
  event.prompt();
  if (!event.userChoice || typeof event.userChoice.then !== 'function') {
    return null;
  }
  return event.userChoice;
}
