import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { UserCheck, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface UserHoverCardProps {
  username: string;
  children: React.ReactNode;
}

export function UserHoverCard({ username, children }: UserHoverCardProps) {
  const [, navigate] = useLocation();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user: currentUser } = useAuth();
  const [show, setShow] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeoutRef = useRef<any>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: profile, isLoading } = trpc.users.getHoverCard.useQuery(
    { username },
    { enabled: show && !!username }
  );

  const toggleFollowMutation = trpc.follows.toggle.useMutation({
    onSuccess: () => {
      utils.users.getHoverCard.invalidate({ username });
    },
    onError: () => toast.error("Erro ao seguir usuário"),
  });

  const handleMouseEnter = () => {
    timeoutRef.current = window.setTimeout(() => setShow(true), 500);
  };

  const handleMouseLeave = () => {
    window.clearTimeout(timeoutRef.current);
    setShow(false);
  };

  useEffect(() => {
    return () => window.clearTimeout(timeoutRef.current);
  }, []);

  // Don't show for current user or empty username
  if (!username || currentUser?.username === username) {
    return <>{children}</>;
  }

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-block"
    >
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div
            className="pointer-events-auto bg-card border border-border rounded-2xl shadow-2xl p-4 w-72 animate-fade-in"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {isLoading || !profile ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Avatar + Follow */}
                <div className="flex items-start justify-between gap-3">
                  <div className="w-14 h-14 rounded-full ig-gradient p-[2px]">
                    <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                      {profile.avatarUrl ? (
                        <img
                          src={profile.avatarUrl}
                          alt={profile.username ?? ""}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold text-foreground">
                          {(profile.username ?? profile.name ?? "?")[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  {currentUser && (
                    <button
                      onClick={() => toggleFollowMutation.mutate({ userId: profile.id })}
                      disabled={toggleFollowMutation.isPending}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        profile.isFollowing
                          ? "bg-muted text-foreground hover:bg-muted/80"
                          : "ig-gradient text-white hover:opacity-90"
                      }`}
                    >
                      {profile.isFollowing ? (
                        <>
                          <UserCheck size={13} />
                          Seguindo
                        </>
                      ) : (
                        <>
                          <UserPlus size={13} />
                          {profile.isFollowedBy ? "Seguir de volta" : "Seguir"}
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Name + username */}
                <div>
                  <button
                    onClick={() => {
                      navigate(`/profile/${profile.username}`);
                      setShow(false);
                    }}
                    className="font-semibold text-sm hover:underline text-left"
                  >
                    {profile.name ?? profile.username}
                  </button>
                  <p className="text-xs text-muted-foreground">@{profile.username}</p>
                </div>

                {/* Bio */}
                {profile.bio && (
                  <p className="text-xs text-foreground/80 line-clamp-2">{profile.bio}</p>
                )}

                {/* Stats */}
                <div className="flex gap-3 pt-2 border-t border-border text-xs">
                  <div className="text-center flex-1">
                    <p className="font-bold text-foreground">{profile.postsCount}</p>
                    <p className="text-muted-foreground">Posts</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="font-bold text-foreground">{profile.followersCount}</p>
                    <p className="text-muted-foreground">Seguidores</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="font-bold text-foreground">{profile.followingCount}</p>
                    <p className="text-muted-foreground">Seguindo</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    navigate(`/profile/${profile.username}`);
                    setShow(false);
                  }}
                  className="w-full py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Ver perfil
                </button>
              </div>
            )}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -translate-y-px pointer-events-none">
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-card" />
          </div>
        </div>
      )}
    </div>
  );
}
