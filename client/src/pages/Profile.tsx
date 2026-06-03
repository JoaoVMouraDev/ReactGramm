import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  Camera,
  Grid3X3,
  Loader2,
  Settings, // Added navigate import
  UserCheck,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { useParams } from "wouter";
import { MobileNav, Navbar } from "@/components/Navbar";
import { PostCard } from "@/components/PostCard";
import { EditProfileModal } from "@/components/EditProfileModal";
import { toast } from "sonner";
import { useLocation } from "wouter"; // Import useLocation

export default function Profile() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const { user: currentUser } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedPost, setSelectedPost] = useState<number | null>(null);
  const [, navigate] = useLocation(); // Initialize navigate
  const utils = trpc.useUtils();

  // Determinar se username é um número (ID) ou um username string
  const isNumericId = /^\d+$/.test(username ?? "");
  const numericId = isNumericId ? parseInt(username ?? "0") : null;

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } =
    isNumericId
      ? trpc.users.getProfileById.useQuery(
          { id: numericId ?? 0 },
          { enabled: !!numericId }
        )
      : trpc.users.getProfile.useQuery(
          { username: username ?? "" },
          { enabled: !!username }
        );

  const { data: userPosts, isLoading: postsLoading, refetch: refetchPosts } =
    trpc.posts.byUser.useQuery(
      { userId: profile?.id ?? 0, limit: 30, offset: 0 },
      { enabled: !!profile?.id }
    );

  const toggleFollowMutation = trpc.follows.toggle.useMutation({
    onSuccess: () => {
      refetchProfile();
    },
    onError: (err) => {
      if (err.data?.code === "UNAUTHORIZED") {
        toast.error("Sua sessão expirou. Por favor, faça login novamente.");
        navigate("/login");
      } else toast.error("Erro ao seguir usuário");
    },
  });

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
        <MobileNav />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-lg font-semibold">Usuário não encontrado</p>
          <p className="text-sm text-muted-foreground">@{username}</p>
        </div>
        <MobileNav />
      </div>
    );
  }

  const avatarLetter = (profile.username ?? profile.name ?? "?")[0]?.toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-20 sm:pb-6">
        {/* Profile header */}
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 mb-8">
          {/* Avatar */}
          <div className="flex justify-center sm:justify-start">
            <div className="relative">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full ig-gradient p-0.75">
                <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.username ?? ""}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl sm:text-4xl font-bold text-foreground">
                      {avatarLetter}
                    </span>
                  )}
                </div>
              </div>
              {profile.isOwner && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity shadow-md"
                >
                  <Camera size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <h1 className="text-xl font-semibold">
                {profile.username ?? profile.name ?? "Usuário"}
              </h1>
              {profile.isOwner ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors"
                  >
                    <Settings size={14} />
                    Editar perfil
                  </button>
                </div>
              ) : currentUser ? (
                <button
                  onClick={() => toggleFollowMutation.mutate({ userId: profile.id })}
                  disabled={toggleFollowMutation.isPending}
                  className={`flex items-center gap-2 px-5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    profile.isFollowing
                      ? "border border-border hover:bg-muted"
                      : "ig-gradient text-white hover:opacity-90"
                  }`}
                >
                  {toggleFollowMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : profile.isFollowing ? (
                    <>
                      <UserCheck size={14} />
                      Seguindo
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} />
                      Seguir
                    </>
                  )}
                </button>
              ) : (
                <button // Changed to use navigate for better SPA experience
                  onClick={() => navigate("/login")}
                  className="flex items-center gap-2 px-5 py-1.5 rounded-lg text-sm font-semibold ig-gradient text-white hover:opacity-90 transition-opacity"
                >
                  <UserPlus size={14} />
                  Seguir
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-6 mb-4">
              <div className="text-center sm:text-left">
                <span className="font-bold text-base">{profile.postsCount}</span>
                <span className="text-sm text-muted-foreground ml-1">posts</span>
              </div>
              <div className="text-center sm:text-left">
                <span className="font-bold text-base">{profile.followersCount}</span>
                <span className="text-sm text-muted-foreground ml-1">seguidores</span>
              </div>
              <div className="text-center sm:text-left">
                <span className="font-bold text-base">{profile.followingCount}</span>
                <span className="text-sm text-muted-foreground ml-1">seguindo</span>
              </div>
            </div>

            {/* Bio */}
            <div>
              {profile.name && (
                <p className="font-semibold text-sm">{profile.name}</p>
              )}
              {profile.bio && (
                <p className="text-sm text-foreground/80 whitespace-pre-line mt-0.5">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Posts grid/list toggle */}
        <div className="border-t border-border">
          <div className="flex justify-center gap-8 -mt-px">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider border-t-2 transition-colors ${
                viewMode === "grid"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Grid3X3 size={14} />
              Posts
            </button>
          </div>
        </div>

        {/* Posts */}
        {postsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : !userPosts || userPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full border-2 border-border flex items-center justify-center">
              <Camera size={28} className="text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold">Nenhum post ainda</p>
              {profile.isOwner && (
                <p className="text-sm text-muted-foreground mt-1">
                  Compartilhe sua primeira foto!
                </p>
              )}
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-3 gap-0.5 mt-1">
            {userPosts.map((post: any) => (
              <button
                key={post.id}
                onClick={() => setSelectedPost(selectedPost === post.id ? null : post.id)}
                className="aspect-square overflow-hidden bg-muted relative group"
              >
                <img
                  src={post.imageUrl}
                  alt={post.caption ?? ""}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-3 text-white text-sm font-semibold">
                    <span>❤️ {post.likesCount}</span>
                    <span>💬 {post.commentsCount}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {userPosts.map((post: any) => (
              <PostCard
                key={post.id}
                post={{ ...post, user: { id: profile.id, username: profile.username, name: profile.name, avatarUrl: profile.avatarUrl } }}
                onDeleted={() => { refetchPosts(); refetchProfile(); }}
              />
            ))}
          </div>
        )}
      </main>

      {showEditModal && (
        <EditProfileModal
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            refetchProfile();
          }}
        />
      )}

      <MobileNav />
    </div>
  );
}
