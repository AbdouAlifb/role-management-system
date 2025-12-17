-- CreateTable
CREATE TABLE "MenuGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuFunction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT,
    "requiredPermissionKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuFunction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuGroupFunction" (
    "menuGroupId" TEXT NOT NULL,
    "menuFunctionId" TEXT NOT NULL,
    "sequence" INTEGER,

    CONSTRAINT "MenuGroupFunction_pkey" PRIMARY KEY ("menuGroupId","menuFunctionId")
);

-- CreateTable
CREATE TABLE "RoleMenuGroup" (
    "roleId" TEXT NOT NULL,
    "menuGroupId" TEXT NOT NULL,

    CONSTRAINT "RoleMenuGroup_pkey" PRIMARY KEY ("roleId","menuGroupId")
);

-- CreateTable
CREATE TABLE "RoleMenuFunction" (
    "roleId" TEXT NOT NULL,
    "menuFunctionId" TEXT NOT NULL,

    CONSTRAINT "RoleMenuFunction_pkey" PRIMARY KEY ("roleId","menuFunctionId")
);

-- CreateIndex
CREATE INDEX "MenuGroup_tenantId_sequence_idx" ON "MenuGroup"("tenantId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "MenuGroup_tenantId_code_key" ON "MenuGroup"("tenantId", "code");

-- CreateIndex
CREATE INDEX "MenuFunction_tenantId_type_idx" ON "MenuFunction"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MenuFunction_tenantId_code_key" ON "MenuFunction"("tenantId", "code");

-- CreateIndex
CREATE INDEX "MenuGroupFunction_menuGroupId_sequence_idx" ON "MenuGroupFunction"("menuGroupId", "sequence");

-- AddForeignKey
ALTER TABLE "MenuGroup" ADD CONSTRAINT "MenuGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuFunction" ADD CONSTRAINT "MenuFunction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuGroupFunction" ADD CONSTRAINT "MenuGroupFunction_menuGroupId_fkey" FOREIGN KEY ("menuGroupId") REFERENCES "MenuGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuGroupFunction" ADD CONSTRAINT "MenuGroupFunction_menuFunctionId_fkey" FOREIGN KEY ("menuFunctionId") REFERENCES "MenuFunction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuGroup" ADD CONSTRAINT "RoleMenuGroup_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuGroup" ADD CONSTRAINT "RoleMenuGroup_menuGroupId_fkey" FOREIGN KEY ("menuGroupId") REFERENCES "MenuGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuFunction" ADD CONSTRAINT "RoleMenuFunction_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuFunction" ADD CONSTRAINT "RoleMenuFunction_menuFunctionId_fkey" FOREIGN KEY ("menuFunctionId") REFERENCES "MenuFunction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
