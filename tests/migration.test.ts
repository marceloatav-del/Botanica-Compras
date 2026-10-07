import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

let db: PGlite;
const migration = await readFile(resolve(process.cwd(), 'supabase/migrations/20261007151919_task_1_1_catalogs.sql'), 'utf8');
let productId: string;
let storeId: string;
let supplierId: string;
let userId: string;
let quoteId: string;
let quoteItemId: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
  `);
  await db.exec(migration);
  const product = await db.query<{ id: string }>("insert into public.produtos(nome, unidade_medida) values ('Produto fixture', 'kg') returning id");
  const store = await db.query<{ id: string }>("insert into public.lojas(nome) values ('Loja fixture') returning id");
  const supplier = await db.query<{ id: string }>("insert into public.fornecedores(nome,email) values ('Fornecedor fixture','fornecedor@example.test') returning id");
  const user = await db.query<{ id: string }>("insert into public.usuarios(nome,email,perfil) values ('Usuário fixture','admin@example.test','admin') returning id");
  productId = product.rows[0].id as string;
  storeId = store.rows[0].id as string;
  supplierId = supplier.rows[0].id as string;
  userId = user.rows[0].id as string;
  const quote = await db.query<{ id: string }>('insert into public.cotacoes(fornecedor_id,criado_por_id) values ($1,$2) returning id', [supplierId, userId]);
  quoteId = quote.rows[0].id as string;
  const item = await db.query<{ id: string }>('insert into public.cotacao_itens(cotacao_id,produto_id,loja_id) values ($1,$2,$3) returning id', [quoteId, productId, storeId]);
  quoteItemId = item.rows[0].id as string;
});

beforeEach(async () => {
  await db.exec("reset role; set request.jwt.claims = '{\"email\":\"nobody@example.test\"}';");
});
afterAll(async () => { await db?.close(); });

describe('Task 1.1 — migration Postgres, integridade e RLS', () => {
  it('cria os quatro catálogos, campos requeridos, quote relations e FKs RESTRICT', async () => {
    const tables = await db.query("select table_name from information_schema.tables where table_schema='public' and table_name in ('produtos','lojas','fornecedores','usuarios','cotacoes','cotacao_itens') order by table_name");
    expect((tables.rows as { table_name: string }[]).map((row) => row.table_name)).toEqual(['cotacao_itens','cotacoes','fornecedores','lojas','produtos','usuarios']);
    const fks = await db.query("select confdeltype from pg_constraint where conname in ('cotacoes_fornecedor_id_fkey','cotacoes_criado_por_id_fkey','cotacao_itens_cotacao_id_fkey','cotacao_itens_produto_id_fkey','cotacao_itens_loja_id_fkey')");
    expect(fks.rows).toHaveLength(5);
    expect((fks.rows as { confdeltype: string }[]).every((row) => row.confdeltype === 'r')).toBe(true);
    const rls = await db.query("select relname, relrowsecurity from pg_class where relname in ('produtos','lojas','fornecedores','usuarios','cotacoes','cotacao_itens')");
    expect(rls.rows).toHaveLength(6);
    expect((rls.rows as { relrowsecurity: boolean }[]).every((row) => row.relrowsecurity === true)).toBe(true);
  });

  it('rejeita nome vazio e produto duplicado case-insensitive (CA-1-02)', async () => {
    await expect(db.query("insert into public.produtos(nome,unidade_medida) values ('   ','kg')")).rejects.toThrow();
    await db.query("insert into public.produtos(nome,unidade_medida) values ('Tomate','kg')");
    await expect(db.query("insert into public.produtos(nome,unidade_medida) values (' tomate ','kg')")).rejects.toThrow(/duplicate key|unique/i);
  });

  it('preserva os quatro registros e referências ao inativar, e bloqueia DELETE físico (CA-1-03)', async () => {
    const cases = [
      ['produtos', productId], ['lojas', storeId], ['fornecedores', supplierId], ['usuarios', userId],
    ] as const;
    for (const [table, id] of cases) {
      const updated = await db.query(`update public.${table} set ativo=false where id=$1 returning id, ativo`, [id]);
      expect(updated.rows).toEqual([{ id, ativo: false }]);
      await expect(db.query(`delete from public.${table} where id=$1`, [id])).rejects.toThrow(/foreign key|violates/i);
      const persisted = await db.query(`select id, ativo from public.${table} where id=$1`, [id]);
      expect(persisted.rows).toEqual([{ id, ativo: false }]);
    }
    const reference = await db.query(`select qi.id, qi.produto_id, qi.loja_id, q.fornecedor_id, q.criado_por_id
      from public.cotacao_itens qi join public.cotacoes q on q.id=qi.cotacao_id
      where qi.id=$1`, [quoteItemId]);
    expect(reference.rows).toEqual([{ id: quoteItemId, produto_id: productId, loja_id: storeId, fornecedor_id: supplierId, criado_por_id: userId }]);
    expect((await db.query('select id from public.cotacoes where id=$1',[quoteId])).rows).toHaveLength(1);
  });

  it('RLS limita catálogo e cotações a admin ativo; profile próprio é o único visível ao usuário normal', async () => {
    await db.query("insert into public.usuarios(nome,email,perfil) values ('Loja login','loja@example.test','loja')");
    await db.exec("set request.jwt.claims = '{\"email\":\"loja@example.test\"}'; set role authenticated;");
    expect((await db.query('select * from public.produtos')).rows).toHaveLength(0);
    expect((await db.query('select * from public.cotacoes')).rows).toHaveLength(0);
    expect((await db.query('select email from public.usuarios')).rows).toEqual([{ email: 'loja@example.test' }]);
    await expect(db.query("insert into public.produtos(nome,unidade_medida) values ('Sem permissão','kg')")).rejects.toThrow(/row-level security|policy/i);
    await expect(db.query('delete from public.produtos where id=$1',[productId])).rejects.toThrow(/permission denied/i);

    await db.exec('reset role;');
    await db.exec("update public.usuarios set ativo=true where email='admin@example.test';");
    await db.exec('set request.jwt.claims = \'{"email":"admin@example.test"}\'; set role authenticated;');
    expect((await db.query('select id from public.produtos where id=$1',[productId])).rows).toHaveLength(1);
    const newProduct = await db.query("insert into public.produtos(nome,unidade_medida) values ('Admin autorizado','un') returning id");
    expect(newProduct.rows).toHaveLength(1);
  });
});
