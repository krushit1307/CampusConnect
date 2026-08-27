import { useEffect } from 'react';
import { Room, RoomEvent } from 'livekit-client';

export function useSpatialSFU(roomName, token, wsUrl) {
  useEffect(() => {
    const room = new Room();

    async function connect() {
      await room.connect(wsUrl, token);
      console.log('Connected to LiveKit SFU room:', room.name);

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === 'audio') {
          const element = track.attach();
          element.id = `audio-${participant.identity}`;
          document.body.appendChild(element);
        }
      });

      // Aggressively unsubscribe from video tracks outside spatial radius to conserve bandwidth
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        room.remoteParticipants.forEach((participant) => {
          const isSpeaking = speakers.includes(participant);
          participant.videoTrackPublications.forEach((pub) => {
            if (!isSpeaking && pub.isSubscribed) {
              pub.setSubscribed(false); // Save bandwidth via SFU pruning
            }
          });
        });
      });
    }

    connect();

    return () => {
      room.disconnect();
    };
  }, [roomName, token, wsUrl]);
}
