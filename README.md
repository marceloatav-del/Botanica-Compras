# Botânica Compras

Aplicação administrativa da Fase 1 para os cadastros da Task 1.1.

## Como abrir a tela

O código está na branch [`task-1.1-cadastros`](https://github.com/marceloatav-del/Botanica-Compras/tree/task-1.1-cadastros), não na `main`.

1. No repositório, selecione a branch `task-1.1-cadastros`.
2. Baixe essa branch ou abra-a no ambiente de desenvolvimento usado pela equipe.
3. Configure as duas variáveis públicas que aparecem em `.env.example`: endereço do projeto Supabase e chave `publishable`.
4. Instale as dependências com `npm install` e inicie com `npm run dev`.
5. Entre com uma conta Supabase Auth cujo e-mail tenha perfil `admin` ativo em `public.usuarios`.

**Não envie senha nem chave privada pelo chat e não coloque `service_role` no navegador.** Ainda não cadastrei usuário admin porque não tenho um e-mail confirmado para associar; não inventarei uma conta.

## O que a tela permite

Criar, editar, inativar e reativar produtos, lojas, fornecedores e usuários. A inativação preserva os registros; não há exclusão física pela interface. O produto sem nome é bloqueado e produto duplicado recebe mensagem clara.

A migration `supabase/migrations/20261007151919_task_1_1_catalogs.sql` já foi aplicada ao projeto Supabase `BotanicaCompras`. As seis tabelas de cadastro/cotação estão criadas, com RLS ativa e zero registros. Nenhum serviço ou branch pago foi criado.

## Testes já feitos

- `npm test`: 7 testes passaram.
- `npm run build`: passou.
- Os testes técnicos usaram dados de teste locais; não são dados reais da Task 1.2.

O schema foi confirmado no Supabase. Falta o teste humano na interface com uma conta admin válida.
