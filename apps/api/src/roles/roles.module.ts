import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  controllers: [RolesController],
  providers: [
    RolesService,
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class RolesModule {}
