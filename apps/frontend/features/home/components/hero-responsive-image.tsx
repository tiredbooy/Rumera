"use client";

import * as React from "react";
import { getImageProps } from "next/image";

import { SmartImage } from "@/components/smart-image";

export function HeroResponsiveImage({
  desktopSrc,
  mobileSrc,
  alt,
  priority,
}: {
  desktopSrc: string;
  mobileSrc?: string | null;
  alt: string;
  priority: boolean;
}) {
  const signature = `${desktopSrc}\u0000${mobileSrc ?? ""}`;
  const [failure, setFailure] = React.useState<{
    signature: string;
    sources: string[];
  } | null>(null);
  const failedSources = new Set(
    failure?.signature === signature ? failure.sources : [],
  );
  const desktopAvailable = !failedSources.has(desktopSrc);
  const mobileAvailable = Boolean(mobileSrc && !failedSources.has(mobileSrc));
  const activeDesktopSrc = desktopAvailable
    ? desktopSrc
    : mobileAvailable
      ? mobileSrc
      : null;
  const activeMobileSrc = mobileAvailable
    ? mobileSrc
    : desktopAvailable
      ? desktopSrc
      : null;

  if (!activeDesktopSrc || !activeMobileSrc) {
    return (
      <SmartImage
        src={null}
        alt={alt}
        fallbackClassName="from-card via-card to-background"
      />
    );
  }

  const common = {
    alt,
    sizes: "100vw",
    ...(priority ? { fetchPriority: "high" as const } : {}),
  };
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({
    ...common,
    src: activeDesktopSrc,
    width: 2400,
    height: 1350,
  });
  const {
    props: { srcSet: mobileSrcSet, ...mobileProps },
  } = getImageProps({
    ...common,
    src: activeMobileSrc,
    width: 1080,
    height: 1350,
  });

  return (
    <picture className="absolute inset-0 block">
      <source media="(min-width: 640px)" srcSet={desktopSrcSet} />
      <img
        {...mobileProps}
        alt={alt}
        srcSet={mobileSrcSet}
        onError={() => {
          const failedSource = window.matchMedia("(min-width: 640px)").matches
            ? activeDesktopSrc
            : activeMobileSrc;
          setFailure((current) => {
            const sources =
              current?.signature === signature ? current.sources : [];
            return sources.includes(failedSource)
              ? current
              : { signature, sources: [...sources, failedSource] };
          });
        }}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </picture>
  );
}
