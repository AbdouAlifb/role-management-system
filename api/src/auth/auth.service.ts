import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import argon2 from "argon2";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async validateUser(tenantId: string, username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { tenantId_username: { tenantId, username } },
    });

    if (!user) throw new UnauthorizedException("Invalid credentials");
    if (!user.isActive) throw new ForbiddenException("User disabled");

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    return user;
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        username: true,
        email: true,
        isActive: true,
        forcePasswordChange: true,
        createdAt: true,
      },
    });
  }
}
