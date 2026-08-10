declare module "lucide-react" {
  import { FC, SVGProps } from "react";
  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    strokeWidth?: string | number;
  }
  export type Icon = FC<IconProps>;

  export const ShieldCheck: Icon;
  export const Send: Icon;
  export const Search: Icon;
  export const Lock: Icon;
  export const AlertTriangle: Icon;
  export const RefreshCw: Icon;
  export const Smile: Icon;
  export const Languages: Icon;
  export const ExternalLink: Icon;
  export const Settings: Icon;
  export const Users: Icon;
  export const Calendar: Icon;
  export const XCircle: Icon;
  export const CheckCircle: Icon;
  export const MapPin: Icon;
  export const Clock: Icon;
  export const Navigation: Icon;
  export const QrCode: Icon;

  // Generic fallback for any other icon
  const src: Record<string, Icon>;
  export default src;
}
