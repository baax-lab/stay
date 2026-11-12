// Zentrale Umgebungsvariablen. Keine Geheimnisse ins Client-Bundle: nur serverseitig importieren.

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Umgebungsvariable ${name} fehlt`);
  }
  return v;
}

function path(value: string | undefined, fallback: string): string {
  const v = (value || fallback).trim();
  return v.startsWith("/") ? v : `/${v}`;
}

export const env = {
  /** Basis-URL, unter der der Server sich selbst erreicht (PDF-Rendering). */
  get internalUrl() {
    return (process.env.INTERNAL_URL ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
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
    /** Endpunkte der Hub-API (Annahme, anpassbar ohne Codeänderung) */
    get contactsPath() {
      return path(process.env.HUB_CONTACTS_PATH, "/contacts");
    },
    get tasksPath() {
      return path(process.env.HUB_TASKS_PATH, "/tasks");
    },
    get appointmentsPath() {
      return path(process.env.HUB_APPOINTMENTS_PATH, "/appointments");
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
  mail: {
    get host() {
      return process.env.SMTP_HOST || undefined;
    },
    get port() {
      return Number(process.env.SMTP_PORT ?? 587);
    },
    get user() {
      return process.env.SMTP_USER || undefined;
    },
    get pass() {
      return process.env.SMTP_PASS || undefined;
    },
    get secure() {
      return process.env.SMTP_SECURE === "true";
    },
    get from() {
      return process.env.MAIL_FROM ?? "Baax Stay <stay@baax.de>";
    },
    get signatureHtml() {
      return process.env.MAIL_SIGNATURE_HTML || undefined;
    },
    get signatureFile() {
      return process.env.MAIL_SIGNATURE_FILE || undefined;
    },
  },
  get mailConfigured() {
    return Boolean(process.env.SMTP_HOST);
  },
  get digestFallbackTo() {
    return process.env.MAIL_DIGEST_FALLBACK_TO || undefined;
  },
  get adminEmail() {
    return process.env.ADMIN_EMAIL || undefined;
  },
  get retentionDiscardedLeadsMonths() {
    return Number(process.env.RETENTION_DISCARDED_LEADS_MONTHS ?? 12) || 12;
  },
  get brandColor() {
    return process.env.BRAND_COLOR || undefined;
  },
  get cronSecret() {
    return process.env.CRON_SECRET || undefined;
  },
  get chromiumPath() {
    return process.env.CHROMIUM_PATH || undefined;
  },
  get devLoginEnabled() {
    return process.env.AUTH_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";
  },
};
