import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    tenantId: string;
    actorUserId?: string;
    action: string;
    resource?: string;
    resourceId?: string;
    req?: any;
    meta?: any;
  }) {
    const ip =
      params.req?.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      params.req?.ip;

    const userAgent = params.req?.headers["user-agent"];

    await this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        ip,
        userAgent,
        meta: params.meta ?? {},
      },
    });
  }
}
