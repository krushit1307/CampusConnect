import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface FileChunk {
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  data: string; // Base64 encoded array buffer or hex string
  hash: string;
}

export interface SwarmPeer {
  peerId: string;
  hasFile: boolean;
  availableChunks: number[];
}

export interface P2PFileTransferProgress {
  fileId: string;
  fileName: string;
  fileSize: number;
  chunksReceived: number;
  totalChunks: number;
  progressPercent: number;
  status: "idle" | "connecting" | "downloading" | "completed" | "error";
  peersCount: number;
}

const CHUNK_SIZE = 16 * 1024; // 16KB per chunk for WebRTC Data Channel optimal frame size

export function useP2PFileShare(fileId: string | null, userId: string | null) {
  const supabase = createClient();
  const [swarmPeers, setSwarmPeers] = useState<Map<string, SwarmPeer>>(new Map());
  const [transferProgress, setTransferProgress] = useState<P2PFileTransferProgress>({
    fileId: fileId || "",
    fileName: "",
    fileSize: 0,
    chunksReceived: 0,
    totalChunks: 0,
    progressPercent: 0,
    status: "idle",
    peersCount: 0,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const fileChunksBufferRef = useRef<Map<number, ArrayBuffer>>(new Map());

  // Helper for SHA-256 chunk hashing
  const hashBuffer = async (buffer: ArrayBuffer): Promise<string> => {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  // Setup Peer Connection
  const createPeerConnection = useCallback(
    (remotePeerId: string, isInitiator: boolean) => {
      if (peerConnectionsRef.current.has(remotePeerId)) {
        return peerConnectionsRef.current.get(remotePeerId)!;
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "ice-candidate",
            payload: {
              targetId: remotePeerId,
              senderId: userId,
              candidate: event.candidate,
            },
          });
        }
      };

      if (isInitiator) {
        const dc = pc.createDataChannel("file-transfer");
        setupDataChannel(remotePeerId, dc);
      } else {
        pc.ondatachannel = (event) => {
          setupDataChannel(remotePeerId, event.channel);
        };
      }

      peerConnectionsRef.current.set(remotePeerId, pc);
      return pc;
    },
    [userId],
  );

  const setupDataChannel = (remotePeerId: string, dc: RTCDataChannel) => {
    dc.binaryType = "arraybuffer";
    dataChannelsRef.current.set(remotePeerId, dc);

    dc.onopen = () => {
      setSwarmPeers((prev) => {
        const next = new Map(prev);
        const peer = next.get(remotePeerId) || {
          peerId: remotePeerId,
          hasFile: false,
          availableChunks: [],
        };
        next.set(remotePeerId, peer);
        return next;
      });
    };

    dc.onclose = () => {
      dataChannelsRef.current.delete(remotePeerId);
      peerConnectionsRef.current.delete(remotePeerId);
      setSwarmPeers((prev) => {
        const next = new Map(prev);
        next.delete(remotePeerId);
        return next;
      });
    };

    dc.onmessage = async (event) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "request-chunk") {
            const { chunkIndex } = msg;
            const chunk = fileChunksBufferRef.current.get(chunkIndex);
            if (chunk && dc.readyState === "open") {
              const hash = await hashBuffer(chunk);
              dc.send(
                JSON.stringify({
                  type: "chunk-header",
                  chunkIndex,
                  totalChunks: fileChunksBufferRef.current.size,
                  hash,
                }),
              );
              dc.send(chunk);
            }
          }
        } catch (e) {
          // Non-JSON message
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Handle incoming binary chunk
        // Process received binary chunk logic here
      }
    };
  };

  // Supabase Realtime Swarm Signaling
  useEffect(() => {
    if (!fileId || !userId) return;

    const swarmChannel = supabase.channel(`p2p_swarm:${fileId}`, {
      config: {
        presence: { key: userId },
      },
    });

    swarmChannel
      .on("presence", { event: "sync" }, () => {
        const state = swarmChannel.presenceState();
        const peerIds = Object.keys(state).filter((id) => id !== userId);
        setTransferProgress((prev) => ({ ...prev, peersCount: peerIds.length }));

        // Connect to new peers
        peerIds.forEach((remotePeerId) => {
          if (!peerConnectionsRef.current.has(remotePeerId)) {
            const pc = createPeerConnection(remotePeerId, true);
            pc.createOffer()
              .then((offer) => pc.setLocalDescription(offer))
              .then(() => {
                swarmChannel.send({
                  type: "broadcast",
                  event: "offer",
                  payload: {
                    targetId: remotePeerId,
                    senderId: userId,
                    sdp: pc.localDescription,
                  },
                });
              });
          }
        });
      })
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.targetId !== userId) return;
        const pc = createPeerConnection(payload.senderId, false);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        swarmChannel.send({
          type: "broadcast",
          event: "answer",
          payload: {
            targetId: payload.senderId,
            senderId: userId,
            sdp: pc.localDescription,
          },
        });
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.targetId !== userId) return;
        const pc = peerConnectionsRef.current.get(payload.senderId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.targetId !== userId) return;
        const pc = peerConnectionsRef.current.get(payload.senderId);
        if (pc && payload.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await swarmChannel.track({ onlineAt: new Date().toISOString() });
        }
      });

    channelRef.current = swarmChannel;

    return () => {
      swarmChannel.unsubscribe();
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      dataChannelsRef.current.clear();
    };
  }, [fileId, userId, createPeerConnection, supabase]);

  // Seeding file into memory buffer
  const seedFile = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);

    fileChunksBufferRef.current.clear();
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
      fileChunksBufferRef.current.set(i, arrayBuffer.slice(start, end));
    }

    setTransferProgress({
      fileId: fileId || file.name,
      fileName: file.name,
      fileSize: file.size,
      chunksReceived: totalChunks,
      totalChunks,
      progressPercent: 100,
      status: "completed",
      peersCount: dataChannelsRef.current.size,
    });
  };

  return {
    swarmPeers,
    transferProgress,
    seedFile,
    hashBuffer,
    CHUNK_SIZE,
  };
}
