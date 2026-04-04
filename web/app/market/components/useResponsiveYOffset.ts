"use client";

import { useState, useEffect } from "react";

export function useResponsiveYOffset() {
  const [yOffset, setYOffset] = useState(-10);

  useEffect(() => {
    function updateOffset() {
      const width = window.innerWidth;
      if (width >= 1024) {
        setYOffset(-10);
      } else {
        setYOffset(5);
      }
    }

    updateOffset();
    window.addEventListener("resize", updateOffset);
    return () => window.removeEventListener("resize", updateOffset);
  }, []);

  return yOffset;
}
