/**
 * Catálogo global de permissões (module:action) do sistema. Fonte única de
 * verdade usada pelo seed (popula a tabela `permissions`) — cada módulo
 * futuro (financeiro, almoxarifado, ativo fixo, fiscal, ...) soma suas
 * próprias entradas aqui sem afetar os já existentes.
 */
export interface PermissionDefinition {
  module: string;
  action: string;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  { module: "organizations", action: "read" },
  { module: "organizations", action: "update" },

  { module: "users", action: "create" },
  { module: "users", action: "read" },
  { module: "users", action: "update" },
  { module: "users", action: "delete" },

  { module: "roles", action: "create" },
  { module: "roles", action: "read" },
  { module: "roles", action: "update" },
  { module: "roles", action: "delete" },

  { module: "cost_centers", action: "create" },
  { module: "cost_centers", action: "read" },
  { module: "cost_centers", action: "update" },
  { module: "cost_centers", action: "delete" },

  { module: "accounts", action: "create" },
  { module: "accounts", action: "read" },
  { module: "accounts", action: "update" },
  { module: "accounts", action: "delete" },

  { module: "journal_entries", action: "create" },
  { module: "journal_entries", action: "read" },
  { module: "journal_entries", action: "reverse" },

  { module: "fiscal", action: "create" },
  { module: "fiscal", action: "read" },
  { module: "fiscal", action: "update_settings" },

  { module: "counterparties", action: "create" },
  { module: "counterparties", action: "read" },
  { module: "counterparties", action: "update" },

  { module: "bank_accounts", action: "create" },
  { module: "bank_accounts", action: "read" },
  { module: "bank_accounts", action: "update" },

  { module: "accounts_payable", action: "create" },
  { module: "accounts_payable", action: "read" },
  { module: "accounts_payable", action: "pay" },
  { module: "accounts_payable", action: "cancel" },

  { module: "accounts_receivable", action: "create" },
  { module: "accounts_receivable", action: "read" },
  { module: "accounts_receivable", action: "receive" },
  { module: "accounts_receivable", action: "cancel" },

  { module: "fixed_assets", action: "create" },
  { module: "fixed_assets", action: "read" },
  { module: "fixed_assets", action: "update" },
  { module: "fixed_assets", action: "delete" },
  { module: "fixed_assets", action: "dispose" },
  { module: "fixed_assets", action: "run_depreciation" },

  { module: "budget", action: "create" },
  { module: "budget", action: "read" },
  { module: "budget", action: "update" },
  { module: "budget", action: "delete" },
  { module: "budget", action: "approve" },
  { module: "budget", action: "close" },

  { module: "warehouses", action: "create" },
  { module: "warehouses", action: "read" },
  { module: "warehouses", action: "update" },

  { module: "inventory_items", action: "create" },
  { module: "inventory_items", action: "read" },
  { module: "inventory_items", action: "update" },
  { module: "inventory_items", action: "inbound" },
  { module: "inventory_items", action: "outbound" },
  { module: "inventory_items", action: "transfer" },

  { module: "reports", action: "read" },

  { module: "bank_reconciliation", action: "read" },
  { module: "bank_reconciliation", action: "import" },
  { module: "bank_reconciliation", action: "match" },
  { module: "bank_reconciliation", action: "close" },

  { module: "employees", action: "create" },
  { module: "employees", action: "read" },
  { module: "employees", action: "update" },

  { module: "payroll_settings", action: "read" },
  { module: "payroll_settings", action: "update" },

  { module: "payroll_runs", action: "create" },
  { module: "payroll_runs", action: "read" },
  { module: "payroll_runs", action: "post" },

  { module: "vacations", action: "create" },
  { module: "vacations", action: "read" },
  { module: "vacations", action: "post" },

  { module: "thirteenth_salary", action: "create" },
  { module: "thirteenth_salary", action: "read" },
  { module: "thirteenth_salary", action: "post" },

  { module: "terminations", action: "create" },
  { module: "terminations", action: "read" },
  { module: "terminations", action: "post" },

  { module: "company_registration", action: "read" },
  { module: "company_registration", action: "update" },

  { module: "esocial", action: "create" },
  { module: "esocial", action: "read" },
  { module: "esocial", action: "update" },

  { module: "sped", action: "generate" },
];

export function permissionKey(module: string, action: string): string {
  return `${module}:${action}`;
}
