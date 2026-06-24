import type { PropsWithChildren } from 'react';

export function Section(props: PropsWithChildren) {
  return (
    <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[1fr_520px] lg:px-8 lg:pb-24">
      {props.children}
    </section>
  );
}

