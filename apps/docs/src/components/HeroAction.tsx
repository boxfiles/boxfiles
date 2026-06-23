import type { PropsWithChildren } from 'react';
import classnames from 'classnames';

export function HeroAction(props: PropsWithChildren<{
  readonly href: string;
  readonly primary?: boolean;
}>) {
  return (
    <a
      data-variant={props.primary ? 'primary' : 'secondary'}
      className={classnames(
        'inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rp-foam',
        'data-[variant=primary]:bg-rp-foam data-[variant=primary]:text-rp-base data-[variant=primary]:hover:bg-rp-gold',
        'data-[variant=secondary]:border data-[variant=secondary]:border-rp-muted/40 data-[variant=secondary]:text-rp-text data-[variant=secondary]:hover:bg-rp-surface',
      )}
      href={props.href}
    >
      {props.children}
    </a>
  );
}
