import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

function withTimeout<T>(p: Promise<T>, ms: number, label = "operation") {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url || !url.trim()) {
      throw new Error("DATABASE_URL is missing/empty. Check apps/api/.env");
    }

    const host = new URL(url).hostname;

    const pool = new Pool({
      connectionString: url,
      connectionTimeoutMillis: 30_000,
      idleTimeoutMillis: 30_000,
      max: 10,
      ssl: {
        rejectUnauthorized: true,
        servername: host, // ✅ force SNI (important with Neon)
      },
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });

    this.pool = pool;
  }

  async onModuleInit() {
    try {
      // ✅ prevents Nest from freezing for minutes if TLS/network is flaky
      await withTimeout(this.$connect(), 8_000, "Prisma $connect");
    } catch (e: any) {
      console.warn("[Prisma] connect skipped:", e?.message ?? String(e));
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
