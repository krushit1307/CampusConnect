import { type ImgHTMLAttributes } from "react";
interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "width" | "height"> {
    src: string;
    alt: string;
    width: number;
    height: number;
    priority?: boolean;
    quality?: number;
    responsiveWidths?: number[];
    fallback?: React.ReactNode;
}
export declare function OptimizedImage({ src, alt, width, height, priority, quality, responsiveWidths, sizes, fallback, onError, ...imageProps }: OptimizedImageProps): import("react").JSX.Element;
export {};
