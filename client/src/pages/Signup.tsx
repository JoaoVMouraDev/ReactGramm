import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Mail, Lock, User, Eye, EyeOff, Github } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { toast } from "sonner";

export default function Signup() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const utils = trpc.useUtils();

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: async () => {
      toast.success("Conta criada com sucesso!");
      await utils.auth.me.invalidate();
      (globalThis as any).location.href = "/";
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-background to-primary/5">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !username) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    signupMutation.mutate({ email, password, username, name: name || undefined });
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-linear-to-br from-background via-background to-primary/5 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold ig-gradient-text mb-2">ReactGram</h1>
            <p className="text-muted-foreground">Crie sua conta e comece a compartilhar</p>
          </div>

          {/* Card */}
          <div className="bg-card border border-border rounded-2xl p-8 shadow-lg space-y-5">

            {/* Social signups */}
            <div className="grid grid-cols-2 gap-3">
              <a href="/api/auth/google">
                <Button variant="outline" className="w-full h-11 gap-2 font-medium">
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Google
                </Button>
              </a>
              <a href="/api/auth/github">
                <Button variant="outline" className="w-full h-11 gap-2 font-medium">
                  <Github size={18} />
                  GitHub
                </Button>
              </a>
            </div>
            <p className="text-center text-[11px] leading-tight text-muted-foreground">
              Google e GitHub não funcionando por agora
            </p>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-card text-muted-foreground">ou crie com email</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Nome completo (opcional)"
                  value={name}
                  onChange={(e) => setName((e.target as any).value)}
                  className="w-full h-11 pl-9 pr-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                />
              </div>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">@</span>
                <Input
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername((e.target as any).value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  className="w-full h-11 pl-7 pr-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail((e.target as any).value)}
                  className="w-full h-11 pl-9 pr-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha (mín. 6 caracteres)"
                  value={password}
                  onChange={(e) => setPassword((e.target as any).value)}
                  className="w-full h-11 pl-9 pr-10 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full h-11 text-sm font-semibold ig-gradient-bg hover:opacity-90 transition-opacity mt-1"
                disabled={signupMutation.isPending}
              >
                {signupMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Criar conta"
                )}
              </Button>
            </form>

            {/* Login link */}
            <p className="text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <button
                onClick={() => navigate("/login")}
                className="font-semibold text-primary hover:underline"
              >
                Fazer login
              </button>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Ao continuar, você concorda com nossos Termos de Serviço
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
