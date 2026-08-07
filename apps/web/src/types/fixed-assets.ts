export type FixedAssetStatus = "ACTIVE" | "FULLY_DEPRECIATED" | "DISPOSED";

export interface FixedAssetDepreciationEntry {
  id: string;
  fixedAssetId: string;
  competenceMonth: string;
  amount: string;
  journalEntryId: string;
  createdAt: string;
}

export interface FixedAsset {
  id: string;
  organizationId: string;
  assetNumber: string;
  description: string;
  acquisitionDate: string;
  acquisitionCost: string;
  residualValue: string;
  usefulLifeMonths: number;
  accumulatedDepreciation: string;
  assetAccountId: string;
  accumulatedDepreciationAccountId: string;
  depreciationExpenseAccountId: string;
  costCenterId: string | null;
  status: FixedAssetStatus;
  disposalDate: string | null;
  disposalJournalEntryId: string | null;
  lossOnDisposalAccountId: string | null;
  createdAt: string;
  updatedAt: string;
  depreciationEntries: FixedAssetDepreciationEntry[];
}

export interface CreateFixedAssetInput {
  description: string;
  acquisitionDate: string;
  acquisitionCost: number;
  residualValue?: number;
  usefulLifeMonths: number;
  assetAccountId: string;
  accumulatedDepreciationAccountId: string;
  depreciationExpenseAccountId: string;
  costCenterId?: string;
}

export interface UpdateFixedAssetInput {
  description?: string;
  costCenterId?: string;
  residualValue?: number;
  usefulLifeMonths?: number;
}

export interface DisposeFixedAssetInput {
  disposalDate: string;
  lossOnDisposalAccountId: string;
}

export interface RunDepreciationInput {
  competenceMonth: string;
}

export interface RunDepreciationResult {
  competenceMonth: string;
  processed: FixedAssetDepreciationEntry[];
}
