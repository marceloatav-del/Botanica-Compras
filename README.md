# Botânica Compras

Aplicação administrativa da Fase 1 para os cadastros previstos na Task 1.1.

## Rodar localmente

Requisitos: Node.js 20 ou compatível.

1. Instale as dependências: `npm install`.
2. Copie `.env.example` para `.env`.
3. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com a URL e chave pública do projeto BotanicaCompras.
4. Inicie com `npm run dev` e abra o endereço mostrado no terminal.

Não use chave `service_role` no navegador. A chave publishable é pública; o controle de acesso aos dados é aplicado pelas políticas RLS do Supabase.

## Verificações

- `npm test` — testes da interface e da migration em PostgreSQL local (PGlite).
- `npm run build` — checagem TypeScript e build de produção.

## Task 1.1

A migration `supabase/migrations/20261007151919_task_1_1_catalogs.sql` cria produtos, lojas, fornecedores, perfis de usuários e as relações mínimas de cotações necessárias para CA-1-03. Os quatro cadastros são inativados por `ativo=false`; não há exclusão física pela aplicação.

O projeto Supabase já existente `BotanicaCompras` recebeu essa migration. Neste momento o schema está vazio de registros. Antes do teste visual é necessário configurar os valores públicos no `.env` e provisionar uma conta Auth com perfil `admin` ativo na tabela `usuarios`; não grave senha nem chave privada em arquivos versionados.

O pacote entregue foi testado localmente: `npm test` (7 testes) e `npm run build`.
