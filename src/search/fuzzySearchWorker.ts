/// <reference lib="webworker" />

import init, { SearchEngine } from "../../wasm/fuzzy-search/pkg/fuzzy_search.js";
// Using standard Vite asset URL pattern
import wasmUrl from "../../wasm/fuzzy-search/pkg/fuzzy_search_bg.wasm?url";

let engine: SearchEngine | null = null;
let wasmMemory: WebAssembly.Memory | null = null;

// Ensure we don't hold references to large arrays unnecessarily.
// We'll keep the SearchEngine loaded in WASM memory.

self.addEventListener("message", async (e: MessageEvent) => {
  const { type, payload, id } = e.data;

  try {
    switch (type) {
      case "INIT":
        if (engine) {
          engine.free();
        }
        // Initialize WASM instance
        const wasm = await init(wasmUrl);
        wasmMemory = wasm.memory;

        // Pass the dataset joined by null bytes to Rust
        // The WASM binding handles the string conversion allocation once
        engine = new SearchEngine(payload.dataset.join("\0"));
        self.postMessage({ type: "INIT_SUCCESS", id });
        break;

      case "SEARCH":
        if (!engine || !wasmMemory) {
          throw new Error("SearchEngine not initialized");
        }

        const { query, maxDistance = 2 } = payload;

        // search returns a pointer to a u32 array
        const ptr = engine.search(query, maxDistance);
        const len = engine.result_len();

        // Create a view over the WASM memory buffer.
        // We copy the results into a new Uint32Array so we can pass it safely via postMessage.
        // Copying a few hundred u32s is virtually instantaneous.
        const resultsView = new Uint32Array(wasmMemory.buffer, ptr, len);
        const results = new Uint32Array(resultsView); // slice to copy

        self.postMessage({ type: "SEARCH_SUCCESS", payload: results, id });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      payload: error instanceof Error ? error.message : String(error),
      id,
    });
  }
});
