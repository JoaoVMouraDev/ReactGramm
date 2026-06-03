import { trpc } from "@/lib/trpc";
import { Hash, Loader2, Search, User } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { MobileNav, Navbar } from "@/components/Navbar";

export default function Explore() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");

  const { data: userResults, isLoading: usersLoading } = trpc.users.search.useQuery(
    { query, limit: 10 },
    { enabled: query.length >= 1 }
  );

  // Derive hashtag results from recent posts
  const { data: hashtagPosts } = trpc.posts.byHashtag.useQuery(
    { hashtag: query, limit: 6, offset: 0 },
    { enabled: query.length >= 1 }
  );

  const hasResults =
    (userResults && userResults.length > 0) ||
    (hashtagPosts && hashtagPosts.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-20 sm:pb-6">
        <h1 className="font-bold text-2xl mb-4">Explorar</h1>

        {/* Search input */}
        <div className="relative mb-6">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Buscar usuários ou #hashtags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-muted rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            autoFocus
          />
        </div>

        {/* Results */}
        {query.length >= 1 ? (
          <div className="space-y-6">
            {/* Users */}
            {usersLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-primary" size={24} />
              </div>
            ) : userResults && userResults.length > 0 ? (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Usuários
                </h2>
                <div className="space-y-1">
                  {userResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => navigate(`/profile/${u.username}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left"
                    >
                      <div className="w-11 h-11 rounded-full ig-gradient p-[2px] shrink-0">
                        <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.username ?? ""}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-bold text-foreground">
                              {(u.username ?? u.name ?? "?")[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{u.username}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.name}</p>
                      </div>
                      <User size={16} className="text-muted-foreground ml-auto shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Hashtags */}
            {hashtagPosts && hashtagPosts.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Hashtags
                </h2>
                <button
                  onClick={() => navigate(`/hashtag/${query.replace(/^#/, "")}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left"
                >
                  <div className="w-11 h-11 rounded-full ig-gradient flex items-center justify-center shrink-0">
                    <Hash size={20} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">#{query.replace(/^#/, "")}</p>
                    <p className="text-xs text-muted-foreground">
                      {hashtagPosts.length}+ posts
                    </p>
                  </div>
                </button>
              </div>
            )}

            {!hasResults && !usersLoading && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">
                  Nenhum resultado para "{query}"
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full ig-gradient mx-auto flex items-center justify-center mb-4">
              <Search size={28} className="text-white" />
            </div>
            <p className="font-semibold text-base">Descubra pessoas e conteúdo</p>
            <p className="text-sm text-muted-foreground mt-1">
              Busque por usuários ou hashtags
            </p>
          </div>
        )}
      </main>

      <MobileNav />
    </div>
  );
}
