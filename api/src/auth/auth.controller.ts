import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { SessionAuthGuard } from "../rbac/guards/session-auth.guard";
import { RbacService } from "../rbac/rbac.service";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService, private rbac: RbacService) {}

  @Post("login")
  async login(@Req() req: any, @Body() dto: LoginDto) {
    // For now: single-tenant default; later you can pass tenant by header or subdomain mapping
    const tenantId =
      req.headers["x-tenant-id"] ||
      process.env.DEFAULT_TENANT_ID ||
      "00000000-0000-0000-0000-000000000001";

    const user = await this.auth.validateUser(tenantId, dto.username, dto.password);

    // session bind
    req.session.userId = user.id;
    req.session.tenantId = user.tenantId;

    // compute and cache permissions immediately
    const version = await this.rbac.getTenantRbacVersion(user.tenantId);
    req.session.permissions = await this.rbac.computeUserPermissions(user.id, user.tenantId);
    req.session.permsVersion = version;

    return {
      user: { id: user.id, username: user.username, tenantId: user.tenantId },
      permissions: req.session.permissions,
      csrfToken: req.session.csrfToken, // created by your CSRF middleware in main.ts
    };
  }

  @Post("logout")
  @UseGuards(SessionAuthGuard)
  async logout(@Req() req: any) {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((err: any) => (err ? reject(err) : resolve())),
    );
    return { ok: true };
  }

  @Get("me")
  @UseGuards(SessionAuthGuard)
  async me(@Req() req: any) {
    const me = await this.auth.getMe(req.session.userId);

    // ensure perms are present (in case server restarted)
    if (!req.session.permissions) {
      req.session.permissions = await this.rbac.computeUserPermissions(
        req.session.userId,
        req.session.tenantId,
      );
    }

    return {
      user: me,
      permissions: req.session.permissions,
      csrfToken: req.session.csrfToken,
    };
  }
}
