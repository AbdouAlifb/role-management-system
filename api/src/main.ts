import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";

import { createClient } from "redis";
import { RedisStore } from "connect-redis";
import { randomBytes } from "crypto";
import { ValidationPipe } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

function isSafeMethod(method: string) {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function logBoot(msg: string, extra?: Record<string, any>) {
  const base = `[BOOT] ${msg}`;
  if (!extra) return console.log(base);
  console.log(base, JSON.stringify(extra));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Express instance
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set("trust proxy", 1);

  // Root endpoint (simple, always)
  expressApp.get("/", (_req: any, res: any) => {
    res.status(200).json({ ok: true, message: "Role API server running" });
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Security middleware
  app.use(helmet());
  app.use(cookieParser());

  // ---- DB check (Prisma) ----
  let dbOk = false;
  try {
    const prisma = app.get(PrismaService);
    await prisma.$queryRaw`SELECT 1`; // fast ping
    dbOk = true;
    logBoot("DB connected ✅");
  } catch (e: any) {
    logBoot("DB connection failed ❌", { error: e?.message ?? String(e) });
  }

  // ---- Redis connect (with timeout + ping) ----
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logBoot("REDIS_URL missing ❌ (sessions will NOT work)");
  }

  const redisClient = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 10_000,
      reconnectStrategy: (retries) => Math.min(retries * 200, 2000),
    },
  });

  redisClient.on("error", (err) => {
    logBoot("Redis error", { error: err?.message ?? String(err) });
  });

  let redisOk = false;
  try {
    logBoot("Redis connecting...");
    await redisClient.connect();
    const pong = await redisClient.ping();
    redisOk = pong === "PONG";
    logBoot("Redis connected ✅", { pong });
  } catch (e: any) {
    logBoot("Redis connection failed ❌", { error: e?.message ?? String(e) });
  }

  // Session (only if redis connected)
  if (redisOk) {
    const store = new RedisStore({
      client: redisClient as any,
      prefix: "sess:",
    });

    app.use(
      session({
        name: "sid",
        store,
        secret: process.env.SESSION_SECRET || "dev-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 1000 * 60 * 60 * 8,
        },
      })
    );
  }

  // CORS
  const origins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
  });

  // CSRF middleware (session-bound token)
  app.use((req: any, res: any, next: any) => {
    if (req.session && !req.session.csrfToken) {
      req.session.csrfToken = randomBytes(32).toString("hex");
    }

    if (req.originalUrl?.includes("/auth/login")) return next();

    if (!isSafeMethod(req.method)) {
      const token = req.headers["x-csrf-token"];
      if (!req.session?.csrfToken || token !== req.session.csrfToken) {
        return res.status(403).json({ message: "CSRF validation failed" });
      }
    }
    next();
  });

  // Health endpoint (no auth)
  expressApp.get("/health", async (_req: any, res: any) => {
    let db = false;
    let redis = false;

    try {
      const prisma = app.get(PrismaService);
      await prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {}

    try {
      if (redisClient?.isReady) {
        const pong = await redisClient.ping();
        redis = pong === "PONG";
      }
    } catch {}

    res.status(200).json({
      ok: db && redis,
      db,
      redis,
      env: process.env.NODE_ENV ?? "unknown",
      uptimeSec: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  });

  // Listen
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, "127.0.0.1");

  logBoot("Listening ✅", { url: await app.getUrl(), dbOk, redisOk });
}

bootstrap().catch((e) => {
  console.error("[BOOT] Fatal error", e);
  process.exit(1);
});
