import { Module } from "@nestjs/common";
import { RbacModule } from "./rbac.module";
import { SessionAuthGuard } from "./guards/session-auth.guard";
import { PermissionsGuard } from "./guards/permissions.guard";

@Module({
  imports: [RbacModule],
  providers: [SessionAuthGuard, PermissionsGuard],
  exports: [SessionAuthGuard, PermissionsGuard],
})
export class RbacGuardsModule {}
