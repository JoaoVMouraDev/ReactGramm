import { ReactNode, useEffect, useState } from "react";

interface PageTransitionProps {
  children: ReactNode;
  duration?: number;
}

/**
 * Componente que aplica animação de fade-in ao montar
 */
export function PageTransition({ children, duration = 300 }: PageTransitionProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger fade-in animation after component mounts
    setIsVisible(true);
  }, []);

  return (
    <div
      className={isVisible ? "animate-page-in" : "opacity-0"}
      style={{
        animationDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}
