import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (!req.session?.userId || !req.session?.tenantId) {
      throw new UnauthorizedException("Not authenticated");
    }
    return true;
  }
}
