import { X } from "lucide-react";
import { useEffect } from "react";

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 p-3 sm:p-8">
      <button
        aria-label="Fechar imagem ampliada"
        onClick={onClose}
        className="absolute inset-0 cursor-zoom-out"
      />
      <img
        src={src}
        alt={alt}
        className="relative max-h-[calc(100vh-1.5rem)] max-w-[calc(100vw-1.5rem)] object-contain object-center drop-shadow-2xl sm:max-h-[calc(100vh-4rem)] sm:max-w-[calc(100vw-4rem)]"
      />
      <button
        aria-label="Fechar imagem ampliada"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-white/20 sm:right-6 sm:top-6"
      >
        <X size={24} />
      </button>
    </div>
  );
}
