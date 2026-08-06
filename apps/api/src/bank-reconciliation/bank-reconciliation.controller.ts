import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { BankReconciliationService } from "./bank-reconciliation.service";
import { ManualMatchDto } from "./dto/manual-match.dto";
import { CreateAdjustmentEntryDto } from "./dto/create-adjustment-entry.dto";

@ApiTags("bank-reconciliation")
@ApiBearerAuth()
@Controller("bank-reconciliations")
export class BankReconciliationController {
  constructor(private readonly service: BankReconciliationService) {}

  @Get()
  @RequirePermission("bank_reconciliation:read")
  list(@CurrentUser() user: AuthenticatedUser, @Query("bankAccountId") bankAccountId?: string) {
    return this.service.list(user.organizationId, bankAccountId);
  }

  @Get(":id")
  @RequirePermission("bank_reconciliation:read")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.findOneOrThrow(user.organizationId, id);
  }

  @Get(":id/summary")
  @RequirePermission("bank_reconciliation:read")
  summary(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.getSummary(user.organizationId, id);
  }

  @Get(":id/lines/:lineId/candidates")
  @RequirePermission("bank_reconciliation:read")
  candidates(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Param("lineId") lineId: string) {
    return this.service.findMatchCandidates(user.organizationId, id, lineId);
  }

  // Sem DTO de classe para o campo de texto do multipart de propósito: o
  // ValidationPipe global só valida corpos com metatype de classe, e o campo
  // único (bankAccountId) já é validado "à mão" no service.
  @Post("import")
  @RequirePermission("bank_reconciliation:import")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  importStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Body("bankAccountId") bankAccountId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("Arquivo OFX não enviado.");
    }
    return this.service.importStatement(user.organizationId, user.id, bankAccountId, file.buffer.toString("utf-8"));
  }

  @Post(":id/lines/:lineId/match")
  @RequirePermission("bank_reconciliation:match")
  match(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Body() dto: ManualMatchDto,
  ) {
    return this.service.manualMatch(user.organizationId, id, lineId, dto);
  }

  @Post(":id/lines/:lineId/reset")
  @RequirePermission("bank_reconciliation:match")
  reset(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Param("lineId") lineId: string) {
    return this.service.resetLine(user.organizationId, id, lineId);
  }

  @Post(":id/lines/:lineId/ignore")
  @RequirePermission("bank_reconciliation:match")
  ignore(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Param("lineId") lineId: string) {
    return this.service.ignore(user.organizationId, id, lineId);
  }

  @Post(":id/lines/:lineId/create-entry")
  @RequirePermission("bank_reconciliation:match")
  createEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Body() dto: CreateAdjustmentEntryDto,
  ) {
    return this.service.createAdjustmentEntry(user.organizationId, user.id, id, lineId, dto);
  }

  @Post(":id/close")
  @RequirePermission("bank_reconciliation:close")
  close(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.close(user.organizationId, id);
  }

  @Delete(":id")
  @RequirePermission("bank_reconciliation:import")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.remove(user.organizationId, id);
  }
}
