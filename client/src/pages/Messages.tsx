import { useAuth } from "@/_core/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Images, Mail, Send, Smile, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function initials(username?: string | null, name?: string | null) {
  return (username ?? name ?? "?").slice(0, 1).toUpperCase();
}

function formatTime(value?: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const EMOJIS = ["😀", "😂", "😍", "🥰", "😎", "🥹", "😢", "😡", "👍", "👏", "🙏", "🔥", "❤️", "💜", "🎉", "✨", "💯", "🤝"];

export default function Messages() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const requestedUser = new URLSearchParams(window.location.search).get("user");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [showPosts, setShowPosts] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  const conversations = trpc.messages.listConversations.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 10000,
  });
  const openDirect = trpc.messages.openDirect.useMutation({
    onSuccess: async ({ conversationId }) => {
      setSelectedId(conversationId);
      await Promise.all([
        conversations.refetch(),
        utils.messages.realtimeToken.invalidate(),
      ]);
      window.history.replaceState({}, "", "/messages");
    },
    onError: (error) => toast.error(error.message),
  });
  const history = trpc.messages.history.useQuery(
    { conversationId: selectedId ?? 0 },
    { enabled: Boolean(selectedId), refetchInterval: 10000 },
  );
  const markRead = trpc.messages.markRead.useMutation();
  const send = trpc.messages.send.useMutation({
    onSuccess: async () => {
      setDraft("");
      setShowEmojis(false);
      setShowPosts(false);
      await Promise.all([history.refetch(), conversations.refetch()]);
    },
    onError: (error) => toast.error(error.message),
  });
  const shareablePosts = trpc.posts.feed.useQuery(
    { limit: 24, offset: 0 },
    { enabled: showPosts, staleTime: 60000 },
  );
  const realtimeToken = trpc.messages.realtimeToken.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 50 * 60 * 1000,
  });

  useEffect(() => {
    if (requestedUser && !openDirect.isPending) {
      openDirect.mutate({ username: requestedUser });
    }
  }, [requestedUser]);

  useEffect(() => {
    if (!selectedId) return;
    markRead.mutate(
      { conversationId: selectedId },
      { onSuccess: () => utils.messages.unreadCount.invalidate() },
    );
  }, [selectedId, history.data?.length]);

  useEffect(() => {
    const token = realtimeToken.data;
    if (!token || !selectedId) return;
    let disposed = false;
    let client: import("ably").Realtime | undefined;
    void import("ably").then(({ Realtime }) => {
      if (disposed) return;
      client = new Realtime({ token: token.token });
      const channel = client.channels.get(`conversation:${selectedId}`);
      channel.subscribe("message", () => {
        history.refetch();
        conversations.refetch();
      });
    });
    return () => {
      disposed = true;
      client?.close();
    };
  }, [realtimeToken.data?.token, selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.data?.length, selectedId]);

  const selectedConversation = conversations.data?.find((item) => item.id === selectedId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !draft.trim() || send.isPending) return;
    send.mutate({ conversationId: selectedId, text: draft.trim() });
  };

  const sharePost = (postId: number) => {
    if (!selectedId || send.isPending) return;
    send.mutate({ conversationId: selectedId, text: "", postId });
  };

  if (loading || !isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto h-[calc(100dvh-3.5rem)] w-full max-w-5xl sm:px-4 sm:py-5">
        <div className="grid h-full overflow-hidden border-border bg-card sm:rounded-lg sm:border md:grid-cols-[320px_1fr]">
          <section className={`${selectedId ? "hidden md:flex" : "flex"} min-h-0 flex-col border-border md:border-r`}>
            <div className="border-b border-border px-5 py-4">
              <h1 className="text-lg font-semibold">Mensagens</h1>
              <p className="text-xs text-muted-foreground">Suas conversas</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {conversations.isLoading || openDirect.isPending ? (
                <p className="p-5 text-sm text-muted-foreground">Carregando...</p>
              ) : conversations.data?.length ? (
                conversations.data.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedId(conversation.id)}
                    className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted"
                  >
                    <Avatar className="h-11 w-11 shrink-0 ring-2 ring-primary/70">
                      <AvatarImage src={conversation.otherUser.avatarUrl ?? undefined} />
                      <AvatarFallback>{initials(conversation.otherUser.username, conversation.otherUser.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{conversation.otherUser.username ?? conversation.otherUser.name}</p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{formatTime(conversation.lastMessageAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{conversation.lastMessage ?? "Inicie a conversa"}</p>
                        {conversation.unreadCount > 0 && (
                          <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] font-bold leading-5 text-primary-foreground">
                            {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <Mail className="mb-3 text-muted-foreground" size={30} />
                  <p className="text-sm font-semibold">Nenhuma conversa ainda</p>
                  <button onClick={() => navigate("/explore")} className="mt-3 text-sm font-semibold text-primary hover:underline">Explorar perfis</button>
                </div>
              )}
            </div>
          </section>

          <section className={`${selectedId ? "flex" : "hidden md:flex"} min-h-0 flex-col`}>
            {selectedConversation ? (
              <>
                <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-5">
                  <button onClick={() => setSelectedId(null)} className="rounded p-1.5 hover:bg-muted md:hidden" aria-label="Voltar"><ArrowLeft size={21} /></button>
                  <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => navigate(`/profile/${selectedConversation.otherUser.username}`)}>
                    <Avatar className="h-9 w-9 ring-2 ring-primary/70">
                      <AvatarImage src={selectedConversation.otherUser.avatarUrl ?? undefined} />
                      <AvatarFallback>{initials(selectedConversation.otherUser.username, selectedConversation.otherUser.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{selectedConversation.otherUser.username ?? selectedConversation.otherUser.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{selectedConversation.otherUser.name}</p>
                    </div>
                  </button>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-6">
                  {history.isLoading ? (
                    <p className="text-center text-sm text-muted-foreground">Carregando mensagens...</p>
                  ) : history.data?.length ? (
                    history.data.map((message) => {
                      const mine = message.senderId === user.id;
                      return (
                        <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[78%] overflow-hidden text-sm ${message.postId ? "rounded-lg border border-border bg-card" : mine ? "rounded-l-lg rounded-tr-lg bg-primary px-3 py-2 text-primary-foreground" : "rounded-r-lg rounded-tl-lg bg-muted px-3 py-2 text-foreground"}`}>
                            {message.postId && message.postImageUrl ? (
                              <button onClick={() => navigate(`/post/${message.postId}`)} className="block w-52 max-w-full text-left sm:w-64">
                                <img src={message.postImageUrl} alt="Publicação compartilhada" className="aspect-square w-full object-cover" />
                                <span className="block truncate px-3 pt-2 text-xs font-semibold">@{message.postAuthorUsername ?? "usuário"}</span>
                                {message.postCaption ? <span className="block line-clamp-2 px-3 pb-2 text-xs text-muted-foreground">{message.postCaption}</span> : <span className="block px-3 pb-2 text-xs text-primary">Ver publicação</span>}
                              </button>
                            ) : null}
                            {message.text ? <p className={`whitespace-pre-wrap break-words ${message.postId ? "px-3 pt-2" : ""}`}>{message.text}</p> : null}
                            <p className={`mt-1 text-right text-[10px] ${message.postId ? "px-3 pb-2 text-muted-foreground" : mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{formatTime(message.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">Envie a primeira mensagem.</div>
                  )}
                  <div ref={bottomRef} />
                </div>

                <form onSubmit={submit} className="relative flex shrink-0 items-end gap-2 border-t border-border bg-card p-3 sm:p-4">
                  {showEmojis ? (
                    <div className="absolute bottom-[4.25rem] left-3 z-20 grid w-64 grid-cols-6 gap-1 rounded-lg border border-border bg-card p-2 shadow-xl sm:left-4">
                      {EMOJIS.map((emoji) => (
                        <button key={emoji} type="button" onClick={() => setDraft((value) => `${value}${emoji}`)} className="flex h-9 w-9 items-center justify-center rounded text-xl hover:bg-muted" aria-label={`Adicionar ${emoji}`}>{emoji}</button>
                      ))}
                    </div>
                  ) : null}
                  {showPosts ? (
                    <div className="absolute bottom-[4.25rem] left-3 right-3 z-20 max-h-[55dvh] overflow-hidden rounded-lg border border-border bg-card shadow-xl sm:left-4 sm:right-4">
                      <div className="flex items-center justify-between border-b border-border px-3 py-2">
                        <p className="text-sm font-semibold">Enviar publicação</p>
                        <button type="button" onClick={() => setShowPosts(false)} className="rounded p-1 hover:bg-muted" aria-label="Fechar publicações"><X size={18} /></button>
                      </div>
                      <div className="grid max-h-[calc(55dvh-2.75rem)] grid-cols-3 gap-1 overflow-y-auto p-2 sm:grid-cols-4">
                        {shareablePosts.isLoading ? <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Carregando...</p> : shareablePosts.data?.length ? shareablePosts.data.map((post) => (
                          <button key={post.id} type="button" onClick={() => sharePost(post.id)} disabled={send.isPending} className="relative aspect-square overflow-hidden rounded bg-muted disabled:opacity-50" title={`Enviar publicação de @${post.user?.username ?? "usuário"}`}>
                            <img src={post.imageUrl} alt="" className="h-full w-full object-cover transition-transform hover:scale-105" />
                          </button>
                        )) : <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Nenhuma publicação disponível.</p>}
                      </div>
                    </div>
                  ) : null}
                  <button type="button" onClick={() => { setShowEmojis((value) => !value); setShowPosts(false); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Adicionar emoji"><Smile size={21} /></button>
                  <button type="button" onClick={() => { setShowPosts((value) => !value); setShowEmojis(false); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Enviar publicação"><Images size={21} /></button>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        submit(event);
                      }
                    }}
                    rows={1}
                    maxLength={2000}
                    placeholder="Digite uma mensagem..."
                    className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button type="submit" disabled={!draft.trim() || send.isPending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40" aria-label="Enviar mensagem"><Send size={18} /></button>
                </form>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Mail size={34} className="mb-3 text-muted-foreground" />
                <p className="text-sm font-semibold">Selecione uma conversa</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
