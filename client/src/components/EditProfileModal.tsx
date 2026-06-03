import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Camera, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface EditProfileModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export function EditProfileModal({ onClose, onSaved }: EditProfileModalProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadAvatarMutation = trpc.upload.avatar.useMutation();
  const updateProfileMutation = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.success("Perfil atualizado!");
      onSaved();
    },
    onError: (err) => {
      toast.error(err.message ?? "Erro ao atualizar perfil");
    },
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (username && username.length < 3) {
      toast.error("Username deve ter pelo menos 3 caracteres");
      return;
    }
    if (username && !/^[a-zA-Z0-9_.]+$/.test(username)) {
      toast.error("Username só pode conter letras, números, _ e .");
      return;
    }

    setUploading(true);
    try {
      let avatarUrl: string | undefined;
      let avatarKey: string | undefined;

      if (avatarFile) {
        const base64 = await fileToBase64(avatarFile);
        const result = await uploadAvatarMutation.mutateAsync({
          filename: avatarFile.name,
          contentType: avatarFile.type,
          base64,
        });
        avatarUrl = result.url;
        avatarKey = result.key;
      }

      await updateProfileMutation.mutateAsync({
        username: username || undefined,
        bio: bio || undefined,
        avatarUrl,
        avatarKey,
      });
    } finally {
      setUploading(false);
    }
  };

  const avatarLetter = (username || user?.name || "?")[0]?.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base">Editar perfil</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-20 h-20 rounded-full ig-gradient p-[2px]">
                <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-foreground">{avatarLetter}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full ig-gradient text-white flex items-center justify-center hover:opacity-90 transition-opacity shadow-md"
              >
                <Camera size={13} />
              </button>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-sm text-primary font-medium hover:underline"
            >
              Alterar foto de perfil
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome de usuário</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                placeholder="seu_usuario"
                maxLength={30}
                className="w-full pl-7 pr-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Apenas letras, números, _ e . Mín. 3 caracteres.
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Fale um pouco sobre você..."
              maxLength={150}
              rows={3}
              className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{bio.length}/150</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={uploading || updateProfileMutation.isPending}
            className="flex-1 py-2.5 rounded-xl ig-gradient text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {(uploading || updateProfileMutation.isPending) ? (
              <Loader2 size={16} className="animate-spin" />
            ) : null}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
