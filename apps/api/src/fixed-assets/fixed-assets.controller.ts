import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { FixedAssetsService } from "./fixed-assets.service";
import { CreateFixedAssetDto } from "./dto/create-fixed-asset.dto";
import { UpdateFixedAssetDto } from "./dto/update-fixed-asset.dto";
import { DisposeFixedAssetDto } from "./dto/dispose-fixed-asset.dto";
import { RunDepreciationDto } from "./dto/run-depreciation.dto";

@ApiTags("fixed-assets")
@ApiBearerAuth()
@Controller("fixed-assets")
export class FixedAssetsController {
  constructor(private readonly fixedAssetsService: FixedAssetsService) {}

  @Get()
  @RequirePermission("fixed_assets:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.fixedAssetsService.list(user.organizationId);
  }

  @Post("depreciation-runs")
  @RequirePermission("fixed_assets:run_depreciation")
  runDepreciation(@CurrentUser() user: AuthenticatedUser, @Body() dto: RunDepreciationDto) {
    return this.fixedAssetsService.runDepreciation(user.organizationId, user.id, dto);
  }

  @Get(":id")
  @RequirePermission("fixed_assets:read")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.fixedAssetsService.findOneOrThrow(user.organizationId, id);
  }

  @Post()
  @RequirePermission("fixed_assets:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFixedAssetDto) {
    return this.fixedAssetsService.create(user.organizationId, user.id, dto);
  }

  @Patch(":id")
  @RequirePermission("fixed_assets:update")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateFixedAssetDto) {
    return this.fixedAssetsService.update(user.organizationId, id, dto);
  }

  @Delete(":id")
  @RequirePermission("fixed_assets:delete")
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.fixedAssetsService.delete(user.organizationId, id);
  }

  @Post(":id/dispose")
  @RequirePermission("fixed_assets:dispose")
  dispose(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: DisposeFixedAssetDto) {
    return this.fixedAssetsService.dispose(user.organizationId, user.id, id, dto);
  }
}
