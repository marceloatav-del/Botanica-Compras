export type PerfilUsuario = 'admin' | 'loja' | 'fornecedor';

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type Produto = {
  id: string;
  nome: string;
  unidade_medida: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type Loja = {
  id: string;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  pedido_minimo: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type Fornecedor = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type CatalogItem = Usuario | Produto | Loja | Fornecedor;
export type CatalogKind = 'produtos' | 'lojas' | 'fornecedores' | 'usuarios';

export const catalogLabels: Record<CatalogKind, string> = {
  produtos: 'Produtos',
  lojas: 'Lojas',
  fornecedores: 'Fornecedores',
  usuarios: 'Usuários',
};

export const catalogColumns: Record<CatalogKind, { key: string; label: string }[]> = {
  produtos: [
    { key: 'nome', label: 'Nome' },
    { key: 'unidade_medida', label: 'Unidade de medida' },
  ],
  lojas: [
    { key: 'nome', label: 'Nome' },
    { key: 'cnpj', label: 'CNPJ' },
    { key: 'pedido_minimo', label: 'Pedido mínimo (R$)' },
  ],
  fornecedores: [
    { key: 'nome', label: 'Nome' },
    { key: 'email', label: 'E-mail' },
  ],
  usuarios: [
    { key: 'nome', label: 'Nome' },
    { key: 'email', label: 'E-mail' },
    { key: 'perfil', label: 'Perfil' },
  ],
};

export const catalogFieldLabels: Record<string, string> = {
  nome: 'Nome',
  unidade_medida: 'Unidade de medida',
  cnpj: 'CNPJ',
  endereco: 'Endereço',
  pedido_minimo: 'Pedido mínimo (R$)',
  email: 'E-mail',
  perfil: 'Perfil',
};

export function catalogErrorMessage(error: unknown): string {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : error instanceof Error ? error.message : String(error ?? '');
  if (/produtos_nome_lower_unique|duplicate key|already exists|unique constraint/i.test(message)) {
    return 'Já existe um produto com esse nome. Escolha outro nome.';
  }
  if (/check constraint|violates not-null|not-null constraint/i.test(message)) {
    return 'Confira os campos obrigatórios e tente novamente.';
  }
  if (/permission denied|row-level security|42501/i.test(message)) {
    return 'Seu usuário não tem permissão para administrar os cadastros.';
  }
  return 'Não foi possível salvar. Revise os dados e tente novamente.';
}

export function validateCatalogInput(
  kind: CatalogKind,
  input: Record<string, unknown>,
): string | null {
  const name = typeof input.nome === 'string' ? input.nome.trim() : '';
  if (!name) return 'Informe o nome.';

  if (kind === 'produtos') {
    const unit = typeof input.unidade_medida === 'string' ? input.unidade_medida.trim() : '';
    if (!unit) return 'Informe a unidade de medida.';
  }
  if (kind === 'fornecedores' || kind === 'usuarios') {
    const email = typeof input.email === 'string' ? input.email.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Informe um e-mail válido.';
  }
  if (kind === 'usuarios' && !['admin', 'loja', 'fornecedor'].includes(String(input.perfil))) {
    return 'Selecione um perfil válido.';
  }
  if (kind === 'lojas' && input.pedido_minimo !== '' && input.pedido_minimo != null) {
    const amount = Number(input.pedido_minimo);
    if (!Number.isFinite(amount) || amount < 0) return 'Pedido mínimo deve ser um valor maior ou igual a zero.';
  }
  return null;
}
