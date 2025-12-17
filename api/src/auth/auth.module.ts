import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { RbacModule } from "../rbac/rbac.module";

@Module({
  imports: [RbacModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
