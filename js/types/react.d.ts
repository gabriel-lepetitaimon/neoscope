import "react";

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined; // Allow CSS custom properties (CSS variables) in inline styles
  }
}
