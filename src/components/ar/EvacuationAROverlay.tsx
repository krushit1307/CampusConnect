import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { EvacuationPathfinder } from '../../services/evacuationPathfinder';
import { VenueCanvasLayout, SpatialPoint } from '../../../shared/schemas/evacuationAR';

interface EvacuationAROverlayProps {
  layout: VenueCanvasLayout;
  currentUserPos: SpatialPoint;
  onExitEmergency: () => void;
}

export const EvacuationAROverlay: React.FC<EvacuationAROverlayProps> = ({
  layout,
  currentUserPos,
  onExitEmergency,
}) => {
  const [waypointPath, setWaypointPath] = useState<SpatialPoint[]>([]);

  useEffect(() => {
    const pathfinder = new EvacuationPathfinder(layout);
    const path = pathfinder.findNearestExitPath(currentUserPos);
    setWaypointPath(path);
  }, [layout, currentUserPos]);

  return (
    <View style={styles.container}>
      {/* AR Viewport Placeholder - Render ARKit/ARCore Scene Geometry */}
      <View style={styles.arViewport}>
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyTitle}>⚠️ EMERGENCY EVACUATION MODE</Text>
          <Text style={styles.emergencySubtitle}>Follow glowing green path to nearest exit</Text>
        </View>

        {/* Dynamic HUD Distance Indicator */}
        <View style={styles.hudContainer}>
          <Text style={styles.hudText}>Nearest Exit: Main South Gate</Text>
          <Text style={styles.hudDistance}>12 meters away</Text>
        </View>

        <TouchableOpacity style={styles.exitButton} onPress={onExitEmergency}>
          <Text style={styles.exitButtonText}>Dismiss Overlay</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  arViewport: { flex: 1, justifyContent: 'space-between', padding: 20 },
  emergencyBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 40,
  },
  emergencyTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  emergencySubtitle: { color: '#FEE2E2', fontSize: 12, marginTop: 4 },
  hudContainer: {
    backgroundColor: 'rgba(0, 255, 102, 0.2)',
    borderColor: '#00FF66',
    borderWidth: 2,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  hudText: { color: '#00FF66', fontWeight: '600' },
  hudDistance: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginTop: 4 },
  exitButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  exitButtonText: { color: '#FFF', fontWeight: '500' },
});
