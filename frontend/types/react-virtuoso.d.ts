declare module 'react-virtuoso' {
  import * as React from 'react';

  export interface VirtuosoProps<T = any> {
    data?: T[];
    itemContent?: (index: number, item: T) => React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }

  export const Virtuoso: <T = any>(props: VirtuosoProps<T>) => React.ReactElement;
}
