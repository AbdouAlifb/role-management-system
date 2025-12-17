import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { RequirePermissions } from "../rbac/decorators/require-permissions.decorator";
import { SessionAuthGuard } from "../rbac/guards/session-auth.guard";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { AuditService } from "../audit/audit.service";

import { CreateUserDto } from "./dto/create-user.dto";
import { CreateGroupDto } from "./dto/create-group.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { CreatePermissionDto } from "./dto/create-permission.dto";
import { SetUserGroupsDto } from "./dto/set-user-groups.dto";

@Controller("admin")
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermissions("rbac.manage")
export class AdminController {
  constructor(private admin: AdminService, private audit: AuditService) {}

  private tenantId(req: any) {
    return req.session.tenantId;
  }
  private actor(req: any) {
    return req.session.userId;
  }

  @Post("users")
  async createUser(@Req() req: any, @Body() dto: CreateUserDto) {
    const user = await this.admin.createUser(this.tenantId(req), dto);
    await this.audit.log({
      tenantId: this.tenantId(req),
      actorUserId: this.actor(req),
      action: "USER_CREATE",
      resource: "User",
      resourceId: user.id,
      req,
      meta: { username: user.username, groupIds: dto.groupIds },
    });
    return user;
  }

  @Post("users/:id/groups")
  async setUserGroups(@Req() req: any, @Param("id") userId: string, @Body() dto: SetUserGroupsDto) {
    const res = await this.admin.setUserGroups(this.tenantId(req), userId, dto.groupIds);
    await this.audit.log({
      tenantId: this.tenantId(req),
      actorUserId: this.actor(req),
      action: "USER_GROUPS_SET",
      resource: "User",
      resourceId: userId,
      req,
      meta: { groupIds: dto.groupIds },
    });
    return res;
  }

  @Post("groups")
  async createGroup(@Req() req: any, @Body() dto: CreateGroupDto) {
    const g = await this.admin.createGroup(this.tenantId(req), dto);
    await this.audit.log({ tenantId: this.tenantId(req), actorUserId: this.actor(req), action: "GROUP_CREATE", resource: "Group", resourceId: g.id, req });
    return g;
  }

  @Post("roles")
  async createRole(@Req() req: any, @Body() dto: CreateRoleDto) {
    const r = await this.admin.createRole(this.tenantId(req), dto);
    await this.audit.log({ tenantId: this.tenantId(req), actorUserId: this.actor(req), action: "ROLE_CREATE", resource: "Role", resourceId: r.id, req });
    return r;
  }

  @Post("permissions")
  async createPermission(@Req() req: any, @Body() dto: CreatePermissionDto) {
    const p = await this.admin.createPermission(this.tenantId(req), dto);
    await this.audit.log({ tenantId: this.tenantId(req), actorUserId: this.actor(req), action: "PERMISSION_CREATE", resource: "Permission", resourceId: p.id, req });
    return p;
  }

  @Post("groups/:groupId/roles/:roleId")
  async attachRoleToGroup(@Req() req: any, @Param("groupId") groupId: string, @Param("roleId") roleId: string) {
    const gr = await this.admin.attachRoleToGroup(this.tenantId(req), groupId, roleId);
    await this.audit.log({ tenantId: this.tenantId(req), actorUserId: this.actor(req), action: "GROUP_ROLE_ATTACH", resource: "Group", resourceId: groupId, req, meta: { roleId } });
    return gr;
  }

  @Post("roles/:roleId/permissions/:permId")
  async attachPermissionToRole(@Req() req: any, @Param("roleId") roleId: string, @Param("permId") permId: string) {
    const rp = await this.admin.attachPermissionToRole(this.tenantId(req), roleId, permId);
    await this.audit.log({ tenantId: this.tenantId(req), actorUserId: this.actor(req), action: "ROLE_PERMISSION_ATTACH", resource: "Role", resourceId: roleId, req, meta: { permId } });
    return rp;
  }

  // Lists (useful for frontend)
  @Get("users") async users(@Req() req: any) { return this.admin.listUsers(this.tenantId(req)); }
  @Get("groups") async groups(@Req() req: any) { return this.admin.listGroups(this.tenantId(req)); }
  @Get("roles") async roles(@Req() req: any) { return this.admin.listRoles(this.tenantId(req)); }
  @Get("permissions") async perms(@Req() req: any) { return this.admin.listPermissions(this.tenantId(req)); }
}
