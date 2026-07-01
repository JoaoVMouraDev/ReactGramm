import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Loader2, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface SharePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: number;
}

export function SharePostDialog({ open, onOpenChange, postId }: SharePostDialogProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [sendingTo, setSendingTo] = useState<number | null>(null);

  const following = trpc.follows.following.useQuery(
    { userId: user?.id ?? 0 },
    { enabled: open && Boolean(user?.id) },
  );
  const openDirect = trpc.messages.openDirect.useMutation();
  const send = trpc.messages.send.useMutation();

  const people = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return following.data ?? [];
    return (following.data ?? []).filter((person) =>
      [person.username, person.name].some((value) =>
        value?.toLocaleLowerCase("pt-BR").includes(normalized),
      ),
    );
  }, [following.data, query]);

  const shareWith = async (person: (typeof people)[number]) => {
    if (!person.username || sendingTo !== null) return;
    setSendingTo(person.id);
    try {
      const { conversationId } = await openDirect.mutateAsync({ username: person.username });
      await send.mutateAsync({ conversationId, text: "", postId });
      toast.success(`Enviado para @${person.username}`);
      setQuery("");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a publicação");
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (sendingTo === null) onOpenChange(value); }}>
      <DialogContent className="flex max-h-[82dvh] flex-col gap-0 overflow-hidden bg-card p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="text-center text-base">Compartilhar</DialogTitle>
          <DialogDescription className="sr-only">Escolha alguém que você segue</DialogDescription>
        </DialogHeader>

        <div className="p-3">
          <div className="relative">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar"
              className="h-10 w-full rounded-lg bg-muted pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {following.isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="animate-spin" /></div>
          ) : people.length ? (
            <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
              {people.map((person) => {
                const label = person.username ?? person.name ?? "usuário";
                const isSending = sendingTo === person.id;
                return (
                  <button
                    key={person.id}
                    type="button"
                    disabled={sendingTo !== null}
                    onClick={() => shareWith(person)}
                    className="flex min-w-0 flex-col items-center gap-2 rounded-lg p-2 text-center transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    <div className="relative">
                      <Avatar className="h-16 w-16 ring-2 ring-primary/60 sm:h-20 sm:w-20">
                        <AvatarImage src={person.avatarUrl ?? undefined} />
                        <AvatarFallback>{label[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {isSending ? <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-white"><Loader2 size={22} className="animate-spin" /></span> : null}
                    </div>
                    <span className="line-clamp-2 w-full text-xs font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <UserRound size={30} className="mb-2 text-muted-foreground" />
              <p className="text-sm font-semibold">{query ? "Nenhuma pessoa encontrada" : "Você ainda não segue ninguém"}</p>
              {!query ? <button type="button" onClick={() => { onOpenChange(false); navigate("/explore"); }} className="mt-3 text-sm font-semibold text-primary hover:underline">Encontrar pessoas</button> : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
