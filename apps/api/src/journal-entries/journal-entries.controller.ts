import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { JournalEntriesService } from "./journal-entries.service";
import { CreateJournalEntryDto } from "./dto/create-journal-entry.dto";

// Sem PUT/PATCH/DELETE de propósito: lançamentos contábeis são imutáveis
// (app_user tem UPDATE/DELETE revogados em journal_entries e
// journal_entry_lines no banco). Correção é sempre por estorno.
@ApiTags("journal-entries")
@ApiBearerAuth()
@Controller("journal-entries")
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @Get()
  @RequirePermission("journal_entries:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.journalEntriesService.list(user.organizationId);
  }

  @Get(":id")
  @RequirePermission("journal_entries:read")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.journalEntriesService.findOneOrThrow(user.organizationId, id);
  }

  @Post()
  @RequirePermission("journal_entries:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateJournalEntryDto) {
    return this.journalEntriesService.create(user.organizationId, user.id, dto);
  }

  @Post(":id/reverse")
  @RequirePermission("journal_entries:reverse")
  reverse(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.journalEntriesService.reverse(user.organizationId, user.id, id);
  }
}
