export interface MentionUser {
  id: number;
  username?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}

export function getActiveMention(value: string, cursor: number) {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_.]{0,64})$/);
  if (!match || match.index === undefined) return null;

  const triggerIndex = beforeCursor.lastIndexOf("@");
  return {
    query: match[1],
    start: triggerIndex,
    end: cursor,
  };
}

export function applyMention(value: string, mention: { start: number; end: number }, username: string) {
  const nextValue = `${value.slice(0, mention.start)}@${username} ${value.slice(mention.end)}`;
  const nextCursor = mention.start + username.length + 2;
  return { value: nextValue, cursor: nextCursor };
}

export function splitMentions(text: string) {
  const parts: Array<{ text: string; username?: string }> = [];
  const mentionPattern = /@([a-zA-Z0-9_.]{3,64})/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index) });
    }
    parts.push({ text: match[0], username: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex) });
  }

  return parts;
}
