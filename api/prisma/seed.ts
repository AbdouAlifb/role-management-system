import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Missing DIRECT_DATABASE_URL (or DATABASE_URL)");

const isLocal = /localhost|127\.0\.0\.1/.test(url);
const pool = new Pool({
  connectionString: url,
  connectionTimeoutMillis: 30_000,
  ssl: isLocal ? false : { rejectUnauthorized: true },});

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
  const perms = [
    "*",
    "rbac.manage",
    "users.manage",
    "audit.read",

    // --- menu permissions (gate app sections)
    "menu.partner",
    "menu.contract",
    "menu.treaty",
    "menu.placement",
    "menu.bordereau",
    "menu.claims",
    "menu.lossreserve",
    "menu.statistics",
    "menu.security",
  ];

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

  // ==========================================================
  // ✅ MENU SEED (client legacy menu → groups + functions)
  // ==========================================================
  const MENU_GROUPS: Array<{ code: string; name: string; sequence: number; icon?: string }> = [
    { code: "KPI", name: "Key Performance Indicator", sequence: 1, icon: "📊" },
    { code: "UWR", name: "Underwriting", sequence: 2, icon: "🧾" },
    { code: "PTA", name: "Premium & Technical Accounts", sequence: 3, icon: "💳" },
    { code: "CLM", name: "Claim Management", sequence: 4, icon: "🧯" },
    { code: "FIN", name: "Finance", sequence: 5, icon: "💰" },
    { code: "ENQ", name: "Enquiry Engine", sequence: 6, icon: "🔎" },
    { code: "REP", name: "Report Engine", sequence: 7, icon: "📄" },
    { code: "REF", name: "Reference Tables", sequence: 8, icon: "📚" },
    { code: "DBA", name: "Database Administration", sequence: 9, icon: "🛠️" },
  ];

  const MENU_FUNCTIONS: Array<{
    code: string;
    name: string;
    type: string; // legacy "M" / "E"
    groupCode: string;
    sequence: number;
    path: string; // frontend route
    requiredPermissionKey: string; // Permission.key
  }> = [
    { code: "Partner",     name: "Partner",      type: "M", groupCode: "KPI", sequence: 1, path: "/dashboard/app/partner",     requiredPermissionKey: "menu.partner" },
    { code: "Contract",    name: "Contract",     type: "M", groupCode: "UWR", sequence: 2, path: "/dashboard/app/contract",    requiredPermissionKey: "menu.contract" },
    { code: "Treaty",      name: "Treaty",       type: "M", groupCode: "UWR", sequence: 3, path: "/dashboard/app/treaty",      requiredPermissionKey: "menu.treaty" },
    { code: "Placement",   name: "Placement",    type: "M", groupCode: "PTA", sequence: 4, path: "/dashboard/app/placement",   requiredPermissionKey: "menu.placement" },
    { code: "Bordereau",   name: "Bordereau",    type: "M", groupCode: "CLM", sequence: 5, path: "/dashboard/app/bordereau",   requiredPermissionKey: "menu.bordereau" },
    { code: "Claims",      name: "Claims",       type: "M", groupCode: "FIN", sequence: 6, path: "/dashboard/app/claims",      requiredPermissionKey: "menu.claims" },
    { code: "LossReserve", name: "Loss Reserve", type: "M", groupCode: "FIN", sequence: 7, path: "/dashboard/app/lossreserve", requiredPermissionKey: "menu.lossreserve" },
    { code: "Statistics",  name: "Statistics",   type: "E", groupCode: "ENQ", sequence: 8, path: "/dashboard/app/statistics",  requiredPermissionKey: "menu.statistics" },
    { code: "Security",    name: "Security",     type: "E", groupCode: "REP", sequence: 9, path: "/dashboard/app/security",    requiredPermissionKey: "menu.security" },
  ];

  // 1) Upsert MenuGroups
  const groupByCode = new Map<string, { id: string }>();
  for (const g of MENU_GROUPS) {
    const mg = await prisma.menuGroup.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: g.code } },
      update: { name: g.name, sequence: g.sequence, icon: g.icon ?? null },
      create: { tenantId: tenant.id, code: g.code, name: g.name, sequence: g.sequence, icon: g.icon ?? null },
      select: { id: true },
    });
    groupByCode.set(g.code, mg);
  }

  // 2) Upsert MenuFunctions + attach to groups (MenuGroupFunction)
  const functionByCode = new Map<string, { id: string }>();

  for (const f of MENU_FUNCTIONS) {
    const mf = await prisma.menuFunction.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: f.code } },
      update: {
        name: f.name,
        type: f.type,
        path: f.path,
        requiredPermissionKey: f.requiredPermissionKey,
      },
      create: {
        tenantId: tenant.id,
        code: f.code,
        name: f.name,
        type: f.type,
        path: f.path,
        requiredPermissionKey: f.requiredPermissionKey,
      },
      select: { id: true },
    });

    functionByCode.set(f.code, mf);

    const mg = groupByCode.get(f.groupCode);
    if (!mg) continue;

    await prisma.menuGroupFunction.upsert({
      where: { menuGroupId_menuFunctionId: { menuGroupId: mg.id, menuFunctionId: mf.id } },
      update: { sequence: f.sequence },
      create: { menuGroupId: mg.id, menuFunctionId: mf.id, sequence: f.sequence },
    });
  }

  // 3) OPTIONAL (recommended now): grant SUPER_ADMIN role access to all seeded menu groups/functions
  //    This avoids “why I don’t see menu items” while your role-menu gating is still evolving.
  for (const mg of groupByCode.values()) {
    await prisma.roleMenuGroup.upsert({
      where: { roleId_menuGroupId: { roleId: role.id, menuGroupId: mg.id } },
      update: {},
      create: { roleId: role.id, menuGroupId: mg.id },
    });
  }

  for (const mf of functionByCode.values()) {
    await prisma.roleMenuFunction.upsert({
      where: { roleId_menuFunctionId: { roleId: role.id, menuFunctionId: mf.id } },
      update: {},
      create: { roleId: role.id, menuFunctionId: mf.id },
    });
  }

  console.log("✅ Seed done. admin /", adminPassword);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // ✅ important: close PG pool
  });
