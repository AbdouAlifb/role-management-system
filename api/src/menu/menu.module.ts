import { Module } from "@nestjs/common";
import { MenuService } from "./menu.service";
import { MenuAdminService } from "./menu-admin.service";
import { MenuController } from "./menu.controller";
import { MenuAdminController } from "./menu-admin.controller";
import { RbacModule } from "../rbac/rbac.module";
import { RbacGuardsModule } from "../rbac/rbac-guards.module";

@Module({
  imports: [RbacModule, RbacGuardsModule],
  controllers: [MenuController, MenuAdminController],
  providers: [MenuService, MenuAdminService],
  exports: [MenuService],
})
export class MenuModule {}
