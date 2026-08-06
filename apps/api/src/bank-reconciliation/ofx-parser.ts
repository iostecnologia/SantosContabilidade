/**
 * Parser tolerante de OFX (SGML "tag soup", padrão dos extratos de bancos
 * brasileiros — tags folha sem fechamento, ex.: `<TRNAMT>-150.00` sem
 * `</TRNAMT>`) e também compatível com OFX 2.x (XML de verdade, que fecha
 * todas as tags). Não usa nenhuma lib de XML: como cada tag aparece em regra
 * numa linha própria, um parser linha-a-linha com uma pilha simples de
 * contexto (STMTTRN / LEDGERBAL / BANKACCTFROM) já é suficiente e evita
 * depender de um parser SGML completo, que este formato não é de verdade.
 */
export interface ParsedOfxTransaction {
  fitId: string | null;
  // Positivo = crédito (dinheiro entrando), negativo = débito — mesmo
  // sinal usado em BankStatementLine.amount.
  amount: number;
  postedAt: string;
  description: string;
}

export interface ParsedOfxStatement {
  accountNumber: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  ledgerBalance: { amount: number; asOf: string } | null;
  transactions: ParsedOfxTransaction[];
}

function parseOfxDate(raw: string): string | null {
  const digits = raw.trim().slice(0, 8);
  if (!/^\d{8}$/.test(digits)) {
    return null;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function parseOfxAmount(raw: string): number {
  const normalized = raw.trim().replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

export function parseOfx(content: string): ParsedOfxStatement {
  // Normaliza variantes XML "minificadas" (tudo numa linha só) para o
  // formato uma-tag-por-linha que o resto do parser assume.
  const normalized = content.replace(/>\s*</g, ">\n<").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  let inTransaction = false;
  let inLedgerBal = false;
  let inAcctFrom = false;

  let currentTxn: Partial<ParsedOfxTransaction> & { name?: string; memo?: string } = {};
  let currentLedgerAmount: number | null = null;
  let currentLedgerAsOf: string | null = null;

  const result: ParsedOfxStatement = {
    accountNumber: null,
    periodStart: null,
    periodEnd: null,
    ledgerBalance: null,
    transactions: [],
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("<")) {
      continue;
    }

    const closeMatch = line.match(/^<\/(\w+)>$/);
    if (closeMatch) {
      const tag = closeMatch[1].toUpperCase();
      if (tag === "STMTTRN" && inTransaction) {
        result.transactions.push({
          fitId: currentTxn.fitId ?? null,
          amount: currentTxn.amount ?? 0,
          postedAt: currentTxn.postedAt ?? "",
          description: currentTxn.name || currentTxn.memo || "(sem descrição)",
        });
        currentTxn = {};
        inTransaction = false;
      } else if (tag === "LEDGERBAL" && inLedgerBal) {
        if (currentLedgerAmount !== null && currentLedgerAsOf) {
          result.ledgerBalance = { amount: currentLedgerAmount, asOf: currentLedgerAsOf };
        }
        inLedgerBal = false;
      } else if (tag === "BANKACCTFROM") {
        inAcctFrom = false;
      }
      continue;
    }

    const openMatch = line.match(/^<(\w+)>(.*)$/);
    if (!openMatch) {
      continue;
    }
    const tag = openMatch[1].toUpperCase();
    const value = openMatch[2].trim();

    if (tag === "STMTTRN") {
      inTransaction = true;
      currentTxn = {};
      continue;
    }
    if (tag === "LEDGERBAL") {
      inLedgerBal = true;
      continue;
    }
    if (tag === "BANKACCTFROM") {
      inAcctFrom = true;
      continue;
    }
    if (value === "") {
      // Outra tag-container sem valor (ex.: <BANKTRANLIST>, <STMTRS>) — nada a extrair.
      continue;
    }

    if (inTransaction) {
      switch (tag) {
        case "FITID":
          currentTxn.fitId = value;
          break;
        case "TRNAMT":
          currentTxn.amount = parseOfxAmount(value);
          break;
        case "DTPOSTED":
          currentTxn.postedAt = parseOfxDate(value) ?? "";
          break;
        case "NAME":
        case "PAYEE":
          currentTxn.name = value;
          break;
        case "MEMO":
          currentTxn.memo = value;
          break;
      }
      continue;
    }

    if (inLedgerBal) {
      if (tag === "BALAMT") {
        currentLedgerAmount = parseOfxAmount(value);
      } else if (tag === "DTASOF") {
        currentLedgerAsOf = parseOfxDate(value);
      }
      continue;
    }

    if (inAcctFrom && tag === "ACCTID") {
      result.accountNumber = value;
      continue;
    }

    if (tag === "DTSTART" && !result.periodStart) {
      result.periodStart = parseOfxDate(value);
    } else if (tag === "DTEND" && !result.periodEnd) {
      result.periodEnd = parseOfxDate(value);
    }
  }

  return result;
}
