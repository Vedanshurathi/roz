"""End-to-end tests of the approval/publish guards on a throwaway copy. Run: python3 -m unittest pipeline/test_studio.py"""
import shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

import yaml

SRC = Path(__file__).resolve().parents[1]


class StudioFlow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        for d in ("pipeline", "config", "templates"):
            shutil.copytree(SRC / d, cls.tmp / d)
        (cls.tmp / "episodes").mkdir()
        cls.ep = cls.tmp / "episodes/ep-test"
        (cls.ep / "media").mkdir(parents=True)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=1080x1920:r=30:d=5",
                        "-f", "lavfi", "-i", "sine=f=330:d=5", "-af", "volume=0.3,loudnorm=I=-14:TP=-2", "-ar", "48000",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(cls.ep / "media/final.mp4")], check=True)
        ep = yaml.safe_load((SRC / "templates/episode.yaml").read_text())
        ep.update(slug="ep-test", kind="short", working_title="test")
        ep["youtube"].update(title="T", description="D", publish_at_ist="2099-01-01T08:00:00")
        (cls.ep / "episode.yaml").write_text(yaml.safe_dump(ep, allow_unicode=True))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def run_cli(self, *a):
        return subprocess.run([sys.executable, str(self.tmp / "pipeline/studio.py"), *a], capture_output=True, text=True)

    def test_flow(self):
        r = self.run_cli("package", str(self.ep)); self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        h = yaml.safe_load((self.ep / "episode.yaml").read_text())["package_hash"]
        self.assertEqual(self.run_cli("publish", str(self.ep)).returncode, 2)                     # unapproved -> refused
        self.assertNotEqual(self.run_cli("approve", str(self.ep), "--hash", "deadbeef0000", "--by", "x", "--channel", "claude_chat").returncode, 0)
        self.assertNotEqual(self.run_cli("approve", str(self.ep), "--hash", h[:12], "--by", "x", "--channel", "email").returncode, 0)
        r = self.run_cli("approve", str(self.ep), "--hash", h[:12], "--by", "owner", "--channel", "claude_chat"); self.assertEqual(r.returncode, 0, r.stderr)
        r = self.run_cli("publish", str(self.ep)); self.assertEqual(r.returncode, 0, r.stdout); self.assertIn("DRY RUN", r.stdout)
        # change the title after approval -> refused until re-packaged AND re-approved
        ep = yaml.safe_load((self.ep / "episode.yaml").read_text()); ep["youtube"]["title"] = "changed"
        (self.ep / "episode.yaml").write_text(yaml.safe_dump(ep, allow_unicode=True))
        r = self.run_cli("publish", str(self.ep)); self.assertEqual(r.returncode, 2); self.assertIn("no approval", r.stdout)
        # --execute stays blocked while publishing is disabled in config
        ep["youtube"]["title"] = "T"; (self.ep / "episode.yaml").write_text(yaml.safe_dump(ep, allow_unicode=True))
        r = self.run_cli("publish", str(self.ep), "--execute"); self.assertNotEqual(r.returncode, 0); self.assertIn("disabled", r.stderr)

    def test_qc_catches_wrong_format(self):
        bad = self.tmp / "bad.mp4"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=25:d=4", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(bad)], check=True)
        r = self.run_cli("qc", str(bad), "--kind", "short")
        self.assertEqual(r.returncode, 1)
        for k in ("FAIL resolution", "FAIL fps", "FAIL audio_present"):
            self.assertIn(k, r.stdout)


if __name__ == "__main__":
    unittest.main()
