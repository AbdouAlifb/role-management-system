import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AuditModule } from "../audit/audit.module";
import { RbacModule } from "../rbac/rbac.module";

@Module({
  imports: [AuditModule, RbacModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
