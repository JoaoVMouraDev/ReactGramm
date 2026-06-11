import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface FollowListModalProps {
  userId: number;
  type: "followers" | "following";
  onClose: () => void;
  onChanged: () => void;
}

export function FollowListModal({ userId, type, onClose, onChanged }: FollowListModalProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [avatarFailures, setAvatarFailures] = useState<Set<number>>(() => new Set());

  const followersQuery = trpc.follows.followers.useQuery(
    { userId },
    { enabled: type === "followers" },
  );
  const followingQuery = trpc.follows.following.useQuery(
    { userId },
    { enabled: type === "following" },
  );
  const query = type === "followers" ? followersQuery : followingQuery;

  const toggleMutation = trpc.follows.toggle.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.follows.followers.invalidate({ userId }),
        utils.follows.following.invalidate({ userId }),
      ]);
      onChanged();
    },
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const openProfile = (username: string | null, id: number) => {
    onClose();
    navigate(`/profile/${username ?? id}`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        aria-label="Fechar"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex max-h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">{type === "followers" ? "Seguidores" : "Seguindo"}</h2>
          <button
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-40 overflow-y-auto p-3">
          {query.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : !query.data?.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {type === "followers" ? "Nenhum seguidor ainda" : "Não segue ninguém ainda"}
            </p>
          ) : (
            <div className="space-y-1">
              {query.data.map((person) => {
                const displayName = person.username ?? person.name ?? "usuário";
                return (
                  <div key={person.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
                    <button
                      onClick={() => openProfile(person.username, person.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="h-11 w-11 shrink-0 rounded-full ig-gradient p-0.5">
                        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-card">
                          {person.avatarUrl && !avatarFailures.has(person.id) ? (
                            <img
                              src={person.avatarUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={() =>
                                setAvatarFailures((current) => new Set(current).add(person.id))
                              }
                            />
                          ) : (
                            <span className="text-sm font-bold">{displayName[0]?.toUpperCase()}</span>
                          )}
                        </div>
                      </div>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{displayName}</span>
                        {person.name && person.name !== person.username ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {person.name}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {user && !person.isCurrentUser ? (
                      <button
                        onClick={() => toggleMutation.mutate({ userId: person.id })}
                        disabled={toggleMutation.isPending}
                        className={
                          person.isFollowing
                            ? "rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                            : "rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                        }
                      >
                        {person.isFollowing ? "Seguindo" : "Seguir"}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
