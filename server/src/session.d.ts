import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: import("./seed-data.js").User;
    }
  }
}
