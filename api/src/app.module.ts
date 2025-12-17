import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";

import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "./rbac/rbac.module";
import { AuthModule } from "./auth/auth.module";
import { AdminModule } from "./admin/admin.module";
import { AuditModule } from "./audit/audit.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),

    // basic rate-limit protection (we can tune later per-route)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),

    PrismaModule,
    RbacModule,
    AuditModule,
    AuthModule,
    AdminModule,
  ],
})
export class AppModule {}
