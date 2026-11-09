#!/usr/bin/env python3
"""Avir's AI Tools (local): a small web page that runs a free image model and a free voice model on this computer.
Used for the real screen recordings in Unfiltered Avir videos: what you see on screen is the model actually running.

  python3 server.py --models <dir with dreamshaper-8/ and lcm-lora/> --kokoro <kokoro dir> --out <out dir> [--port 8765]

Image: DreamShaper 8 (CreativeML OpenRAIL-M) + LCM-LoRA SD1.5 (OpenRAIL++), CPU, few steps; a live preview of the
latents is shown at every step (a fixed linear latent->RGB map, the same trick ComfyUI uses for fast previews).
Voice: Kokoro multi-lang v1.0 (Apache-2.0) via sherpa-onnx.
"""
import argparse, base64, io, json, subprocess, threading, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

ap = argparse.ArgumentParser(); ap.add_argument("--models", required=True); ap.add_argument("--kokoro", required=True)
ap.add_argument("--out", required=True); ap.add_argument("--port", type=int, default=8765)
A = ap.parse_args(); OUT = Path(A.out); OUT.mkdir(parents=True, exist_ok=True); HERE = Path(__file__).resolve().parent
TTS = HERE.parent.parent / ".claude/skills/video-editor/scripts/tts.py"
JOB = {"state": "idle", "step": 0, "total": 0, "t0": 0, "elapsed": 0, "preview": None, "image": None, "log": []}
PIPE = None


def load():
    global PIPE
    import torch
    from diffusers import StableDiffusionPipeline, LCMScheduler
    t = time.time()
    p = StableDiffusionPipeline.from_pretrained(A.models + "/dreamshaper-8", variant="fp16", torch_dtype=torch.float16,
                                                safety_checker=None, requires_safety_checker=False).to(torch.float32)
    p.scheduler = LCMScheduler.from_config(p.scheduler.config)
    p.load_lora_weights(A.models + "/lcm-lora", weight_name="pytorch_lora_weights.safetensors"); p.fuse_lora()
    PIPE = p; print(f"model loaded in {time.time() - t:.1f}s", flush=True)


def latent_preview(lat):
    import numpy as np
    from PIL import Image
    M = np.array([[0.298, 0.207, 0.208], [0.187, 0.286, 0.173], [-0.158, 0.189, 0.264], [-0.184, -0.271, -0.473]])
    x = lat[0].permute(1, 2, 0).float().numpy() @ M
    im = Image.fromarray((np.clip((x + 1) / 2, 0, 1) * 255).astype("uint8")).resize((256, 384), Image.BILINEAR)
    b = io.BytesIO(); im.save(b, "JPEG", quality=85); return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()


def generate(prompt, steps, seed, w, h):
    import torch
    JOB.update(state="running", step=0, total=steps, t0=time.time(), elapsed=0, preview=None, image=None)

    def cb(pipe, i, t, kw):
        JOB.update(step=i + 1, elapsed=time.time() - JOB["t0"], preview=latent_preview(kw["latents"]))
        return kw
    im = PIPE(prompt, negative_prompt="text, letters, watermark, logo, blurry, deformed", num_inference_steps=steps,
              guidance_scale=1.5, width=w, height=h, generator=torch.Generator().manual_seed(seed),
              callback_on_step_end=cb, callback_on_step_end_tensor_inputs=["latents"]).images[0]
    name = f"image_{int(time.time())}.png"; im.save(OUT / name)
    JOB.update(state="done", image="/out/" + name, elapsed=time.time() - JOB["t0"])
    JOB["log"].append({"prompt": prompt, "steps": steps, "seed": seed, "size": [w, h], "seconds": round(JOB["elapsed"], 1), "file": name})
    json.dump(JOB["log"], open(OUT / "image_log.json", "w"), ensure_ascii=False, indent=1)


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send(self, code, body, ctype="application/json"):
        if isinstance(body, (dict, list)): body = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/index.html"): return self.send(200, (HERE / "index.html").read_bytes(), "text/html; charset=utf-8")
        if self.path == "/api/status": return self.send(200, {**JOB, "elapsed": time.time() - JOB["t0"] if JOB["state"] == "running" else JOB["elapsed"], "log": None})
        if self.path.startswith("/out/"):
            f = OUT / Path(self.path[5:]).name
            if f.exists(): return self.send(200, f.read_bytes(), "audio/wav" if f.suffix == ".wav" else "image/png")
        self.send(404, {"error": "not found"})

    def do_POST(self):
        d = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        if self.path == "/api/image":
            if JOB["state"] == "running": return self.send(409, {"error": "busy"})
            threading.Thread(target=generate, args=(d["prompt"], int(d.get("steps", 6)), int(d.get("seed", 7)), int(d.get("w", 512)), int(d.get("h", 768))), daemon=True).start()
            return self.send(200, {"ok": True})
        if self.path == "/api/voice":
            t = time.time(); name = f"voice_{int(t)}.wav"
            r = subprocess.run(["python3", str(TTS), d["text"], str(OUT / name), "--voice", d.get("voice", "hf_beta"), "--lang", "hi",
                                "--speed", str(d.get("speed", 1.0))], capture_output=True, text=True, env={"KOKORO_DIR": A.kokoro, "PATH": "/usr/bin:/bin:/usr/local/bin"})
            took = time.time() - t
            with open(OUT / "voice_log.json", "a") as f: f.write(json.dumps({"text": d["text"], "voice": d.get("voice"), "seconds": round(took, 2), "file": name, "ok": r.returncode == 0}, ensure_ascii=False) + "\n")
            return self.send(200 if r.returncode == 0 else 500, {"url": "/out/" + name, "took": took, "err": r.stderr[-300:]})
        if self.path == "/api/save":
            name = d.get("name", "poster.png"); (OUT / Path(name).name).write_bytes(base64.b64decode(d["data"].split(",", 1)[1]))
            return self.send(200, {"ok": True, "file": name})
        self.send(404, {"error": "not found"})


threading.Thread(target=load, daemon=True).start()
print(f"http://127.0.0.1:{A.port}", flush=True)
ThreadingHTTPServer(("127.0.0.1", A.port), H).serve_forever()
