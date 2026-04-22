"use client";

import { useState } from "react";

// Renders the level's Midjourney image if it loads, falls back to emoji
// when the file is missing (404). The default `size` path gives a square
// thumbnail; pass `className` (and optional `fallbackClassName`) to render
// the image as a full-bleed cover inside a positioned parent.
export function LevelAvatar({
  image,
  emoji,
  size = 56,
  alt,
  className,
  fallbackClassName,
}: {
  image?: string;
  emoji: string;
  size?: number;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) {
    if (fallbackClassName) {
      return (
        <span aria-hidden className={fallbackClassName}>
          {emoji}
        </span>
      );
    }
    return (
      <span
        aria-hidden
        className="inline-flex items-center justify-center"
        style={{ fontSize: size * 0.72, lineHeight: 1 }}
      >
        {emoji}
      </span>
    );
  }
  if (className) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={alt}
        onError={() => setFailed(true)}
        className={className}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt={alt}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="rounded-xl object-contain"
      style={{ width: size, height: size }}
    />
  );
}
