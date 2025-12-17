import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { SessionAuthGuard } from "../rbac/guards/session-auth.guard";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { RequirePermissions } from "../rbac/decorators/require-permissions.decorator";
import { MenuAdminService } from "./menu-admin.service";
import { CreateMenuGroupDto } from "./dto/create-menu-group.dto";
import { CreateMenuFunctionDto } from "./dto/create-menu-function.dto";
import { AttachMenuFunctionDto } from "./dto/attach-menu-function.dto";

@Controller("menu-admin")
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermissions("rbac.manage")
export class MenuAdminController {
  constructor(private admin: MenuAdminService) {}

  private tenantId(req: any) {
    return (
      req.session?.tenantId ||
      req.headers["x-tenant-id"] ||
      process.env.DEFAULT_TENANT_ID
    );
  }

  @Post("groups")
  createGroup(@Req() req: any, @Body() dto: CreateMenuGroupDto) {
    return this.admin.createMenuGroup(this.tenantId(req), dto);
  }

  @Post("functions")
  createFunction(@Req() req: any, @Body() dto: CreateMenuFunctionDto) {
    return this.admin.createMenuFunction(this.tenantId(req), dto);
  }

  @Post("groups/:groupId/functions/:functionId")
  attachFunction(
    @Req() req: any,
    @Param("groupId") groupId: string,
    @Param("functionId") functionId: string,
    @Body() dto: AttachMenuFunctionDto,
  ) {
    return this.admin.attachFunctionToGroup(this.tenantId(req), groupId, functionId, dto.sequence);
  }

  @Post("roles/:roleId/menu-groups/:menuGroupId")
  attachMenuGroupToRole(
    @Req() req: any,
    @Param("roleId") roleId: string,
    @Param("menuGroupId") menuGroupId: string,
  ) {
    return this.admin.attachMenuGroupToRole(this.tenantId(req), roleId, menuGroupId);
  }

  @Get("groups")
  listGroups(@Req() req: any) {
    return this.admin.listMenuGroups(this.tenantId(req));
  }

  @Get("functions")
  listFunctions(@Req() req: any) {
    return this.admin.listMenuFunctions(this.tenantId(req));
  }
  @Get("mappings/group-functions")
listGroupFunctions(@Req() req: any) {
  return this.admin.listGroupFunctions(this.tenantId(req));
}

@Get("mappings/role-groups")
listRoleGroups(@Req() req: any) {
  return this.admin.listRoleMenuGroups(this.tenantId(req));
}

  @Get("users/:userId/access")
  getUserAccess(@Req() req: any, @Param("userId") userId: string) {
    return this.admin.getUserAccessSummary(this.tenantId(req), userId);
  }
  
}
