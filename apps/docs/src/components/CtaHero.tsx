import type { PropsWithChildren } from 'react';
import { Hero } from './Hero';

export function CtaHero(props: PropsWithChildren<{
  readonly title: string;
  readonly subtitle?: string;
  readonly tagline?: string;
}>) {
  return (
    <Hero>
      {props.tagline && (
        <p className="w-fit rounded-full border border-rp-muted/40 bg-rp-surface px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-rp-foam">
          {props.tagline}
        </p>
      )}
      <div className="space-y-5">
        <h2 className="text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-rp-text sm:text-7xl">
          {props.title}
        </h2>
        <p className="max-w-xl text-lg leading-8 text-rp-subtle">
          {props.subtitle}
        </p>
      </div>
      {props.children}
    </Hero>
  );
}


