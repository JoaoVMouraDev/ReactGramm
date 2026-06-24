const URL_PATTERN =
  /((?:https?:\/\/)?(?:www\.)?(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;

function getHref(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function trimTrailingPunctuation(value: string) {
  const match = value.match(/^(.*?)([.,!?;:)]+)?$/);
  return {
    url: match?.[1] || value,
    trailing: match?.[2] || "",
  };
}

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

export function LinkifiedText({ text, className }: LinkifiedTextProps) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const { url, trailing } = trimTrailingPunctuation(match[0]);
    parts.push(
      <a
        key={`${url}-${match.index}`}
        href={getHref(url)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-primary hover:underline"
      >
        {url}
      </a>,
    );
    if (trailing) parts.push(trailing);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}
