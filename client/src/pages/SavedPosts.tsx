import { useAuth } from "@/_core/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";
import { PostCard } from "@/components/PostCard";
import { trpc } from "@/lib/trpc";
import { Bookmark, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function SavedPosts() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const {
    data: posts = [],
    isLoading,
    isError,
    refetch,
  } = trpc.bookmarks.list.useQuery(undefined, { enabled: isAuthenticated });

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-lg px-0 py-5 pb-20 sm:px-4 sm:pb-6">
          <h1 className="mb-5 px-4 text-xl font-semibold sm:px-0">
            Posts salvos
          </h1>

          {isLoading || loading ? (
            <div className="space-y-4">
              {[0, 1].map(item => (
                <div
                  key={item}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <div className="h-16 animate-pulse bg-muted" />
                  <div className="aspect-square animate-pulse bg-muted/70" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 px-4 py-20 text-center">
              <p className="font-semibold">
                Não foi possível carregar seus posts salvos
              </p>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                <RefreshCw size={16} />
                Tentar novamente
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-20 text-center">
              <Bookmark size={42} className="text-muted-foreground" />
              <p className="font-semibold">Você ainda não salvou nenhum post</p>
              <button
                onClick={() => navigate("/")}
                className="text-sm text-primary hover:underline"
              >
                Voltar ao feed
              </button>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {posts.map(post => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </main>
      </div>
    </PageTransition>
  );
}
