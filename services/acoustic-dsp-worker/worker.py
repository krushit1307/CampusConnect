import os
import time
import numpy as np
from scipy.fft import fft, fftfreq
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "http://localhost:54321")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "mock-key")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def generate_mock_crowd_audio(crowd_size: int, duration_sec: float = 1.0, sample_rate: int = 44100):
    """
    Simulates a raw audio buffer of a crowd.
    Large crowds generate a dense, overlapping 'Pink Noise' spectrum in the 300Hz-3000Hz vocal band.
    """
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False)
    
    # Base room ambiance (White noise)
    audio = np.random.normal(0, 0.1, len(t))
    
    # Add human vocal frequencies (Pink noise estimation)
    # The more people, the denser the amplitude across these bands
    if crowd_size > 0:
        vocal_energy = np.random.normal(0, 0.5 * (crowd_size / 100), len(t))
        
        # Apply a simple bandpass filter simulation (300 - 3000 Hz)
        # For mock purposes, we inject sine waves in this range
        for _ in range(crowd_size // 10): 
            freq = np.random.uniform(300, 3000)
            audio += np.sin(2 * np.pi * freq * t) * (np.random.uniform(0.01, 0.05))
            
    return audio, sample_rate

def analyze_acoustic_density(audio_buffer: np.ndarray, sample_rate: int, room_capacity: int, venue_id: str):
    """
    Performs FFT Digital Signal Processing to analyze the acoustic signature
    and determine the estimated crowd density.
    """
    print(f"[*] Processing {len(audio_buffer)} audio samples for Venue {venue_id}...")
    
    N = len(audio_buffer)
    yf = fft(audio_buffer)
    xf = fftfreq(N, 1 / sample_rate)
    
    # Extract the Human Vocal Band (300Hz - 3000Hz)
    vocal_band_mask = (xf >= 300) & (xf <= 3000)
    vocal_frequencies = xf[vocal_band_mask]
    vocal_amplitudes = np.abs(yf[vocal_band_mask])
    
    # Calculate Total Acoustic Energy in the vocal band
    total_vocal_energy = np.sum(vocal_amplitudes)
    
    # Base empirical modeling: Let's assume 1 unit of energy = 1 human (Simplified)
    # Calibrated to room acoustics
    estimated_crowd_size = int(total_vocal_energy / 500) # Magic calibration constant
    
    # Convert energy to estimated Decibels (dB)
    db_level = 10 * np.log10(total_vocal_energy + 1e-10) + 40 # Offset for realism
    
    print(f"[+] DSP Analysis Complete | Est. Crowd: {estimated_crowd_size} | Audio Level: {db_level:.1f} dB")
    
    # Check Crush Hazard
    hazard_level = 'SAFE'
    if estimated_crowd_size > room_capacity * 1.5:
        hazard_level = 'CRITICAL_CRUSH_HAZARD'
    elif estimated_crowd_size > room_capacity * 1.2:
        hazard_level = 'WARNING'
        
    if hazard_level == 'CRITICAL_CRUSH_HAZARD':
        print("[!] CRITICAL ALARM: Acoustic Density triangulation proves severe overcrowding! Overriding Network Analytics.")
        # Trigger Database Alarm
        try:
            supabase.table("acoustic_crush_alarms").insert({
                "venue_id": venue_id,
                "estimated_density": estimated_crowd_size,
                "room_capacity": room_capacity,
                "db_level": round(db_level, 2),
                "hazard_level": hazard_level
            }).execute()
        except Exception as e:
            print(f"[-] Supabase Write Error: {e}")

    return estimated_crowd_size, db_level, hazard_level

if __name__ == "__main__":
    print("--- DSP Acoustic Density Triangulation Worker Started ---")
    
    # Mocking a scenario where network shows 0 (Airplane mode), but room has 550 people (Capacity 100)
    print("\n[Scenario] 550 students hide devices in a 100-capacity basement.")
    audio_data, sr = generate_mock_crowd_audio(crowd_size=550, duration_sec=1.0)
    analyze_acoustic_density(audio_data, sr, room_capacity=100, venue_id="venue-basement-001")
    
    print("\n[Scenario] Normal lecture, 40 students in a 100-capacity room.")
    audio_data2, sr2 = generate_mock_crowd_audio(crowd_size=40, duration_sec=1.0)
    analyze_acoustic_density(audio_data2, sr2, room_capacity=100, venue_id="venue-lecture-002")

