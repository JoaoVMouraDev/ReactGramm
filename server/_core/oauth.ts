import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getBaseUrl(req: Request): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)
      ?.split(",")[0]
      ?.trim() ||
    req.protocol ||
    "https";
  return `${proto}://${req.get("host")}`;
}

async function setSessionCookie(
  res: Response,
  req: Request,
  openId: string,
  name: string,
) {
  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!ENV.googleClientId) {
      res.status(503).json({ error: "Google OAuth not configured" });
      return;
    }

    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: `${getBaseUrl(req)}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    if (!code) {
      res.redirect("/login?error=google_denied");
      return;
    }

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: `${getBaseUrl(req)}/api/auth/google/callback`,
          grant_type: "authorization_code",
        }),
      });
      const tokens = (await tokenRes.json()) as { access_token?: string };
      if (!tokens.access_token) throw new Error("No access_token from Google");

      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const googleUser = (await userRes.json()) as {
        id?: string;
        email?: string;
        name?: string;
        picture?: string;
      };

      if (!googleUser.id) throw new Error("No user id from Google");

      const user = await db.upsertOAuthUser({
        provider: "google",
        providerId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.picture,
      });

      await setSessionCookie(res, req, user.openId!, user.name ?? "");
      res.redirect("/");
    } catch (err) {
      console.error("[OAuth] Google callback failed", err);
      res.redirect("/login?error=google_failed");
    }
  });

  app.get("/api/auth/github", (req: Request, res: Response) => {
    if (!ENV.githubClientId) {
      res.status(503).json({ error: "GitHub OAuth not configured" });
      return;
    }

    const params = new URLSearchParams({
      client_id: ENV.githubClientId,
      redirect_uri: `${getBaseUrl(req)}/api/auth/github/callback`,
      scope: "read:user user:email",
    });

    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  });

  app.get("/api/auth/github/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    if (!code) {
      res.redirect("/login?error=github_denied");
      return;
    }

    try {
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: ENV.githubClientId,
          client_secret: ENV.githubClientSecret,
          code,
          redirect_uri: `${getBaseUrl(req)}/api/auth/github/callback`,
        }),
      });
      const tokens = (await tokenRes.json()) as { access_token?: string };
      if (!tokens.access_token) throw new Error("No access_token from GitHub");

      const [userRes, emailsRes] = await Promise.all([
        fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: "application/vnd.github+json",
          },
        }),
        fetch("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: "application/vnd.github+json",
          },
        }),
      ]);

      const githubUser = (await userRes.json()) as {
        id?: number;
        login?: string;
        email?: string;
        name?: string;
        avatar_url?: string;
      };
      const emails = (await emailsRes.json()) as Array<{
        email?: string;
        primary?: boolean;
        verified?: boolean;
      }>;
      const primaryEmail = Array.isArray(emails)
        ? emails.find((email) => email.primary && email.verified)?.email ??
          emails[0]?.email
        : undefined;

      if (!githubUser.id) throw new Error("No user id from GitHub");

      const user = await db.upsertOAuthUser({
        provider: "github",
        providerId: String(githubUser.id),
        email: primaryEmail ?? githubUser.email ?? undefined,
        name: githubUser.name ?? githubUser.login,
        avatarUrl: githubUser.avatar_url,
      });

      await setSessionCookie(res, req, user.openId!, user.name ?? "");
      res.redirect("/");
    } catch (err) {
      console.error("[OAuth] GitHub callback failed", err);
      res.redirect("/login?error=github_failed");
    }
  });
}
