import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { MobileNav, Navbar } from "@/components/Navbar";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [offset, setOffset] = useState(0);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Hook para observar o scroll e disparar o carregamento automático
  const LIMIT = 10;

  // Setup intersection observer
  useEffect(() => {
    const observer = new (globalThis as any).IntersectionObserver(
      ([entry]: any) => setInView(entry.isIntersecting),
      { threshold: 0.1 }
    );
    if (ref.current) {
      observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, []);

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
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  // @ts-ignore - Caso o backend ainda retorne um array simples em vez de objeto com cursor
  } = trpc.posts.feed.useInfiniteQuery(
    { limit: LIMIT }, // O offset/cursor será gerenciado pelo getNextPageParam
    {
      queryKey: ["posts.feed", { limit: LIMIT }], // Chave de query estável
      getNextPageParam: (lastPage: any) => lastPage.nextCursor ?? undefined,
      refetchOnWindowFocus: false,
    }
  );

  // Efeito para carregar mais posts quando o elemento "sentinela" entra na visualização
  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  // Achata as páginas em um único array de posts para renderização
  // Ajustado para lidar com retorno que pode ser array direto ou objeto .posts
  const posts = data?.pages.flatMap((page: any) => Array.isArray(page) ? page : page.posts) || [];

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
        ) : !posts || posts.length === 0 ? (
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

            {/* Sentinela: Quando este elemento entra na tela, o fetchNextPage é disparado */}
            <div ref={ref} className="flex justify-center py-8">
              {isFetchingNextPage ? (
                <Loader2 className="animate-spin text-primary" size={24} />
              ) : hasNextPage ? (
                <span className="text-xs text-muted-foreground italic">Carregando mais...</span>
              ) : (
                <span className="text-xs text-muted-foreground italic">Você chegou ao fim do feed ✨</span>
              )}
            </div>
          </div>
        )}
        </main>
        <MobileNav />
      </div>
    </PageTransition>
  );
}
