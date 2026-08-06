export interface Permission {
  id: string;
  module: string;
  action: string;
  key: string;
}

export interface Role {
  id: string;
  organizationId: string;
  name: string;
  isSystem: boolean;
  createdAt: string;
  rolePermissions: { permission: Permission }[];
}

export interface CreateRoleInput {
  name: string;
  permissionKeys?: string[];
}

export interface UpdateRoleInput {
  name: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  userRoles: { role: { id: string; name: string } }[];
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
  roleIds?: string[];
}

export interface UpdateUserInput {
  fullName?: string;
  isActive?: boolean;
}

// Rótulos em pt-BR para o catálogo global de permissões (module:action) — o
// catálogo não é uniforme (nem todo módulo tem create/read/update/delete;
// ex.: accounts_payable tem create/read/pay/cancel, journal_entries tem
// create/read/reverse já que lançamentos são imutáveis). Mostramos a ação
// real de cada módulo em vez de forçar um rótulo genérico "editar"/"excluir"
// que não existiria de verdade no sistema.
export const MODULE_LABELS: Record<string, string> = {
  organizations: "Organização",
  users: "Usuários",
  roles: "Papéis",
  cost_centers: "Centros de Custo",
  accounts: "Plano de Contas",
  journal_entries: "Lançamentos Contábeis",
  fiscal: "Fiscal",
  counterparties: "Contrapartes",
  bank_accounts: "Contas Bancárias",
  accounts_payable: "Contas a Pagar",
  accounts_receivable: "Contas a Receber",
  fixed_assets: "Ativo Fixo",
  budget: "Orçamento",
  warehouses: "Depósitos",
  inventory_items: "Itens de Almoxarifado",
  reports: "Relatórios",
  bank_reconciliation: "Conciliação Bancária",
};

export const ACTION_LABELS: Record<string, string> = {
  create: "Criar",
  read: "Ler",
  update: "Editar",
  delete: "Excluir",
  pay: "Pagar",
  cancel: "Cancelar",
  receive: "Receber",
  reverse: "Estornar",
  approve: "Aprovar",
  close: "Fechar",
  dispose: "Baixar",
  run_depreciation: "Rodar depreciação",
  inbound: "Entrada",
  outbound: "Saída",
  transfer: "Transferência",
  import: "Importar",
  match: "Conciliar",
};

export function moduleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module;
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
