import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import type { CatalogItem, CatalogKind } from './catalog.types';

export type CatalogDraft = Record<string, string>;

function databaseClient(client: SupabaseClient<Database>): SupabaseClient {
  // Dynamic table selection is constrained by CatalogKind and every table has RLS.
  return client as unknown as SupabaseClient;
}

export async function listCatalog(
  client: SupabaseClient<Database>,
  kind: CatalogKind,
): Promise<CatalogItem[]> {
  const { data, error } = await databaseClient(client)
    .from(kind)
    .select('*')
    .order('nome', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CatalogItem[];
}

function toPayload(kind: CatalogKind, draft: CatalogDraft): Record<string, unknown> {
  const common = { nome: draft.nome.trim() };
  switch (kind) {
    case 'produtos':
      return { ...common, unidade_medida: draft.unidade_medida.trim() };
    case 'lojas':
      return {
        ...common,
        cnpj: draft.cnpj.trim() || null,
        endereco: draft.endereco.trim() || null,
        pedido_minimo: draft.pedido_minimo.trim() === '' ? null : Number(draft.pedido_minimo),
      };
    case 'fornecedores':
      return { ...common, email: draft.email.trim().toLowerCase() };
    case 'usuarios':
      return {
        ...common,
        email: draft.email.trim().toLowerCase(),
        perfil: draft.perfil,
      };
  }
}

export async function createCatalogItem(
  client: SupabaseClient<Database>,
  kind: CatalogKind,
  draft: CatalogDraft,
): Promise<CatalogItem> {
  const { data, error } = await databaseClient(client)
    .from(kind)
    .insert(toPayload(kind, draft))
    .select('*')
    .single();
  if (error) throw error;
  return data as CatalogItem;
}

export async function updateCatalogItem(
  client: SupabaseClient<Database>,
  kind: CatalogKind,
  id: string,
  draft: CatalogDraft,
): Promise<CatalogItem> {
  const { data, error } = await databaseClient(client)
    .from(kind)
    .update(toPayload(kind, draft))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as CatalogItem;
}

/** Logical removal only: this layer deliberately has no physical DELETE operation. */
export async function setCatalogItemActive(
  client: SupabaseClient<Database>,
  kind: CatalogKind,
  id: string,
  active: boolean,
): Promise<CatalogItem> {
  const { data, error } = await databaseClient(client)
    .from(kind)
    .update({ ativo: active })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as CatalogItem;
}

export async function loadActiveAdminProfile(
  client: SupabaseClient<Database>,
  email: string,
): Promise<{ id: string; nome: string; email: string; perfil: 'admin'; ativo: true } | null> {
  const { data, error } = await client
    .from('usuarios')
    .select('id,nome,email,perfil,ativo')
    .ilike('email', email.trim())
    .eq('ativo', true)
    .eq('perfil', 'admin')
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; nome: string; email: string; perfil: 'admin'; ativo: true } | null;
}
