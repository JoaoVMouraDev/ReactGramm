import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Heart, Loader2, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { MentionText } from "./MentionText";
import { MentionTextarea } from "./MentionTextarea";

interface CommentsDrawerProps {
  postId: number;
  open: boolean;
  onClose: () => void;
  onCommentAdded?: () => void;
}

type CommentItem = {
  id: number;
  postId: number;
  userId: number;
  parentCommentId?: number | null;
  text: string;
  likesCount?: number;
  isLiked?: boolean;
  createdAt: Date | string;
  user?: {
    id: number;
    username?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
  };
};

const QUICK_REACTIONS = ["❤️", "🙌", "🔥", "👏", "🥲", "😍", "😮", "😂"];

type MobileViewport = {
  height: number;
  top: number;
};

function getDisplayName(comment: CommentItem) {
  return comment.user?.username ?? comment.user?.name ?? "usuário";
}

export function CommentsDrawer({
  postId,
  open,
  onClose,
  onCommentAdded,
}: CommentsDrawerProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [mobileViewport, setMobileViewport] = useState<MobileViewport | null>(null);
  const utils = trpc.useUtils();

  const { data: comments, isLoading } = trpc.comments.getByPost.useQuery(
    { postId, limit: 50, offset: 0 },
    { enabled: open && !!postId },
  );

  const createMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setText("");
      setReplyTo(null);
      utils.comments.getByPost.invalidate();
      onCommentAdded?.();
    },
    onError: (err) => {
      if (err.data?.code === "UNAUTHORIZED") {
        toast.error("Sua sessão expirou. Por favor, faça login novamente.");
        navigate("/login");
      } else {
        toast.error(err.message || "Erro ao comentar");
      }
    },
  });

  const toggleLikeMutation = trpc.comments.toggleLike.useMutation({
    onSuccess: () => {
      utils.comments.getByPost.invalidate({ postId, limit: 50, offset: 0 });
    },
    onError: (err) => {
      if (err.data?.code === "UNAUTHORIZED") {
        toast.error("Faça login para curtir comentários");
        navigate("/login");
      } else {
        toast.error(err.message || "Erro ao curtir comentário");
      }
    },
  });

  const { rootComments, repliesByParent } = useMemo(() => {
    const replies = new Map<number, CommentItem[]>();
    const roots: CommentItem[] = [];

    for (const comment of (comments ?? []) as CommentItem[]) {
      if (comment.parentCommentId) {
        const current = replies.get(comment.parentCommentId) ?? [];
        current.push(comment);
        replies.set(comment.parentCommentId, current);
      } else {
        roots.push(comment);
      }
    }

    return { rootComments: roots, repliesByParent: replies };
  }, [comments]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      document.body.classList.add("comments-drawer-open");
      window.dispatchEvent(
        new CustomEvent("commentsdrawerchange", { detail: { open: true } }),
      );
    } else {
      document.body.style.overflow = "";
      document.body.classList.remove("comments-drawer-open");
      window.dispatchEvent(
        new CustomEvent("commentsdrawerchange", { detail: { open: false } }),
      );
    }
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("comments-drawer-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setMobileViewport(null);
      return;
    }

    const viewport = window.visualViewport;
    const mobileQuery = window.matchMedia("(max-width: 639px)");

    const updateViewport = () => {
      if (!viewport || !mobileQuery.matches) {
        setMobileViewport(null);
        return;
      }

      setMobileViewport({
        height: Math.round(viewport.height),
        top: Math.round(viewport.offsetTop),
      });
    };

    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);

    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, [open]);

  const handleSubmit = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!text.trim()) return;
    createMutation.mutate({
      postId,
      text: text.trim(),
      parentCommentId: replyTo?.id,
    });
  };

  const handleReply = (comment: CommentItem) => {
    if (!user) {
      navigate("/login");
      return;
    }

    const username = getDisplayName(comment);
    setReplyTo(comment);
    setText((current) => {
      const mention = `@${username} `;
      return current.trim() ? current : mention;
    });
  };

  const handleLikeComment = (commentId: number) => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (toggleLikeMutation.isPending) return;
    toggleLikeMutation.mutate({ commentId });
  };

  const goToProfile = (comment: CommentItem) => {
    navigate(`/profile/${comment.user?.username ?? comment.userId}`);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex h-[100dvh] items-end justify-center sm:inset-0 sm:h-auto sm:items-center"
      style={
        mobileViewport
          ? {
              bottom: "auto",
              height: `${mobileViewport.height}px`,
              top: `${mobileViewport.top}px`,
            }
          : undefined
      }
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative flex h-[92%] max-h-[calc(100%_-_0.5rem)] w-full flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl animate-fade-in sm:h-auto sm:max-h-[85vh] sm:w-[min(92vw,42rem)] sm:rounded-2xl">
        <div className="relative border-b border-border px-4 pb-3 pt-5 sm:px-5 sm:pt-3">
          <span className="absolute left-1/2 top-2 h-1 w-12 -translate-x-1/2 rounded-full bg-muted-foreground/60 sm:hidden" />
          <h3 className="text-center text-base font-semibold">Comentários</h3>
          <button
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted sm:right-5"
            aria-label="Fechar comentários"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
            </div>
          ) : rootComments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">Nenhum comentário ainda.</p>
              <p className="text-muted-foreground text-xs mt-1">Seja o primeiro a comentar!</p>
            </div>
          ) : (
            rootComments.map((comment) => {
              const username = getDisplayName(comment);
              const replies = repliesByParent.get(comment.id) ?? [];

              return (
                <div key={comment.id} className="space-y-2">
                  <div className="flex gap-3">
                    <button onClick={() => goToProfile(comment)} className="shrink-0">
                      <div className="w-8 h-8 rounded-full ig-gradient p-0.5">
                        <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                          {comment.user?.avatarUrl ? (
                            <img
                              src={comment.user.avatarUrl}
                              alt={username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold text-foreground">
                              {username[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="pr-2 text-sm leading-5">
                        <p className="wrap-break-word">
                          <button
                            onClick={() => goToProfile(comment)}
                            className="mr-1 font-semibold hover:underline"
                          >
                            {username}
                          </button>
                          <MentionText text={comment.text} onMentionClick={onClose} />
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 px-1 flex items-center gap-3">
                        <span>{new Date(comment.createdAt).toLocaleDateString("pt-BR")}</span>
                        <button
                          onClick={() => handleReply(comment)}
                          className="font-semibold hover:text-foreground"
                        >
                          Responder
                        </button>
                        <button
                          onClick={() => handleLikeComment(comment.id)}
                          className={`inline-flex items-center gap-1 font-semibold hover:text-foreground ${
                            comment.isLiked ? "text-red-500" : ""
                          }`}
                        >
                          <Heart size={12} fill={comment.isLiked ? "currentColor" : "none"} />
                          {(comment.likesCount ?? 0) > 0 ? comment.likesCount : "Curtir"}
                        </button>
                      </p>
                    </div>
                  </div>

                  {replies.length > 0 && (
                    <div className="ml-11 space-y-2 border-l border-border pl-3">
                      {replies.map((reply) => {
                        const replyName = getDisplayName(reply);

                        return (
                          <div key={reply.id} className="flex gap-2">
                            <button onClick={() => goToProfile(reply)} className="shrink-0">
                              <div className="w-6 h-6 rounded-full ig-gradient p-0.5">
                                <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                                  {reply.user?.avatarUrl ? (
                                    <img
                                      src={reply.user.avatarUrl}
                                      alt={replyName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[10px] font-bold text-foreground">
                                      {replyName[0]?.toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="pr-2 text-sm leading-5">
                                <p className="wrap-break-word">
                                  <button
                                    onClick={() => goToProfile(reply)}
                                    className="mr-1 font-semibold hover:underline"
                                  >
                                    {replyName}
                                  </button>
                                  <MentionText text={reply.text} onMentionClick={onClose} />
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 px-1 flex items-center gap-3">
                                <span>{new Date(reply.createdAt).toLocaleDateString("pt-BR")}</span>
                                <button
                                  onClick={() => handleReply(comment)}
                                  className="font-semibold hover:text-foreground"
                                >
                                  Responder
                                </button>
                                <button
                                  onClick={() => handleLikeComment(reply.id)}
                                  className={`inline-flex items-center gap-1 font-semibold hover:text-foreground ${
                                    reply.isLiked ? "text-red-500" : ""
                                  }`}
                                >
                                  <Heart size={12} fill={reply.isLiked ? "currentColor" : "none"} />
                                  {(reply.likesCount ?? 0) > 0 ? reply.likesCount : "Curtir"}
                                </button>
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-card px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 sm:px-5 sm:pb-4 sm:pt-3">
          {user ? (
            <div className="space-y-2">
              {replyTo && (
                <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <span>Respondendo @{getDisplayName(replyTo)}</span>
                  <button
                    onClick={() => {
                      setReplyTo(null);
                      setText("");
                    }}
                    className="font-semibold hover:text-foreground"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 overflow-x-auto py-1 sm:hidden">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setText((current) => `${current}${emoji}`)}
                    className="shrink-0 rounded-full p-1 text-2xl leading-none transition-transform active:scale-90"
                    aria-label={`Adicionar ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 items-center">
                <div className="w-8 h-8 rounded-full ig-gradient p-0.5 shrink-0">
                  <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-foreground">
                        {(user.username ?? user.name ?? "?")[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <MentionTextarea
                  placeholder={replyTo ? "Escreva uma resposta..." : "Adicione um comentário..."}
                  value={text}
                  onChange={setText}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSubmit();
                    }
                  }}
                  rows={1}
                  className="min-h-10 max-h-24 flex-1 resize-none rounded-2xl border border-border bg-muted/60 px-4 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/30"
                  disabled={createMutation.isPending}
                  autoFocus
                />
                <button
                  onClick={handleSubmit}
                  disabled={!text.trim() || createMutation.isPending}
                  className="p-2 rounded-full ig-gradient text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  {createMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="w-full text-center text-sm text-primary font-medium py-2 hover:underline"
            >
              Faça login para comentar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
