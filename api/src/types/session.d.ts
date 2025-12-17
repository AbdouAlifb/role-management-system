import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    tenantId?: string;
    csrfToken?: string;

    // Cache permissions in session
    permissions?: string[];
    permsVersion?: number;
  }
}

