// Extend React.CSSProperties for custom CSS properties (--var-name)
import 'react';

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
