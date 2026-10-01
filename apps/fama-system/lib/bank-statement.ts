export type StatementRow = { postedAt: string; description: string; amountCents: number };

function splitCsvLine(line: string, delimiter: string) {
  const columns: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { columns.push(value.trim()); value = ""; }
    else value += char;
  }
  if (quoted) throw new Error("O arquivo contém aspas CSV sem fechamento.");
  columns.push(value.trim());
  return columns;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

function amountInCents(value: string, allowZero = false) {
  let normalized = value.replace(/[^\d,.-]/g, "");
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    const thousands = decimal === "," ? /\./g : /,/g;
    normalized = normalized.replace(thousands, "").replace(decimal, ".");
  } else if (comma >= 0) normalized = normalized.replace(/,/g, ".");
  else if ((normalized.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(normalized)) normalized = normalized.replace(/\./g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || (!allowZero && amount === 0) || Math.abs(amount) > 100_000_000) throw new Error("O extrato contém um valor inválido ou zerado.");
  return Math.round(amount * 100);
}

function isoDate(value: string) {
  const raw = value.trim();
  const brazilian = raw.match(/^(\d{2})[/.](\d{2})[/.](\d{4})$/);
  const normalized = brazilian ? `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}` : raw.slice(0, 10);
  const parts = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const valid = parts && new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))).toISOString().slice(0, 10) === normalized;
  if (!valid) {
    throw new Error("O extrato precisa informar a data no formato AAAA-MM-DD ou DD/MM/AAAA.");
  }
  return normalized;
}

export function parseBankStatementCsv(source: string): StatementRow[] {
  if (source.length > 2_000_000) throw new Error("O CSV excede o limite de 2 MB.");
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2 || lines.length > 501) throw new Error("O CSV deve conter um cabeçalho e até 500 movimentações.");
  const delimiter = (lines[0].match(/;/g) ?? []).length > (lines[0].match(/,/g) ?? []).length ? ";" : ",";
  const headers = splitCsvLine(lines[0], delimiter).map(normalize);
  const index = (choices: string[]) => headers.findIndex((header) => choices.includes(header));
  const dateIndex = index(["data", "date", "data lancamento", "data movimento"]);
  const descriptionIndex = index(["descricao", "description", "historico", "memo"]);
  const amountIndex = index(["valor", "amount", "valor (r$)", "montante"]);
  const creditIndex = index(["credito", "credit", "entrada"]);
  const debitIndex = index(["debito", "debit", "saida"]);
  if (dateIndex < 0 || descriptionIndex < 0 || (amountIndex < 0 && creditIndex < 0 && debitIndex < 0)) {
    throw new Error("Cabeçalho não reconhecido. Use Data, Descrição e Valor, ou Crédito e Débito.");
  }
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line, delimiter);
    const read = (column: number) => values[column] ?? "";
    const amount = amountIndex >= 0 ? amountInCents(read(amountIndex))
      : Math.abs(amountInCents(read(creditIndex) || "0", true)) - Math.abs(amountInCents(read(debitIndex) || "0", true));
    if (amount === 0) throw new Error("O extrato contém uma movimentação com valor zerado.");
    const description = read(descriptionIndex).trim();
    if (!description || description.length > 300) throw new Error("Há uma movimentação sem descrição ou com descrição longa demais.");
    return { postedAt: isoDate(read(dateIndex)), description, amountCents: amount };
  });
  return rows;
}
