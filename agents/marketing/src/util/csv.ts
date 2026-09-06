/** Basit CSV ayrıştırıcı: tırnaklı alanlar, virgül/noktalı virgül ayırıcı, CRLF. Bağımlılık yok. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = splitRows(text.replace(/^﻿/, ''));
  if (rows.length === 0) return [];
  const delimiter = detectDelimiter(rows[0] ?? '');
  const header = splitFields(rows[0] ?? '', delimiter).map((h) => h.trim().toLowerCase());
  const out: Record<string, string>[] = [];
  for (const row of rows.slice(1)) {
    if (row.trim() === '') continue;
    const fields = splitFields(row, delimiter);
    const record: Record<string, string> = {};
    header.forEach((key, i) => {
      record[key] = (fields[i] ?? '').trim();
    });
    out.push(record);
  }
  return out;
}

function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  if (tabs > commas && tabs > semis) return '\t';
  return semis > commas ? ';' : ',';
}

function splitRows(text: string): string[] {
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      rows.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current !== '') rows.push(current);
  return rows;
}

function splitFields(row: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i];
    if (inQuotes) {
      if (ch === '"' && row[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/** "1.234", "1,234", "12,5" gibi yerel sayı biçimlerini toleranslı okur. */
export function toNumber(value: string | undefined): number {
  if (!value) return 0;
  let s = value.trim().replace(/\s/g, '');
  if (s === '') return 0;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.');
  const n = Number(s.replace(/%$/, ''));
  return Number.isFinite(n) ? n : 0;
}
