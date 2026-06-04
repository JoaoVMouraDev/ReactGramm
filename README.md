# ReactGram

ReactGram é uma rede social de fotos inspirada no Instagram, feita com React, tRPC, Express e PostgreSQL. O app permite criar conta, publicar imagens, explorar usuários e hashtags, curtir, comentar, seguir perfis e editar o próprio perfil.

Aplicação em produção: [https://reactgramm.onrender.com](https://reactgramm.onrender.com)

## Funcionalidades

- Cadastro e login com email e senha
- Login social com Google e GitHub, quando as credenciais OAuth estiverem configuradas
- Feed de posts com carregamento incremental
- Upload de imagens para posts
- Legendas e hashtags por publicação
- Curtidas com atualização otimista na interface
- Comentários em painel lateral
- Página de detalhes de cada post
- Perfis públicos com avatar, bio, contadores e grade de posts
- Edição de perfil, nome de usuário, bio e foto
- Sistema de seguir/deixar de seguir usuários
- Busca por usuários
- Exploração de hashtags
- Tema claro/escuro
- Layout responsivo com navegação superior no desktop e navegação inferior no mobile

## Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- shadcn/ui e Radix UI
- Wouter para rotas
- TanStack Query
- tRPC React
- Lucide React
- Sonner para notificações

### Backend

- Node.js
- Express
- tRPC
- Drizzle ORM
- PostgreSQL
- JWT/cookie de sessão
- OAuth Google e GitHub
- Upload local em desenvolvimento e storage externo em produção quando configurado

## Rotas da aplicação

| Rota | Descrição |
| --- | --- |
| `/` | Feed principal |
| `/login` | Login com email, Google ou GitHub |
| `/signup` | Criação de conta |
| `/upload` | Publicação de novo post |
| `/explore` | Busca por usuários e hashtags |
| `/profile/:username` | Perfil público do usuário |
| `/hashtag/:tag` | Posts por hashtag |
| `/post/:id` | Página de detalhe do post |

## Estrutura do projeto

```txt
client/
  src/
    components/       Componentes reutilizáveis
    pages/            Telas da aplicação
    contexts/         Tema e contextos React
    _core/hooks/      Hooks de autenticação
    lib/trpc.ts       Cliente tRPC

server/
  _core/              Infraestrutura do servidor, auth, OAuth e tRPC
  auth.ts             Validações e hash de senha
  db.ts               Consultas e operações no banco
  routers.ts          Procedimentos tRPC
  storage.ts          Upload de imagens

drizzle/
  schema.ts           Schema PostgreSQL

shared/
  const.ts            Constantes compartilhadas
  types.ts            Tipos compartilhados
```

## Banco de dados

O projeto usa PostgreSQL com Drizzle ORM. As principais tabelas são:

- `users`: usuários, login por email, Google/GitHub, perfil, avatar, bio e role
- `posts`: publicações com imagem, legenda e hashtags
- `likes`: curtidas dos usuários nos posts
- `comments`: comentários dos posts
- `follows`: relação de seguidores e seguindo

## Variáveis de ambiente

Crie um arquivo `.env` para rodar localmente:

```env
DATABASE_URL=postgresql://usuario:senha@host:porta/database
JWT_SECRET=uma_chave_segura_para_sessao

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
```

Observações:

- `DATABASE_URL` é obrigatória para persistir usuários, posts, curtidas, comentários e follows.
- `JWT_SECRET` é recomendado para assinar as sessões.
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` só são necessários para login com Google.
- `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` só são necessários para login com GitHub.
- As variáveis `BUILT_IN_FORGE_API_URL` e `BUILT_IN_FORGE_API_KEY` são usadas para storage externo. Sem elas, em desenvolvimento o upload salva arquivos em `client/public/local-storage`.

## Como rodar localmente

1. Clone o repositório:

```bash
git clone https://github.com/JoaoVMouraDev/ReactGramm.git
cd ReactGramm
```

2. Instale as dependências:

```bash
pnpm install
```

3. Configure o `.env` com as variáveis necessárias.

4. Sincronize o schema do banco:

```bash
pnpm db:push
```

5. Inicie o projeto:

```bash
pnpm dev
```

## Scripts

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Inicia o servidor em modo desenvolvimento |
| `pnpm build` | Gera o build de produção |
| `pnpm start` | Executa o build em produção |
| `pnpm check` | Verifica os tipos TypeScript |
| `pnpm test` | Roda os testes com Vitest |
| `pnpm format` | Formata o projeto com Prettier |
| `pnpm db:push` | Aplica o schema Drizzle no banco |

## Deploy no Render

O projeto está preparado para rodar como Web Service no Render.

Configuração sugerida:

```txt
Build Command: pnpm install && pnpm build
Start Command: pnpm exec tsx --experimental-specifier-resolution=node server/_core/index.ts
```

Variáveis importantes no Render:

```env
DATABASE_URL=...
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

Para OAuth em produção, configure as URLs de callback:

```txt
Google: https://reactgramm.onrender.com/api/auth/google/callback
GitHub: https://reactgramm.onrender.com/api/auth/github/callback
```

## Autenticação

O ReactGram suporta três formas de entrada:

- Email e senha: cadastro local com senha protegida por hash.
- Google OAuth: redireciona para o Google e cria/atualiza o usuário no retorno.
- GitHub OAuth: redireciona para o GitHub e cria/atualiza o usuário no retorno.

Após o login, o servidor cria uma sessão em cookie HTTP-only. As rotas protegidas usam o usuário autenticado no contexto do tRPC.

## API tRPC

Principais módulos do router:

- `auth`: sessão, login, cadastro e logout
- `posts`: feed, criação, detalhes, exclusão, posts por usuário e por hashtag
- `upload`: upload de imagem de post e avatar
- `likes`: curtir/descurtir e listar curtidas
- `comments`: criar e listar comentários
- `follows`: seguir, deixar de seguir e contadores
- `users`: perfil, busca, hover card e atualização de perfil

## Testes

O projeto usa Vitest. Para rodar:

```bash
pnpm test
```

Também é recomendado validar tipos antes de publicar alterações:

```bash
pnpm check
```

## Licença

Este projeto está sob a licença MIT.
