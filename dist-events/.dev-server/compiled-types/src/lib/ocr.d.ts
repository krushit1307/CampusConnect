import { type Worker } from "tesseract.js";
export declare function getOCRWorker(): Promise<Worker>;
export declare function extractText(file: File): Promise<string>;
