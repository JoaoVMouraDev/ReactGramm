import { trpc } from "@/lib/trpc";
import { applyMention, getActiveMention, type MentionUser } from "@/lib/mentions";
import { AtSign } from "lucide-react";
import { useMemo, useRef, useState } from "react";

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 3,
  className,
  disabled,
  autoFocus,
  onKeyDown,
}: MentionTextareaProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const activeMention = useMemo(() => getActiveMention(value, cursor), [value, cursor]);
  const mentionQuery = activeMention?.query.trim() ?? "";
  const shouldSearch = !!activeMention && mentionQuery.length > 0;

  const { data: users } = trpc.users.search.useQuery(
    { query: mentionQuery, limit: 6 },
    { enabled: shouldSearch }
  );

  const suggestions = shouldSearch ? users ?? [] : [];
  const showSuggestions = suggestions.length > 0;

  const syncCursor = () => {
    const element = inputRef.current;
    if (!element) return;
    setCursor(element.selectionStart ?? 0);
  };

  const pickUser = (user: MentionUser) => {
    if (!activeMention || !user.username) return;
    const next = applyMention(value, activeMention, user.username);
    onChange(next.value);
    setActiveIndex(0);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(next.cursor, next.cursor);
      setCursor(next.cursor);
    });
  };

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onChange(event.currentTarget.value);
          setCursor(event.currentTarget.selectionStart ?? 0);
          setActiveIndex(0);
        }}
        onClick={syncCursor}
        onKeyUp={syncCursor}
        onSelect={syncCursor}
        onKeyDown={(event) => {
          if (showSuggestions) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % suggestions.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
              return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault();
              pickUser(suggestions[activeIndex]);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setCursor(-1);
              return;
            }
          }
          onKeyDown?.(event);
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className={className}
        disabled={disabled}
        autoFocus={autoFocus}
      />

      {showSuggestions && (
        <div className="absolute left-0 right-0 bottom-full mb-2 max-h-60 overflow-y-auto rounded-xl border border-border bg-card shadow-xl z-50">
          {suggestions.map((user, index) => {
            const name = user.name || user.username || "usuario";
            const username = user.username || "";

            return (
              <button
                key={user.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  pickUser(user);
                }}
                className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                  index === activeIndex ? "bg-muted" : "hover:bg-muted"
                }`}
              >
                <div className="w-8 h-8 rounded-full ig-gradient p-0.5 shrink-0">
                  <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <AtSign size={15} className="text-muted-foreground" />
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">@{username}</p>
                  <p className="text-xs text-muted-foreground truncate">{name}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
