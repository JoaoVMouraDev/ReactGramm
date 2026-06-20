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

<img width="811" height="648" alt="FEED" src="https://github.com/user-attachments/assets/7d802e23-869d-4aea-a988-a5a2f8f01c67" />
<br>
<img width="1070" height="597" alt="PERFIL" src="https://github.com/user-attachments/assets/98fd7c73-7aa6-4a6c-9268-5fc5389eeab9" />
<br>
<img width="1158" height="645" alt="SEGUIDORES" src="https://github.com/user-attachments/assets/4d609b2c-ed9b-41e0-9973-0a1d3433dfde" />
<br>
<img width="1156" height="652" alt="POSTAGEM" src="https://github.com/user-attachments/assets/45ed525e-374a-47f4-b466-3f250180c0fb" />
<br>
<img width="798" height="647" alt="EDIÇÃO DE POST" src="https://github.com/user-attachments/assets/ab02a822-ce3b-4cc1-9db7-19721772a5d3" />
<br>





## Licença

MIT
