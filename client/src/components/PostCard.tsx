import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  Bookmark,
  Flag,
  Heart,
  ImageOff,
  Link as LinkIcon,
  MessageCircle,
  MoreHorizontal,
  Send,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { CommentsDrawer } from "./CommentsDrawer";
import { UserHoverCard } from "./UserHoverCard";

interface PostCardProps {
  post: {
    id: number;
    userId: number;
    imageUrl: string;
    caption?: string | null;
    hashtags?: string[];
    likesCount: number;
    commentsCount: number;
    isLiked?: boolean;
    isBookmarked?: boolean;
    createdAt: Date;
    user?: {
      id: number;
      username?: string | null;
      name?: string | null;
      avatarUrl?: string | null;
    };
  };
  onDeleted?: () => void;
}

export function PostCard({ post, onDeleted }: PostCardProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(post.isLiked ?? false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked ?? false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwner = user?.id === post.userId;

  const utils = trpc.useUtils();

  const toggleLikeMutation = trpc.likes.toggle.useMutation({
    onMutate: async () => {
      // Cancela buscas em andamento para o feed para não sobrescrever o estado otimista
      await utils.posts.feed.cancel();

      // Capturamos os valores atuais ANTES da mudança
      const prevLiked = isLiked;
      const prevCount = likesCount;

      // Invertemos o estado baseando-se no valor anterior (prev)
      setIsLiked(!prevLiked);
      setLikesCount(c => Math.max(0, prevLiked ? c - 1 : c + 1));
      
      if (!prevLiked) {
        setHeartAnim(true);
        setTimeout(() => setHeartAnim(false), 1000);
      }
      return { prevLiked, prevCount };
    },
    onSuccess: () => {
      // Invalida o feed para garantir que os contadores estejam atualizados no servidor
      utils.posts.feed.invalidate();
    },
    onError: (err, variables, context) => {
      const errorMsg = err.message || "";
      const isDuplicate = errorMsg.includes("Duplicate entry") || 
                          errorMsg.includes("UNIQUE constraint failed") || 
                          errorMsg.includes("Failed query: insert into `likes` ");

      if (err.data?.code === "UNAUTHORIZED") {
        toast.error("Sua sessão expirou. Por favor, faça login novamente.");
        navigate("/login"); // Redireciona para a página de login
      } else if (isDuplicate) {
        // Se o erro for de duplicata, significa que o post JÁ ESTÁ curtido no banco.
        // Mantemos o coração vermelho e garantimos que o contador reflita pelo menos 1
        setIsLiked(true);
        setLikesCount((prev) => (prev <= 0 ? 1 : prev));
        // Não mostramos erro pro usuário, pois a curtida já existe como desejado.
        utils.posts.feed.invalidate();
      } else {
        if (context) {
          setIsLiked(context.prevLiked);
          setLikesCount(context.prevCount);
        }
        toast.error(err.message || "Erro ao curtir post");
        utils.posts.feed.invalidate();
      }
    },
  });

  // TODO: Implementar o router 'bookmarks' no backend do tRPC e regenerar os tipos.
  // Por enquanto, a mutação de bookmark está comentada para evitar erros de compilação.
  // const toggleBookmarkMutation = trpc.bookmarks.toggle?.useMutation({
  //   onMutate: () => setIsBookmarked(!isBookmarked),
  //   onError: () => setIsBookmarked(!isBookmarked),
  // });

  const deletePostMutation = trpc.posts.delete.useMutation({
    onSuccess: () => {
      toast.success("Post deletado");
      onDeleted?.();
      utils.posts.feed.invalidate();
    },
    onError: () => toast.error("Erro ao deletar post"),
  });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !(menuRef.current as any).contains(e.target as any)) {
        setShowMenu(false);
      }
    };
    (globalThis as any).document?.addEventListener("mousedown", handleClick);
    return () => (globalThis as any).document?.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setAvatarFailed(false);
  }, [post.user?.avatarUrl]);

  useEffect(() => {
    setImageFailed(false);
  }, [post.imageUrl]);

  const handleLike = () => {
    if (!user) {
      toast.error("Faça login para curtir posts");
      return;
    }
    if (toggleLikeMutation.isPending) return; // Apenas ignora cliques extras enquanto processa
    toggleLikeMutation.mutate({ postId: post.id });
  };

  const handleSave = () => {
    if (!user) {
      toast.error("Faça login para salvar posts");
      return;
    }
    // toggleBookmarkMutation.mutate({ postId: post.id }); // Descomentar quando o backend estiver pronto
    setIsBookmarked(!isBookmarked); // Apenas para feedback visual temporário
  };

  const handleDoubleClick = () => {
    if (!user || isLiked) return;
    handleLike();
  };

  const handleDelete = () => {
    if ((globalThis as any).confirm("Tem certeza que deseja deletar este post?")) {
      deletePostMutation.mutate({ id: post.id });
    }
    setShowMenu(false);
  };

  const handleCopyLink = () => {
    (globalThis as any).navigator?.clipboard?.writeText(`${(globalThis as any).location?.origin}/post/${post.id}`);
    toast.success("Link copiado!");
    setShowMenu(false);
  };

  const handleReport = () => {
    toast.info("Post reportado. Obrigado!");
    setShowMenu(false);
  };

  const username = post.user?.username ?? post.user?.name ?? "usuário";
  const avatarLetter = username[0]?.toUpperCase() ?? "?";

  return (
    <>
      <article className="card-base overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-3 py-3 flex items-center gap-3">
          <UserHoverCard username={post.user?.username ?? ""}>
            <button
              onClick={() => navigate(`/profile/${post.user?.username ?? post.userId}`)}
              className="shrink-0"
            >
              <div className="w-9 h-9 rounded-full ig-gradient p-0.5">
                <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                  {post.user?.avatarUrl && !avatarFailed ? (
                    <img
                      src={post.user.avatarUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={() => setAvatarFailed(true)}
                    />
                  ) : (
                    <span className="text-xs font-bold text-foreground">{avatarLetter}</span>
                  )}
                </div>
              </div>
            </button>
          </UserHoverCard>

          <div className="flex-1 min-w-0">
            <UserHoverCard username={post.user?.username ?? ""}>
              <button
                onClick={() => navigate(`/profile/${post.user?.username ?? post.userId}`)}
                className="font-semibold text-sm hover:underline text-left"
              >
                {username}
              </button>
            </UserHoverCard>
            <p className="text-xs text-muted-foreground">
              {new Date(post.createdAt).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "short",
              })}
            </p>
          </div>

          {/* Menu */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground"
            >
              <MoreHorizontal size={20} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in">
                {isOwner && (
                  <button
                    onClick={handleDelete}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-500/10 text-red-500 text-sm text-left transition-colors border-b border-border"
                  >
                    <Trash2 size={15} />
                    Deletar post
                  </button>
                )}
                <button
                  onClick={handleCopyLink}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted text-sm text-left transition-colors border-b border-border"
                >
                  <LinkIcon size={15} className="text-muted-foreground" />
                  Copiar link
                </button>
                {!isOwner && (
                  <button
                    onClick={handleReport}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-500/10 text-red-500 text-sm text-left transition-colors"
                  >
                    <Flag size={15} />
                    Denunciar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Image */}
        <div
          className="w-full bg-muted overflow-hidden relative cursor-pointer"
          style={{ aspectRatio: "4/5" }}
          onDoubleClick={handleDoubleClick}
          onClick={() => navigate(`/post/${post.id}`)}
        >
          {imageFailed ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageOff size={32} />
              <span className="text-sm font-medium">Imagem indisponível</span>
            </div>
          ) : (
            <img
              src={post.imageUrl}
              alt=""
              className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-500 ease-out"
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          )}
          {/* Double-tap heart animation */}
          {heartAnim && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Heart
                size={80}
                fill="white"
                className="text-white opacity-90 heart-beat drop-shadow-lg"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-3 pt-3 pb-1 flex items-center gap-3">
          <button
            onClick={handleLike}
            disabled={toggleLikeMutation.isPending}
            className={`transition-colors duration-200 hover:scale-110 ${
              isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-400"
            }`}
          >
            <Heart
              size={24}
              fill={isLiked ? "currentColor" : "none"}
              className={heartAnim ? "heart-beat" : ""}
            />
          </button>
          <button
            onClick={() => setShowComments(true)}
            className="text-muted-foreground hover:text-foreground transition-colors hover:scale-110"
          >
            <MessageCircle size={24} />
          </button>
          <button
            onClick={handleCopyLink}
            className="text-muted-foreground hover:text-foreground transition-colors hover:scale-110"
          >
            <Send size={24} />
          </button>
          <div className="flex-1" />
          <button 
            onClick={handleSave}
            className={`transition-all duration-200 hover:scale-110 ${isBookmarked ? "text-foreground" : "text-muted-foreground"}`}
          >
            <Bookmark size={24} fill={isBookmarked ? "currentColor" : "none"} />
          </button>
        </div>

        {/* Stats */}
        <div className="px-3 pb-1">
          <p className="text-sm font-semibold">
            {likesCount} {likesCount === 1 ? "curtida" : "curtidas"}
          </p>
        </div>

        {/* Caption */}
        {post.caption && (
          <div className="px-3 pb-2">
            <p className="text-sm">
              <button
                onClick={() => navigate(`/profile/${post.user?.username ?? post.userId}`)}
                className="font-semibold hover:underline mr-1"
              >
                {username}
              </button>
              <span className="text-foreground/80">
                {isCaptionExpanded || post.caption.length <= 100 
                  ? post.caption 
                  : `${post.caption.substring(0, 100)}... `}
              </span>
              {post.caption.length > 100 && !isCaptionExpanded && (
                <button
                  onClick={() => setIsCaptionExpanded(true)}
                  className="text-muted-foreground text-xs font-medium hover:text-foreground"
                >
                  mais
                </button>
              )}
            </p>
          </div>
        )}

        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="px-3 pb-2 flex flex-wrap gap-1">
            {post.hashtags.map((tag) => (
              <button
                key={tag}
                onClick={() => navigate(`/hashtag/${tag}`)}
                className="text-xs text-primary hover:underline font-medium"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Comments preview */}
        {commentsCount > 0 && (
          <button
            onClick={() => setShowComments(true)}
            className="px-3 pb-3 text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            Ver {commentsCount === 1 ? "1 comentário" : `todos os ${commentsCount} comentários`}
          </button>
        )}
      </article>

      <CommentsDrawer
        postId={post.id}
        open={showComments}
        onClose={() => setShowComments(false)}
        onCommentAdded={() => setCommentsCount((c) => c + 1)}
      />
    </>
  );
}
