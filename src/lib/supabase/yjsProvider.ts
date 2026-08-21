import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { RealtimeChannel } from "@supabase/supabase-js";

export class SupabaseYjsProvider {
  doc: Y.Doc;
  channel: RealtimeChannel;
  awareness: awarenessProtocol.Awareness;
  userId: string;
  userName: string;

  constructor(doc: Y.Doc, channel: RealtimeChannel, userId: string, userName: string) {
    this.doc = doc;
    this.channel = channel;
    this.userId = userId;
    this.userName = userName;
    this.awareness = new awarenessProtocol.Awareness(doc);

    // Setup local awareness state
    this.awareness.setLocalStateField("user", {
      name: userName,
      color: this.getRandomColor(),
    });

    // Listen to Yjs doc updates
    this.doc.on("update", this.onDocUpdate);

    // Listen to awareness updates
    this.awareness.on("update", this.onAwarenessUpdate);

    // Listen to Supabase Realtime broadcast signals
    this.channel
      .on("broadcast", { event: "yjs-update" }, this.handleRemoteDocUpdate)
      .on("broadcast", { event: "yjs-awareness" }, this.handleRemoteAwarenessUpdate);
  }

  private getRandomColor(): string {
    const colors = [
      "#ff5964",
      "#35a7ff",
      "#386150",
      "#f7b2bd",
      "#f68e5f",
      "#a2d2ff",
      "#ffc6ff",
      "#b5e2fa",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private onDocUpdate = (update: Uint8Array, origin: any) => {
    // Only broadcast updates generated locally (origin !== this)
    if (origin === this) return;

    const base64Update = this.uint8ArrayToBase64(update);
    this.channel.send({
      type: "broadcast",
      event: "yjs-update",
      payload: {
        update: base64Update,
        senderId: this.userId,
      },
    });
  };

  private onAwarenessUpdate = ({ added, updated, removed }: any, origin: any) => {
    if (origin === "local") {
      const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
      const base64Update = this.uint8ArrayToBase64(update);
      this.channel.send({
        type: "broadcast",
        event: "yjs-awareness",
        payload: {
          update: base64Update,
        },
      });
    }
  };

  private handleRemoteDocUpdate = ({ payload }: any) => {
    const { update, senderId } = payload;
    if (senderId === this.userId) return;

    const binaryUpdate = this.base64ToUint8Array(update);
    Y.applyUpdate(this.doc, binaryUpdate, this);
  };

  private handleRemoteAwarenessUpdate = ({ payload }: any) => {
    const { update } = payload;
    const binaryUpdate = this.base64ToUint8Array(update);
    awarenessProtocol.applyAwarenessUpdate(this.awareness, binaryUpdate, this.channel);
  };

  private uint8ArrayToBase64(arr: Uint8Array): string {
    return btoa(String.fromCharCode.apply(null, arr as any));
  }

  private base64ToUint8Array(str: string): Uint8Array {
    return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
  }

  destroy() {
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    this.awareness.destroy();
  }
}
