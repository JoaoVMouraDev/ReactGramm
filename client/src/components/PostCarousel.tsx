import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type PostMedia = {
  id?: number;
  url: string;
  key?: string;
  type: "image" | "gif";
  position?: number;
};

type PostCarouselProps = {
  media: PostMedia[];
  alt: string;
  onMediaClick?: (media: PostMedia) => void;
  onDoubleClick?: () => void;
};

export function PostCarousel({
  media,
  alt,
  onMediaClick,
  onDoubleClick,
}: PostCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const current = media[activeIndex];
  const hasMultiple = media.length > 1;

  useEffect(() => {
    setActiveIndex(0);
  }, [media[0]?.url]);

  useEffect(() => {
    setFailed(false);
    if (!hasMultiple) return;

    const indexes = [
      (activeIndex - 1 + media.length) % media.length,
      (activeIndex + 1) % media.length,
    ];
    indexes.forEach(index => {
      const image = new Image();
      image.src = media[index].url;
    });
  }, [activeIndex, hasMultiple, media]);

  if (!current) return null;

  const goTo = (index: number) => {
    setActiveIndex((index + media.length) % media.length);
  };

  return (
    <div
      className="group relative flex w-full cursor-pointer items-center justify-center overflow-hidden bg-black"
      onClick={() => onMediaClick?.(current)}
      onDoubleClick={onDoubleClick}
      onTouchStart={event => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={event => {
        if (!hasMultiple || touchStartX.current === null) return;
        const distance =
          (event.changedTouches[0]?.clientX ?? touchStartX.current) -
          touchStartX.current;
        if (Math.abs(distance) > 45)
          goTo(activeIndex + (distance < 0 ? 1 : -1));
        touchStartX.current = null;
      }}
    >
      {failed ? (
        <div className="flex min-h-80 w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
          <ImageOff size={32} />
          <span className="text-sm font-medium">Mídia indisponível</span>
        </div>
      ) : (
        <img
          key={current.url}
          src={current.url}
          alt={`${alt} (${activeIndex + 1} de ${media.length})`}
          className="block max-h-[78vh] w-full object-contain object-center"
          loading={activeIndex === 0 ? "eager" : "lazy"}
          onError={() => setFailed(true)}
        />
      )}

      {hasMultiple && (
        <>
          <button
            type="button"
            aria-label="Mídia anterior"
            onClick={event => {
              event.stopPropagation();
              goTo(activeIndex - 1);
            }}
            className="absolute left-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition-opacity md:opacity-0 md:group-hover:opacity-100"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            aria-label="Próxima mídia"
            onClick={event => {
              event.stopPropagation();
              goTo(activeIndex + 1);
            }}
            className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition-opacity md:opacity-0 md:group-hover:opacity-100"
          >
            <ChevronRight size={22} />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {media.map((item, index) => (
              <button
                key={item.id ?? `${item.url}-${index}`}
                type="button"
                aria-label={`Ir para mídia ${index + 1} de ${media.length}`}
                onClick={event => {
                  event.stopPropagation();
                  goTo(index);
                }}
                className={`h-2 w-2 rounded-full border border-black/20 ${
                  index === activeIndex ? "bg-white" : "bg-white/55"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
