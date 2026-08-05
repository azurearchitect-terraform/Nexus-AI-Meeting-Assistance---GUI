import { useEffect, useRef } from "react";
import { MousePointer2 } from "lucide-react";

export const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef({ x: 0, y: 0 });
  const isVisibleRef = useRef(false);

  useEffect(() => {
    let rafId: number;

    const updateCursorPosition = () => {
      if (cursorRef.current && isVisibleRef.current) {
        cursorRef.current.style.transform = `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0)`;
      }
      rafId = requestAnimationFrame(updateCursorPosition);
    };

    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      positionRef.current = { x: e.clientX, y: e.clientY };

      if (!isVisibleRef.current) {
        isVisibleRef.current = true;
        if (cursorRef.current) {
          cursorRef.current.style.opacity = "1";
        }
      }
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
    };

    const handleMouseLeave = () => {
      isVisibleRef.current = false;
      if (cursorRef.current) {
        cursorRef.current.style.opacity = "0";
      }
    };

    const handleWindowBlur = () => {
      isVisibleRef.current = false;
      if (cursorRef.current) {
        cursorRef.current.style.opacity = "0";
      }
    };

    // Start the animation loop
    rafId = requestAnimationFrame(updateCursorPosition);

    // Add event listeners on window in capture phase so slider pointer captures never freeze cursor tracking
    window.addEventListener("pointermove", handlePointerMove, { capture: true, passive: true });
    window.addEventListener("pointerdown", handlePointerMove, { capture: true, passive: true });
    window.addEventListener("pointerup", handlePointerMove, { capture: true, passive: true });
    window.addEventListener("mousemove", handlePointerMove, { capture: true, passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerdown", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerMove, { capture: true });
      window.removeEventListener("mousemove", handlePointerMove, { capture: true });
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("blur", handleWindowBlur);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      className="fixed top-0 left-0 pointer-events-none z-[99999] opacity-0 will-change-transform"
      style={{
        transform: "translate3d(0px, 0px, 0)",
        transition: "opacity 0.08s ease-out",
      }}
    >
      <MousePointer2 className="w-5 h-5 drop-shadow-2xl fill-secondary stroke-primary pointer-events-none select-none" />
    </div>
  );
};
