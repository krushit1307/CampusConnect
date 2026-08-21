export class FuzzySearchEngine {
  private worker: Worker;
  private messageId = 0;
  private pendingRequests = new Map<
    number,
    { resolve: (data: any) => void; reject: (err: Error) => void }
  >();

  private constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener("message", (e) => {
      const { type, payload, id } = e.data;
      const request = this.pendingRequests.get(id);
      if (!request) return;

      this.pendingRequests.delete(id);

      if (type === "ERROR") {
        request.reject(new Error(payload));
      } else {
        request.resolve(payload);
      }
    });
  }

  private dispatch<T>(type: string, payload?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ type, payload, id });
    });
  }

  static async create(dataset: string[]): Promise<FuzzySearchEngine> {
    // Standard Vite way to construct a web worker
    const worker = new Worker(new URL("./fuzzySearchWorker.ts", import.meta.url), {
      type: "module",
    });
    const engine = new FuzzySearchEngine(worker);

    await engine.dispatch("INIT", { dataset });
    return engine;
  }

  async search(query: string, maxDistance: number = 2): Promise<Uint32Array> {
    return this.dispatch<Uint32Array>("SEARCH", { query, maxDistance });
  }

  terminate() {
    this.worker.terminate();
  }
}
