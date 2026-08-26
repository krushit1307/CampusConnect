import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Camera position animator component
function CameraRig({ targetPosition }) {
  useFrame((state) => {
    // Smoothly lerp camera position towards selected seat coordinates
    state.camera.position.lerp(new THREE.Vector3(...targetPosition), 0.08);
    state.camera.lookAt(0, 2, -15); // Look towards the Stage center
  });
  return null;
}

export function TheaterViewport({ selectedSeat }) {
  // Map 2D seat coordinates (row, col) to 3D space (X, Y, Z)
  // For example: Row G (index 6) translated to Z depth, Seat 14 translated to X offset
  const getSeatCoordinates = (seat) => {
    if (!seat) return [0, 5, 10]; // Default overview position
    const rowOffset = seat.charCodeAt(0) - 65; // 'A' = 0, 'G' = 6
    const xPos = (seat.col - 10) * 0.8; 
    const zPos = rowOffset * 1.5 - 5;
    return [xPos, 2.2, zPos]; // Eye-level seated height (Y = 2.2)
  };

  const cameraTarget = getSeatCoordinates(selectedSeat);

  return (
    <div className="w-full h-[400px] rounded-2xl overflow-hidden bg-gray-950 border border-gray-800 shadow-inner relative">
      <Canvas camera={{ position: [0, 8, 15], fov: 60 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 20, 10]} intensity={1.2} />
        <CameraRig targetPosition={cameraTarget} />

        {/* Stage */}
        <mesh position={[0, 1, -18]}>
          <boxGeometry args={[16, 0.5, 6]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} />
        </mesh>
        {/* Stage Backdrop / Screen */}
        <mesh position={[0, 5, -21]}>
          <planeGeometry args={[18, 8]} />
          <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.2} />
        </mesh>

        {/* Simulated Concrete Pillar (Obstruction block near row G) */}
        <mesh position={[2, 3, -2]}>
          <cylinderGeometry args={[0.6, 0.6, 6, 16]} />
          <meshStandardMaterial color="#64748b" roughness={0.9} />
        </mesh>

        {/* Seating Grid Representation */}
        {Array.from({ length: 8 }).map((_, rIdx) => 
          Array.from({ length: 20 }).map((_, cIdx) => {
            const isSelected = selectedSeat && selectedSeat.row === String.fromCharCode(65 + rIdx) && selectedSeat.col === cIdx + 1;
            return (
              <mesh key={`${rIdx}-${cIdx}`} position={[(cIdx - 10) * 0.8, 1.5, rIdx * 1.5 - 5]}>
                <boxGeometry args={[0.5, 0.6, 0.5]} />
                <meshStandardMaterial color={isSelected ? '#ef4444' : '#334155'} />
              </mesh>
            );
          })
        )}

        <OrbitControls enableZoom={true} maxPolarAngle={Math.PI / 2 - 0.05} />
      </Canvas>
      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-mono text-white/90 pointer-events-none">
        {selectedSeat ? `Viewing from Seat ${selectedSeat.row}${selectedSeat.col}` : 'Select a seat on the 2D map to preview 3D sightline'}
      </div>
    </div>
  );
}
