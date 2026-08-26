import { createWorker, type Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;

export async function getOCRWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng");
  }
  return workerPromise;
}

export async function extractText(file: File): Promise<string> {
  const worker = await getOCRWorker();
  const {
    data: { text },
  } = await worker.recognize(file);

  return text;
}
