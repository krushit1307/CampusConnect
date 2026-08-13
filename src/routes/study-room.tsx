import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import Video from "lucide-react/dist/esm/icons/video";
import VideoOff from "lucide-react/dist/esm/icons/video-off";
import Mic from "lucide-react/dist/esm/icons/mic";
import MicOff from "lucide-react/dist/esm/icons/mic-off";
import MonitorUp from "lucide-react/dist/esm/icons/monitor-up";
import MonitorOff from "lucide-react/dist/esm/icons/monitor-off";
import LogOut from "lucide-react/dist/esm/icons/log-out";
import Users from "lucide-react/dist/esm/icons/users";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { toast } from "sonner";

interface PeerConnectionState {
  peerId: string;
  userName: string;
  stream: MediaStream | null;
}

export default function StudyRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("Anonymous");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerConnectionState[]>([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRoomFull, setIsRoomFull] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<any>(null);

  // Fetch current user info
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data?.full_name) {
              setUserName(data.full_name);
            }
          });
      } else {
        // Generate temporary ID for anonymous peers
        const tempId = `anon-${Math.random().toString(36).substring(2, 9)}`;
        setUserId(tempId);
      }
    });
  }, [supabase]);

  // Request camera and microphone access
  useEffect(() => {
    if (!userId || !roomId) return;

    let activeStream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        activeStream = stream;
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setupSignaling(stream);
      })
      .catch((err) => {
        toast.error("Failed to access camera or microphone. Joining audio-only/screen-only mode.");
        // Try audio-only or create dummy stream
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            activeStream = stream;
            setLocalStream(stream);
            setupSignaling(stream);
          })
          .catch(() => {
            // Setup with empty stream
            const dummyStream = new MediaStream();
            setLocalStream(dummyStream);
            setupSignaling(dummyStream);
          });
      });

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [userId, roomId]);

  // Setup WebRTC Signaling layer using Supabase Realtime Channels
  const setupSignaling = (stream: MediaStream) => {
    const channel = supabase.channel(`study-room:${roomId}`, {
      config: {
        presence: {
          key: userId!,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        const activePeers = Object.keys(presenceState);

        // Room Size hard limit (5 participants)
        if (activePeers.length > 5 && !activePeers.includes(userId!)) {
          setIsRoomFull(true);
          toast.error("Room is full! Maximum 5 participants allowed.");
          return;
        }

        // Initialize peer connections for any newly detected peers
        activePeers.forEach((peerId) => {
          if (peerId !== userId && !peersRef.current.has(peerId)) {
            const presenceInfo: any = presenceState[peerId]?.[0];
            const peerName = presenceInfo?.userName || "Anonymous";
            createPeerConnection(peerId, peerName, stream);
          }
        });

        // Cleanup peers that left presence
        peersRef.current.forEach((_, peerId) => {
          if (!activePeers.includes(peerId)) {
            removePeerConnection(peerId);
          }
        });
      })
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const { senderId, targetId, offer, answer, candidate } = payload;
        if (targetId !== userId) return;

        const pc = peersRef.current.get(senderId);
        if (!pc) return;

        try {
          if (offer) {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);

            channel.send({
              type: "broadcast",
              event: "signal",
              payload: {
                senderId: userId,
                targetId: senderId,
                answer: ans,
              },
            });
          } else if (answer) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          } else if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (err) {
          console.error("Error handling WebRTC signal payload:", err);
        }
      });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          peerId: userId,
          userName: userName,
        });
      }
    });
  };

  // Create Peer Connection (Mesh network topology)
  const createPeerConnection = (peerId: string, peerName: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    });

    peersRef.current.set(peerId, pc);

    // Add local tracks to peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Handle incoming stream tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setPeers((prev) => {
        const exists = prev.some((p) => p.peerId === peerId);
        if (exists) {
          return prev.map((p) => (p.peerId === peerId ? { ...p, stream: remoteStream } : p));
        }
        return [...prev, { peerId, userName: peerName, stream: remoteStream }];
      });
    };

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: {
            senderId: userId,
            targetId: peerId,
            candidate: event.candidate,
          },
        });
      }
    };

    // ICE Restart triggers if disconnection happens
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        console.log(`[ICE] Connection with ${peerId} failed. Triggering ICE restart.`);
        if (userId! < peerId) {
          pc.createOffer({ iceRestart: true }).then((offer) => {
            pc.setLocalDescription(offer).then(() => {
              channelRef.current?.send({
                type: "broadcast",
                event: "signal",
                payload: {
                  senderId: userId,
                  targetId: peerId,
                  offer: offer,
                },
              });
            });
          });
        }
      }
    };

    // Caller initiates WebRTC offer (determined by smaller lexical ID)
    if (userId! < peerId) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          channelRef.current?.send({
            type: "broadcast",
            event: "signal",
            payload: {
              senderId: userId,
              targetId: peerId,
              offer: pc.localDescription,
            },
          });
        })
        .catch((err) => console.error("Error creating initial offer:", err));
    }

    setPeers((prev) => {
      if (prev.some((p) => p.peerId === peerId)) return prev;
      return [...prev, { peerId, userName: peerName, stream: null }];
    });
  };

  const removePeerConnection = (peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      pc.close();
      peersRef.current.delete(peerId);
    }
    setPeers((prev) => prev.filter((p) => p.peerId !== peerId));
  };

  // Toggle audio stream track mute
  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isAudioMuted;
      });
      setIsAudioMuted(!isAudioMuted);
    }
  };

  // Toggle video stream track disable
  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoDisabled;
      });
      setIsVideoDisabled(!isVideoDisabled);
    }
  };

  // WebRTC Screen Sharing (getDisplayMedia)
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];

        // Swap track on all peer connections
        peersRef.current.forEach((pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === "video");
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          }
        });

        // Trigger rollback when user stops sharing via browser bar
        screenTrack.onended = () => {
          stopScreenShare();
        };

        // Render locally
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setIsScreenSharing(true);
      } catch (err) {
        toast.error("Failed to share screen.");
      }
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    // Restore camera track to all peer connections
    const cameraTrack = localStream?.getVideoTracks()[0];
    if (cameraTrack) {
      peersRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === "video");
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack);
        }
      });
    }

    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }

    setIsScreenSharing(false);
  };

  if (isRoomFull) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center p-6">
        <div className="neu-border bg-red-100 p-8 max-w-md shadow-[4px_4px_0_0_#000]">
          <h2 className="text-2xl font-black text-black mb-4">🚪 Room is Full</h2>
          <p className="font-mono text-sm text-gray-700 mb-6">
            Study Room {roomId} has reached its limit of 5 participants. IMPT: WebRTC mesh
            topologies cannot support larger rooms without latency degradation.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="neu-border bg-white hover:bg-lime/20 px-4 py-2 font-mono text-xs font-bold uppercase transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[85vh] flex flex-col p-4 md:p-6 bg-lavender/10">
      {/* Header Info */}
      <div className="neu-border bg-white p-4 mb-6 shadow-[4px_4px_0_0_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 bg-lime neu-border px-2.5 py-0.5 font-mono text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="h-3 w-3 fill-black animate-spin" />
            Impromptu Study session
          </span>
          <h1 className="text-3xl font-display font-black text-black leading-none">
            Room: {roomId}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="neu-border bg-sky px-3 py-1.5 font-mono text-xs font-bold uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#000]">
            <Users className="h-4 w-4" />
            {peers.length + 1}/5 Active
          </span>
        </div>
      </div>

      {/* Grid of video blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 mb-8">
        {/* Local Stream card */}
        <div className="neu-border bg-white rounded-xl shadow-[4px_4px_0_0_#000] overflow-hidden flex flex-col justify-between h-[300px]">
          <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center border-b-2 border-black">
            {isVideoDisabled ? (
              <div className="absolute inset-0 bg-peach flex items-center justify-center font-display font-black text-white text-5xl uppercase tracking-wider select-none">
                {userName.substring(0, 2)}
              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            )}
            <span className="absolute bottom-3 left-3 bg-black/60 text-white font-mono text-xs px-2 py-0.5 rounded">
              You (Local)
            </span>
          </div>
        </div>

        {/* Remote Stream cards */}
        {peers.map((peer) => (
          <div
            key={peer.peerId}
            className="neu-border bg-white rounded-xl shadow-[4px_4px_0_0_#000] overflow-hidden flex flex-col justify-between h-[300px]"
          >
            <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center border-b-2 border-black">
              {!peer.stream || peer.stream.getVideoTracks().length === 0 ? (
                <div className="absolute inset-0 bg-lime flex items-center justify-center font-display font-black text-white text-5xl uppercase tracking-wider select-none animate-pulse">
                  {peer.userName.substring(0, 2)}
                </div>
              ) : (
                <VideoPlayer stream={peer.stream} />
              )}
              <span className="absolute bottom-3 left-3 bg-black/60 text-white font-mono text-xs px-2 py-0.5 rounded">
                {peer.userName}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Control panel bar */}
      <div className="neu-border bg-white p-4 shadow-[4px_4px_0_0_#000] sticky bottom-4 left-0 right-0 flex justify-center items-center gap-4 flex-wrap z-50">
        <button
          onClick={toggleAudio}
          className={`neu-border p-3 transition-colors ${
            isAudioMuted ? "bg-red-500 text-white" : "bg-white hover:bg-sky/20"
          }`}
          title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
        >
          {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        <button
          onClick={toggleVideo}
          className={`neu-border p-3 transition-colors ${
            isVideoDisabled ? "bg-red-500 text-white" : "bg-white hover:bg-sky/20"
          }`}
          title={isVideoDisabled ? "Enable Camera" : "Disable Camera"}
        >
          {isVideoDisabled ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </button>

        <button
          onClick={toggleScreenShare}
          className={`neu-border p-3 transition-colors ${
            isScreenSharing ? "bg-lime text-black" : "bg-white hover:bg-sky/20"
          }`}
          title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
        >
          {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
        </button>

        <button
          onClick={() => navigate("/dashboard")}
          className="neu-border bg-red-100 hover:bg-red-200 text-black px-4 py-3 font-mono text-xs font-bold uppercase transition-colors flex items-center gap-1.5"
          title="Leave Room"
        >
          <LogOut className="h-4 w-4" />
          Leave
        </button>
      </div>
    </div>
  );
}

function VideoPlayer({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />;
}
