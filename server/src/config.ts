import "dotenv/config";

export interface ServerConfig {
  port: number;
  sessionSecret: string;
  frontendOrigin: string;
  cookieSecure: boolean;
  trustProxy: boolean;
}

export function getServerConfig(): ServerConfig {
  const cookieSecureEnv = process.env.COOKIE_SECURE ?? "false";
  const trustProxyEnv = process.env.TRUST_PROXY ?? "false";
  if (!["true", "false"].includes(cookieSecureEnv) || !["true", "false"].includes(trustProxyEnv)) {
    throw new Error("COOKIE_SECURE and TRUST_PROXY must be true or false");
  }
  const port = Number(process.env.PORT ?? 3000);
  const sessionSecret = process.env.SESSION_SECRET ?? "";
  const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
  const cookieSecure = cookieSecureEnv === "true";
  const trustProxy = trustProxyEnv === "true";

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
  let origin: URL;
  try {
    origin = new URL(frontendOrigin);
  } catch {
    throw new Error("FRONTEND_ORIGIN must be a valid absolute URL");
  }
  if (origin.origin !== frontendOrigin) {
    throw new Error("FRONTEND_ORIGIN must contain only the origin, without a path");
  }
  if (process.env.NODE_ENV === "production" && !cookieSecure) {
    throw new Error("COOKIE_SECURE=true is required in production");
  }

  return { port, sessionSecret, frontendOrigin, cookieSecure, trustProxy };
}
