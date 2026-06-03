# Configuração de OAuth (Google & GitHub)

## Variáveis de ambiente necessárias

Adicione ao seu `.env`:

```env
# Google OAuth
GOOGLE_CLIENT_ID=seu_google_client_id
GOOGLE_CLIENT_SECRET=seu_google_client_secret

# GitHub OAuth
GITHUB_CLIENT_ID=seu_github_client_id
GITHUB_CLIENT_SECRET=seu_github_client_secret
```

---

## Google OAuth — Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto ou selecione um existente
3. Vá em **APIs & Services → Credentials**
4. Clique em **Create Credentials → OAuth 2.0 Client ID**
5. Tipo de aplicação: **Web application**
6. Em **Authorized redirect URIs**, adicione:
   - `http://localhost:5173/api/auth/google/callback` (dev)
   - `https://seudominio.com/api/auth/google/callback` (prod)
7. Copie o **Client ID** e **Client Secret**

---

## GitHub OAuth — GitHub Developer Settings

1. Acesse [github.com/settings/applications/new](https://github.com/settings/applications/new)
2. Preencha:
   - **Application name**: ReactGram
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:5173/api/auth/github/callback`
3. Clique em **Register application**
4. Copie o **Client ID** e gere um **Client Secret**

---

## Banco de dados

Execute a migration se necessário:

```sql
-- drizzle/0003_oauth_providers.sql
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `googleId` varchar(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS `githubId` varchar(255) UNIQUE;
```

---

## Como funciona

| Método | Fluxo |
|--------|-------|
| **Email/Senha** | Cadastro via `POST /trpc/auth.signup`, login via `POST /trpc/auth.login` — senha hasheada com SHA-256, sessão JWT criada no cookie |
| **Google** | Redirect para Google → callback em `/api/auth/google/callback` → upsert do usuário → cookie de sessão |
| **GitHub** | Redirect para GitHub → callback em `/api/auth/github/callback` → upsert do usuário → cookie de sessão |
| **Vinculação de contas** | Se o email do Google/GitHub já existe no banco (cadastro por email), as contas são automaticamente vinculadas |
