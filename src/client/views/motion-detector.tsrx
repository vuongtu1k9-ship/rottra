import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { Icon } from "solid-heroicons";
import { videoCamera, stopCircle, playCircle } from "solid-heroicons/outline";

type MotionEvent = {
    time: number;
    area: number;
    threshold: number;
  };

function computeMotionDiff(
  prevData: Uint8ClampedArray | null,
  currData: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): { motionPixels: number; totalPixels: number } {
  const totalPixels = width * height;
  if (!prevData) {
    return { motionPixels: 0, totalPixels };
  }

  let motionPixels = 0;
  const step = 4;
  for (let i = 0; i < prevData.length; i += 4 * step) {
    const rDiff = Math.abs(currData[i] - prevData[i]);
    const gDiff = Math.abs(currData[i + 1] - prevData[i + 1]);
    const bDiff = Math.abs(currData[i + 2] - prevData[i + 2]);
    const diff = (rDiff + gDiff + bDiff) / 3;
    if (diff > threshold) {
      motionPixels++;
    }
  }
  return { motionPixels, totalPixels: Math.floor(totalPixels / step) };
}

export component MotionDetector(props: any) {
  let videoEl: HTMLVideoElement | undefined;
  let canvasEl: HTMLCanvasElement | undefined;
  let overlayCanvasEl: HTMLCanvasElement | undefined;
  let processFrameId: number | null = null;
  let prevFrameData: Uint8ClampedArray | null = null;
  let lastMotionTime = 0;

  const [isStreaming, setIsStreaming] = createSignal(false);
  const [isDetecting, setIsDetecting] = createSignal(false);
  const [error, setError] = createSignal<string>("");
  const [motionLevel, setMotionLevel] = createSignal(0);
  const [isAlert, setIsAlert] = createSignal(false);
  const [sensitivity, setSensitivity] = createSignal(20);
  const [minArea, setMinArea] = createSignal(500);
  const [motionLog, setMotionLog] = createSignal<MotionEvent[]>([]);
  const [stats, setStats] = createSignal({
    totalFrames: 0,
    motionFrames: 0,
    lastMotionPixels: 0,
    resolution: "0x0",
  });

  let stream: MediaStream | null = null;

  const startCamera = async () => {
    try {
      setError("");
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (videoEl) {
        videoEl.srcObject = stream;
        await videoEl.play();
      }
      setIsStreaming(true);
      prevFrameData = null;
    } catch (err: any) {
      setError("Không thể truy cập camera: " + (err.message || "Lỗi không xác định"));
    }
  };

  const stopCamera = () => {
    setIsDetecting(false);
    if (processFrameId) {
      cancelAnimationFrame(processFrameId);
      processFrameId = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
    setIsStreaming(false);
    prevFrameData = null;
    setMotionLevel(0);
    setIsAlert(false);
  };

  const startDetection = () => {
    if (!isStreaming() || !canvasEl || !videoEl) return;
    setIsDetecting(true);
    prevFrameData = null;
    setMotionLog([]);
    setStats((s) => ({ ...s, totalFrames: 0, motionFrames: 0 }));
  };

  const stopDetection = () => {
    setIsDetecting(false);
    if (processFrameId) {
      cancelAnimationFrame(processFrameId);
      processFrameId = null;
    }
  };

  const processFrame = () => {
    if (!isDetecting() || !canvasEl || !overlayCanvasEl || !videoEl) return;

    const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
    const overlayCtx = overlayCanvasEl.getContext("2d", { willReadFrequently: true });
    if (!ctx || !overlayCtx) return;

    const width = videoEl.videoWidth || 640;
    const height = videoEl.videoHeight || 480;

    if (canvasEl.width !== width || canvasEl.height !== height) {
      canvasEl.width = width;
      canvasEl.height = height;
      overlayCanvasEl.width = width;
      overlayCanvasEl.height = height;
    }

    ctx.drawImage(videoEl, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    const grayData = new Uint8ClampedArray(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      grayData[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    const result = computeMotionDiff(prevFrameData, grayData, width, height, sensitivity());

    const scaledMotionPixels = result.motionPixels;
    const motionPercent =
      result.totalPixels > 0 ? scaledMotionPixels / result.totalPixels : 0;
    setMotionLevel(motionPercent);

    const isCurrentlyAlert = scaledMotionPixels > minArea() * 0.01;
    setIsAlert(isCurrentlyAlert);

    const now = Date.now();
    setStats(
      (s) => ({
        ...s,
        totalFrames: s.totalFrames + 1,
        motionFrames: s.motionFrames + (isCurrentlyAlert ? 1 : 0),
        lastMotionPixels: scaledMotionPixels,
        resolution: `${width}x${height}`,
      }),
    );

    if (isCurrentlyAlert && now - lastMotionTime > 3000) {
      lastMotionTime = now;
      setMotionLog(
        (prev) => [
          {
            time: now,
            area: scaledMotionPixels,
            threshold: sensitivity(),
          },
          ...prev.slice(0, 49),
        ],
      );
    }

    overlayCtx.clearRect(0, 0, width, height);

    if (isCurrentlyAlert) {
      overlayCtx.strokeStyle = "rgba(239, 68, 68, 0.8)";
      overlayCtx.lineWidth = 3;
      overlayCtx.strokeRect(2, 2, width - 4, height - 4);
    }

    const blockSize = 16;
    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        let blockDiff = 0;
        let count = 0;
        for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
          for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
            const idx = (y + dy) * width + x + dx;
            if (prevFrameData && Math.abs(grayData[idx] - prevFrameData[idx]) > sensitivity()) {
              blockDiff++;
            }
            count++;
          }
        }
        if (count > 0 && blockDiff / count > 0.3) {
          overlayCtx.fillStyle = "rgba(239, 68, 68, 0.35)";
          overlayCtx.fillRect(x, y, blockSize, blockSize);
        }
      }
    }

    prevFrameData = grayData;
    processFrameId = requestAnimationFrame(processFrame);
  };

  createEffect(() => {
    if (isDetecting()) {
      processFrameId = requestAnimationFrame(processFrame);
    } else {
      if (processFrameId) {
        cancelAnimationFrame(processFrameId);
        processFrameId = null;
      }
    }
  });

  onCleanup(() => {
    stopCamera();
  });

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("vi-VN");
  };

  <tsx>
    <div class="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
            {"Camera Motion Detector"}
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {"Phát hiện chuyển động qua webcam bằng TypeScript + Canvas API"}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <Show when={!isStreaming()}>
            <button
              onClick={startCamera}
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20 cursor-pointer">
              <Icon path={videoCamera} class="w-4 h-4" />
              <span>
                {"Mở Camera"}
              </span>
            </button>
          </Show>
          <Show when={isStreaming() && !isDetecting()}>
            <button
              onClick={startDetection}
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 cursor-pointer">
              <Icon path={playCircle} class="w-4 h-4" />
              <span>
                {"Bắt đầu phát hiện"}
              </span>
            </button>
          </Show>
          <Show when={isDetecting()}>
            <button
              onClick={stopDetection}
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition-all shadow-lg shadow-amber-500/20 cursor-pointer">
              <Icon path={stopCircle} class="w-4 h-4" />
              <span>
                {"Dừng phát hiện"}
              </span>
            </button>
          </Show>
          <Show when={isStreaming()}>
            <button
              onClick={stopCamera}
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all shadow-lg shadow-red-500/20 cursor-pointer">
              <Icon path={stopCircle} class="w-4 h-4" />
              <span>
                {"Tắt Camera"}
              </span>
            </button>
          </Show>
        </div>
      </div>
      <Show when={error()}>
        <div
          class="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm font-medium">
          {error()}
        </div>
      </Show>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-4">
          <div class="relative rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 bg-black shadow-2xl">
            <div class="relative aspect-video w-full">
              <video ref={videoEl} autoplay playsinline muted class="absolute inset-0 w-full h-full object-cover" />
              <canvas ref={canvasEl} class="absolute inset-0 w-full h-full object-cover pointer-events-none" />
              <canvas ref={overlayCanvasEl} class="absolute inset-0 w-full h-full object-cover pointer-events-none" />
              <Show when={!isStreaming()}>
                <div class="absolute inset-0 flex items-center justify-center bg-gray-900/80 text-gray-300">
                  <div class="text-center space-y-2">
                    <svg class="w-16 h-16 mx-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h13a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <p class="text-sm font-medium">
                      {"Camera chưa bật"}
                    </p>
                  </div>
                </div>
              </Show>
              <Show when={isAlert()}>
                <div
                  class="absolute top-4 left-4 right-4 p-3 rounded-2xl bg-red-600/90 text-white font-bold text-sm shadow-xl backdrop-blur-sm border border-red-400/50 animate-pulse">
                  {"CẢNH BÁO: Phát hiện chuyển động bất thường!"}
                </div>
              </Show>
            </div>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {"Tổng khung"}
              </div>
              <div class="text-xl font-black text-gray-900 dark:text-white">
                {stats().totalFrames}
              </div>
            </div>
            <div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {"Khung chuyển động"}
              </div>
              <div class="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {stats().motionFrames}
              </div>
            </div>
            <div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {"Pixel chuyển động"}
              </div>
              <div class="text-xl font-black text-amber-600 dark:text-amber-400">
                {stats().lastMotionPixels}
              </div>
            </div>
            <div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {"Độ phân giải"}
              </div>
              <div class="text-xl font-black text-blue-600 dark:text-blue-400">
                {stats().resolution}
              </div>
            </div>
          </div>
        </div>
        <div class="space-y-4">
          <div class="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 space-y-5">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">
              {"Cài đặt"}
            </h3>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {"Ngưỡng chuyển động: " + sensitivity()}
              </label>
              <input
                type="range"
                min="5"
                max="80"
                value={sensitivity()}
                onInput={(e) => setSensitivity(Number((e.target as HTMLInputElement).value))}
                class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {"Giá trị thấp = nhạy hơn"}
              </p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {"Diện tích tối thiểu: " + minArea()}
              </label>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={minArea()}
                onInput={(e) => setMinArea(Number((e.target as HTMLInputElement).value))}
                class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {"Số pixel chuyển động tối thiểu để kích hoạt cảnh báo"}
              </p>
            </div>
          </div>
          <div class="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-3">
              {"Mức độ chuyển động"}
            </h3>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(motionLevel() * 100 * 10, 100)}%`,
                  "background-color": motionLevel() > 0.05 ? "rgb(239, 68, 68)" : "rgb(34, 197, 94)",
                }}
              />
            </div>
            <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {(motionLevel() * 100).toFixed(2)}
              %
              {"khung hình có chuyển động"}
            </div>
          </div>
          <div class="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-3">
              {"Nhật ký sự kiện"}
            </h3>
            <Show
              when={motionLog().length > 0}
              fallback={<tsx>
                <p class="text-sm text-gray-400 italic">
                  {"Chưa có sự kiện nào"}
                </p>
              </tsx>}>
              <div class="space-y-2 max-h-64 overflow-y-auto">
                <For each={motionLog()}>
                  {(evt) => <div
                    class="flex items-center justify-between p-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-500/20">
                    <div class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span class="text-xs font-bold text-gray-900 dark:text-white">
                        {formatTime(evt.time)}
                      </span>
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400">
                      {evt.area}
                      px · ngưỡng
                      {evt.threshold}
                    </div>
                  </div>}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  </tsx>
}
