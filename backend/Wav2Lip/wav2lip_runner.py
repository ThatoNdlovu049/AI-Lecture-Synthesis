import os
import cv2
import numpy as np
import torch
import subprocess
import platform
from tqdm import tqdm

import audio
import face_detection
from models import Wav2Lip

# ---- Fixed settings (were CLI args before, now sensible defaults) ----
IMG_SIZE = 96
MEL_STEP_SIZE = 16
PADS = [0, 30, 0, 0]
FACE_DET_BATCH_SIZE = 16
WAV2LIP_BATCH_SIZE = 128
RESIZE_FACTOR = 1
CROP = [0, -1, 0, -1]
BOX = [-1, -1, -1, -1]
NOSMOOTH = True
STATIC = False
FPS_DEFAULT = 25.

device = 'cuda' if torch.cuda.is_available() else 'cpu'
print('Wav2Lip using {} for inference.'.format(device))

_model = None  # loaded once, cached globally


def _load_checkpoint(checkpoint_path):
    if device == 'cuda':
        checkpoint = torch.load(checkpoint_path)
    else:
        checkpoint = torch.load(checkpoint_path, map_location=lambda storage, loc: storage)
    return checkpoint


def load_wav2lip_model(checkpoint_path):
    """Call this once at FastAPI startup."""
    global _model
    model = Wav2Lip()
    print("Loading Wav2Lip checkpoint from: {}".format(checkpoint_path))
    checkpoint = _load_checkpoint(checkpoint_path)
    s = checkpoint["state_dict"]
    new_s = {}
    for k, v in s.items():
        new_s[k.replace('module.', '')] = v
    model.load_state_dict(new_s)
    model = model.to(device)
    _model = model.eval()
    print("Wav2Lip model loaded.")
    return _model


def get_smoothened_boxes(boxes, T):
    for i in range(len(boxes)):
        if i + T > len(boxes):
            window = boxes[len(boxes) - T:]
        else:
            window = boxes[i: i + T]
        boxes[i] = np.mean(window, axis=0)
    return boxes


def face_detect(images):
    detector = face_detection.FaceAlignment(face_detection.LandmarksType._2D,
                                             flip_input=False, device=device)

    batch_size = FACE_DET_BATCH_SIZE

    while 1:
        predictions = []
        try:
            for i in tqdm(range(0, len(images), batch_size)):
                predictions.extend(detector.get_detections_for_batch(np.array(images[i:i + batch_size])))
        except RuntimeError:
            if batch_size == 1:
                raise RuntimeError('Image too big to run face detection. Try lowering RESIZE_FACTOR.')
            batch_size //= 2
            print('Recovering from OOM error; New batch size: {}'.format(batch_size))
            continue
        break

    results = []
    pady1, pady2, padx1, padx2 = PADS
    for rect, image in zip(predictions, images):
        if rect is None:
            os.makedirs('temp', exist_ok=True)
            cv2.imwrite('temp/faulty_frame.jpg', image)
            raise ValueError('Face not detected! Ensure the input contains a face in all frames.')

        y1 = max(0, rect[1] - pady1)
        y2 = min(image.shape[0], rect[3] + pady2)
        x1 = max(0, rect[0] - padx1)
        x2 = min(image.shape[1], rect[2] + padx2)

        results.append([x1, y1, x2, y2])

    boxes = np.array(results)
    if not NOSMOOTH:
        boxes = get_smoothened_boxes(boxes, T=5)
    results = [[image[y1:y2, x1:x2], (y1, y2, x1, x2)] for image, (x1, y1, x2, y2) in zip(images, boxes)]

    del detector
    return results


def datagen(frames, mels, static):
    img_batch, mel_batch, frame_batch, coords_batch = [], [], [], []

    if BOX[0] == -1:
        if not static:
            face_det_results = face_detect(frames)
        else:
            face_det_results = face_detect([frames[0]])
    else:
        y1, y2, x1, x2 = BOX
        face_det_results = [[f[y1:y2, x1:x2], (y1, y2, x1, x2)] for f in frames]

    for i, m in enumerate(mels):
        idx = 0 if static else i % len(frames)
        frame_to_save = frames[idx].copy()
        face, coords = face_det_results[idx].copy()

        face = cv2.resize(face, (IMG_SIZE, IMG_SIZE))

        img_batch.append(face)
        mel_batch.append(m)
        frame_batch.append(frame_to_save)
        coords_batch.append(coords)

        if len(img_batch) >= WAV2LIP_BATCH_SIZE:
            img_batch, mel_batch = np.asarray(img_batch), np.asarray(mel_batch)
            img_masked = img_batch.copy()
            img_masked[:, IMG_SIZE // 2:] = 0
            img_batch = np.concatenate((img_masked, img_batch), axis=3) / 255.
            mel_batch = np.reshape(mel_batch, [len(mel_batch), mel_batch.shape[1], mel_batch.shape[2], 1])
            yield img_batch, mel_batch, frame_batch, coords_batch
            img_batch, mel_batch, frame_batch, coords_batch = [], [], [], []

    if len(img_batch) > 0:
        img_batch, mel_batch = np.asarray(img_batch), np.asarray(mel_batch)
        img_masked = img_batch.copy()
        img_masked[:, IMG_SIZE // 2:] = 0
        img_batch = np.concatenate((img_masked, img_batch), axis=3) / 255.
        mel_batch = np.reshape(mel_batch, [len(mel_batch), mel_batch.shape[1], mel_batch.shape[2], 1])
        yield img_batch, mel_batch, frame_batch, coords_batch


def run_wav2lip(face_path, audio_path, outfile_path='results/result_voice.mp4'):
    """
    Runs Wav2Lip inference. Model must already be loaded via load_wav2lip_model().
    Returns the path to the generated video.
    """
    if _model is None:
        raise RuntimeError("Wav2Lip model not loaded — call load_wav2lip_model() first.")

    if not os.path.isfile(face_path):
        raise ValueError('face_path must be a valid path to a video/image file')

    os.makedirs('temp', exist_ok=True)
    os.makedirs(os.path.dirname(outfile_path) or '.', exist_ok=True)

    static = face_path.split('.')[-1].lower() in ['jpg', 'png', 'jpeg']

    if static:
        full_frames = [cv2.imread(face_path)]
        fps = FPS_DEFAULT
    else:
        video_stream = cv2.VideoCapture(face_path)
        fps = video_stream.get(cv2.CAP_PROP_FPS)

        full_frames = []
        while 1:
            still_reading, frame = video_stream.read()
            if not still_reading:
                video_stream.release()
                break
            if RESIZE_FACTOR > 1:
                frame = cv2.resize(frame, (frame.shape[1] // RESIZE_FACTOR, frame.shape[0] // RESIZE_FACTOR))

            y1, y2, x1, x2 = CROP
            if x2 == -1: x2 = frame.shape[1]
            if y2 == -1: y2 = frame.shape[0]
            frame = frame[y1:y2, x1:x2]

            full_frames.append(frame)

    print("Number of frames available for inference: " + str(len(full_frames)))

    local_audio_path = audio_path
    if not local_audio_path.endswith('.wav'):
        command = 'ffmpeg -y -i "{}" -strict -2 "{}"'.format(local_audio_path, 'temp/temp.wav')
        subprocess.call(command, shell=platform.system() != 'Windows')
        local_audio_path = 'temp/temp.wav'

    wav = audio.load_wav(local_audio_path, 16000)
    mel = audio.melspectrogram(wav)

    if np.isnan(mel.reshape(-1)).sum() > 0:
        raise ValueError('Mel contains nan! Using a TTS voice? Add a small epsilon noise to the wav file and try again')

    mel_chunks = []
    mel_idx_multiplier = 80. / fps
    i = 0
    while 1:
        start_idx = int(i * mel_idx_multiplier)
        if start_idx + MEL_STEP_SIZE > len(mel[0]):
            mel_chunks.append(mel[:, len(mel[0]) - MEL_STEP_SIZE:])
            break
        mel_chunks.append(mel[:, start_idx: start_idx + MEL_STEP_SIZE])
        i += 1

    print("Length of mel chunks: {}".format(len(mel_chunks)))

    full_frames = full_frames[:len(mel_chunks)]
    batch_size = WAV2LIP_BATCH_SIZE
    gen = datagen(full_frames.copy(), mel_chunks, static)

    out = None
    for i, (img_batch, mel_batch, frames, coords) in enumerate(
            tqdm(gen, total=int(np.ceil(float(len(mel_chunks)) / batch_size)))):
        if i == 0:
            frame_h, frame_w = full_frames[0].shape[:-1]
            out = cv2.VideoWriter('temp/result.avi',
                                   cv2.VideoWriter_fourcc(*'DIVX'), fps, (frame_w, frame_h))

        img_batch = torch.FloatTensor(np.transpose(img_batch, (0, 3, 1, 2))).to(device)
        mel_batch = torch.FloatTensor(np.transpose(mel_batch, (0, 3, 1, 2))).to(device)

        with torch.no_grad():
            pred = _model(mel_batch, img_batch)

        pred = pred.cpu().numpy().transpose(0, 2, 3, 1) * 255.

        for p, f, c in zip(pred, frames, coords):
            y1, y2, x1, x2 = c
            p = cv2.resize(p.astype(np.uint8), (x2 - x1, y2 - y1))
            f[y1:y2, x1:x2] = p
            out.write(f)

    out.release()

    command = 'ffmpeg -y -i "{}" -i "{}" -strict -2 -q:v 1 "{}"'.format(
        local_audio_path, 'temp/result.avi', outfile_path)
    subprocess.call(command, shell=platform.system() != 'Windows')

    return outfile_path