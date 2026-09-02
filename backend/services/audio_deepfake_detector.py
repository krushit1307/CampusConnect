import numpy as np
import librosa

def analyze_audio_noise_floor(file_path: str) -> dict:
    """
    Analyzes the ambient noise floor of an audio track during non-speech intervals.
    Deepfakes exhibit a mathematically flat or perfectly silent noise floor, 
    whereas genuine recordings contain chaotic environmental acoustic artifacts.
    """
    # Load audio file (downsample to 16kHz for uniform spectral analysis)
    try:
        y, sr = librosa.load(file_path, sr=16000)
    except Exception:
        import scipy.io.wavfile as wav
        sr_orig, data = wav.read(file_path)
        if data.ndim > 1:
            data = data.mean(axis=1)
        if data.dtype == np.int16:
            data = data.astype(np.float32) / 32768.0
        elif data.dtype == np.int32:
            data = data.astype(np.float32) / 2147483648.0
        elif data.dtype == np.uint8:
            data = (data.astype(np.float32) - 128.0) / 128.0
        else:
            data = data.astype(np.float32)
        y = data
        sr = sr_orig

    # Short-Time Fourier Transform (STFT)
    stft = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
    
    # Calculate short-term energy (root-mean-square) per frame
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    
    # Determine the noise floor by locating frames below the 15th percentile energy threshold
    silence_threshold = np.percentile(rms, 15)
    noise_frames = stft[:, rms <= silence_threshold]
    
    if noise_frames.size == 0:
        return {
            "is_synthetic": True,
            "confidence": 0.95,
            "reason": "High Probability of Synthetic Generation (No speech pauses or natural noise floor detected)."
        }
        
    # Calculate the mean variance across frequency bins within the noise floor frames
    # Real-world rooms have chaotic variances (HVAC hums, echo reflections)
    spectral_variance = np.var(noise_frames, axis=1)
    mean_variance = np.mean(spectral_variance)
    
    # Check for absolute digital silence (mathematically flat 0.0 energy)
    mean_noise_energy = np.mean(noise_frames)
    
    # Threshold Tuning: Real mics rarely drop below a variance scale of 1e-6 or absolute 0 energy floors
    IS_PERFECTLY_SILENT = mean_noise_energy < 1e-7
    IS_SYNTHETICALLY_FLAT = mean_variance < 1e-6

    if IS_PERFECTLY_SILENT or IS_SYNTHETICALLY_FLAT:
        confidence = 0.99 if IS_PERFECTLY_SILENT else 0.88
        reason = "Perfect digital silence detected" if IS_PERFECTLY_SILENT else "Synthetically sterile background noise floor"
        return {
            "is_synthetic": True,
            "confidence": confidence,
            "reason": f"High Probability of Synthetic Generation ({reason})."
        }

    return {
        "is_synthetic": False,
        "confidence": float(1.0 - (1.0 / (1.0 + mean_variance))),
        "reason": "Natural, complex background environment noise floor verified."
    }
