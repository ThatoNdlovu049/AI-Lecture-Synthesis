"""Lecture-video pipeline: script -> cloned voice -> lip-sync -> subtitles.

Only the worker process (worker.py) runs this, never the API server, so video
generation cannot block the chatbot. Every step works inside the job's own
folder (jobs/<job id>/), so two lectures can never overwrite each other's files.
"""
import os
import re
import sys
import uuid
import subprocess

import ollama

from lecture_text import get_text_from_pdf, get_text_from_docx, generate_prompt

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
WAV2LIP_DIR = os.path.join(BACKEND_DIR, "Wav2Lip")
RESULTS_DIR = os.path.join(WAV2LIP_DIR, "results")
MODEL_NAME = "llama3.1:8b"

_tts = None
_wav2lip_runner = None


def load_models():
    """Load the voice and lip-sync models once, when the worker starts."""
    global _tts, _wav2lip_runner

    import torch
    import assemblyai
    from chatterbox import ChatterboxMultilingualTTS

    # Leave half the CPU cores free so the chatbot (Ollama) stays responsive
    torch.set_num_threads(max(1, (os.cpu_count() or 2) // 2))

    device = "cuda" if torch.cuda.is_available() else "cpu"
    _tts = ChatterboxMultilingualTTS.from_pretrained(device=device)

    sys.path.append(WAV2LIP_DIR)
    from Wav2Lip import wav2lip_runner
    wav2lip_runner.load_wav2lip_model(os.path.join(WAV2LIP_DIR, "checkpoints", "wav2lip_gan.pth"))
    _wav2lip_runner = wav2lip_runner

    assemblyai.settings.api_key = os.environ["key"]
    os.makedirs(RESULTS_DIR, exist_ok=True)


def read_materials(material_paths):
    text = ""
    for path in material_paths:
        with open(path, "rb") as f:
            content = f.read()
        if path.lower().endswith(".pdf"):
            text += get_text_from_pdf(content) + "\n"
        elif path.lower().endswith(".docx"):
            text += get_text_from_docx(content) + "\n"
    if not text.strip():
        raise RuntimeError("No text could be read from the course materials")
    return text


def write_script(text, language="english"):
    response = ollama.chat(
        model=MODEL_NAME,
        messages=[{"role": "user", "content": generate_prompt(text, language)}]
    )
    return response["message"]["content"]


def generate_audio(text, audio_sample, job_dir, on_paragraph=None):
    import torch
    import torchaudio as ta

    output_path = os.path.join(job_dir, "audio.wav")
    paragraphs = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]

    wavs = []
    for i, para in enumerate(paragraphs):
        print(f"Generating paragraph {i + 1}/{len(paragraphs)}...", flush=True)
        if on_paragraph:
            on_paragraph(i + 1, len(paragraphs))
        wav = _tts.generate(
            para,
            language_id="en",
            exaggeration=0.4,
            cfg_weight=0.35,
            audio_prompt_path=audio_sample
        )
        wavs.append(wav)
        wavs.append(torch.zeros(1, int(0.4 * _tts.sr)))

    ta.save(output_path, torch.cat(wavs, dim=-1), _tts.sr)
    return output_path


def generate_lipsync_video(audio_path, video_path):
    output_path = os.path.join(RESULTS_DIR, f"{uuid.uuid4()}.mp4")
    _wav2lip_runner.run_wav2lip(video_path, audio_path, output_path)
    if not os.path.isfile(output_path):
        raise RuntimeError("Lip-sync did not produce a video (check that the face is visible in every frame)")
    return output_path


def generate_subtitles(video_path, job_dir):
    import assemblyai

    transcript = assemblyai.Transcriber().transcribe(video_path)
    if transcript.status == assemblyai.TranscriptStatus.error:
        raise RuntimeError(f"AssemblyAI could not transcribe the video: {transcript.error}")

    srt_path = os.path.join(job_dir, "subtitle.srt")
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(transcript.export_subtitles_srt())
    return srt_path


def burn_subtitles(video_path, srt_path, output_path, font_size=12):
    # ffmpeg's subtitles filter cannot take a "C:\..." path, so pass it relative
    # to the backend folder (the worker's working folder) with forward slashes.
    srt = os.path.relpath(srt_path, BACKEND_DIR).replace("\\", "/")
    vf = f"subtitles='{srt}': force_style='FontSize={font_size}'"

    cmd = ["ffmpeg", "-y", "-i", video_path, "-vf", vf, "-c:a", "copy", output_path]
    print("Running: ", " ".join(cmd), flush=True)

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError("ffmpeg could not add the subtitles: " + result.stderr[-400:])
    return output_path


def run_pipeline(job_dir, video_path, audio_sample_path, material_paths, set_step):
    """Builds the full lecture video and returns its URL (served at /results)."""
    set_step("Reading the course materials")
    text = read_materials(material_paths)

    set_step("Writing the lecture script")
    script = write_script(text)
    with open(os.path.join(job_dir, "script.txt"), "w", encoding="utf-8") as f:
        f.write(script)

    set_step("Cloning the voice")
    audio_path = generate_audio(
        script, audio_sample_path, job_dir,
        on_paragraph=lambda i, n: set_step(f"Cloning the voice (paragraph {i} of {n})")
    )

    set_step("Lip-syncing the video")
    lipsync_path = generate_lipsync_video(audio_path, video_path)

    set_step("Adding subtitles")
    srt_path = generate_subtitles(lipsync_path, job_dir)
    final_path = os.path.join(RESULTS_DIR, f"final_{os.path.basename(lipsync_path)}")
    burn_subtitles(lipsync_path, srt_path, final_path)

    return f"/results/{os.path.basename(final_path)}"
