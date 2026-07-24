import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface SignalingCallbacks {
  onIncomingCall?: (payload: { roomId: string; senderId: string; senderName: string }) => void;
  onCallResponse?: (payload: { accepted: boolean; senderId: string }) => void;
  onOffer?: (sdp: RTCSessionDescriptionInit, senderId: string) => void;
  onAnswer?: (sdp: RTCSessionDescriptionInit, senderId: string) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit, senderId: string) => void;
  onHangUp?: (senderId: string) => void;
}

export function useSignaling(
  userId: string | null,
  callbacksRef: React.MutableRefObject<SignalingCallbacks>,
) {
  const supabase = createClient();
  const personalChannelRef = useRef<RealtimeChannel | null>(null);
  const sessionChannelRef = useRef<RealtimeChannel | null>(null);

  // 1. Subscribe to personal signaling channel for call invitations/responses
  useEffect(() => {
    if (!userId) return;

    const channelName = `user_signals:${userId}`;
    const channel = supabase.channel(channelName);

    channel
      .on("broadcast", { event: "incoming-call" }, ({ payload }) => {
        if (callbacksRef.current.onIncomingCall) {
          callbacksRef.current.onIncomingCall(payload);
        }
      })
      .on("broadcast", { event: "call-response" }, ({ payload }) => {
        if (callbacksRef.current.onCallResponse) {
          callbacksRef.current.onCallResponse(payload);
        }
      })
      .subscribe();

    personalChannelRef.current = channel;

    return () => {
      if (personalChannelRef.current) {
        supabase.removeChannel(personalChannelRef.current);
        personalChannelRef.current = null;
      }
    };
  }, [userId, supabase, callbacksRef]);

  // 2. Join a call session channel for peer-to-peer signaling
  const joinSession = (roomId: string) => {
    // Leave previous session channel if any
    if (sessionChannelRef.current) {
      supabase.removeChannel(sessionChannelRef.current);
      sessionChannelRef.current = null;
    }

    const channelName = `webrtc_call:${roomId}`;
    const channel = supabase.channel(channelName);

    channel
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        if (payload.senderId === userId) return; // Ignore our own signals

        const { type, sdp, candidate, senderId } = payload;
        switch (type) {
          case "offer":
            if (callbacksRef.current.onOffer && sdp) {
              callbacksRef.current.onOffer(sdp, senderId);
            }
            break;
          case "answer":
            if (callbacksRef.current.onAnswer && sdp) {
              callbacksRef.current.onAnswer(sdp, senderId);
            }
            break;
          case "candidate":
            if (callbacksRef.current.onIceCandidate && candidate) {
              callbacksRef.current.onIceCandidate(candidate, senderId);
            }
            break;
          case "hang-up":
            if (callbacksRef.current.onHangUp) {
              callbacksRef.current.onHangUp(senderId);
            }
            break;
        }
      })
      .subscribe();

    sessionChannelRef.current = channel;
  };

  const leaveSession = () => {
    if (sessionChannelRef.current) {
      supabase.removeChannel(sessionChannelRef.current);
      sessionChannelRef.current = null;
    }
  };

  // 3. Signaling send methods
  const sendCallRequest = async (targetUserId: string, roomId: string, senderName: string) => {
    const channelName = `user_signals:${targetUserId}`;
    const channel = supabase.channel(channelName);
    await channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.send({
          type: "broadcast",
          event: "incoming-call",
          payload: { roomId, senderId: userId, senderName },
        });
        supabase.removeChannel(channel);
      }
    });
  };

  const sendCallResponse = async (targetUserId: string, accepted: boolean) => {
    const channelName = `user_signals:${targetUserId}`;
    const channel = supabase.channel(channelName);
    await channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.send({
          type: "broadcast",
          event: "call-response",
          payload: { accepted, senderId: userId },
        });
        supabase.removeChannel(channel);
      }
    });
  };

  const sendSignal = async (
    roomId: string,
    type: "offer" | "answer" | "candidate" | "hang-up",
    payloadData?: {
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    },
  ) => {
    const channel = sessionChannelRef.current;
    if (!channel) {
      console.warn("Cannot send signal: not in session channel");
      return;
    }

    await channel.send({
      type: "broadcast",
      event: "signal",
      payload: {
        senderId: userId,
        type,
        ...payloadData,
      },
    });
  };

  return {
    joinSession,
    leaveSession,
    sendCallRequest,
    sendCallResponse,
    sendSignal,
  };
}
