import numpy as np
import pytest
from backend.services.audio_deepfake_detector import analyze_audio_noise_floor

def test_flat_synthetic_audio_detection(tmp_path):
    # Create a mock synthetic audio file containing mathematically sterile sine bursts
    file_path = tmp_path / "synthetic.wav"
    sr = 16000
    t = np.linspace(0, 3, int(sr * 3), endpoint=False)
    # Perfectly uniform signal mixed with pure digital silence padding
    signal = np.sin(2 * np.pi * 440 * t)
    signal[int(sr * 1):int(sr * 2)] = 0.0 
    
    import scipy.io.wavfile as wav
    wav.write(file_path, sr, signal.astype(np.float32))
    
    result = analyze_audio_noise_floor(str(file_path))
    assert result["is_synthetic"] is True
    assert "Synthetic Generation" in result["reason"]

def test_genuine_noisy_audio_verification(tmp_path):
    # Create a mock genuine file embedded with chaotic background Gaussian noise
    file_path = tmp_path / "genuine.wav"
    sr = 16000
    t = np.linspace(0, 3, int(sr * 3), endpoint=False)
    speech_signal = np.sin(2 * np.pi * 300 * t)
    # Inject chaotic ambient hum across the entire time block
    chaotic_ambient_noise = np.random.normal(0, 0.05, len(t))
    combined_signal = speech_signal + chaotic_ambient_noise
    
    import scipy.io.wavfile as wav
    wav.write(file_path, sr, combined_signal.astype(np.float32))
    
    result = analyze_audio_noise_floor(str(file_path))
    assert result["is_synthetic"] is False
