export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID || "";

  try {
    // Use globalThis/window when available; fall back to an env var for SSR/build time.
    const maybeWindow = typeof globalThis !== "undefined" ? (globalThis as any).window : undefined;
    const origin = maybeWindow?.location?.origin
      ? maybeWindow.location.origin
      : import.meta.env.VITE_APP_ORIGIN || "";
    const redirectUri = `${origin}/api/oauth/callback`;
    const state = btoa(redirectUri);

    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch (e) {
    console.error("Erro ao gerar URL de login: VITE_OAUTH_PORTAL_URL não configurada ou inválida.");
    return "#";
  }
};
