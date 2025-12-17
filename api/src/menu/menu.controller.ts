import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { SessionAuthGuard } from "../rbac/guards/session-auth.guard";
import { MenuService } from "./menu.service";

@Controller("menu")
@UseGuards(SessionAuthGuard)
export class MenuController {
  constructor(private menu: MenuService) {}

  private tenantId(req: any) {
    return (
      req.session?.tenantId ||
      req.headers["x-tenant-id"] ||
      process.env.DEFAULT_TENANT_ID
    );
  }

  @Get("me")
  async me(@Req() req: any) {
    const tenantId = this.tenantId(req);
    const perms = await this.menu.ensureSessionPerms(req);
    return this.menu.getMenuForUser(tenantId, req.session.userId, perms);
  }
}
