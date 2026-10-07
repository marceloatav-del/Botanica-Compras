import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { loadActiveAdminProfile } from './catalog.repository';
import type { CatalogDraft } from './catalog.repository';
import { catalogErrorMessage, catalogFieldLabels, catalogLabels, catalogColumns, validateCatalogInput } from './catalog.types';
import type { CatalogItem, CatalogKind } from './catalog.types';
import { createCatalogItem, listCatalog, setCatalogItemActive, updateCatalogItem } from './catalog.repository';
import { hasSupabaseConfig, supabase } from '../../lib/supabase';

const emptyDraft = (kind: CatalogKind): CatalogDraft => {
  const draft: CatalogDraft = { nome: '' };
  if (kind === 'produtos') draft.unidade_medida = '';
  if (kind === 'lojas') Object.assign(draft, { cnpj: '', endereco: '', pedido_minimo: '' });
  if (kind === 'fornecedores') draft.email = '';
  if (kind === 'usuarios') Object.assign(draft, { email: '', perfil: 'loja' });
  return draft;
};

const fieldsFor: Record<CatalogKind, { name: string; type?: string; required?: boolean; options?: string[] }[]> = {
  produtos: [
    { name: 'nome', required: true },
    { name: 'unidade_medida', required: true },
  ],
  lojas: [
    { name: 'nome', required: true },
    { name: 'cnpj' },
    { name: 'endereco' },
    { name: 'pedido_minimo', type: 'number' },
  ],
  fornecedores: [
    { name: 'nome', required: true },
    { name: 'email', type: 'email', required: true },
  ],
  usuarios: [
    { name: 'nome', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'perfil', options: ['admin', 'loja', 'fornecedor'] },
  ],
};

function displayCell(item: CatalogItem, kind: CatalogKind, key: string): string {
  const value = (item as unknown as Record<string, unknown>)[key];
  if (value == null || value === '') return '—';
  if (key === 'pedido_minimo') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
  if (kind === 'usuarios' && key === 'perfil') {
    return ({ admin: 'Admin', loja: 'Loja', fornecedor: 'Fornecedor' } as Record<string, string>)[String(value)];
  }
  return String(value);
}

function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!supabase) return;
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const userEmail = sessionData.session?.user.email;
      if (!userEmail) throw new Error('A conta não possui um e-mail confirmado.');
      const profile = await loadActiveAdminProfile(supabase, userEmail);
      if (!profile) {
        await supabase.auth.signOut();
        throw new Error('Conta sem perfil de administrador ativo. Solicite a liberação ao responsável.');
      }
      onSignedIn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar. Revise os dados e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">B</div>
        <p className="eyebrow">Botânica Compras</p>
        <h1 id="login-title">Acesse a administração</h1>
        <p className="muted">Entre com a conta vinculada a um perfil de administrador ativo.</p>
        <form onSubmit={submit} className="form-stack">
          <label htmlFor="login-email">E-mail</label>
          <input id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="login-password">Senha</label>
          <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="alert error" role="alert">{error}</p>}
          <button className="button primary full" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </section>
    </main>
  );
}

export function CatalogApp() {
  const [session, setSession] = useState(false);
  const [kind, setKind] = useState<CatalogKind>('produtos');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [editor, setEditor] = useState<{ id: string | null; draft: CatalogDraft } | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  async function refresh(nextKind: CatalogKind = kind) {
    if (!supabase) return;
    setLoading(true);
    try {
      setItems(await listCatalog(supabase, nextKind));
    } catch (error) {
      setNotice({ tone: 'error', text: catalogErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  async function signedIn() {
    setSession(true);
    await refresh(kind);
  }

  useEffect(() => {
    const client = supabase;
    if (!client) return undefined;
    let mounted = true;
    client.auth.getSession().then(async ({ data, error }) => {
      if (error) {
        if (mounted) setNotice({ tone: 'error', text: catalogErrorMessage(error) });
        return;
      }
      const email = data.session?.user.email;
      if (!email || !mounted) return;
      try {
        const profile = await loadActiveAdminProfile(client, email);
        if (mounted && profile) {
          setSession(true);
          await refresh('produtos');
        } else if (mounted) {
          await client.auth.signOut();
        }
      } catch (error) {
        if (mounted) setNotice({ tone: 'error', text: catalogErrorMessage(error) });
      }
    });
    const { data: authListener } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) setSession(false);
    });
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function changeKind(next: CatalogKind) {
    setKind(next);
    setEditor(null);
    setShowInactive(false);
    await refresh(next);
  }

  function startCreate() {
    setNotice(null);
    setEditor({ id: null, draft: emptyDraft(kind) });
  }

  function startEdit(item: CatalogItem) {
    const draft = emptyDraft(kind);
    for (const field of fieldsFor[kind]) {
      const value = (item as unknown as Record<string, unknown>)[field.name];
      draft[field.name] = value == null ? '' : String(value);
    }
    setNotice(null);
    setEditor({ id: item.id, draft });
  }

  function setDraftField(name: string, value: string) {
    setEditor((current) => current ? { ...current, draft: { ...current.draft, [name]: value } } : current);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !editor) return;
    const validation = validateCatalogInput(kind, editor.draft);
    if (validation) {
      setNotice({ tone: 'error', text: validation });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      if (editor.id) await updateCatalogItem(supabase, kind, editor.id, editor.draft);
      else await createCatalogItem(supabase, kind, editor.draft);
      setEditor(null);
      setNotice({ tone: 'success', text: `${catalogLabels[kind].slice(0, -1)} ${editor.id ? 'atualizado' : 'cadastrado'} com sucesso.` });
      await refresh(kind);
    } catch (error) {
      setNotice({ tone: 'error', text: catalogErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: CatalogItem) {
    if (!supabase) return;
    const isActive = item.ativo;
    const verb = isActive ? 'inativar' : 'reativar';
    if (!window.confirm(`Deseja ${verb} este cadastro? O registro não será apagado.`)) return;
    setNotice(null);
    try {
      await setCatalogItemActive(supabase, kind, item.id, !isActive);
      setNotice({ tone: 'success', text: `Cadastro ${isActive ? 'inativado' : 'reativado'}; o registro foi preservado.` });
      await refresh(kind);
    } catch (error) {
      setNotice({ tone: 'error', text: catalogErrorMessage(error) });
    }
  }

  if (!hasSupabaseConfig) {
    return (
      <main className="auth-shell">
        <section className="auth-card config-card">
          <div className="brand-mark" aria-hidden="true">B</div>
          <p className="eyebrow">Botânica Compras</p>
          <h1>Configuração necessária</h1>
          <p>O app está compilado, mas falta configurar <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> no ambiente local/deploy. Nenhuma chave privilegiada deve ser usada no navegador.</p>
        </section>
      </main>
    );
  }

  if (!session) return <LoginScreen onSignedIn={signedIn} />;

  const activeItems = items.filter((item) => item.ativo);
  const inactiveItems = items.filter((item) => !item.ativo);
  const visibleItems = showInactive ? inactiveItems : activeItems;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Botânica Compras — início"><span className="brand-mark small">B</span><span>Botânica <strong>Compras</strong></span></a>
        <div className="topbar-right"><span className="secure-label"><span className="secure-dot" /> Área administrativa</span><button className="button ghost" onClick={async () => { await supabase?.auth.signOut(); setSession(false); }}>Sair</button></div>
      </header>
      <section className="page-heading">
        <div><p className="eyebrow">Configuração do sistema</p><h1>Cadastros</h1><p className="muted">Organize a lista-mãe e os dados usados no ciclo de compras.</p></div>
        <div className="summary-chip"><span className="summary-number">{activeItems.length}</span><span>ativos</span></div>
      </section>
      <nav className="catalog-tabs" aria-label="Tipos de cadastro">
        {(Object.keys(catalogLabels) as CatalogKind[]).map((entry) => (
          <button key={entry} className={`tab ${kind === entry ? 'active' : ''}`} onClick={() => void changeKind(entry)} aria-current={kind === entry ? 'page' : undefined}>{catalogLabels[entry]}</button>
        ))}
      </nav>
      <section className="catalog-panel" aria-labelledby="catalog-title">
        <div className="panel-heading">
          <div><h2 id="catalog-title">{catalogLabels[kind]}</h2><p className="muted small-text">Crie, edite e inative registros sem apagar o histórico.</p></div>
          <button className="button primary" onClick={startCreate}>＋ Novo cadastro</button>
        </div>
        {notice && <p className={`alert ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
        {editor && (
          <form className="editor-card" onSubmit={save} noValidate aria-label={editor.id ? 'Editar cadastro' : 'Novo cadastro'}>
            <div className="editor-heading"><h3>{editor.id ? 'Editar cadastro' : 'Novo cadastro'}</h3><button className="icon-button" type="button" aria-label="Fechar formulário" onClick={() => setEditor(null)}>×</button></div>
            <div className="field-grid">
              {fieldsFor[kind].map((field) => (
                <label className="field" key={field.name} htmlFor={`field-${field.name}`}>
                  <span>{catalogFieldLabels[field.name]}{field.required && <span className="required-mark"> *</span>}</span>
                  {field.options ? (
                    <select id={`field-${field.name}`} value={editor.draft[field.name] ?? ''} onChange={(e) => setDraftField(field.name, e.target.value)} required>
                      {field.options.map((option) => <option value={option} key={option}>{option === 'admin' ? 'Admin (diretoria)' : option === 'loja' ? 'Loja' : 'Fornecedor'}</option>)}
                    </select>
                  ) : (
                    <input id={`field-${field.name}`} type={field.type ?? 'text'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? '0.01' : undefined} value={editor.draft[field.name] ?? ''} onChange={(e) => setDraftField(field.name, e.target.value)} required={field.required} />
                  )}
                </label>
              ))}
            </div>
            <div className="form-actions"><button className="button ghost" type="button" onClick={() => setEditor(null)}>Cancelar</button><button className="button primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar cadastro'}</button></div>
          </form>
        )}
        <div className="list-toolbar">
          <div className="segmented" role="group" aria-label="Filtrar registros">
            <button className={!showInactive ? 'selected' : ''} onClick={() => setShowInactive(false)}>Ativos <span>{activeItems.length}</span></button>
            <button className={showInactive ? 'selected' : ''} onClick={() => setShowInactive(true)}>Inativos <span>{inactiveItems.length}</span></button>
          </div>
          <button className="button ghost refresh-button" onClick={() => void refresh()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar lista'}</button>
        </div>
        {loading ? <div className="loading-state" role="status">Carregando cadastros…</div> : visibleItems.length === 0 ? (
          <div className="empty-state"><span className="empty-icon" aria-hidden="true">{showInactive ? '◌' : '＋'}</span><h3>{showInactive ? 'Nenhum cadastro inativo' : 'Nenhum cadastro ativo'}</h3><p>{showInactive ? 'Os registros inativados aparecerão aqui e poderão ser reativados.' : 'Comece adicionando um cadastro. Os dados desta tela são administrativos; dados de amostra real serão carregados na Task 1.2.'}</p></div>
        ) : (
          <div className="table-wrap"><table><thead><tr>{catalogColumns[kind].map((col) => <th key={col.key} scope="col">{col.label}</th>)}<th scope="col">Situação</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead><tbody>
            {visibleItems.map((item) => <tr key={item.id}>
              {catalogColumns[kind].map((col) => <td key={col.key}>{displayCell(item, kind, col.key)}</td>)}
              <td><span className={`status-pill ${item.ativo ? 'on' : 'off'}`}><span />{item.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td><div className="row-actions"><button className="button table-button" onClick={() => startEdit(item)}>Editar</button><button className={`button table-button ${item.ativo ? 'danger-text' : ''}`} onClick={() => void toggleActive(item)}>{item.ativo ? 'Inativar' : 'Reativar'}</button></div></td>
            </tr>)}
          </tbody></table></div>
        )}
      </section>
      <footer className="app-footer"><span>Botânica Compras</span><span>Os registros inativos permanecem preservados no histórico.</span></footer>
    </main>
  );
}
