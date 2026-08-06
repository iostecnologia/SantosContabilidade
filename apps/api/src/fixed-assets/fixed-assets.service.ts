import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { FixedAsset, FixedAssetDepreciationEntry, Prisma } from "@prisma/client";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { JournalEntriesService } from "../journal-entries/journal-entries.service";
import { CreateFixedAssetDto } from "./dto/create-fixed-asset.dto";
import { UpdateFixedAssetDto } from "./dto/update-fixed-asset.dto";
import { DisposeFixedAssetDto } from "./dto/dispose-fixed-asset.dto";
import { RunDepreciationDto } from "./dto/run-depreciation.dto";

/**
 * Cadastrar um ativo NÃO posta lançamento algum — diferente de AP/AR, um
 * ativo pode ser capitalizado no razão por vários caminhos (compra à vista,
 * título de AP cuja linha de débito já aponta pra conta do ativo, aporte de
 * capital etc.); modelar "como foi adquirido" fica fora de escopo aqui.
 * `FixedAsset` é um razão auxiliar: registra o ativo já capitalizado e sua
 * depreciação, reconciliado contra (mas não gerando) o saldo da conta do
 * ativo. As únicas duas coisas que este módulo posta no razão são a
 * depreciação periódica e a baixa (write-off puro, sem venda/proceeds).
 */
@Injectable()
export class FixedAssetsService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionAdapter>,
    private readonly journalEntries: JournalEntriesService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.fixedAsset.findMany({
      where: { organizationId },
      include: { depreciationEntries: true },
      orderBy: { assetNumber: "asc" },
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const asset = await this.tx.fixedAsset.findFirst({
      where: { id, organizationId },
      include: { depreciationEntries: true },
    });
    if (!asset) {
      throw new NotFoundException("Ativo fixo não encontrado.");
    }
    return asset;
  }

  async create(organizationId: string, userId: string, dto: CreateFixedAssetDto) {
    await this.ensureAccountUsable(organizationId, dto.assetAccountId);
    await this.ensureAccountUsable(organizationId, dto.accumulatedDepreciationAccountId);
    await this.ensureAccountUsable(organizationId, dto.depreciationExpenseAccountId);

    const counterRows = await this.tx.$queryRaw<{ current_value: bigint }[]>`
      INSERT INTO sequence_counters (organization_id, counter_key, current_value)
      VALUES (${organizationId}, 'fixed_asset', 1)
      ON CONFLICT (organization_id, counter_key)
      DO UPDATE SET current_value = sequence_counters.current_value + 1
      RETURNING current_value
    `;
    if (counterRows.length !== 1) {
      throw new ConflictException("Não foi possível gerar o número do ativo.");
    }
    const assetNumber = counterRows[0].current_value;

    const asset = await this.tx.fixedAsset.create({
      data: {
        organizationId,
        assetNumber,
        description: dto.description,
        acquisitionDate: new Date(dto.acquisitionDate),
        acquisitionCost: dto.acquisitionCost,
        residualValue: dto.residualValue ?? 0,
        usefulLifeMonths: dto.usefulLifeMonths,
        assetAccountId: dto.assetAccountId,
        accumulatedDepreciationAccountId: dto.accumulatedDepreciationAccountId,
        depreciationExpenseAccountId: dto.depreciationExpenseAccountId,
        costCenterId: dto.costCenterId,
        createdBy: userId,
      },
    });

    return this.findOneOrThrow(organizationId, asset.id);
  }

  async update(organizationId: string, id: string, dto: UpdateFixedAssetDto) {
    const asset = await this.findOneOrThrow(organizationId, id);

    const changesBasis = dto.residualValue !== undefined || dto.usefulLifeMonths !== undefined;
    if (changesBasis && asset.depreciationEntries.length > 0) {
      throw new ConflictException(
        "Ativo já possui depreciação lançada; não é possível alterar valor residual ou vida útil.",
      );
    }

    return this.tx.fixedAsset.update({
      where: { id },
      data: {
        description: dto.description,
        costCenterId: dto.costCenterId,
        residualValue: dto.residualValue,
        usefulLifeMonths: dto.usefulLifeMonths,
      },
    });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const asset = await this.findOneOrThrow(organizationId, id);

    if (asset.depreciationEntries.length > 0) {
      throw new ConflictException("Ativo possui depreciações registradas; não pode ser removido.");
    }

    try {
      await this.tx.fixedAsset.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new ConflictException("Ativo está em uso e não pode ser removido.");
      }
      throw err;
    }
  }

  async runDepreciation(organizationId: string, userId: string, dto: RunDepreciationDto) {
    const raw = new Date(dto.competenceMonth);
    const competenceMonth = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(competenceMonth.getUTCFullYear(), competenceMonth.getUTCMonth() + 1, 0));

    const eligibleAssets = await this.tx.fixedAsset.findMany({
      where: { organizationId, status: "ACTIVE", acquisitionDate: { lte: periodEnd } },
    });

    const alreadyProcessed = await this.tx.fixedAssetDepreciationEntry.findMany({
      where: { organizationId, competenceMonth },
      select: { fixedAssetId: true },
    });
    const processedIds = new Set(alreadyProcessed.map((e) => e.fixedAssetId));

    const processed: FixedAssetDepreciationEntry[] = [];
    for (const asset of eligibleAssets) {
      if (processedIds.has(asset.id)) {
        continue;
      }

      const depreciableBase = asset.acquisitionCost.minus(asset.residualValue);
      if (depreciableBase.lessThanOrEqualTo(0)) {
        continue;
      }
      const remaining = depreciableBase.minus(asset.accumulatedDepreciation);
      if (remaining.lessThanOrEqualTo(0)) {
        continue;
      }
      const monthlyAmount = depreciableBase.dividedBy(asset.usefulLifeMonths).toDecimalPlaces(2);
      const amountToPost = Prisma.Decimal.min(monthlyAmount, remaining);
      if (amountToPost.lessThanOrEqualTo(0)) {
        continue;
      }

      processed.push(await this.postDepreciation(organizationId, userId, asset, competenceMonth, amountToPost, depreciableBase));
    }

    return { competenceMonth, processed };
  }

  private async postDepreciation(
    organizationId: string,
    userId: string,
    asset: FixedAsset,
    competenceMonth: Date,
    amountToPost: Prisma.Decimal,
    depreciableBase: Prisma.Decimal,
  ) {
    const entryDate = new Date(Date.UTC(competenceMonth.getUTCFullYear(), competenceMonth.getUTCMonth() + 1, 0));

    const journalEntry = await this.journalEntries.create(organizationId, userId, {
      entryDate: entryDate.toISOString().slice(0, 10),
      competenceDate: competenceMonth.toISOString().slice(0, 10),
      description: `Depreciação do ativo nº ${asset.assetNumber} — ${asset.description}`,
      referenceModule: "FIXED_ASSET",
      referenceId: asset.id,
      lines: [
        {
          accountId: asset.depreciationExpenseAccountId,
          costCenterId: asset.costCenterId ?? undefined,
          direction: "DEBIT",
          amount: amountToPost.toNumber(),
        },
        { accountId: asset.accumulatedDepreciationAccountId, direction: "CREDIT", amount: amountToPost.toNumber() },
      ],
    });

    const depreciationEntry = await this.tx.fixedAssetDepreciationEntry.create({
      data: {
        organizationId,
        fixedAssetId: asset.id,
        competenceMonth,
        amount: amountToPost,
        journalEntryId: journalEntry.id,
        createdBy: userId,
      },
    });

    const newAccumulated = asset.accumulatedDepreciation.plus(amountToPost);
    await this.tx.fixedAsset.update({
      where: { id: asset.id },
      data: {
        accumulatedDepreciation: newAccumulated,
        status: newAccumulated.greaterThanOrEqualTo(depreciableBase) ? "FULLY_DEPRECIATED" : "ACTIVE",
      },
    });

    return depreciationEntry;
  }

  async dispose(organizationId: string, userId: string, id: string, dto: DisposeFixedAssetDto) {
    const asset = await this.findOneOrThrow(organizationId, id);

    if (asset.status === "DISPOSED") {
      throw new ConflictException("Ativo já foi baixado.");
    }
    await this.ensureAccountUsable(organizationId, dto.lossOnDisposalAccountId);

    const accumulated = asset.accumulatedDepreciation;
    const bookValue = asset.acquisitionCost.minus(accumulated);

    const lines: {
      accountId: string;
      costCenterId?: string;
      direction: "DEBIT" | "CREDIT";
      amount: number;
    }[] = [];
    if (accumulated.greaterThan(0)) {
      lines.push({ accountId: asset.accumulatedDepreciationAccountId, direction: "DEBIT", amount: accumulated.toNumber() });
    }
    if (bookValue.greaterThan(0)) {
      lines.push({ accountId: dto.lossOnDisposalAccountId, direction: "DEBIT", amount: bookValue.toNumber() });
    }
    lines.push({ accountId: asset.assetAccountId, direction: "CREDIT", amount: asset.acquisitionCost.toNumber() });

    const journalEntry = await this.journalEntries.create(organizationId, userId, {
      entryDate: dto.disposalDate,
      competenceDate: dto.disposalDate,
      description: `Baixa do ativo nº ${asset.assetNumber} — ${asset.description}`,
      referenceModule: "FIXED_ASSET",
      referenceId: asset.id,
      lines,
    });

    await this.tx.fixedAsset.update({
      where: { id },
      data: {
        status: "DISPOSED",
        disposalDate: new Date(dto.disposalDate),
        disposalJournalEntryId: journalEntry.id,
        lossOnDisposalAccountId: dto.lossOnDisposalAccountId,
      },
    });

    return this.findOneOrThrow(organizationId, id);
  }

  private async ensureAccountUsable(organizationId: string, accountId: string): Promise<void> {
    const account = await this.tx.account.findFirst({ where: { id: accountId, organizationId } });
    if (!account) {
      throw new BadRequestException("Conta contábil inválida para esta organização.");
    }
    if (!account.isAnalytic || !account.isActive) {
      throw new BadRequestException("Conta contábil precisa ser analítica e estar ativa.");
    }
  }
}
