declare module "lucide-react" {
  import { FC, SVGProps } from "react";
  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  }
  export type Icon = FC<IconProps>;
  // Declare all commonly used icons
  export const Loader2: Icon;
  export const Shield: Icon;
  export const Activity: Icon;
  export const Users: Icon;
  export const AlertTriangle: Icon;
  export const CheckCircle: Icon;
  export const BarChart3: Icon;
  export const X: Icon;
  export const Plus: Icon;
  export const ChevronRight: Icon;
  export const ChevronLeft: Icon;
  export const Award: Icon;
  export const Image: Icon;
  export const Calendar: Icon;
}
