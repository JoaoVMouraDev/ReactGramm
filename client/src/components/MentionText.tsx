import { splitMentions } from "@/lib/mentions";
import { useLocation } from "wouter";

interface MentionTextProps {
  text: string;
  className?: string;
  onMentionClick?: () => void;
}

export function MentionText({ text, className, onMentionClick }: MentionTextProps) {
  const [, navigate] = useLocation();
  const parts = splitMentions(text);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.username ? (
          <button
            key={`${part.text}-${index}`}
            type="button"
            onClick={() => {
              onMentionClick?.();
              navigate(`/profile/${part.username}`);
            }}
            className="font-semibold text-primary hover:underline"
          >
            {part.text}
          </button>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        )
      )}
    </span>
  );
}
