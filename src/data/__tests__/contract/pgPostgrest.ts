/* eslint-disable @typescript-eslint/no-explicit-any */
import { Pool, types as pgTypes, type PoolClient } from 'pg';

import type {
  AuthApiLike,
  FilterBuilder,
  MutationBuilder,
  PostgrestError,
  PostgrestResponse,
  QueryBuilder,
  Row,
  SupabaseLike,
} from '@/data/remote/postgrest';

/**
 * Testler için PostgREST uyarlayıcısı.
 *
 * Gerçek Supabase sunucusu olmadan uzak sağlayıcıyı **gerçek** bir Postgres
 * veritabanına karşı çalıştırır: `SupabaseLike` yüzeyini uygular ve çağrıları
 * SQL'e çevirir. Bu bir taklit (mock) değildir — sorgular, kısıtlar, tetikleyiciler
 * ve RPC'ler gerçekten çalışır.
 *
 * Desteklenen alt küme (uzak sağlayıcının kullandığı kadarı):
 *   · select / insert / upsert / update / delete (+ `.select()` ile dönüş)
 *   · eq, neq, gt, gte, lt, lte, like, ilike, is, in, contains, overlaps, not, or
 *   · order, limit, range, single, maybeSingle
 *   · gömülü kaynaklar: `alias:tablo!fk_sütunu(sütunlar)` — FK ipucu ZORUNLUDUR
 *   · rpc(fn, args) — küme dönen fonksiyonlar satır dizisi, skalerler ham değer döner
 *
 * PostgREST ile bilinçli farklar `docs/REMOTE_PROVIDER.md` içinde listelenir.
 */

// `date` sütunları ham metin olarak kalsın (yerel saat kaymasını önler).
pgTypes.setTypeParser(1082, (value: string) => value);

interface Filter {
  column: string;
  op: string;
  value: unknown;
  negate?: boolean;
}

interface OrderSpec {
  column: string;
  ascending: boolean;
  nullsFirst: boolean;
}

interface Embed {
  alias: string;
  table: string;
  fk: string;
  columns: string;
}

interface Meta {
  columns: Map<string, Set<string>>;
  scalarFns: Map<string, boolean>;
  foreignKeys: Map<string, { table: string; column: string } | null>;
}

const SQL_OPS: Record<string, string> = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'LIKE',
  ilike: 'ILIKE',
};

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** `or`/`and` süzgeç ağacı. */
type FilterNode =
  | { kind: 'cmp'; column: string; op: string; value: unknown; negate: boolean }
  | { kind: 'group'; join: 'AND' | 'OR'; children: FilterNode[]; negate: boolean };

/** Parantez derinliğini gözeterek virgülle ayırır. */
function splitTopLevel(expression: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of expression) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  if (current) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * PostgREST süzgeç ifadesini ayrıştırır:
 *   `a.eq.1`, `not.a.is.null`, `and(a.eq.1,b.gt.2)`, `or(...)` (iç içe olabilir).
 */
function parseFilterExpression(expression: string): FilterNode {
  let text = expression.trim();
  let negate = false;
  if (text.startsWith('not.')) {
    negate = true;
    text = text.slice(4);
  }
  const groupMatch = /^(and|or)\((.*)\)$/is.exec(text);
  if (groupMatch?.[1] && groupMatch[2] !== undefined) {
    return {
      kind: 'group',
      join: groupMatch[1].toLowerCase() === 'and' ? 'AND' : 'OR',
      children: splitTopLevel(groupMatch[2]).map(parseFilterExpression),
      negate,
    };
  }
  const first = text.indexOf('.');
  const second = text.indexOf('.', first + 1);
  if (first < 0 || second < 0) throw new Error(`Çözümlenemeyen süzgeç: ${expression}`);
  const column = text.slice(0, first);
  const op = text.slice(first + 1, second);
  const raw = text.slice(second + 1);
  let value: unknown = raw;
  if (op === 'is') value = raw === 'null' ? null : raw === 'true';
  if (op === 'in') value = raw.replace(/^\(|\)$/g, '').split(',');
  return { kind: 'cmp', column, op, value, negate };
}

/** `or(...)` argümanını üst düzeyde OR ile birleşen düğümlere çevirir. */
function parseOrFilters(expression: string): FilterNode {
  return {
    kind: 'group',
    join: 'OR',
    children: splitTopLevel(expression).map(parseFilterExpression),
    negate: false,
  };
}

/** `*, author:profiles!author_id(*)` → sütunlar + gömülü kaynaklar. */
function parseSelect(select: string): { columns: string[]; embeds: Embed[] } {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of select) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());

  const columns: string[] = [];
  const embeds: Embed[] = [];
  for (const part of parts) {
    const open = part.indexOf('(');
    if (open === -1) {
      columns.push(part);
      continue;
    }
    const head = part.slice(0, open);
    const inner = part.slice(open + 1, part.lastIndexOf(')'));
    const [aliasPart, targetPart] = head.includes(':')
      ? [head.slice(0, head.indexOf(':')), head.slice(head.indexOf(':') + 1)]
      : [head, head];
    const [table, hint] = targetPart.split('!');
    if (!table || !hint) {
      throw new Error(
        `Gömülü kaynak FK ipucu olmadan kullanılamaz: "${part}" (beklenen: alias:tablo!fk_sütunu(...))`,
      );
    }
    embeds.push({
      alias: aliasPart.replace(/!.*$/, ''),
      table: table.replace(/!inner$/, ''),
      fk: hint.replace(/!inner$/, ''),
      columns: inner || '*',
    });
  }
  return { columns: columns.length ? columns : ['*'], embeds };
}

class Builder implements MutationBuilder {
  private filters: Filter[] = [];
  private orFilters: FilterNode[] = [];
  private orders: OrderSpec[] = [];
  private limitCount: number | null = null;
  private offsetCount = 0;
  private selectString = '*';
  private returning = false;
  private rowMode: 'many' | 'single' | 'maybe' = 'many';

  constructor(
    private readonly ctx: PgContext,
    private readonly table: string,
    private readonly op: 'select' | 'insert' | 'upsert' | 'update' | 'delete',
    private readonly payload?: Row | Row[],
    private readonly upsertOptions?: { onConflict?: string; ignoreDuplicates?: boolean },
  ) {}

  select(columns = '*'): this {
    this.selectString = columns;
    this.returning = true;
    return this;
  }

  private add(column: string, op: string, value: unknown, negate = false): this {
    this.filters.push({ column, op, value, negate });
    return this;
  }

  eq(c: string, v: unknown) {
    return this.add(c, 'eq', v);
  }
  neq(c: string, v: unknown) {
    return this.add(c, 'neq', v);
  }
  gt(c: string, v: unknown) {
    return this.add(c, 'gt', v);
  }
  gte(c: string, v: unknown) {
    return this.add(c, 'gte', v);
  }
  lt(c: string, v: unknown) {
    return this.add(c, 'lt', v);
  }
  lte(c: string, v: unknown) {
    return this.add(c, 'lte', v);
  }
  like(c: string, v: string) {
    return this.add(c, 'like', v);
  }
  ilike(c: string, v: string) {
    return this.add(c, 'ilike', v);
  }
  is(c: string, v: null | boolean) {
    return this.add(c, 'is', v);
  }
  in(c: string, v: readonly unknown[]) {
    return this.add(c, 'in', v);
  }
  contains(c: string, v: readonly unknown[] | string) {
    return this.add(c, 'contains', v);
  }
  overlaps(c: string, v: readonly unknown[]) {
    return this.add(c, 'overlaps', v);
  }
  not(c: string, op: string, v: unknown) {
    return this.add(c, op, v, true);
  }
  or(expression: string) {
    this.orFilters.push(parseOrFilters(expression));
    return this;
  }
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst ?? false,
    });
    return this;
  }
  limit(count: number) {
    this.limitCount = count;
    return this;
  }
  range(from: number, to: number) {
    this.offsetCount = from;
    this.limitCount = to - from + 1;
    return this;
  }

  single(): PromiseLike<PostgrestResponse<Row>> {
    this.rowMode = 'single';
    return this as unknown as PromiseLike<PostgrestResponse<Row>>;
  }

  maybeSingle(): PromiseLike<PostgrestResponse<Row | null>> {
    this.rowMode = 'maybe';
    return this as unknown as PromiseLike<PostgrestResponse<Row | null>>;
  }

  then<R1 = PostgrestResponse<Row[]>, R2 = never>(
    onfulfilled?: ((value: any) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled as never, onrejected);
  }

  /* -------------------------------------------------------------- */

  private buildWhere(values: unknown[], alias = ''): string {
    const prefix = alias ? `${quoteIdent(alias)}.` : '';
    const clauses: string[] = [];
    for (const f of this.filters) {
      clauses.push(renderFilter(f, prefix, values));
    }
    for (const group of this.orFilters) {
      const rendered = renderNode(group, prefix, values);
      if (rendered) clauses.push(rendered);
    }
    return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  }

  private buildOrder(): string {
    if (!this.orders.length) return '';
    const parts = this.orders.map(
      (o) =>
        `${quoteIdent(o.column)} ${o.ascending ? 'ASC' : 'DESC'} ${o.nullsFirst ? 'NULLS FIRST' : 'NULLS LAST'}`,
    );
    return `ORDER BY ${parts.join(', ')}`;
  }

  private buildTail(): string {
    const parts: string[] = [];
    if (this.limitCount != null) parts.push(`LIMIT ${this.limitCount}`);
    if (this.offsetCount) parts.push(`OFFSET ${this.offsetCount}`);
    return parts.join(' ');
  }

  private async run(): Promise<PostgrestResponse<unknown>> {
    try {
      const rows = await this.execute();
      const parsed = parseSelect(this.selectString);
      const enriched = parsed.embeds.length
        ? await this.ctx.attachEmbeds(this.table, rows, parsed.embeds)
        : rows;
      if (this.rowMode === 'single') {
        if (enriched.length !== 1) {
          return {
            data: null,
            error: {
              message:
                enriched.length === 0
                  ? 'JSON object requested, multiple (or no) rows returned'
                  : 'JSON object requested, multiple rows returned',
              code: 'PGRST116',
            },
          };
        }
        return { data: enriched[0], error: null };
      }
      if (this.rowMode === 'maybe') {
        if (enriched.length > 1) {
          return {
            data: null,
            error: { message: 'JSON object requested, multiple rows returned', code: 'PGRST116' },
          };
        }
        return { data: enriched[0] ?? null, error: null };
      }
      return { data: enriched, error: null };
    } catch (error) {
      return { data: null, error: toPostgrestError(error) };
    }
  }

  private async execute(): Promise<Row[]> {
    const values: unknown[] = [];
    const table = quoteIdent(this.table);
    const parsed = parseSelect(this.selectString);
    const projection = parsed.columns.includes('*')
      ? '*'
      : parsed.columns.map((c) => quoteIdent(c)).join(', ');

    switch (this.op) {
      case 'select': {
        const sql = [
          `SELECT ${projection} FROM ${table}`,
          this.buildWhere(values),
          this.buildOrder(),
          this.buildTail(),
        ]
          .filter(Boolean)
          .join(' ');
        return this.ctx.query(sql, values);
      }
      case 'insert':
      case 'upsert': {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
        if (!list.length) return [];
        const columns = Array.from(new Set(list.flatMap((r) => Object.keys(r))));
        const tuples = list.map((row) => {
          const cells = columns.map((c) => {
            values.push(row[c] === undefined ? null : row[c]);
            return `$${values.length}`;
          });
          return `(${cells.join(', ')})`;
        });
        let conflict = '';
        if (this.op === 'upsert') {
          const target = this.upsertOptions?.onConflict
            ? `(${this.upsertOptions.onConflict
                .split(',')
                .map((c) => quoteIdent(c.trim()))
                .join(', ')})`
            : '';
          conflict = this.upsertOptions?.ignoreDuplicates
            ? `ON CONFLICT ${target} DO NOTHING`
            : `ON CONFLICT ${target} DO UPDATE SET ${columns
                .map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
                .join(', ')}`;
        }
        const sql = `INSERT INTO ${table} (${columns.map(quoteIdent).join(', ')}) VALUES ${tuples.join(', ')} ${conflict} RETURNING *`;
        return this.ctx.query(sql, values);
      }
      case 'update': {
        const row = (this.payload ?? {}) as Row;
        const assignments = Object.keys(row).map((c) => {
          values.push(row[c] === undefined ? null : row[c]);
          return `${quoteIdent(c)} = $${values.length}`;
        });
        if (!assignments.length) return [];
        const sql = `UPDATE ${table} SET ${assignments.join(', ')} ${this.buildWhere(values)} RETURNING *`;
        return this.ctx.query(sql, values);
      }
      case 'delete': {
        const sql = `DELETE FROM ${table} ${this.buildWhere(values)} RETURNING *`;
        return this.ctx.query(sql, values);
      }
      default:
        return [];
    }
  }
}

function renderNode(node: FilterNode, prefix: string, values: unknown[]): string {
  if (node.kind === 'cmp') {
    return renderFilter(
      { column: node.column, op: node.op, value: node.value, negate: node.negate },
      prefix,
      values,
    );
  }
  const parts = node.children.map((child) => renderNode(child, prefix, values)).filter(Boolean);
  if (!parts.length) return '';
  const joined = `(${parts.join(` ${node.join} `)})`;
  return node.negate ? `NOT ${joined}` : joined;
}

function renderFilter(f: Filter, prefix: string, values: unknown[]): string {
  const column = `${prefix}${quoteIdent(f.column)}`;
  let clause: string;
  if (f.op === 'is') {
    clause = f.value === null ? `${column} IS NULL` : `${column} IS ${f.value ? 'TRUE' : 'FALSE'}`;
  } else if (f.op === 'in') {
    const list = (f.value as unknown[]) ?? [];
    if (!list.length) return 'FALSE';
    values.push(list);
    clause = `${column} = ANY($${values.length})`;
  } else if (f.op === 'contains') {
    values.push(f.value);
    clause = `${column} @> $${values.length}`;
  } else if (f.op === 'overlaps') {
    values.push(f.value);
    clause = `${column} && $${values.length}`;
  } else {
    const sqlOp = SQL_OPS[f.op];
    if (!sqlOp) throw new Error(`Desteklenmeyen süzgeç: ${f.op}`);
    // PostgREST joker karakteri `*`; SQL karşılığı `%`.
    values.push(
      (f.op === 'like' || f.op === 'ilike') && typeof f.value === 'string'
        ? f.value.replace(/\*/g, '%')
        : f.value,
    );
    clause = `${column} ${sqlOp} $${values.length}`;
  }
  return f.negate ? `NOT (${clause})` : clause;
}

function toPostgrestError(error: unknown): PostgrestError {
  const err = error as { message?: string; code?: string; detail?: string; hint?: string };
  return {
    message: err?.message ?? String(error),
    code: err?.code,
    details: err?.detail ?? null,
    hint: err?.hint ?? null,
  };
}

/* ------------------------------------------------------------------ */

class PgContext {
  private meta: Meta = { columns: new Map(), scalarFns: new Map(), foreignKeys: new Map() };

  constructor(
    private readonly pool: Pool,
    private readonly currentUser: () => string | null,
  ) {}

  async query(sql: string, values: unknown[]): Promise<Row[]> {
    const client: PoolClient = await this.pool.connect();
    try {
      // RLS yardımcıları ve RPC'ler `auth.uid()` okuduğu için her istekte ayarlanır.
      await client.query('SELECT set_config($1, $2, false)', [
        'request.jwt.claim.sub',
        this.currentUser() ?? '',
      ]);
      const result = await client.query(sql, values);
      return result.rows as Row[];
    } finally {
      client.release();
    }
  }

  async columnsOf(table: string): Promise<Set<string>> {
    const cached = this.meta.columns.get(table);
    if (cached) return cached;
    const rows = await this.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    const set = new Set(rows.map((r) => String(r.column_name)));
    this.meta.columns.set(table, set);
    return set;
  }

  /** `tablo.sütun` yabancı anahtarının işaret ettiği (tablo, sütun) çiftini döner. */
  async foreignKeyTarget(
    table: string,
    column: string,
  ): Promise<{ table: string; column: string } | null> {
    const key = `${table}.${column}`;
    if (this.meta.foreignKeys.has(key)) return this.meta.foreignKeys.get(key) ?? null;
    const rows = await this.query(
      `SELECT ccu.table_name AS target_table, ccu.column_name AS target_column
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = $1
          AND kcu.column_name = $2
        LIMIT 1`,
      [table, column],
    );
    const first = rows[0];
    const target = first
      ? { table: String(first.target_table), column: String(first.target_column) }
      : null;
    this.meta.foreignKeys.set(key, target);
    return target;
  }

  /** Gömülü kaynakları ayrı bir sorguyla (toplu) çözer. */
  async attachEmbeds(parentTable: string, rows: Row[], embeds: Embed[]): Promise<Row[]> {
    if (!rows.length) return rows;
    const parentColumns = await this.columnsOf(parentTable);
    const output = rows.map((r) => ({ ...r }));

    for (const embed of embeds) {
      const childColumns = await this.columnsOf(embed.table);
      const nested = parseSelect(embed.columns);
      const manyToOne = parentColumns.has(embed.fk);
      if (!manyToOne && !childColumns.has(embed.fk)) {
        throw new Error(`FK ipucu çözülemedi: ${embed.table}!${embed.fk}`);
      }

      if (manyToOne) {
        const target = await this.foreignKeyTarget(parentTable, embed.fk);
        const targetColumn = target?.column ?? 'id';
        const ids = Array.from(new Set(output.map((r) => r[embed.fk]).filter((v) => v != null)));
        const children = ids.length
          ? await this.query(
              `SELECT * FROM ${quoteIdent(embed.table)} WHERE ${quoteIdent(targetColumn)} = ANY($1)`,
              [ids],
            )
          : [];
        const enriched = nested.embeds.length
          ? await this.attachEmbeds(embed.table, children, nested.embeds)
          : children;
        const byId = new Map(enriched.map((c) => [String(c[targetColumn]), c]));
        for (const row of output) {
          const key = row[embed.fk];
          row[embed.alias] = key == null ? null : (byId.get(String(key)) ?? null);
        }
      } else {
        const target = await this.foreignKeyTarget(embed.table, embed.fk);
        const parentColumn = target?.column ?? 'id';
        const ids = Array.from(
          new Set(output.map((r) => r[parentColumn]).filter((v) => v != null)),
        );
        const children = ids.length
          ? await this.query(
              `SELECT * FROM ${quoteIdent(embed.table)} WHERE ${quoteIdent(embed.fk)} = ANY($1)`,
              [ids],
            )
          : [];
        const enriched = nested.embeds.length
          ? await this.attachEmbeds(embed.table, children, nested.embeds)
          : children;
        const grouped = new Map<string, Row[]>();
        for (const child of enriched) {
          const key = String(child[embed.fk]);
          grouped.set(key, [...(grouped.get(key) ?? []), child]);
        }
        for (const row of output) {
          row[embed.alias] = grouped.get(String(row[parentColumn])) ?? [];
        }
      }
    }
    return output;
  }

  /** Fonksiyonun küme mi yoksa skaler mi döndürdüğünü şemadan okur. */
  async isSetReturning(fn: string): Promise<boolean> {
    const cached = this.meta.scalarFns.get(fn);
    if (cached !== undefined) return cached;
    const rows = await this.query(
      `SELECT p.proretset OR t.typtype = 'c' AS composite
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         JOIN pg_type t ON t.oid = p.prorettype
        WHERE n.nspname = 'public' AND p.proname = $1
        LIMIT 1`,
      [fn],
    );
    const value = Boolean(rows[0]?.composite);
    this.meta.scalarFns.set(fn, value);
    return value;
  }
}

class RpcBuilder implements FilterBuilder<Row[]> {
  private orders: OrderSpec[] = [];
  private limitCount: number | null = null;
  private rowMode: 'many' | 'single' | 'maybe' = 'many';

  constructor(
    private readonly ctx: PgContext,
    private readonly fn: string,
    private readonly args: Row,
  ) {}

  private self(): this {
    return this;
  }
  select() {
    return this.self();
  }
  eq() {
    return this.self();
  }
  neq() {
    return this.self();
  }
  gt() {
    return this.self();
  }
  gte() {
    return this.self();
  }
  lt() {
    return this.self();
  }
  lte() {
    return this.self();
  }
  like() {
    return this.self();
  }
  ilike() {
    return this.self();
  }
  is() {
    return this.self();
  }
  in() {
    return this.self();
  }
  contains() {
    return this.self();
  }
  overlaps() {
    return this.self();
  }
  or() {
    return this.self();
  }
  not() {
    return this.self();
  }
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst ?? false,
    });
    return this;
  }
  limit(count: number) {
    this.limitCount = count;
    return this;
  }
  range(from: number, to: number) {
    this.limitCount = to - from + 1;
    return this;
  }
  single(): PromiseLike<PostgrestResponse<Row>> {
    this.rowMode = 'single';
    return this as unknown as PromiseLike<PostgrestResponse<Row>>;
  }
  maybeSingle(): PromiseLike<PostgrestResponse<Row | null>> {
    this.rowMode = 'maybe';
    return this as unknown as PromiseLike<PostgrestResponse<Row | null>>;
  }

  then<R1 = PostgrestResponse<Row[]>, R2 = never>(
    onfulfilled?: ((value: any) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled as never, onrejected);
  }

  private async run(): Promise<PostgrestResponse<unknown>> {
    try {
      const names = Object.keys(this.args);
      const values = names.map((n) => this.args[n]);
      const params = names.map((n, i) => `${quoteIdent(n)} => $${i + 1}`).join(', ');
      const setReturning = await this.ctx.isSetReturning(this.fn);
      const order = this.orders.length
        ? `ORDER BY ${this.orders
            .map((o) => `${quoteIdent(o.column)} ${o.ascending ? 'ASC' : 'DESC'}`)
            .join(', ')}`
        : '';
      const tail = this.limitCount != null ? `LIMIT ${this.limitCount}` : '';
      const sql = setReturning
        ? `SELECT * FROM ${quoteIdent(this.fn)}(${params}) ${order} ${tail}`
        : `SELECT ${quoteIdent(this.fn)}(${params}) AS value`;
      const result = await this.ctx.query(sql, values);
      if (!setReturning) {
        return { data: (result[0]?.value ?? null) as never, error: null };
      }
      if (this.rowMode === 'single') {
        if (result.length !== 1) {
          return {
            data: null,
            error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
          };
        }
        return { data: result[0], error: null };
      }
      if (this.rowMode === 'maybe') return { data: result[0] ?? null, error: null };
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: toPostgrestError(error) };
    }
  }
}

/* ------------------------------------------------------------------ */

export interface PgPostgrestOptions {
  /** Etkin kullanıcı — `auth.uid()` bu değeri döner. */
  getUserId(): string | null;
  setUserId(id: string | null): void;
}

/** `SupabaseLike` uygulaması: doğrudan Postgres'e bağlanır. */
export function createPgPostgrest(pool: Pool, session: PgPostgrestOptions): SupabaseLike {
  const ctx = new PgContext(pool, () => session.getUserId());

  const auth: AuthApiLike = {
    async getSession() {
      const id = session.getUserId();
      return { data: { session: id ? { user: { id } } : null }, error: null };
    },
    async getUser() {
      const id = session.getUserId();
      return { data: { user: id ? { id } : null }, error: null };
    },
    async signInWithPassword({ email }) {
      const rows = await ctx.query('SELECT id FROM auth.users WHERE email = $1', [email]);
      const id = rows[0]?.id ? String(rows[0].id) : null;
      if (!id) {
        return { data: { user: null }, error: { message: 'Invalid login credentials' } };
      }
      session.setUserId(id);
      return { data: { user: { id } }, error: null };
    },
    async signUp({ email, options }) {
      const rows = await ctx.query(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, $2) RETURNING id`,
        [email, JSON.stringify(options?.data ?? {})],
      );
      const id = rows[0]?.id ? String(rows[0].id) : null;
      session.setUserId(id);
      return { data: { user: id ? { id } : null }, error: null };
    },
    async signOut() {
      session.setUserId(null);
      return { error: null };
    },
  };

  return {
    from(table: string): QueryBuilder {
      return {
        select: (columns = '*') => new Builder(ctx, table, 'select').select(columns),
        insert: (values) => new Builder(ctx, table, 'insert', values),
        upsert: (values, options) => new Builder(ctx, table, 'upsert', values, options),
        update: (values) => new Builder(ctx, table, 'update', values),
        delete: () => new Builder(ctx, table, 'delete'),
      };
    },
    rpc(fn: string, args: Row = {}) {
      return new RpcBuilder(ctx, fn, args);
    },
    auth,
  };
}
