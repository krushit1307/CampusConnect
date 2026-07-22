import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useSignaling, SignalingCallbacks } from "@/hooks/useSignaling";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Loader2 } from "lucide-react";

interface WebRTCContextType {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callState: "idle" | "calling" | "incoming" | "connected";
  peerName: string | null;
  isMuted: boolean;
  isCameraOff: boolean;
  startCall: (targetUserId: string, targetUserName: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
}

const WebRTCContext = createContext<WebRTCContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useWebRTC = () => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error("useWebRTC must be used within a WebRTCProvider");
  }
  return context;
};

export const WebRTCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<{ full_name: string | null } | null>(null);

  // Call state
  const [callState, setCallState] = useState<"idle" | "calling" | "incoming" | "connected">("idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState<string | null>(null);

  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const callStateRef = useRef(callState);

  // Sync ref to avoid closure issues in callbacks
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Track authenticated user ID
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch current user's profile for their name
  useEffect(() => {
    if (!userId) {
      setMyProfile(null);
      return;
    }

    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setMyProfile(data);
        }
      });
  }, [userId]);

  // Clean up media stream helper
  const stopMediaTracks = (stream: MediaStream | null) => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const getMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraOff(false);
      return stream;
    } catch (err) {
      console.error("Error accessing media devices:", err);
      toast.error("Could not access camera or microphone. Please check permissions.");
      throw err;
    }
  };

  // ICE Candidates safety queue
  const addIceCandidateSafely = async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    if (pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    } else {
      pendingCandidatesRef.current.push(candidate);
    }
  };

  const processPendingCandidates = async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;

    const candidates = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];

    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding deferred ICE candidate:", err);
      }
    }
  };

  // Signaling Setup
  const callbacksRef = useRef<SignalingCallbacks>({});

  const { joinSession, leaveSession, sendCallRequest, sendCallResponse, sendSignal } = useSignaling(
    userId,
    callbacksRef,
  );

  // Implement signaling callbacks
  useEffect(() => {
    callbacksRef.current = {
      onIncomingCall: async ({ roomId: incRoomId, senderId, senderName: sndName }) => {
        if (callStateRef.current !== "idle") {
          // Send decline/busy if already in a call
          const tempChannel = supabase.channel(`user_signals:${senderId}`);
          tempChannel.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              await tempChannel.send({
                type: "broadcast",
                event: "call-response",
                payload: { accepted: false, senderId: userId },
              });
              supabase.removeChannel(tempChannel);
            }
          });
          return;
        }

        setCallState("incoming");
        setRoomId(incRoomId);
        setPeerId(senderId);
        setPeerName(sndName);
      },

      onCallResponse: async ({ accepted, senderId }) => {
        if (callStateRef.current !== "calling" || senderId !== peerId) return;

        if (!accepted) {
          toast.error("Call declined by recipient.");
          cleanupCall();
          return;
        }

        // Call accepted! Establish WebRTC connection
        setCallState("connected");
        try {
          const currentRoomId = roomId;
          if (!currentRoomId) return;

          joinSession(currentRoomId);
          const stream = await getMediaStream();

          const pc = createPeerConnection(currentRoomId, stream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          await sendSignal(currentRoomId, "offer", { sdp: offer });
        } catch (err) {
          console.error("Failed to establish peer connection:", err);
          toast.error("Call connection failed.");
          cleanupCall();
        }
      },

      onOffer: async (sdp, senderId) => {
        if (callStateRef.current !== "connected" || !roomId) return;

        try {
          let stream = localStream;
          if (!stream) {
            stream = await getMediaStream();
          }

          const pc = createPeerConnection(roomId, stream);
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await sendSignal(roomId, "answer", { sdp: answer });
          await processPendingCandidates();
        } catch (err) {
          console.error("Failed handling SDP offer:", err);
          cleanupCall();
        }
      },

      onAnswer: async (sdp) => {
        const pc = peerConnectionRef.current;
        if (!pc || callStateRef.current !== "connected") return;

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await processPendingCandidates();
        } catch (err) {
          console.error("Failed handling SDP answer:", err);
          cleanupCall();
        }
      },

      onIceCandidate: async (candidate) => {
        await addIceCandidateSafely(candidate);
      },

      onHangUp: () => {
        toast.info("Call ended by remote user.");
        cleanupCall();
      },
    };
  }, [userId, roomId, peerId, localStream, joinSession, sendSignal, supabase]);

  const createPeerConnection = (rId: string, stream: MediaStream) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    });

    // Add local tracks to peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Handle gathered ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(rId, "candidate", { candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        cleanupCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const startCall = async (targetUserId: string, targetUserName: string) => {
    if (callState !== "idle") return;

    try {
      const generatedRoomId = `call_${Math.random().toString(36).substring(2, 15)}`;
      setCallState("calling");
      setRoomId(generatedRoomId);
      setPeerId(targetUserId);
      setPeerName(targetUserName);

      // Pre-acquire camera/mic to verify availability
      await getMediaStream();

      // Send call invitation
      await sendCallRequest(targetUserId, generatedRoomId, myProfile?.full_name || "Club Member");
    } catch (err) {
      console.error("Failed to start call:", err);
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (callState !== "incoming" || !roomId || !peerId) return;

    try {
      setCallState("connected");
      joinSession(roomId);

      // Respond accept
      await sendCallResponse(peerId, true);

      // Get media stream
      await getMediaStream();
    } catch (err) {
      console.error("Failed to accept call:", err);
      toast.error("Failed to accept incoming call.");
      cleanupCall();
    }
  };

  const declineCall = async () => {
    if (!peerId) return;
    try {
      await sendCallResponse(peerId, false);
    } catch (err) {
      console.error("Error declining call:", err);
    }
    cleanupCall();
  };

  const endCall = () => {
    if (roomId) {
      sendSignal(roomId, "hang-up").catch((err) =>
        console.error("Error sending hang-up signal:", err),
      );
    }
    cleanupCall();
  };

  const cleanupCall = () => {
    stopMediaTracks(localStream);
    setLocalStream(null);
    setRemoteStream(null);

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    leaveSession();
    pendingCandidatesRef.current = [];

    setCallState("idle");
    setRoomId(null);
    setPeerId(null);
    setPeerName(null);
    setIsMuted(false);
    setIsCameraOff(false);
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  // Sync ref sources
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <WebRTCContext.Provider
      value={{
        localStream,
        remoteStream,
        callState,
        peerName,
        isMuted,
        isCameraOff,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleCamera,
      }}
    >
      {children}

      {/* Neo-brutalist Call UI Overlay */}
      {callState !== "idle" && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-950 dark:border-cream flex flex-col min-h-[500px] text-black">
            {/* Header */}
            <div className="border-b-4 border-black bg-yellow-300 dark:bg-yellow-400 p-4 flex items-center justify-between text-black font-display font-black uppercase tracking-wider">
              <span>CampusConnect Video Call</span>
              <span className="font-mono text-xs border-2 border-black bg-white px-2 py-0.5">
                {callState}
              </span>
            </div>

            {/* Main Area */}
            <div className="flex-1 bg-zinc-900 relative flex items-center justify-center min-h-[350px]">
              {callState === "calling" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-white bg-black/50 font-mono p-4 text-center">
                  <div className="h-16 w-16 mb-4 border-4 border-white border-t-transparent rounded-full animate-spin flex items-center justify-center">
                    <Phone className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-display font-bold uppercase text-lg">
                    Calling {peerName}...
                  </h3>
                  <p className="text-xs text-gray-400 mt-2">Waiting for recipient to accept</p>
                </div>
              )}

              {callState === "incoming" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-white bg-black/60 font-mono p-6 text-center">
                  <div className="h-20 w-20 bg-lime border-4 border-black flex items-center justify-center text-black mb-6 shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] animate-bounce">
                    <Phone className="h-10 w-10 animate-pulse" />
                  </div>
                  <h3 className="font-display font-black uppercase text-xl text-yellow-300">
                    Incoming Call
                  </h3>
                  <p className="font-bold text-lg mt-2 uppercase">{peerName}</p>
                  <p className="text-xs text-gray-300 mt-1">
                    wants to start a 1-on-1 video session
                  </p>

                  <div className="flex items-center gap-4 mt-8">
                    <button
                      onClick={declineCall}
                      className="border-2 border-black bg-brand-red-ios px-6 py-2 text-black font-display font-bold uppercase tracking-wider hover:bg-red-400 active:translate-x-0.5 active:translate-y-0.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all"
                    >
                      Decline
                    </button>
                    <button
                      onClick={acceptCall}
                      className="border-2 border-black bg-lime px-6 py-2 text-black font-display font-bold uppercase tracking-wider hover:bg-lime-400 active:translate-x-0.5 active:translate-y-0.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              )}

              {/* Video Feeds (Connected / Calling Preview) */}
              {(callState === "connected" || callState === "calling") && (
                <div className="w-full h-full absolute inset-0 flex items-center justify-center overflow-hidden bg-zinc-950">
                  {/* Remote Stream Video - Full Size */}
                  {callState === "connected" && remoteStream ? (
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    callState === "connected" && (
                      <div className="flex flex-col items-center justify-center text-gray-400 font-mono text-sm gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-lime" />
                        <span>Connecting secure peer link...</span>
                      </div>
                    )
                  )}

                  {/* Local Stream Video - Floating PiP */}
                  {localStream && (
                    <div className="absolute right-4 bottom-4 w-40 h-28 border-4 border-black bg-zinc-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden z-20">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Controls Footer */}
            {callState !== "incoming" && (
              <div className="border-t-4 border-black bg-cream p-4 flex items-center justify-between font-mono">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-xs uppercase text-gray-700">
                    Peer: {peerName}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleMute}
                    className={`border-2 border-black p-2.5 hover:shadow-none transition-all active:translate-x-0.5 active:translate-y-0.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                      isMuted ? "bg-brand-red-ios text-black" : "bg-white text-black"
                    }`}
                    title={isMuted ? "Unmute Mic" : "Mute Mic"}
                  >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </button>

                  <button
                    onClick={toggleCamera}
                    className={`border-2 border-black p-2.5 hover:shadow-none transition-all active:translate-x-0.5 active:translate-y-0.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                      isCameraOff ? "bg-brand-red-ios text-black" : "bg-white text-black"
                    }`}
                    title={isCameraOff ? "Turn Video On" : "Turn Video Off"}
                  >
                    {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                  </button>

                  <button
                    onClick={endCall}
                    className="border-2 border-black bg-brand-red-ios p-2.5 text-white hover:bg-brand-red-ios-dark hover:shadow-none transition-all active:translate-x-0.5 active:translate-y-0.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    title="End Session"
                  >
                    <PhoneOff className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </WebRTCContext.Provider>
  );
};
