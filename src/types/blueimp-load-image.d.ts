declare module "blueimp-load-image" {
  interface LoadImageOptions {
    maxWidth?: number;
    maxHeight?: number;
    minWidth?: number;
    minHeight?: number;
    canvas?: boolean;
    crop?: boolean;
    orientation?: number | boolean;
    meta?: boolean;
  }
  interface MetaData {
    originalWidth?: number;
    originalHeight?: number;
    imageHead?: ArrayBuffer;
    exif?: {
      get: (key: string) => any;
      [key: string]: any;
    };
  }
  function loadImage(
    file: File | Blob | string,
    callback: (img: HTMLImageElement | HTMLCanvasElement, data?: MetaData) => void,
    options: LoadImageOptions,
  ): HTMLImageElement | FileReader | false;

  export default loadImage;
}
