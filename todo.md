# Instagram Clone - TODO

## Backend / Schema
- [x] Estender tabela users com username, bio, avatarUrl, avatarKey
- [x] Criar tabela posts (id, userId, imageUrl, imageKey, caption, hashtags, createdAt)
- [x] Criar tabela likes (id, postId, userId, createdAt)
- [x] Criar tabela comments (id, postId, userId, text, createdAt)
- [x] Criar tabela follows (id, followerId, followingId, createdAt)
- [x] Executar migração SQL no banco
- [x] DB helpers: posts, likes, comments, follows, users
- [x] tRPC router: posts (create, feed, getById, delete)
- [x] tRPC router: likes (toggle, getByPost)
- [x] tRPC router: comments (create, getByPost)
- [x] tRPC router: follows (toggle, getFollowers, getFollowing)
- [x] tRPC router: users (getProfile, updateProfile, search)
- [x] tRPC router: upload (presigned URL para S3)
- [x] tRPC router: search (users + hashtags)

## Frontend
- [x] Tema claro/escuro com paleta Instagram (branco, preto, gradiente roxo-rosa)
- [x] Layout principal com navbar superior (logo, busca, ícones)
- [x] Navbar mobile inferior
- [x] Página Home: feed vertical de posts
- [x] Componente PostCard (imagem, legenda, hashtags, curtidas, comentários)
- [x] Curtidas com atualização otimista
- [x] Seção de comentários por post (modal/drawer)
- [x] Página de perfil de usuário (avatar, bio, posts em grid, contadores)
- [x] Modal de edição de perfil (username, bio, foto)
- [x] Página de upload de post (imagem + legenda + hashtags)
- [x] Busca em tempo real (usuários + hashtags)
- [x] Hover card de usuário
- [x] Sistema de seguidores (seguir/deixar de seguir)
- [x] Página de hashtag (posts com aquela hashtag)
- [x] Rotas: /, /profile/:username, /post/:id, /explore, /upload

## Testes
- [x] Testes vitest para routers principais (24 testes passando)
- [x] Verificação de build sem erros TypeScript
