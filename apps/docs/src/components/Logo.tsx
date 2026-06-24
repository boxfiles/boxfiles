import classnames from 'classnames';
import type { PropsWithChildren, HTMLAttributes } from 'react';

export function Logo(props: PropsWithChildren<HTMLAttributes<SVGSVGElement>>) {
  return (
    <div className={classnames("flex items-center gap-2 text-6xl font-bold", props.className)}>
      <h1>Boxfiles</h1>
    </div>
  );
}

