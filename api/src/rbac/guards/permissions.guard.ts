import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRED_PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { RbacService } from "../rbac.service";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private rbac: RbacService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();

    const required =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    if (required.length === 0) return true;

    const userId = req.session?.userId;
    const tenantId = req.session?.tenantId;
    if (!userId || !tenantId) throw new ForbiddenException("Missing session");

    // cache permissions in session, invalidate via tenant.rbacVersion
    const currentVersion = await this.rbac.getTenantRbacVersion(tenantId);
    if (!req.session.permissions || req.session.permsVersion !== currentVersion) {
      req.session.permissions = await this.rbac.computeUserPermissions(userId, tenantId);
      req.session.permsVersion = currentVersion;
    }

    if (!this.rbac.hasPermission(req.session.permissions, required)) {
      throw new ForbiddenException("Insufficient permissions");
    }
    return true;
  }
}
