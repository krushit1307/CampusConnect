import pytest
import json
from unittest.mock import MagicMock, patch
from backend.services.audio_description_generator import generate_video_audio_description

@patch("backend.services.audio_description_generator.genai.Client")
@patch("backend.services.audio_description_generator.boto3.client")
@patch("backend.services.audio_description_generator.splice_audio_tracks_to_video")
def test_audio_description_pipeline_execution(mock_splice, mock_boto, mock_genai):
    """
    Validates that video assets successfully parse JSON descriptors from the multimodal AI 
    and dispatch matching requests to the text-to-speech client.
    """
    # Mock Gemini AI payload output strings
    mock_gemini_instance = MagicMock()
    mock_genai.return_value = mock_gemini_instance
    mock_gemini_instance.files.upload.return_value = "mock_file_ref"
    
    mock_response = MagicMock()
    mock_response.text = json.dumps([
        {"start_seconds": 5.0, "description": "Graph shows a massive blue line surge."}
    ])
    mock_gemini_instance.models.generate_content.return_value = mock_response

    # Mock AWS Polly synthesized stream responses
    mock_polly_instance = MagicMock()
    mock_boto.return_value = mock_polly_instance
    mock_polly_instance.synthesize_speech.return_value = {
        "AudioStream": MagicMock(read=lambda: b"fake_mp3_binary_data")
    }

    # Execute target test verification pipeline pass
    generate_video_audio_description("dummy_input.mp4", "dummy_output.mp4")

    # Assert downstream system bindings triggered correctly
    assert mock_polly_instance.synthesize_speech.call_count == 1
    mock_splice.assert_called_once()
