import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import {
  Bell,
  Compass,
  Heart,
  Home,
  LogOut,
  Mail,
  MessageCircle,
  Moon,
  PlusSquare,
  Search,
  Sun,
  User,
  UserPlus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";

function formatNotificationTime(value: Date | string) {
  const createdAt = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - createdAt.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} d`;

  return createdAt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getSeenNotificationsKey(userId: number | string | undefined) {
  return `reactgram-seen-notifications-${userId ?? "guest"}`;
}

function safeGetItem(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures on restricted browsers.
  }
}

export function Navbar() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [seenNotificationIds, setSeenNotificationIds] = useState<Set<string>>(
    () => new Set(),
  );
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { data: searchResults } = trpc.users.search.useQuery(
    { query: searchQuery, limit: 8 },
    { enabled: searchQuery.length >= 1 },
  );

  const { data: notifications = [], isLoading: notificationsLoading } =
    trpc.notifications.list.useQuery(
      { limit: 20 },
      { enabled: Boolean(user), refetchInterval: 15000 },
    );
  const unreadNotificationsCount = notifications.filter(
    (notification) => !seenNotificationIds.has(notification.id),
  ).length;

  useEffect(() => {
    if (!user?.id) {
      setSeenNotificationIds(new Set());
      return;
    }

    try {
      const saved = safeGetItem(getSeenNotificationsKey(user.id));
      const ids = saved ? (JSON.parse(saved) as string[]) : [];
      setSeenNotificationIds(new Set(ids));
    } catch {
      setSeenNotificationIds(new Set());
    }
  }, [user?.id]);

  const markNotificationsAsSeen = () => {
    if (!user?.id || notifications.length === 0) return;

    setSeenNotificationIds((current) => {
      const next = new Set(current);
      for (const notification of notifications) {
        next.add(notification.id);
      }
      safeSetItem(
        getSeenNotificationsKey(user.id),
        JSON.stringify(Array.from(next).slice(-100)),
      );
      return next;
    });
  };

  useEffect(() => {
    if (showNotifications) {
      markNotificationsAsSeen();
    }
  }, [showNotifications, notifications]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target as Node)
      ) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-1 px-2 sm:gap-4 sm:px-4">
        <button
          onClick={() => navigate("/")}
          className="shrink-0 text-lg font-bold tracking-tight ig-gradient-text sm:text-xl"
        >
          ReactGram
        </button>

        <div ref={searchRef} className="relative flex-1 max-w-xs hidden sm:block">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearch(true);
              }}
              onFocus={() => setShowSearch(true)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-full border-0 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>

          {showSearch && searchQuery.length >= 1 && (
            <div className="absolute top-full mt-2 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-fade-in z-50">
              {!searchResults || searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum resultado
                </p>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => {
                      navigate(`/profile/${result.username ?? result.id}`);
                      setShowSearch(false);
                      setSearchQuery("");
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full ig-gradient flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                      {result.avatarUrl ? (
                        <img
                          src={result.avatarUrl}
                          alt={result.username ?? ""}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (result.username ?? result.name ?? "?")[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {result.username}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {result.name}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => navigate("/")}
            className="rounded-lg p-1.5 text-foreground transition-colors hover:bg-muted sm:p-2"
            title="Início"
          >
            <Home size={22} />
          </button>
          <button
            onClick={() => navigate("/explore")}
            className="rounded-lg p-1.5 text-foreground transition-colors hover:bg-muted sm:p-2"
            title="Explorar"
          >
            <Compass size={22} />
          </button>
          {user && (
            <button
              onClick={() => navigate("/upload")}
              className="rounded-lg p-1.5 text-foreground transition-colors hover:bg-muted sm:p-2"
              title="Novo post"
            >
              <PlusSquare size={22} />
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="rounded-lg p-1.5 text-foreground transition-colors hover:bg-muted sm:p-2"
            title="Alternar tema"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {user && (
            <button
              onClick={() => navigate("/messages")}
              className="rounded-lg p-1.5 text-foreground transition-colors hover:bg-muted sm:p-2"
              title="Mensagens"
              aria-label="Mensagens"
            >
              <Mail size={20} />
            </button>
          )}

          {user && (
            <div ref={notificationsRef} className="relative">
              <button
                onClick={() => {
                  setShowNotifications((value) => {
                    const nextValue = !value;
                    if (nextValue) markNotificationsAsSeen();
                    return nextValue;
                  });
                }}
                className="relative rounded-lg p-1.5 text-foreground transition-colors hover:bg-muted sm:p-2"
                title="Notificações"
              >
                <Bell size={20} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
                    {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-fade-in z-50">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold">Notificações</p>
                    <p className="text-xs text-muted-foreground">
                      Atividades recentes no seu perfil
                    </p>
                  </div>

                  <div className="notification-scrollbar max-h-[calc(100dvh-8rem)] divide-y divide-border overflow-y-auto overscroll-contain sm:max-h-[32rem]">
                    {notificationsLoading ? (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                        Carregando...
                      </p>
                    ) : notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                        Nenhuma notificação ainda
                      </p>
                    ) : (
                      notifications.map((notification) => {
                        const Icon =
                          notification.type === "follow"
                            ? UserPlus
                            : notification.type === "like" || notification.type === "comment_like"
                              ? Heart
                              : MessageCircle;
                        const actorName =
                          notification.actor.username ??
                          notification.actor.name ??
                          "usuário";
                        const actorPath =
                          notification.actor.username ?? notification.actor.id;
                        let title =
                          notification.type === "follow"
                            ? "Novo seguidor"
                            : notification.type === "like"
                              ? "Nova curtida"
                              : "Novo comentário";
                        let text =
                          notification.type === "follow"
                            ? `${actorName} começou a seguir você`
                            : notification.type === "like"
                              ? `${actorName} curtiu sua foto`
                              : `${actorName} comentou na sua foto`;
                        if (notification.type === "comment_like") {
                          title = "Curtida no comentário";
                          text = `${actorName} curtiu seu comentário`;
                        } else if (notification.type === "reply") {
                          title = "Nova resposta";
                          text = `${actorName} respondeu seu comentário`;
                        }

                        const target =
                          notification.type === "follow"
                            ? `/profile/${actorPath}`
                            : notification.postId
                              ? `/post/${notification.postId}`
                              : `/profile/${actorPath}`;

                        return (
                          <button
                            key={notification.id}
                            onClick={() => {
                              navigate(target);
                              setShowNotifications(false);
                            }}
                            className="w-full px-4 py-3 flex items-start gap-3 hover:bg-muted transition-colors text-left"
                          >
                            <span className="mt-0.5 w-9 h-9 rounded-full ig-gradient text-white flex items-center justify-center shrink-0">
                              <Icon size={17} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold">
                                {title}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {text}
                              </span>
                            </span>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {formatNotificationTime(notification.createdAt)}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {user ? (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="p-1 rounded-full hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-full ig-gradient p-[2px]">
                  <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.username ?? ""}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-foreground">
                        {(user.username ?? user.name ?? "?")[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-fade-in z-50">
                  <button
                    onClick={() => {
                      navigate(`/profile/${user.username ?? user.id}`);
                      setShowUserMenu(false);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left border-b border-border"
                  >
                    <User size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium">Meu perfil</span>
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-500/10 transition-colors text-left text-red-500"
                  >
                    <LogOut size={16} />
                    <span className="text-sm font-medium">Sair</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => (window.location.href = getLoginUrl())}
              className="ig-gradient text-white border-0 hover:opacity-90"
            >
              Entrar
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
