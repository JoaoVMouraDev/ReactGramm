import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Loader2, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
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

export function CommentsDrawer({
  postId,
  open,
  onClose,
  onCommentAdded,
}: CommentsDrawerProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const utils = trpc.useUtils();

  const { data: comments, isLoading } = trpc.comments.getByPost.useQuery(
    { postId, limit: 50, offset: 0 },
    { enabled: open && !!postId }
  );

  const createMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setText("");
      utils.comments.getByPost.invalidate();
      onCommentAdded?.();
    },
    onError: (err) => {
      if (err.data?.code === "UNAUTHORIZED") {
        toast.error("Sua sessão expirou. Por favor, faça login novamente.");
        navigate("/login");
      } else toast.error("Erro ao comentar");
    },
  });

  useEffect(() => {
    if (open) {
      (globalThis as any).document?.body?.style && ((globalThis as any).document.body.style.overflow = "hidden");
    } else {
      (globalThis as any).document?.body?.style && ((globalThis as any).document.body.style.overflow = "");
    }
    return () => {
      (globalThis as any).document?.body?.style && ((globalThis as any).document.body.style.overflow = "");
    };
  }, [open]);

  const handleSubmit = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!text.trim()) return;
    createMutation.mutate({ postId, text: text.trim() });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="font-semibold text-base">Comentários</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground"
          >
            <X size={20} />
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
            </div>
          ) : !comments || comments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">Nenhum comentário ainda.</p>
              <p className="text-muted-foreground text-xs mt-1">Seja o primeiro a comentar!</p>
            </div>
          ) : (
            comments.map((comment: any) => {
              const uname = comment.user?.username ?? comment.user?.name ?? "usuário";
              return (
                <div key={comment.id} className="flex gap-3">
                  <button
                    onClick={() => {
                      navigate(`/profile/${comment.user?.username ?? comment.userId}`);
                      onClose();
                    }}
                    className="shrink-0"
                  >
                    <div className="w-8 h-8 rounded-full ig-gradient p-0.5">
                      <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                        {comment.user?.avatarUrl ? (
                          <img
                            src={comment.user.avatarUrl}
                            alt={uname}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-foreground">
                            {uname[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="bg-muted rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold mb-0.5">{uname}</p>
                      <p className="text-sm wrap-break-word">
                        <MentionText text={comment.text} onMentionClick={onClose} />
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 px-1">
                      {new Date(comment.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          {user ? (
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
                placeholder="Adicione um comentário..."
                value={text}
                onChange={setText}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                rows={1}
                className="flex-1 bg-muted rounded-2xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none min-h-10 max-h-24"
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
