# 💞 Nós Dois — Agenda & Finanças do Casal

PWA em **Next.js 15 (App Router) + Supabase + Tailwind** para o casal compartilhar agenda, notas/listas e gastos, com sincronização em tempo real.

```
casal-app/
├── supabase/schema.sql          ← tabelas, RLS, funções (rodar no Supabase)
├── middleware.ts                ← renova sessão e protege rotas
├── lib/
│   ├── supabase/{client,server,middleware}.ts
│   ├── useRealtime.ts           ← hook de sincronização em tempo real
│   ├── types.ts · constants.ts · format.ts
├── components/                  ← HouseholdProvider, BottomNav, ui (Sheet, Fab…)
├── app/
│   ├── login/                   ← e-mail/senha ou link mágico
│   ├── auth/callback/           ← retorno dos links de e-mail
│   ├── onboarding/              ← criar casal / entrar com código
│   └── (app)/                   ← área logada (exige casal)
│       ├── agenda/  notas/  financas/  ajustes/
└── public/ manifest.webmanifest · sw.js · offline.html · icons/
```

---

## 1. Criar o banco no Supabase (grátis)

1. Crie uma conta em <https://supabase.com> → **New project** (região *South America (São Paulo)*). Guarde a senha do banco.
2. Menu **SQL Editor → New query** → cole **todo** o conteúdo de `supabase/schema.sql` → **Run**. Deve terminar com “Success. No rows returned”.
3. Menu **Project Settings → API**: copie a **Project URL** e a chave **anon public**.
   ⚠️ Nunca use a chave `service_role` no frontend.
4. Menu **Authentication → Sign In / Providers → Email**: deixe *Email* habilitado (vale para senha e link mágico). Recomendado: manter **Confirm email** ligado.
5. Menu **Authentication → URL Configuration** (preencha depois de publicar na Vercel, passo 3):
   - **Site URL**: `https://SEU-APP.vercel.app`
   - **Redirect URLs**: `https://SEU-APP.vercel.app/auth/callback` e `http://localhost:3000/auth/callback`

> **Limite de e-mails:** o servidor de e-mail embutido do Supabase envia poucos e-mails por hora (bom para 2 pessoas). Se precisar de mais, configure um SMTP próprio em *Authentication → Emails → SMTP Settings*.

## 2. Rodar no seu computador (opcional)

Requer Node.js 18.18+ (recomendado 20 ou 22).

```bash
cp .env.example .env.local      # cole a URL e a anon key
npm install
npm run dev                     # http://localhost:3000
```

O service worker só é ativado em produção (`npm run build && npm start`).

## 3. Publicar grátis na Vercel

1. Suba a pasta para um repositório no GitHub (pode ser **privado**):
   ```bash
   git init && git add . && git commit -m "Nós Dois v1"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/nos-dois.git
   git push -u origin main
   ```
2. Entre em <https://vercel.com> com o GitHub → **Add New… → Project** → importe o repositório.
3. Em **Environment Variables** adicione:
   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon public |
4. **Deploy**. Em ~1 min você recebe `https://SEU-APP.vercel.app`.
5. Volte ao Supabase (passo 1.5) e cadastre essa URL em *Site URL* e *Redirect URLs*.
6. A cada `git push` na `main` a Vercel publica a nova versão sozinha.

## 4. Primeiro uso

1. **Pessoa A** abre o app → *Criar conta* → confirma o e-mail → **Criar nosso espaço**. A tela de Ajustes mostra um **código de 8 letras** (vale 7 dias, uso único) com botão *Compartilhar*.
2. **Pessoa B** cria a conta → **Tenho um código** → digita o código.
3. Pronto: tudo que um criar/editar aparece no celular do outro em tempo real.

## 5. Instalar como app no celular

- **iPhone (Safari)** — abra o site → botão **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início** → *Adicionar*.
  (Precisa ser pelo Safari; outros navegadores no iOS também oferecem a opção a partir do iOS 16.4.)
- **Android (Chrome)** — abra o site → aparece *“Instalar app”*; ou menu **⋮ → Instalar app / Adicionar à tela inicial**.

O app abre em tela cheia, com ícone próprio, e mostra uma tela amigável se estiver sem internet.

---

## 🔐 Segurança — o que foi feito

| Camada | Medida |
|---|---|
| **RLS em todas as tabelas** | Cada leitura/escrita só passa se `household_id = my_household_id()` (função `SECURITY DEFINER` que lê o casal do usuário logado). |
| **Entrar num casal** | O usuário **não consegue** alterar `household_id` diretamente: o `UPDATE` em `profiles` só é permitido nas colunas `display_name` e `color`. Criar/entrar só via RPCs `create_household` / `join_household`. |
| **Código de convite** | 8 caracteres aleatórios (`gen_random_bytes`, ~10¹² combinações), expira em 7 dias, **uso único**, máximo de 2 membros, erro genérico (não revela se o código existe). |
| **Integridade** | Pagador/responsável precisa ser membro do mesmo casal; itens de lista têm FK composta (nota + casal); trigger impede trocar `household_id`/`created_by`; `CHECK` em tamanhos, valores e categorias. |
| **Anônimos** | Sem nenhum acesso às tabelas (`revoke all … from anon`). |
| **Sessão** | `@supabase/ssr` com cookies; o middleware valida com `getUser()` (verificação no servidor do Supabase) em cada request. |
| **Redirect** | O callback de login sempre redireciona para caminho interno fixo (sem *open redirect*). |
| **Service Worker** | Não armazena HTML nem respostas do Supabase — só arquivos estáticos públicos. |
| **Headers HTTP** | HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. |

**Teste rápido do RLS:** no SQL Editor rode `select * from events;` com o *role* `anon` (seletor no topo do editor) → deve vir vazio/negado.

### Observações
- **Realtime e DELETE:** o Supabase não aplica filtro a eventos de exclusão em tabelas com RLS; o app só recebe o *id* removido e recarrega a lista (nenhum dado de outro casal é lido).
- **Recorrentes/parcelados:** são gerados de uma vez (até 60 ocorrências); as futuras nascem como *Pendente*. Na edição dá para excluir “só este” ou “este e próximos”.
- **Acerto de contas** no dashboard assume divisão 50/50 das despesas pagas por cada um; lançamentos em “Conta conjunta” não entram no acerto.
