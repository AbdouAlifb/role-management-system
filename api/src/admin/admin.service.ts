import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import argon2 from "argon2";
import { ConflictException, NotFoundException } from "@nestjs/common";

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

  // async attachRoleToGroup(tenantId: string, groupId: string, roleId: string) {
  //   const gr = await this.prisma.groupRole.create({ data: { groupId, roleId } });
  //   await this.bumpRbacVersion(tenantId);
  //   return gr;
  // }

  // async attachPermissionToRole(tenantId: string, roleId: string, permissionId: string) {
  //   const rp = await this.prisma.rolePermission.create({ data: { roleId, permissionId } });
  //   await this.bumpRbacVersion(tenantId);
  //   return rp;
  // }


  async attachRoleToGroup(tenantId: string, groupId: string, roleId: string) {
  // optional safety checks
  const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw new NotFoundException("Role not found");

  const group = await this.prisma.group.findFirst({ where: { id: groupId, tenantId } });
  if (!group) throw new NotFoundException("Group not found");

  const gr = await this.prisma.groupRole.upsert({
    where: { groupId_roleId: { groupId, roleId } },
    update: {},
    create: { groupId, roleId },
  });

  await this.bumpRbacVersion(tenantId);
  return gr;
}

async attachPermissionToRole(tenantId: string, roleId: string, permissionId: string) {
  const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw new NotFoundException("Role not found");

  const perm = await this.prisma.permission.findFirst({ where: { id: permissionId, tenantId } });
  if (!perm) throw new NotFoundException("Permission not found");

  const rp = await this.prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId, permissionId } },
    update: {},
    create: { roleId, permissionId },
  });

  await this.bumpRbacVersion(tenantId);
  return rp;
}


  // Optional listing endpoints (useful for front)
  async listGroups(tenantId: string) {
    return this.prisma.group.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  }
  // async listRoles(tenantId: string) {
  //   return this.prisma.role.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  // }
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
  // ✅ list roles WITH permissions (so frontend can render immediately)
async listRoles(tenantId: string) {
  return this.prisma.role.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: {
      perms: { include: { permission: true } }, // RolePermission -> Permission
    },
  });
}

// ✅ optional: fetch perms for ONE role
async listRolePermissions(tenantId: string, roleId: string) {
  // ensure role belongs to tenant
  await this.prisma.role.findFirstOrThrow({ where: { id: roleId, tenantId } });

  return this.prisma.permission.findMany({
    where: { tenantId, roles: { some: { roleId } } }, // Permission.roles = RolePermission[]
    orderBy: { key: "asc" },
  });
}

// ✅ make single-attach idempotent (no duplicate crash)
// async attachPermissionToRole(tenantId: string, roleId: string, permissionId: string) {
//   await this.prisma.role.findFirstOrThrow({ where: { id: roleId, tenantId } });
//   await this.prisma.permission.findFirstOrThrow({ where: { id: permissionId, tenantId } });

//   return this.prisma.rolePermission.upsert({
//     where: { roleId_permissionId: { roleId, permissionId } },
//     update: {},
//     create: { roleId, permissionId },
//   });
// }

// ✅ set/sync permissions in one request (add many + remove missing)
async setRolePermissions(tenantId: string, roleId: string, permissionIds: string[]) {
  await this.prisma.role.findFirstOrThrow({ where: { id: roleId, tenantId } });

  // (optional but recommended) validate permissionIds belong to tenant
  const found = await this.prisma.permission.findMany({
    where: { tenantId, id: { in: permissionIds } },
    select: { id: true },
  });
  const allowedIds = found.map((p) => p.id);

  return this.prisma.$transaction(async (tx) => {
    // remove perms not in the new list
    await tx.rolePermission.deleteMany({
      where: { roleId, permissionId: { notIn: allowedIds } },
    });

    // add missing perms (idempotent)
    await tx.rolePermission.createMany({
      data: allowedIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });

    // return updated role (with perms) for convenience
    return tx.role.findUnique({
      where: { id: roleId },
      include: { perms: { include: { permission: true } } },
    });
  });
}
async setRoleGroups(tenantId: string, roleId: string, groupIds: string[]) {
  const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw new NotFoundException("Role not found");

  // (optional) validate groups belong to tenant
  if (groupIds.length) {
    const count = await this.prisma.group.count({ where: { tenantId, id: { in: groupIds } } });
    if (count !== groupIds.length) throw new NotFoundException("One or more groups not found");
  }

  await this.prisma.$transaction(async (tx) => {
    // remove groups not in new list
    await tx.groupRole.deleteMany({
      where: { roleId, groupId: { notIn: groupIds.length ? groupIds : ["__none__"] } },
    });

    // add missing ones (idempotent)
    if (groupIds.length) {
      await tx.groupRole.createMany({
        data: groupIds.map((groupId) => ({ groupId, roleId })),
        skipDuplicates: true,
      });
    }
  });

  await this.bumpRbacVersion(tenantId);
  return { ok: true };
}


}
