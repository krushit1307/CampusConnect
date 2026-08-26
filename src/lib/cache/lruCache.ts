/**
 * Custom O(1) LRU Cache Layer using IndexedDB for persistence.
 * Uses a Doubly Linked List + Hash Map in-memory structure to manage metadata
 * and calculate LRU evictions in O(1) time.
 */

export interface LRUNode {
  key: string;
  size: number;
  accessedAt: number;
  prev: LRUNode | null;
  next: LRUNode | null;
}

export interface CacheEntry {
  key: string;
  body: string;
  headers: Record<string, string>;
  status: number;
  size: number;
  accessedAt: number;
}

export class LRUCache {
  private maxSize: number; // 50MB in bytes
  private totalSize: number;
  private hashMap: Map<string, LRUNode>;
  private head: LRUNode | null;
  private tail: LRUNode | null;
  private db: IDBDatabase | null;
  private initPromise: Promise<void> | null;

  constructor(maxSizeInMB: number = 50) {
    this.maxSize = maxSizeInMB * 1024 * 1024;
    this.totalSize = 0;
    this.hashMap = new Map();
    this.head = null;
    this.tail = null;
    this.db = null;
    this.initPromise = null;
  }

  /**
   * Initializes the cache: opens the database and reads existing metadata
   * to build the in-memory Doubly Linked List and Hash Map.
   */
  public async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    const maxSizeInMB = this.maxSize / (1024 * 1024);

    this.initPromise = (async () => {
      try {
        this.db = await this.openDatabase();
        await this.buildMemoryStructures();
        console.log(
          `[LRU Cache] Initialized. Loaded ${this.hashMap.size} entries. Total size: ${(
            this.totalSize /
            (1024 * 1024)
          ).toFixed(2)} MB / ${maxSizeInMB} MB`,
        );
      } catch (err) {
        console.error("[LRU Cache] Initialization failed:", err);
      }
    })();
    return this.initPromise;
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("campus-connect-cache", 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("cache")) {
          db.createObjectStore("cache", { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Reads only metadata (key, size, accessedAt) using a cursor
   * to avoid reading large response bodies on startup.
   */
  private buildMemoryStructures(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error("Database not initialized"));

      const transaction = this.db.transaction("cache", "readonly");
      const store = transaction.objectStore("cache");
      const request = store.openCursor();
      const loadedNodes: LRUNode[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const val = cursor.value as CacheEntry;
          loadedNodes.push({
            key: val.key,
            size: val.size,
            accessedAt: val.accessedAt,
            prev: null,
            next: null,
          });
          cursor.continue();
        } else {
          // Sort nodes by accessedAt ascending (oldest first, so we push them in order)
          loadedNodes.sort((a, b) => a.accessedAt - b.accessedAt);

          // Rebuild DLL and HashMap
          for (const node of loadedNodes) {
            this.addToHead(node);
            this.hashMap.set(node.key, node);
            this.totalSize += node.size;
          }
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieves a cached response from the database.
   * Updates accessedAt metadata to keep the record warm.
   */
  public async get(key: string): Promise<CacheEntry | null> {
    await this.init();

    const node = this.hashMap.get(key);
    if (!node) return null;

    // Move to head of DLL (recently used)
    this.moveToHead(node);
    node.accessedAt = Date.now();

    // Fetch the actual record from IndexedDB
    const entry = await this.readFromDB(key);
    if (!entry) return null;

    // Update accessed timestamp in IndexedDB asynchronously
    entry.accessedAt = node.accessedAt;
    this.writeToDB(entry).catch((err) =>
      console.error("[LRU Cache] Failed to update accessedAt in DB:", err),
    );

    return entry;
  }

  /**
   * Caches a new response or updates an existing one.
   * Evicts least recently used items if 50MB size limit is exceeded.
   */
  public async put(
    key: string,
    body: string,
    headers: Record<string, string>,
    status: number,
  ): Promise<void> {
    await this.init();

    // Estimate size of cache record in bytes (UTF-16 chars are 2 bytes + padding)
    const nodeSize = (key.length + body.length + JSON.stringify(headers).length) * 2 + 100;

    let node = this.hashMap.get(key);
    if (node) {
      this.totalSize -= node.size;
      node.size = nodeSize;
      node.accessedAt = Date.now();
      this.totalSize += nodeSize;
      this.moveToHead(node);
    } else {
      node = {
        key,
        size: nodeSize,
        accessedAt: Date.now(),
        prev: null,
        next: null,
      };
      this.addToHead(node);
      this.hashMap.set(key, node);
      this.totalSize += nodeSize;
    }

    const entry: CacheEntry = {
      key,
      body,
      headers,
      status,
      size: nodeSize,
      accessedAt: node.accessedAt,
    };

    // Write to DB
    await this.writeToDB(entry);

    // Evict items if we exceed 50MB limit
    await this.evict();
  }

  private readFromDB(key: string): Promise<CacheEntry | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve(null);

      const transaction = this.db.transaction("cache", "readonly");
      const store = transaction.objectStore("cache");
      const request = store.get(key);

      request.onsuccess = () => resolve((request.result as CacheEntry) || null);
      request.onerror = () => reject(request.error);
    });
  }

  private writeToDB(entry: CacheEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error("Database not initialized"));

      const transaction = this.db.transaction("cache", "readwrite");
      const store = transaction.objectStore("cache");
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private deleteFromDB(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();

      const transaction = this.db.transaction("cache", "readwrite");
      const store = transaction.objectStore("cache");
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * O(1) Eviction process that pops the tail node repeatedly
   * until memory usage drops below maxSize limit.
   */
  private async evict(): Promise<void> {
    while (this.totalSize > this.maxSize && this.tail) {
      const lruNode = this.tail;
      console.log(
        `[LRU Cache Eviction] Evicting key: ${lruNode.key} (size: ${(lruNode.size / 1024).toFixed(
          1,
        )} KB)`,
      );

      this.removeNode(lruNode);
      this.hashMap.delete(lruNode.key);
      this.totalSize -= lruNode.size;

      // Delete from DB asynchronously
      await this.deleteFromDB(lruNode.key);
    }
  }

  // --- DLL Utility operations ---

  private addToHead(node: LRUNode) {
    node.next = this.head;
    node.prev = null;

    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: LRUNode) {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private moveToHead(node: LRUNode) {
    this.removeNode(node);
    this.addToHead(node);
  }

  public getCacheStats() {
    return {
      sizeMB: (this.totalSize / (1024 * 1024)).toFixed(2),
      limitMB: (this.maxSize / (1024 * 1024)).toFixed(2),
      entriesCount: this.hashMap.size,
    };
  }
}

// Export singleton instance of LRU cache
export const cacheInstance = new LRUCache(50);
