import { trpc } from "@/lib/trpc";
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface LikeListModalProps {
  postId: number;
  onClose: () => void;
}

export function LikeListModal({ postId, onClose }: LikeListModalProps) {
  const [, navigate] = useLocation();
  const [avatarFailures, setAvatarFailures] = useState<Set<number>>(() => new Set());

  const likesQuery = trpc.likes.usersByPost.useQuery({ postId });

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
          <h2 className="font-semibold">Curtidas</h2>
          <button
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-40 overflow-y-auto p-3">
          {likesQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : !likesQuery.data?.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Ainda não tem curtidas
            </p>
          ) : (
            <div className="space-y-1">
              {likesQuery.data.map((person) => {
                const displayName = person.username ?? person.name ?? "usuário";
                return (
                  <button
                    key={person.id}
                    onClick={() => openProfile(person.username, person.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/60"
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
                          <span className="text-sm font-bold">
                            {displayName[0]?.toUpperCase()}
                          </span>
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
