// Zentrale Umgebungsvariablen. Keine Geheimnisse ins Client-Bundle: nur serverseitig importieren.

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Umgebungsvariable ${name} fehlt`);
  }
  return v;
}

export const env = {
  get appUrl() {
    return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get sessionSecret() {
    const s = req("SESSION_SECRET");
    if (s.length < 32) throw new Error("SESSION_SECRET muss mindestens 32 Zeichen haben");
    return s;
  },
  hub: {
    get url() {
      return (process.env.HUB_URL ?? "").replace(/\/$/, "");
    },
    get loginPath() {
      return process.env.HUB_LOGIN_PATH ?? "/sso/login";
    },
    get jwtSecret() {
      return process.env.HUB_JWT_SECRET || undefined;
    },
    get jwksUrl() {
      return process.env.HUB_JWKS_URL || undefined;
    },
    get issuer() {
      return process.env.HUB_JWT_ISSUER || undefined;
    },
    get audience() {
      return process.env.HUB_JWT_AUDIENCE || undefined;
    },
    get roleClaim() {
      return process.env.HUB_ROLE_CLAIM || "role";
    },
    get apiUrl() {
      return (process.env.HUB_API_URL ?? "").replace(/\/$/, "");
    },
    get apiToken() {
      return process.env.HUB_API_TOKEN || undefined;
    },
    /** Hub-Login konfiguriert (Secret oder JWKS vorhanden)? */
    get ssoConfigured() {
      return Boolean(this.url && (this.jwtSecret || this.jwksUrl));
    },
    /** Hub-API für Kontakt-/Aufgabenübergabe konfiguriert? */
    get apiConfigured() {
      return Boolean(this.apiUrl && this.apiToken);
    },
  },
  get devLoginEnabled() {
    return process.env.AUTH_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";
  },
};
