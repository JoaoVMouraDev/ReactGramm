import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Loader2, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/Navbar";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const LIMIT = 10;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      // O erro "Cannot find name 'window'" pode ser resolvido adicionando "dom"
      // à lista "lib" no seu tsconfig.json, por exemplo:
      // "lib": ["dom", "es2020"]
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);

  const {
    data: posts = [],
    isLoading,
    isError,
    refetch,
  } = trpc.posts.feed.useQuery(
    { limit: LIMIT, offset: 0 },
    { refetchOnWindowFocus: false }
  );

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="max-w-lg mx-auto px-0 sm:px-4 py-4 pb-20 sm:pb-4">
        {/* Feed */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="animate-spin text-primary" size={32} />
            <p className="text-sm text-muted-foreground">Carregando feed...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 px-4 text-center">
            <p className="font-semibold text-lg">Não foi possível carregar o feed</p>
            <p className="text-sm text-muted-foreground">
              Tente novamente em alguns instantes.
            </p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw size={16} />
              Tentar novamente
            </Button>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 px-4">
            <div className="w-20 h-20 rounded-full ig-gradient flex items-center justify-center">
              <span className="text-3xl">📸</span>
            </div>
            <div className="text-center">
              <h2 className="font-semibold text-lg mb-1">Nenhum post ainda</h2>
              <p className="text-sm text-muted-foreground">
                {user
                  ? "Seja o primeiro a compartilhar uma foto!"
                  : "Faça login para ver o feed e interagir com posts."}
              </p>
            </div>
            {!user ? (
              <Button
                onClick={() => ((globalThis as any).location.href = getLoginUrl())}
                className="ig-gradient text-white border-0 hover:opacity-90"
              >
                Entrar para ver o feed
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {posts.map((post: any) => (
              <PostCard
                key={post.id}
                post={post}
                onDeleted={() => refetch()}
                onUpdated={() => refetch()}
              />
            ))}
            <div className="flex justify-center py-8">
              <span className="text-xs text-muted-foreground italic">Você chegou ao fim do feed</span>
            </div>
          </div>
        )}
        </main>
      </div>
    </PageTransition>
  );
}
