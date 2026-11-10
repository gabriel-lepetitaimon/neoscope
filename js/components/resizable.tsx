import React, { useState, useRef } from "react";

interface HandleProps {
  defaultHeight: number;
  onHeightChange: (newHeight: number) => void;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
}

export const ResizeHeightHandle = ({ defaultHeight, onHeightChange, minHeight, maxHeight, className }: HandleProps) => {
  const [height, setHeight] = useState<number>(defaultHeight);
  const [isHighligted, setIsHighligted] = useState<boolean>(false);
  const isResizingRef = useRef(false);
  const isHoveredRef = useRef(false);
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;

    const startY = e.clientY;
    const startHeight = height;

    const onMouseUp = () => {
      isResizingRef.current = false;
      if (isHighligted && !isHoveredRef.current) setIsHighligted(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      if (moveEvent.buttons === 0) {
        // Si le bouton de la souris est relâché, arrêter le redimensionnement
        onMouseUp();
        return;
      }
      // En bas à gauche : descendre la souris augmente la hauteur
      const deltaY = moveEvent.clientY - startY;
      let newHeight = startHeight + deltaY;
      if (minHeight !== undefined) newHeight = Math.max(newHeight, minHeight);
      else newHeight = Math.max(newHeight, 10); // Valeur minimale par défaut
      if (maxHeight !== undefined) newHeight = Math.min(newHeight, maxHeight);
      setHeight(newHeight);
      onHeightChange(newHeight);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      className={className}
      onMouseDown={startResizing}
      onMouseEnter={() => {
        isHoveredRef.current = true;
        setIsHighligted(true);
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
        if (!isResizingRef.current) setIsHighligted(false);
      }}
      style={{
        position: "absolute",
        bottom: "4px",
        right: "4px",
        width: "12px",
        height: "12px",
        cursor: "ns-resize", // Curseur vertical uniquement (nord-sud)
        zIndex: 10,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
      }}
      title="Drag to adjust height"
    >
      {/* SVG d'une icône de redimensionnement à 3 lignes (Grip) */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 10 10"
        style={{
          overflow: "visible",
          stroke: isHighligted ? "var(--neoscope-highlight-color)" : "var(--neoscope-dim-foreground-color)",
          strokeWidth: 1.5,
          strokeLinecap: "round",
        }}
      >
        <line x1="8" y1="2" x2="2" y2="8" />
        <line x1="8" y1="5" x2="5" y2="8" />
      </svg>
    </div>
  );
};
