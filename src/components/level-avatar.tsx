"use client";

import { useState } from "react";

// Renders the level's Midjourney image if it loads, falls back to emoji
// when the file is missing (404) or not yet uploaded. Image is always
// rendered as a centered square; callers control the outer frame size.
export function LevelAvatar({
  image,
  emoji,
  size = 56,
  alt,
}: {
  image?: string;
  emoji: string;
  size?: number;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) {
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
