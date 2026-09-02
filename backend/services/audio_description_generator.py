import os
import subprocess
import boto3
from google import genai
from google.genai import types

# Initialize AWS Polly and Google Gemini clients
polly_client = boto3.client("polly", region_name=os.getenv("AWS_REGION", "us-east-1"))
ai_client = genai.Client()

def generate_video_audio_description(video_path: str, output_path: str):
    """
    Analyzes visual shifts inside an MP4, leverages multimodal LLMs to summarize 
    visual state graphs, and binds an AWS Polly TTS description track onto Audio Channel 2.
    """
    print(f"Uploading video segment to Multimodal Engine: {video_path}")
    
    # 1. Upload video to Gemini File API to handle frame-by-frame structural visual extraction
    video_file = ai_client.files.upload(file=video_path)
    
    prompt = (
        "Analyze this video. Generate a timestamped, highly descriptive script "
        "explaining only the critical visual elements (graphs, slide changes, or physical actions) "
        "specifically during intervals where the speaker is silent. Format your response strictly "
        "as a JSON list of objects: [{'start_seconds': 12.5, 'description': 'The speaker points to a massive red spike at the top right of the voltage graph.'}]"
    )
    
    # 2. Invoke Multimodal analysis model
    response = ai_client.models.generate_content(
        model="gemini-1.5-pro",
        contents=[video_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )
    
    import json
    description_events = json.loads(response.text)
    
    # Compile individual spoken description files
    temp_audio_files = []
    
    for index, event in enumerate(description_events):
        start_time = event["start_seconds"]
        text = event["description"]
        
        # 3. Request neural speech synthesis from AWS Polly
        polly_response = polly_client.synthesize_speech(
            Engine="neural",
            OutputFormat="mp3",
            Text=text,
            VoiceId="Joanna"
        )
        
        temp_audio_path = f"temp_desc_{index}.mp3"
        with open(temp_audio_path, "wb") as f:
            f.write(polly_response["AudioStream"].read())
            
        temp_audio_files.append((start_time, temp_audio_path))
        
    # 4. Splice synthesized voiceovers back into video stream as Track 2 using FFmpeg
    splice_audio_tracks_to_video(video_path, temp_audio_files, output_path)
    
    # Clean up intermediate temporary files
    for _, path in temp_audio_files:
        if os.path.exists(path):
            os.remove(path)

def splice_audio_tracks_to_video(video_path: str, audio_events: list, output_path: str):
    """
    Uses an FFmpeg filter graph execution block to blend secondary voiceover sequences 
    at precise timestamp offsets while preserving the original video and audio channels.
    """
    # Create the complex filter graph arguments for shifting and mixing descriptive audio clips
    filter_inputs = ""
    filter_amix = ""
    
    for index, (start_time, path) in enumerate(audio_events):
        filter_inputs += f" -i {path}"
        # Apply a delay to align each clip to its corresponding video time offset (in milliseconds)
        filter_amix += f"[{index+1}:a]adelay={int(start_time * 1000)}|{int(start_time * 1000)}[a{index}]; "
        
    mix_count = len(audio_events)
    inputs_mix_string = "".join([f"[a{i}]" for i in range(mix_count)])
    
    # Compile the final amix filter graph string block
    filter_complex = f"{filter_amix}{inputs_mix_string}amix=inputs={mix_count}:duration=first[ad_track]"
    
    # Run structural FFmpeg subprocess call mapping:
    # Track 0: Video, Track 1: Original Audio, Track 2: Synthesized Descriptive Audio
    cmd = (
        f"ffmpeg -y -i {video_path}{filter_inputs} -filter_complex \"{filter_complex}\" "
        f"-map 0:v -map 0:a -map \"[ad_track]\" -c:v copy -c:a aac {output_path}"
    )
    
    subprocess.run(cmd, shell=True, check=True)
    print(f"Accessibility audio track successfully generated and compiled to: {output_path}")
