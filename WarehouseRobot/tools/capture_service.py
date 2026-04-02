#!/usr/bin/env python3
"""
Capture frames from an ESP32-CAM MJPEG stream when the Arduino UNO signals capture (Serial).

Project path (Senior-Design repo):
  .../Senior-Design/WarehouseRobot/tools/capture_service.py

Works with the WarehouseRobot Arduino sketch (CAPTURE_REQUEST on Serial @ 9600).

Typical setup:
  - PC Wi-Fi: connect to robot ESP32 SoftAP (often http://192.168.4.1).
  - PC USB: Arduino UNO for Serial at 9600 (Upload mode as required by ELEGOO).

From this folder:
  pip install -r requirements-capture.txt

Examples:
  python capture_service.py --serial-port COM5
  python capture_service.py --serial-port COM5 --selection sharpest --buffer-size 25
  python capture_service.py --serial-port COM5 --selection multi --multi-count 5
  python capture_service.py --no-serial
"""

from __future__ import annotations

import argparse
import os
import sys
import threading
import time
from collections import deque
from datetime import datetime, timezone

try:
    import cv2
except ImportError:
    print("Missing opencv-python. Run: pip install -r requirements-capture.txt", file=sys.stderr)
    sys.exit(1)

try:
    import serial
except ImportError:
    print("Missing pyserial. Run: pip install -r requirements-capture.txt", file=sys.stderr)
    sys.exit(1)


def laplacian_sharpness(bgr) -> float:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%f")[:-3] + "Z"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Buffer MJPEG stream from ESP32; save JPEG(s) on UNO Serial trigger."
    )
    p.add_argument(
        "--stream-url",
        default="http://192.168.4.1/stream",
        help="ESP32 MJPEG stream URL (default: SoftAP)",
    )
    p.add_argument(
        "--serial-port",
        default=None,
        help="UNO serial port (Windows: COM5, Linux: /dev/ttyUSB0). Omit with --no-serial.",
    )
    p.add_argument("--baud", type=int, default=9600, help="Serial baud (default 9600)")
    p.add_argument(
        "--trigger",
        default="CAPTURE_REQUEST",
        help="Substring that must appear on a serial line to fire capture",
    )
    p.add_argument(
        "--output-dir",
        default="captures",
        help="Directory for saved JPEGs (created if missing)",
    )
    p.add_argument(
        "--buffer-size",
        type=int,
        default=30,
        help="Max frames to keep in ring buffer (default 30)",
    )
    p.add_argument(
        "--selection",
        choices=("newest", "sharpest", "multi"),
        default="sharpest",
        help="newest: last frame; sharpest: max Laplacian variance in buffer; "
        "multi: save last N frames",
    )
    p.add_argument(
        "--multi-count",
        type=int,
        default=3,
        help="With --selection multi, how many trailing frames to save (default 3)",
    )
    p.add_argument(
        "--jpeg-quality",
        type=int,
        default=95,
        help="JPEG quality 1-100 for cv2.imwrite (default 95)",
    )
    p.add_argument(
        "--stream-backend",
        default="",
        help="Optional OpenCV capture backend, e.g. FFMPEG (auto if empty)",
    )
    p.add_argument(
        "--reopen-sec",
        type=float,
        default=2.0,
        help="Seconds to wait before reopening stream after read failures",
    )
    p.add_argument(
        "--no-serial",
        action="store_true",
        help="Do not open serial; press ENTER in terminal to trigger capture (testing)",
    )
    return p.parse_args()


class CaptureService:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self._stop = threading.Event()
        self._trigger = threading.Event()
        self._buf_lock = threading.Lock()
        self._frames: deque[tuple[float, "cv2.Mat"]] = deque(maxlen=max(1, args.buffer_size))

    def _open_capture(self):
        url = self.args.stream_url
        be = self.args.stream_backend.strip().upper()
        if be == "FFMPEG":
            cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        elif be:
            # allow numeric CAP_* if user passes a number
            try:
                cap = cv2.VideoCapture(url, int(be))
            except ValueError:
                cap = cv2.VideoCapture(url)
        else:
            cap = cv2.VideoCapture(url)
        return cap

    def stream_worker(self):
        cap = None
        fail_streak = 0
        while not self._stop.is_set():
            if cap is None or not cap.isOpened():
                if cap is not None:
                    cap.release()
                cap = self._open_capture()
                if not cap.isOpened():
                    print(f"[stream] cannot open {self.args.stream_url}, retry in {self.args.reopen_sec}s")
                    time.sleep(self.args.reopen_sec)
                    continue
                print(f"[stream] opened {self.args.stream_url}")

            ok, frame = cap.read()
            if not ok or frame is None:
                fail_streak += 1
                if fail_streak > 30:
                    print("[stream] read failing, reopening")
                    cap.release()
                    cap = None
                    fail_streak = 0
                    time.sleep(self.args.reopen_sec)
                else:
                    time.sleep(0.01)
                continue

            fail_streak = 0
            now = time.time()
            with self._buf_lock:
                self._frames.append((now, frame.copy()))

    def serial_worker(self):
        try:
            ser = serial.Serial(self.args.serial_port, self.args.baud, timeout=0.2)
        except serial.SerialException as e:
            print(f"[serial] failed to open {self.args.serial_port}: {e}", file=sys.stderr)
            self._stop.set()
            return

        print(f"[serial] listening on {self.args.serial_port} @ {self.args.baud}")
        buf = ""
        while not self._stop.is_set():
            try:
                chunk = ser.read(512)
            except serial.SerialException:
                time.sleep(0.05)
                continue
            if not chunk:
                continue
            buf += chunk.decode(errors="ignore")
            while "\n" in buf:
                line, buf = buf.split("\n", 1)
                line = line.strip()
                if self.args.trigger in line:
                    print(f"[serial] trigger: {line!r}")
                    self._trigger.set()

    def manual_trigger_worker(self):
        print("[manual] Press ENTER to capture (Ctrl+C to quit)")
        while not self._stop.is_set():
            try:
                sys.stdin.readline()
            except Exception:
                break
            self._trigger.set()

    def save_on_trigger(self):
        os.makedirs(self.args.output_dir, exist_ok=True)
        q = max(1, min(100, self.args.jpeg_quality))

        while not self._stop.is_set():
            if not self._trigger.wait(timeout=0.25):
                continue
            self._trigger.clear()

            with self._buf_lock:
                if not self._frames:
                    print("[capture] buffer empty, skip")
                    continue
                snapshot = list(self._frames)

            stamp = utc_stamp()
            sel = self.args.selection

            if sel == "newest":
                _, frame = snapshot[-1]
                path = os.path.join(self.args.output_dir, f"capture_{stamp}.jpg")
                cv2.imwrite(path, frame, [int(cv2.IMWRITE_JPEG_QUALITY), q])
                print(f"[capture] saved {path}")

            elif sel == "sharpest":
                best = max(snapshot, key=lambda t: laplacian_sharpness(t[1]))
                path = os.path.join(self.args.output_dir, f"capture_{stamp}_sharp.jpg")
                cv2.imwrite(path, best[1], [int(cv2.IMWRITE_JPEG_QUALITY), q])
                print(f"[capture] saved {path} (sharpness={laplacian_sharpness(best[1]):.1f})")

            else:
                n = max(1, self.args.multi_count)
                chunk = snapshot[-n:]
                for i, (_, frame) in enumerate(chunk):
                    path = os.path.join(
                        self.args.output_dir,
                        f"capture_{stamp}_m{i:02d}.jpg",
                    )
                    cv2.imwrite(path, frame, [int(cv2.IMWRITE_JPEG_QUALITY), q])
                print(f"[capture] saved {len(chunk)} frames under {self.args.output_dir}/")

    def run(self):
        threads = [
            threading.Thread(target=self.stream_worker, name="stream", daemon=True),
            threading.Thread(target=self.save_on_trigger, name="capture", daemon=True),
        ]

        if self.args.no_serial:
            threads.append(threading.Thread(target=self.manual_trigger_worker, name="manual", daemon=True))
        else:
            if not self.args.serial_port:
                print("Error: set --serial-port or use --no-serial", file=sys.stderr)
                sys.exit(2)
            threads.append(threading.Thread(target=self.serial_worker, name="serial", daemon=True))

        for t in threads:
            t.start()

        try:
            while any(t.is_alive() for t in threads):
                time.sleep(0.2)
        except KeyboardInterrupt:
            print("\n[main] stopping")
            self._stop.set()
            time.sleep(0.5)


def main():
    args = parse_args()
    CaptureService(args).run()


if __name__ == "__main__":
    main()
