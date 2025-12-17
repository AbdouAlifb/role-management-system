import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RbacService {
  constructor(private prisma: PrismaService) {}

  async getTenantRbacVersion(tenantId: string): Promise<number> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { rbacVersion: true },
    });
    return t?.rbacVersion ?? 1;
  }

  async computeUserPermissions(userId: string, tenantId: string): Promise<string[]> {
    // 1) groups
    const groups = await this.prisma.userGroup.findMany({
      where: { userId },
      select: { groupId: true },
    });
    const groupIds = groups.map(g => g.groupId);
    if (groupIds.length === 0) return [];

    // 2) roles from groups
    const roles = await this.prisma.groupRole.findMany({
      where: { groupId: { in: groupIds } },
      select: { roleId: true },
    });
    const roleIds = roles.map(r => r.roleId);
    if (roleIds.length === 0) return [];

    // 3) permissions from roles
    const perms = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      select: { permission: { select: { key: true, tenantId: true } } },
    });

    // tenant safety (avoid cross-tenant leakage)
    const keys = perms
      .filter(p => p.permission.tenantId === tenantId)
      .map(p => p.permission.key);

    return [...new Set(keys)];
  }

  hasPermission(userPerms: string[], required: string[]): boolean {
    if (userPerms.includes("*")) return true;
    return required.every(r => userPerms.includes(r));
  }
}
