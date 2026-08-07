/**
 * Funções puras de cálculo usadas por folha mensal, férias, 13º e rescisão.
 * Nenhuma delas toca o banco — recebem os dados (salário, faixas de
 * INSS/IRRF já carregadas, datas) e devolvem números, para poderem ser
 * testadas isoladamente e reaproveitadas pelos quatro serviços de evento.
 */

export interface TaxBracketInput {
  minBase: number;
  maxBase: number | null;
  rate: number;
  deduction: number;
}

// Converte faixas vindas do Prisma (campos Decimal) para números simples —
// os valores em jogo (dezenas a milhares de reais) estão bem abaixo de
// onde a imprecisão de ponto flutuante seria material para folha de pagamento.
export function toTaxBracketInputs(
  brackets: { minBase: unknown; maxBase: unknown; rate: unknown; deduction: unknown }[],
): TaxBracketInput[] {
  return brackets.map((b) => ({
    minBase: Number(b.minBase),
    maxBase: b.maxBase === null || b.maxBase === undefined ? null : Number(b.maxBase),
    rate: Number(b.rate),
    deduction: Number(b.deduction),
  }));
}

// Formato único "base*alíquota - parcela a deduzir" — é o método oficial do
// IRRF e também representa corretamente o INSS progressivo (desde a EC
// 103/2019) se as "parcelas a deduzir" de cada faixa forem pré-calculadas
// para dar continuidade entre faixas (ver seed de PayrollSettingsService).
// O teto do INSS (valor máximo de desconto) é aplicado por fora desta
// função, pelo chamador — este cálculo sozinho não tem noção de teto.
export function calculateProgressiveTax(base: number, brackets: TaxBracketInput[]): number {
  if (base <= 0 || brackets.length === 0) {
    return 0;
  }
  const sorted = [...brackets].sort((a, b) => a.minBase - b.minBase);
  const bracket = sorted.find((b) => base >= b.minBase && (b.maxBase === null || base <= b.maxBase)) ?? sorted[sorted.length - 1];
  return Math.max(base * bracket.rate - bracket.deduction, 0);
}

export function dailyRate(baseSalary: number): number {
  return baseSalary / 30;
}

// Meses trabalhados dentro de [período, ano] — usado por 13º e rescisão.
// Regra CLT: fração de mês só conta como mês completo se o funcionário
// trabalhou pelo menos 15 dias naquele mês.
export function countWorkedMonthsInYear(admissionDate: Date, year: number, terminationDate: Date | null): number {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const periodStart = admissionDate > yearStart ? admissionDate : yearStart;
  const periodEnd = terminationDate && terminationDate < yearEnd ? terminationDate : yearEnd;
  if (periodStart > periodEnd) {
    return 0;
  }

  let months = 0;
  let cursor = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), 1));
  while (cursor <= periodEnd) {
    const monthIndex = cursor.getUTCMonth();
    const monthYear = cursor.getUTCFullYear();
    const daysInMonth = new Date(Date.UTC(monthYear, monthIndex + 1, 0)).getUTCDate();
    const monthStart = new Date(Date.UTC(monthYear, monthIndex, 1));
    const monthEnd = new Date(Date.UTC(monthYear, monthIndex, daysInMonth));
    const workStart = periodStart > monthStart ? periodStart : monthStart;
    const workEnd = periodEnd < monthEnd ? periodEnd : monthEnd;
    const daysWorked = Math.floor((workEnd.getTime() - workStart.getTime()) / 86400000) + 1;
    if (daysWorked >= 15) {
      months++;
    }
    cursor = new Date(Date.UTC(monthYear, monthIndex + 1, 1));
  }
  return Math.min(months, 12);
}

// Aviso prévio indenizado: 30 dias + 3 dias por ano completo de casa, até 90
// (Lei 12.506/2011). Este sistema sempre trata o aviso como indenizado — ver
// comentário de topo do schema.prisma sobre simplificações assumidas.
export function calculateNoticeDays(admissionDate: Date, terminationDate: Date): number {
  const msPerYear = 365.25 * 86400000;
  const completeYears = Math.floor((terminationDate.getTime() - admissionDate.getTime()) / msPerYear);
  return Math.min(30 + 3 * completeYears, 90);
}

// Dias corridos trabalhados no mês do desligamento (saldo de salário).
export function daysWorkedInMonth(terminationDate: Date): number {
  return terminationDate.getUTCDate();
}

// Meses completos entre duas datas (parte de mês só conta se o dia final >=
// dia inicial) — base para o cálculo de férias proporcionais na rescisão.
export function fullMonthsBetween(start: Date, end: Date): number {
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) {
    months -= 1;
  }
  return Math.max(months, 0);
}

function addMonthsUTC(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

// Meses do período aquisitivo de férias EM CURSO no momento do desligamento
// (não o período aquisitivo já vencido/gozado, que este sistema não
// reconstrói automaticamente — ver `vestedVacationAmount` em Termination,
// preenchido manualmente quando aplicável). Aplica a regra dos 15 dias para
// a fração do mês corrente do ciclo.
export function monthsInCurrentVacationCycle(admissionDate: Date, terminationDate: Date): number {
  const totalMonths = fullMonthsBetween(admissionDate, terminationDate);
  const monthsIntoCurrentCycle = totalMonths % 12;
  const cycleAnniversary = addMonthsUTC(admissionDate, totalMonths);
  const daysIntoPartialMonth = Math.floor((terminationDate.getTime() - cycleAnniversary.getTime()) / 86400000);
  const extra = daysIntoPartialMonth >= 15 ? 1 : 0;
  return Math.min(monthsIntoCurrentCycle + extra, 12);
}
