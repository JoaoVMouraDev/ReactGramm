# ReactGram

ReactGram é uma rede social de fotos construída com React, tRPC, Express e PostgreSQL.

Produção: [https://react-gramm.vercel.app](https://react-gramm.vercel.app)

## Funcionalidades

- Cadastro e login com email e senha
- Feed com carregamento incremental
- Publicação e edição de posts com imagem, legenda e hashtags
- Curtidas e comentários
- Perfis públicos com avatar, bio e grade de posts
- Listas de seguidores e seguindo
- Seguir e deixar de seguir usuários
- Busca por usuários e hashtags
- Notificações de seguidores, curtidas e comentários
- Administração e exclusão de posts
- Tema claro e escuro
- Interface responsiva

## Tecnologias

- React 19, TypeScript, Vite e Tailwind CSS
- tRPC, TanStack Query e Express
- PostgreSQL e Drizzle ORM
- Vercel Blob para novas imagens
- Vitest

## Configuração local

```bash
git clone https://github.com/JoaoVMouraDev/ReactGramm.git
cd ReactGramm
npm install
```

Crie um arquivo `.env`:

```env
DATABASE_URL=postgresql://usuario:senha@host:porta/database
JWT_SECRET=uma_chave_segura
BLOB_READ_WRITE_TOKEN=
ADMIN_USERNAMES=
ADMIN_EMAILS=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

Prepare o banco e inicie o projeto:

```bash
npm run db:push
npm run dev
```

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o ambiente de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm run check` | Valida os tipos TypeScript |
| `npm test` | Executa os testes |
| `npm run db:push` | Sincroniza o schema do banco |

## Estrutura

```txt
client/       Interface React
server/       API, autenticação, banco e storage
drizzle/      Schema e migrações PostgreSQL
shared/       Tipos e constantes compartilhadas
api/          Entrada serverless da Vercel
```

## Deploy

O projeto está configurado para a Vercel pelo arquivo `vercel.json`.

Variáveis obrigatórias em produção:

- `DATABASE_URL`
- `JWT_SECRET`
- `BLOB_READ_WRITE_TOKEN`

Após adicionar as variáveis, faça um novo deploy. As novas imagens são enviadas ao Vercel Blob e os dados sociais permanecem no PostgreSQL.

## Licença

MIT
