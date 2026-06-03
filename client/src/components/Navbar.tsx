import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import {
  Compass,
  Heart,
  Home,
  LogOut,
  Moon,
  PlusSquare,
  Search,
  Sun,
  User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";

export function Navbar() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { data: searchResults } = trpc.users.search.useQuery(
    { query: searchQuery, limit: 8 },
    { enabled: searchQuery.length >= 1 }
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
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
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <button
          onClick={() => navigate("/")}
          className="font-bold text-xl tracking-tight ig-gradient-text shrink-0"
        >
          ReactGram
        </button>

        {/* Search */}
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
                searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      navigate(`/profile/${u.username}`);
                      setShowSearch(false);
                      setSearchQuery("");
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full ig-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt={u.username ?? ""}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        (u.username ?? u.name ?? "?")[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{u.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.name}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground"
            title="Início"
          >
            <Home size={22} />
          </button>
          <button
            onClick={() => navigate("/explore")}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground"
            title="Explorar"
          >
            <Compass size={22} />
          </button>
          {user && (
            <button
              onClick={() => navigate("/upload")}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground"
              title="Novo post"
            >
              <PlusSquare size={22} />
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground"
            title="Alternar tema"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
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
                    <span className="text-sm font-medium">Meu Perfil</span>
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

/* Mobile bottom nav */
export function MobileNav() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();

  const items = [
    { icon: Home, path: "/", label: "Início" },
    { icon: Search, path: "/explore", label: "Explorar" },
    ...(user ? [{ icon: PlusSquare, path: "/upload", label: "Novo Post" }] : []),
    ...(user
      ? [{ icon: User, path: `/profile/${user.username ?? user.id}`, label: "Perfil" }]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border sm:hidden">
      <div className="flex items-center justify-around h-14 px-2">
        {items.map((item) => {
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
