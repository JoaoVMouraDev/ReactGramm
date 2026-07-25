import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { ArrowLeft, Hash, ImagePlus, Loader2, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { MentionTextarea } from "@/components/MentionTextarea";

export default function UploadPost() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const uploadImageMutation = trpc.upload.image.useMutation();
  const createPostMutation = trpc.posts.create.useMutation({
    onSuccess: () => {
      utils.posts.feed.invalidate();
      toast.success("Post publicado!");
      navigate("/");
    },
    onError: err => {
      if (err.data?.code === "UNAUTHORIZED") {
        toast.error("Sua sessão expirou. Por favor, faça login novamente.");
        navigate("/login");
      } else toast.error("Erro ao publicar post");
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="font-semibold text-lg">Faça login para publicar</p>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-2.5 rounded-xl ig-gradient text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (mediaFiles.length + files.length > 10) {
      toast.error("Selecione no máximo 10 mídias");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (files.some(file => !allowedTypes.includes(file.type))) {
      toast.error("Use apenas JPG, PNG, WEBP ou GIF");
      return;
    }
    if (files.some(file => file.size > 10 * 1024 * 1024)) {
      toast.error("Cada mídia pode ter no máximo 10MB");
      return;
    }
    setMediaFiles(current => [...current, ...files]);
    setMediaPreviews(current => [
      ...current,
      ...files.map(file => URL.createObjectURL(file)),
    ]);
    e.target.value = "";
  };

  const handleAddHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "").toLowerCase();
    if (!tag) return;
    if (hashtags.includes(tag)) {
      toast.error("Hashtag já adicionada");
      return;
    }
    if (hashtags.length >= 10) {
      toast.error("Máximo 10 hashtags");
      return;
    }
    setHashtags([...hashtags, tag]);
    setHashtagInput("");
  };

  const handleRemoveHashtag = (tag: string) => {
    setHashtags(hashtags.filter(h => h !== tag));
  };

  const handleSubmit = async () => {
    if (!mediaFiles.length) {
      toast.error("Selecione ao menos uma mídia");
      return;
    }
    setUploading(true);
    try {
      const uploaded = [];
      for (let position = 0; position < mediaFiles.length; position += 1) {
        const file = mediaFiles[position];
        const base64 = await fileToBase64(file);
        const result = await uploadImageMutation.mutateAsync({
          filename: file.name,
          contentType: file.type as
            | "image/jpeg"
            | "image/png"
            | "image/webp"
            | "image/gif",
          base64,
        });
        uploaded.push({
          ...result,
          type:
            file.type === "image/gif" ? ("gif" as const) : ("image" as const),
          position,
        });
      }
      const first = uploaded[0];
      await createPostMutation.mutateAsync({
        imageUrl: first.url,
        imageKey: first.key,
        media: uploaded,
        caption: caption.trim() || undefined,
        hashtags: hashtags.length > 0 ? hashtags : undefined,
      });
    } catch (err: any) {
      console.error("[Upload] Falha ao publicar:", err);
      toast.error(err.message || "Erro ao publicar post");
    } finally {
      setUploading(false);
    }
  };

  const isLoading =
    uploading || uploadImageMutation.isPending || createPostMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-lg mx-auto px-4 py-6 pb-20 sm:pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-semibold text-lg">Novo post</h1>
        </div>

        {/* Image picker */}
        {mediaPreviews.length === 0 ? (
          <button
            onClick={() => (fileRef.current as any)?.click()}
            className="w-full aspect-square border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <div className="w-16 h-16 rounded-full ig-gradient flex items-center justify-center group-hover:scale-105 transition-transform">
              <ImagePlus size={28} className="text-white" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-base">Adicionar fotos ou GIFs</p>
              <p className="text-sm text-muted-foreground mt-1">
                Selecione até 10 mídias
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                JPG, PNG, WEBP ou GIF • Máx. 10MB cada
              </p>
            </div>
          </button>
        ) : (
          <div className="relative mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-muted p-2">
            {mediaPreviews.map((preview, index) => (
              <img
                key={preview}
                src={preview}
                alt={`Preview ${index + 1}`}
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
            {mediaFiles.length < 10 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Adicionar mais fotos ou GIFs"
                className="aspect-square w-full rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
              >
                <Plus size={28} />
              </button>
            )}
            <button
              onClick={() => {
                mediaPreviews.forEach(URL.revokeObjectURL);
                setMediaPreviews([]);
                setMediaFiles([]);
                if (fileRef.current) (fileRef.current as any).value = "";
              }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Caption */}
        <div className="mt-4 space-y-1.5">
          <label className="text-sm font-medium">Legenda</label>
          <MentionTextarea
            value={caption}
            onChange={setCaption}
            placeholder="Escreva uma legenda..."
            maxLength={2200}
            rows={4}
            className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">
            {caption.length}/2200
          </p>
        </div>

        {/* Hashtags */}
        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium">Hashtags</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Hash
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={hashtagInput}
                onChange={e =>
                  setHashtagInput(
                    (e.target as any).value.replace(/[^a-zA-Z0-9_]/g, "")
                  )
                }
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleAddHashtag();
                  }
                }}
                placeholder="adicionar hashtag"
                className="w-full pl-8 pr-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
            <button
              onClick={handleAddHashtag}
              disabled={!hashtagInput.trim()}
              className="px-4 py-2.5 rounded-xl ig-gradient text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              Adicionar
            </button>
          </div>
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {hashtags.map(tag => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                >
                  #{tag}
                  <button
                    onClick={() => handleRemoveHashtag(tag)}
                    className="hover:text-red-500 transition-colors ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!mediaFiles.length || isLoading}
          className="w-full mt-6 py-3 rounded-xl ig-gradient text-white font-semibold text-base disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Publicando...
            </>
          ) : (
            "Publicar"
          )}
        </button>
      </main>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new (globalThis as any).FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
