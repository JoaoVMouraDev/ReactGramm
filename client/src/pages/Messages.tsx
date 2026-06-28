import { useAuth } from "@/_core/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Messages() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const selectedUser = new URLSearchParams(window.location.search).get("user");

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <h1 className="text-xl font-semibold">Mensagens</h1>

        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card">
            <Mail size={28} className="text-muted-foreground" />
          </div>
          <h2 className="text-base font-semibold">
            {selectedUser ? `Conversa com @${selectedUser}` : "Nenhuma conversa ainda"}
          </h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            {selectedUser
              ? "O chat estará disponível aqui na próxima etapa."
              : "Encontre um perfil para iniciar uma conversa."}
          </p>
          <Button
            onClick={() => navigate("/explore")}
            className="mt-5 border-0 ig-gradient text-white hover:opacity-90"
          >
            Explorar perfis
          </Button>
        </div>
      </main>
    </div>
  );
}
