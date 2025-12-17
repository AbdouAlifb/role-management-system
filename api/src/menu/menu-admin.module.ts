import { Module } from "@nestjs/common";
import { MenuAdminController } from "./menu-admin.controller";
import { MenuAdminService } from "./menu-admin.service";

@Module({
  controllers: [MenuAdminController],
  providers: [MenuAdminService],
})
export class MenuAdminModule {}
