import classnames from 'classnames';
import type { PropsWithChildren, HTMLAttributes, ReactNode } from 'react';

export function Logo(props: PropsWithChildren<HTMLAttributes<SVGSVGElement> & {
  suffix?: ReactNode;
}>) {
  return (
    <div className={classnames("flex items-center gap-2 text-6xl font-bold", props.className)}>
      <h1>Boxfiles{props.suffix}</h1>
    </div>
  );
}

