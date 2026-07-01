import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface SharePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: number;
}

export function SharePostDialog({ open, onOpenChange, postId }: SharePostDialogProps) {
  const [, navigate] = useLocation();
  const conversations = trpc.messages.listConversations.useQuery(undefined, { enabled: open });
  const send = trpc.messages.send.useMutation({
    onSuccess: (_, variables) => {
      const conversation = conversations.data?.find((item) => item.id === variables.conversationId);
      toast.success(`Enviado para @${conversation?.otherUser.username ?? "conversa"}`);
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="text-base">Compartilhar publicação</DialogTitle>
          <DialogDescription>Escolha uma conversa</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60dvh] overflow-y-auto">
          {conversations.isLoading ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Carregando conversas...</p>
          ) : conversations.data?.length ? (
            conversations.data.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                disabled={send.isPending}
                onClick={() => send.mutate({ conversationId: conversation.id, text: "", postId })}
                className="flex w-full items-center gap-3 border-b border-border px-5 py-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
              >
                <Avatar className="h-11 w-11 ring-2 ring-primary/60">
                  <AvatarImage src={conversation.otherUser.avatarUrl ?? undefined} />
                  <AvatarFallback>{(conversation.otherUser.username ?? conversation.otherUser.name ?? "?")[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{conversation.otherUser.username ?? conversation.otherUser.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{conversation.otherUser.name}</p>
                </div>
                {send.isPending && send.variables?.conversationId === conversation.id ? <Check size={18} className="text-primary" /> : null}
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center px-5 py-9 text-center">
              <MessageCircle size={28} className="mb-2 text-muted-foreground" />
              <p className="text-sm font-semibold">Nenhuma conversa ainda</p>
              <button type="button" onClick={() => { onOpenChange(false); navigate("/explore"); }} className="mt-3 text-sm font-semibold text-primary hover:underline">Encontrar pessoas</button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
