import { trpc } from "@/lib/trpc";
import { Hash, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface EditPostModalProps {
  post: {
    id: number;
    caption?: string | null;
    hashtags?: string[];
  };
  onClose: () => void;
  onSaved: () => void;
}

export function EditPostModal({ post, onClose, onSaved }: EditPostModalProps) {
  const [caption, setCaption] = useState(post.caption ?? "");
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState(post.hashtags ?? []);

  const updateMutation = trpc.posts.update.useMutation({
    onSuccess: () => {
      toast.success("Post atualizado");
      onSaved();
    },
    onError: (error) => toast.error(error.message || "Erro ao atualizar post"),
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "").toLowerCase();
    if (!tag || hashtags.includes(tag)) return;
    if (hashtags.length >= 10) {
      toast.error("Máximo de 10 hashtags");
      return;
    }
    setHashtags((current) => [...current, tag]);
    setHashtagInput("");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        aria-label="Fechar"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">Editar post</h2>
          <button
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Legenda</label>
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              maxLength={2200}
              rows={5}
              className="w-full resize-none rounded-lg bg-muted px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-right text-xs text-muted-foreground">{caption.length}/2200</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Hashtags</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={hashtagInput}
                  onChange={(event) =>
                    setHashtagInput(event.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      addHashtag();
                    }
                  }}
                  placeholder="adicionar hashtag"
                  className="w-full rounded-lg bg-muted py-2.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <button
                onClick={addHashtag}
                disabled={!hashtagInput.trim()}
                className="rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                Adicionar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  #{tag}
                  <button
                    aria-label={`Remover ${tag}`}
                    onClick={() => setHashtags((current) => current.filter((item) => item !== tag))}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={() => updateMutation.mutate({ id: post.id, caption, hashtags })}
            disabled={updateMutation.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
