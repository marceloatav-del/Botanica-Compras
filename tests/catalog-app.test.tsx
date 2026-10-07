import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogApp } from '../src/features/catalog/CatalogApp';

const state = vi.hoisted(() => {
  const listener = { subscription: { unsubscribe: vi.fn() } };
  const mockAuth = {
    getSession: vi.fn(async () => ({ data: { session: state.sessionEmail ? { user: { email: state.sessionEmail } } : null }, error: null })),
    signInWithPassword: vi.fn(async ({ email }: { email: string; password: string }) => { state.sessionEmail = email; return { error: null }; }),
    signOut: vi.fn(async () => { state.sessionEmail = null; return { error: null }; }),
    onAuthStateChange: vi.fn(() => ({ data: listener })),
  };
  return {
    sessionEmail: null as string | null,
    tables: {} as Record<string, Record<string, unknown>[]>,
    auth: mockAuth,
  };
});

function resetState() {
  state.sessionEmail = null;
  state.tables = {
    usuarios: [{ id: 'admin-1', nome: 'Admin de teste', email: 'admin@example.test', perfil: 'admin', ativo: true, created_at: '', updated_at: '' }],
    produtos: [], lojas: [], fornecedores: [], cotacoes: [], cotacao_itens: [],
  };
}

function queryFor(table: string) {
  let operation: 'select' | 'insert' | 'update' = 'select';
  let payload: Record<string, unknown> = {};
  const filters: [string, unknown, boolean?][] = [];
  const builder: Record<string, any> = {};
  builder.select = () => builder;
  builder.insert = (value: Record<string, unknown>) => { operation = 'insert'; payload = value; return builder; };
  builder.update = (value: Record<string, unknown>) => { operation = 'update'; payload = value; return builder; };
  builder.eq = (key: string, value: unknown) => { filters.push([key, value]); return builder; };
  builder.ilike = (key: string, value: unknown) => { filters.push([key, String(value).toLowerCase(), true]); return builder; };
  const matches = (row: Record<string, unknown>) => filters.every(([key, value, insensitive]) =>
    insensitive ? String(row[key] ?? '').toLowerCase() === value : row[key] === value);
  const result = async () => {
    const rows = state.tables[table] ?? (state.tables[table] = []);
    if (operation === 'insert') {
      if (table === 'produtos' && rows.some((row) => String(row.nome).trim().toLowerCase() === String(payload.nome).trim().toLowerCase())) {
        return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "produtos_nome_lower_unique"' } };
      }
      const row = { id: `${table}-${rows.length + 1}`, ativo: true, created_at: '', updated_at: '', ...payload };
      rows.push(row);
      return { data: row, error: null };
    }
    if (operation === 'update') {
      const row = rows.find(matches);
      if (!row) return { data: null, error: { message: 'row not found' } };
      Object.assign(row, payload);
      return { data: row, error: null };
    }
    return { data: rows.filter(matches).slice().sort((a, b) => String(a.nome ?? '').localeCompare(String(b.nome ?? ''))), error: null };
  };
  builder.single = result;
  builder.maybeSingle = async () => {
    const res = await result();
    return { ...res, data: Array.isArray(res.data) ? (res.data[0] ?? null) : res.data };
  };
  builder.order = async () => result();
  return builder;
}

vi.mock('../src/lib/supabase', () => ({
  hasSupabaseConfig: true,
  supabase: { auth: state.auth, from: (table: string) => queryFor(table) },
}));

beforeEach(() => { resetState(); vi.clearAllMocks(); });
afterEach(() => cleanup());

async function login(user: ReturnType<typeof userEvent.setup>) {
  render(<CatalogApp />);
  await user.type(screen.getByLabelText('E-mail'), 'admin@example.test');
  await user.type(screen.getByLabelText('Senha'), 'test-password');
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  await screen.findByRole('heading', { name: 'Produtos' });
}

async function createCatalog(kind: 'produtos' | 'lojas' | 'fornecedores' | 'usuarios', name: string) {
  const user = userEvent.setup();
  if (kind !== 'produtos') {
    await user.click(screen.getByRole('button', { name: kind === 'lojas' ? 'Lojas' : kind === 'fornecedores' ? 'Fornecedores' : 'Usuários' }));
    await screen.findByRole('heading', { name: kind === 'lojas' ? 'Lojas' : kind === 'fornecedores' ? 'Fornecedores' : 'Usuários' });
  }
  await user.click(screen.getByRole('button', { name: /Novo cadastro/ }));
  await user.type(screen.getByLabelText(/Nome/), name);
  if (kind === 'produtos') await user.type(screen.getByLabelText(/Unidade de medida/), 'kg');
  if (kind === 'fornecedores' || kind === 'usuarios') await user.type(screen.getByLabelText(/E-mail/), `${name.toLowerCase().replaceAll(' ', '.')}@example.test`);
  await user.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText(name);
}

describe('Task 1.1 — CRUD de cadastros', () => {
  it('bloqueia nome de produto vazio com mensagem visível (RED da SPEC)', async () => {
    const user = userEvent.setup();
    await login(user);
    await user.click(screen.getByRole('button', { name: /Novo cadastro/ }));
    await user.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Informe o nome.');
    expect(state.tables.produtos).toHaveLength(0);
  });

  it('cria, edita e inativa cada um dos quatro tipos sem apagar linha', async () => {
    const user = userEvent.setup();
    await login(user);
    for (const [kind, name, changed] of [
      ['produtos', 'Batata inglesa', 'Batata lavada'],
      ['lojas', 'Loja teste', 'Loja teste editada'],
      ['fornecedores', 'Fornecedor teste', 'Fornecedor teste editado'],
      ['usuarios', 'Usuário teste', 'Usuário teste editado'],
    ] as const) {
      await createCatalog(kind, name);
      const row = screen.getByRole('row', { name: new RegExp(name) });
      await user.click(within(row).getByRole('button', { name: 'Editar' }));
      const nameInput = screen.getByLabelText(/Nome/);
      await user.clear(nameInput);
      await user.type(nameInput, changed);
      await user.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
      await screen.findByText(changed);

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const updatedRow = screen.getByRole('row', { name: new RegExp(changed) });
      await user.click(within(updatedRow).getByRole('button', { name: 'Inativar' }));
      expect(await screen.findByText(/registro foi preservado/i)).toBeInTheDocument();
      expect(screen.queryByRole('row', { name: new RegExp(changed) })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Inativos/ }));
      expect(await screen.findByRole('row', { name: new RegExp(changed) })).toBeInTheDocument();
      const inactiveRow = screen.getByRole('row', { name: new RegExp(changed) });
      await user.click(within(inactiveRow).getByRole('button', { name: 'Reativar' }));
      expect(await screen.findByText(/registro foi preservado/i)).toBeInTheDocument();
      const itemRows = state.tables[kind].filter((row) => row.nome === changed);
      expect(itemRows).toHaveLength(1);
      expect(itemRows[0]).toMatchObject({ nome: changed, ativo: true });
    }
  });

  it('bloqueia produto duplicado sem diferenciar maiúsculas/minúsculas e explica o motivo', async () => {
    const user = userEvent.setup();
    await login(user);
    await createCatalog('produtos', 'Tomate');
    await user.click(screen.getByRole('button', { name: /Novo cadastro/ }));
    await user.type(screen.getByLabelText(/Nome/), 'tomate');
    await user.type(screen.getByLabelText(/Unidade de medida/), 'kg');
    await user.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um produto com esse nome.');
    expect(state.tables.produtos).toHaveLength(1);
  });
});
