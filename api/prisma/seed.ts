import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Missing DIRECT_DATABASE_URL (or DATABASE_URL) in apps/api/.env");

const pool = new Pool({
  connectionString: url,
  connectionTimeoutMillis: 30_000,
  ssl: { rejectUnauthorized: true },
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});


async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Default Tenant",
    },
  });

  // Permissions (include "*" for super admin bypass)
  const perms = ["*", "rbac.manage", "users.manage", "audit.read"];
  for (const key of perms) {
    await prisma.permission.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: {},
      create: { tenantId: tenant.id, key },
    });
  }

  const role = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "SUPER_ADMIN" } },
    update: {},
    create: { tenantId: tenant.id, name: "SUPER_ADMIN" },
  });

  const group = await prisma.group.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Super Admins" } },
    update: {},
    create: { tenantId: tenant.id, name: "Super Admins" },
  });

  // Attach role to group
  await prisma.groupRole.upsert({
    where: { groupId_roleId: { groupId: group.id, roleId: role.id } },
    update: {},
    create: { groupId: group.id, roleId: role.id },
  });

  // Attach "*" permission to role
  const starPerm = await prisma.permission.findUniqueOrThrow({
    where: { tenantId_key: { tenantId: tenant.id, key: "*" } },
  });

  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: role.id, permissionId: starPerm.id } },
    update: {},
    create: { roleId: role.id, permissionId: starPerm.id },
  });

  // Create admin user
  const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe!12345";
  const passwordHash = await argon2.hash(adminPassword);

  const admin = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: "admin" } },
    update: {},
    create: {
      tenantId: tenant.id,
      username: "admin",
      email: "admin@example.com",
      passwordHash,
      forcePasswordChange: true,
    },
  });

  // Add admin to Super Admins group
  await prisma.userGroup.upsert({
    where: { userId_groupId: { userId: admin.id, groupId: group.id } },
    update: {},
    create: { userId: admin.id, groupId: group.id },
  });

  console.log("✅ Seed done. admin /", adminPassword);
}

main()
  .finally(async () => prisma.$disconnect());
