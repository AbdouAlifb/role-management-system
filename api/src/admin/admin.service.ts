import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import argon2 from "argon2";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async bumpRbacVersion(tenantId: string) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { rbacVersion: { increment: 1 } },
    });
  }

  async createUser(tenantId: string, dto: any) {
    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        username: dto.username,
        email: dto.email ?? null,
        passwordHash,
        forcePasswordChange: true,
      },
      select: { id: true, username: true, email: true, tenantId: true },
    });

    if (dto.groupIds?.length) {
      await this.prisma.userGroup.createMany({
        data: dto.groupIds.map((groupId: string) => ({ userId: user.id, groupId })),
        skipDuplicates: true,
      });
    }

    await this.bumpRbacVersion(tenantId);
    return user;
  }

  async setUserGroups(tenantId: string, userId: string, groupIds: string[]) {
    await this.prisma.userGroup.deleteMany({ where: { userId } });

    if (groupIds.length) {
      await this.prisma.userGroup.createMany({
        data: groupIds.map(groupId => ({ userId, groupId })),
      });
    }

    await this.bumpRbacVersion(tenantId);
    return { ok: true };
  }

  async createGroup(tenantId: string, dto: any) {
    const g = await this.prisma.group.create({ data: { tenantId, ...dto } });
    await this.bumpRbacVersion(tenantId);
    return g;
  }

  async createRole(tenantId: string, dto: any) {
    const r = await this.prisma.role.create({ data: { tenantId, ...dto } });
    await this.bumpRbacVersion(tenantId);
    return r;
  }

  async createPermission(tenantId: string, dto: any) {
    const p = await this.prisma.permission.create({ data: { tenantId, ...dto } });
    await this.bumpRbacVersion(tenantId);
    return p;
  }

  async attachRoleToGroup(tenantId: string, groupId: string, roleId: string) {
    const gr = await this.prisma.groupRole.create({ data: { groupId, roleId } });
    await this.bumpRbacVersion(tenantId);
    return gr;
  }

  async attachPermissionToRole(tenantId: string, roleId: string, permissionId: string) {
    const rp = await this.prisma.rolePermission.create({ data: { roleId, permissionId } });
    await this.bumpRbacVersion(tenantId);
    return rp;
  }

  // Optional listing endpoints (useful for front)
  async listGroups(tenantId: string) {
    return this.prisma.group.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  }
  async listRoles(tenantId: string) {
    return this.prisma.role.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  }
  async listPermissions(tenantId: string) {
    return this.prisma.permission.findMany({ where: { tenantId }, orderBy: { key: "asc" } });
  }
  async listUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: { id: true, username: true, email: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
