#!/usr/bin/env python3
"""Character art on CPU: DreamShaper 8 (CreativeML OpenRAIL-M) + LCM-LoRA (OpenRAIL++), ~6 steps.
usage: charart.py out_dir --seeds 1 2 3 [--prompt-file p.txt] [--w 512 --h 640] [--steps 6]"""
import argparse, os, time
from pathlib import Path
import torch
from diffusers import StableDiffusionPipeline, LCMScheduler

MODELS = Path(os.environ.get("MODELS", "/tmp/claude-0/-home-user-roz/e0f1c78f-431b-5d53-ac40-f78dc2fd9d39/scratchpad/models"))
BASE = ("anime key visual, premium realistic anime style, portrait of a handsome young Indian man, 22 years old, "
        "neatly styled short black hair, expressive dark brown eyes, defined natural jawline, short well-groomed black beard and moustache, "
        "friendly confident smile, warm brown skin, white t-shirt under olive green overshirt, "
        "cinematic lighting, warm key light, soft teal rim light, night city bokeh background, detailed, sharp focus")
NEG = "child, teenager, chibi, flat vector, 3d render, photo, deformed, extra fingers, text, watermark, logo, glasses, long hair, blurry, ugly"

ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--seeds", type=int, nargs="+", default=[1])
ap.add_argument("--prompt", default=BASE); ap.add_argument("--neg", default=NEG)
ap.add_argument("--w", type=int, default=512); ap.add_argument("--h", type=int, default=640); ap.add_argument("--steps", type=int, default=6)
ap.add_argument("--cfg", type=float, default=1.5)
a = ap.parse_args()
torch.set_num_threads(os.cpu_count())
pipe = StableDiffusionPipeline.from_pretrained(MODELS / "dreamshaper-8", variant="fp16", torch_dtype=torch.float16,
                                               safety_checker=None, requires_safety_checker=False).to(torch.float32)
pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
pipe.load_lora_weights(str(MODELS / "lcm-lora"), weight_name="pytorch_lora_weights.safetensors")
pipe.fuse_lora()
Path(a.out).mkdir(parents=True, exist_ok=True)
for s in a.seeds:
    t = time.time()
    im = pipe(a.prompt, negative_prompt=a.neg, num_inference_steps=a.steps, guidance_scale=a.cfg, width=a.w, height=a.h,
              generator=torch.Generator().manual_seed(s)).images[0]
    im.save(Path(a.out) / f"seed{s}.png"); print(f"seed {s}: {time.time()-t:.1f}s", flush=True)
