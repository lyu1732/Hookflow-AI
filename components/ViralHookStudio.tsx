"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  BadgeCheck,
  BarChart3,
  CalendarClock,
  Captions,
  Crown,
  Download,
  FileVideo,
  Gauge,
  Hash,
  LoaderCircle,
  Play,
  Sparkles,
  Target,
  Upload,
  Wand2,
  X,
  Zap
} from "lucide-react";

type ExportMode = "watermark" | "rewarded";
type ToastType = "success" | "error";

type HookTemplate = {
  id: "zoom" | "asmr" | "fast" | "reverse" | "subtitle";
  name: string;
  label: string;
  description: string;
  previewClass: string;
  exportEffect: "zoom" | "pulse" | "fast" | "reverse" | "subtitle";
};

type ExportResult = {
  url: string;
  size: number;
  mode: ExportMode;
  fileName: string;
  mimeType: string;
  duration: number;
};

type Analysis = {
  category: string;
  elements: string[];
  visualStyle: string;
  attentionScore: number;
  hookStrength: number;
  engagementLift: string;
  retentionLift: string;
  recommendedHook: string;
};

type CopyPack = {
  titles: string[];
  captions: string[];
  hashtags: string[];
  publishTime: string;
};

type FrameMetric = {
  brightness: number;
  saturation: number;
  contrast: number;
  warmth: number;
  edgeEnergy: number;
};

type AnalyzeResponse = {
  analysis: Analysis;
  copyPack: CopyPack;
  source: "gemini" | "local-fallback";
};

const templates: HookTemplate[] = [
  {
    id: "zoom",
    name: "爆点前置",
    label: "前 1 秒抓住注意力",
    description: "轻微推近画面并强化对比，让开场更有冲击感。",
    previewClass: "preview-zoom",
    exportEffect: "zoom"
  },
  {
    id: "asmr",
    name: "ASMR卡点",
    label: "质感增强与轻节奏",
    description: "增强细节和节奏感，适合美食、手作、开箱。",
    previewClass: "preview-asmr",
    exportEffect: "pulse"
  },
  {
    id: "fast",
    name: "快速开场",
    label: "更快进入主题",
    description: "用快节奏开头减少流失，适合教程和产品展示。",
    previewClass: "preview-fast",
    exportEffect: "fast"
  },
  {
    id: "reverse",
    name: "悬念倒放",
    label: "先给结果再反转",
    description: "用反向视觉制造悬念，强化看完动机。",
    previewClass: "preview-reverse",
    exportEffect: "reverse"
  },
  {
    id: "subtitle",
    name: "爆款字幕",
    label: "醒目标题引导停留",
    description: "加入强提示字幕，让观众知道下一秒值得看。",
    previewClass: "preview-subtitle",
    exportEffect: "subtitle"
  }
];

const formatSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const getSupportedRecorder = () => {
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
};

const getFileExtension = (mimeType: string) => (mimeType.includes("mp4") ? "mp4" : "webm");

const waitForVideoReady = (video: HTMLVideoElement) =>
  new Promise<void>((resolve, reject) => {
    if (video.readyState >= 2 && video.videoWidth > 0) {
      resolve();
      return;
    }

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("视频读取失败"));
    };

    video.addEventListener("loadedmetadata", onReady, { once: true });
    video.addEventListener("canplay", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });

const seekVideo = (video: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("视频抽帧失败"));
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = Math.max(0, Math.min(time, video.duration || time));
  });

const getFrameMetric = (context: CanvasRenderingContext2D, width: number, height: number): FrameMetric => {
  const { data } = context.getImageData(0, 0, width, height);
  let brightness = 0;
  let saturation = 0;
  let warmth = 0;
  let contrast = 0;
  let edgeEnergy = 0;
  const step = Math.max(4, Math.floor(data.length / 3200) * 4);
  let count = 0;

  for (let index = 0; index < data.length; index += step) {
    const red = data[index] / 255;
    const green = data[index + 1] / 255;
    const blue = data[index + 2] / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const light = (red + green + blue) / 3;

    brightness += light;
    saturation += max === 0 ? 0 : (max - min) / max;
    warmth += Math.max(0, red - blue + 0.5);
    contrast += Math.abs(light - 0.5) * 2;

    const next = Math.min(data.length - 4, index + step);
    edgeEnergy +=
      (Math.abs(data[index] - data[next]) +
        Math.abs(data[index + 1] - data[next + 1]) +
        Math.abs(data[index + 2] - data[next + 2])) /
      765;
    count += 1;
  }

  return {
    brightness: Number((brightness / count).toFixed(3)),
    saturation: Number((saturation / count).toFixed(3)),
    contrast: Number((contrast / count).toFixed(3)),
    warmth: Number(Math.min(1, warmth / count).toFixed(3)),
    edgeEnergy: Number((edgeEnergy / count).toFixed(3))
  };
};

const extractAnalysisFrames = async (url: string) => {
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  await waitForVideoReady(video);

  const duration = Number.isFinite(video.duration) ? video.duration : 8;
  const aspectRatio = video.videoWidth / video.videoHeight;
  const scale = Math.min(1, 400 / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.max(2, Math.round(video.videoWidth * scale));
  const height = Math.max(2, Math.round(video.videoHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("无法初始化抽帧画布");

  const times = [0.15, duration / 2, Math.max(0.15, duration - 0.25)];
  const frames: string[] = [];
  const metrics: FrameMetric[] = [];

  for (const time of times) {
    await seekVideo(video, time);
    context.drawImage(video, 0, 0, width, height);
    metrics.push(getFrameMetric(context, width, height));
    frames.push(canvas.toDataURL("image/jpeg", 0.42).split(",")[1] ?? "");
  }

  video.removeAttribute("src");
  video.load();
  return { frames, metrics, duration, aspectRatio };
};

const generateAnalysis = (file: File | null, template: HookTemplate): Analysis => {
  const name = file?.name.toLowerCase() ?? "";
  const isDance = /dance|kpop|舞|跳/.test(name);
  const isProduct = /product|shop|review|开箱|测评|产品/.test(name);
  const isFood = /food|cook|餐|美食|吃/.test(name);

  if (isDance) {
    return {
      category: "舞蹈 / 表演",
      elements: ["KPOP", "快节奏音乐", "人物动作"],
      visualStyle: "女团表演 / 竖屏舞台感",
      attentionScore: 78,
      hookStrength: 82,
      engagementLift: "+12%",
      retentionLift: "+18%",
      recommendedHook: template.id === "asmr" ? "ASMR卡点" : "快速开场"
    };
  }

  if (isProduct) {
    return {
      category: "产品种草",
      elements: ["产品展示", "使用场景", "卖点解释"],
      visualStyle: "干净近景 / 高信息密度",
      attentionScore: 74,
      hookStrength: 79,
      engagementLift: "+10%",
      retentionLift: "+16%",
      recommendedHook: "爆款字幕"
    };
  }

  if (isFood) {
    return {
      category: "美食生活",
      elements: ["质感细节", "手部动作", "环境氛围"],
      visualStyle: "近景质感 / 沉浸式节奏",
      attentionScore: 81,
      hookStrength: 86,
      engagementLift: "+14%",
      retentionLift: "+21%",
      recommendedHook: "ASMR卡点"
    };
  }

  return {
    category: "生活方式 / 创作者内容",
    elements: ["人物主体", "场景切换", "情绪表达"],
    visualStyle: "短视频竖屏 / 真实记录感",
    attentionScore: 76,
    hookStrength: 80,
    engagementLift: "+11%",
    retentionLift: "+17%",
    recommendedHook: template.name
  };
};

const generateCopyPack = (analysis: Analysis): CopyPack => ({
  titles: [
    "最后3秒千万别划走",
    analysis.category.includes("舞蹈") ? "这个动作居然还能这么跳" : "这个细节我反复看了十遍",
    "普通内容这样开场，停留率直接拉满"
  ],
  captions: [
    "原来这个开头还能这样设计，难怪完播率更高。",
    "把最有冲击力的画面提前，观众才愿意继续看。",
    "今天这条适合用强提示字幕做第一秒钩子。"
  ],
  hashtags: ["#creator", "#viral", "#短视频增长", "#hook", "#内容运营"],
  publishTime: "19:00-21:00"
});

const MetricCard = memo(function MetricCard({
  label,
  value,
  tone = "cyan"
}: {
  label: string;
  value: string;
  tone?: "cyan" | "mint" | "coral";
}) {
  const toneClass =
    tone === "mint" ? "text-mint" : tone === "coral" ? "text-coral" : "text-cyan";

  return (
    <div className="rounded-lg border border-line bg-white/[0.045] p-4">
      <p className="text-xs text-white/50">{label}</p>
      <p className={`mt-2 text-2xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
});

const TemplateSelector = memo(function TemplateSelector({
  selectedId,
  disabled,
  onSelect
}: {
  selectedId: HookTemplate["id"];
  disabled: boolean;
  onSelect: (template: HookTemplate) => void;
}) {
  return (
    <aside className="rounded-lg border border-line bg-panel/90 shadow-lift backdrop-blur">
      <div className="border-b border-line px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-coral">
          增长模板
        </p>
        <h2 className="mt-1 text-lg font-bold">选择爆款结构</h2>
      </div>
      <div className="studio-scrollbar grid max-h-[38rem] gap-3 overflow-auto p-4">
        {templates.map((template, index) => {
          const isActive = template.id === selectedId;

          return (
            <button
              key={template.id}
              className={`rounded-lg border p-4 text-left transition ${
                isActive
                  ? "border-cyan bg-cyan/10 shadow-glow"
                  : "border-line bg-white/[0.04] hover:border-white/28 hover:bg-white/[0.065]"
              }`}
              onClick={() => onSelect(template)}
              disabled={disabled}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-white text-xs font-black text-ink">
                      {index + 1}
                    </span>
                    <h3 className="font-black">{template.name}</h3>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white/82">
                    {template.label}
                  </p>
                </div>
                {isActive ? <Play size={18} className="text-cyan" /> : <Wand2 size={18} />}
              </div>
              <p className="mt-3 text-sm leading-5 text-white/58">{template.description}</p>
            </button>
          );
        })}
      </div>
    </aside>
  );
});

const AnalysisDashboard = memo(function AnalysisDashboard({
  analysis,
  copyPack,
  isAnalyzing
}: {
  analysis: Analysis;
  copyPack: CopyPack;
  isAnalyzing: boolean;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="rounded-lg border border-line bg-panel/88 p-5 shadow-lift">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan">
              AI推荐分析
            </p>
            <h2 className="mt-1 text-xl font-black">Creator Growth Diagnosis</h2>
          </div>
          {isAnalyzing ? <LoaderCircle className="animate-spin text-cyan" size={24} /> : <Target className="text-cyan" size={24} />}
        </div>

        {isAnalyzing ? (
          <div className="mt-5 rounded-lg border border-cyan/30 bg-cyan/10 p-4 text-sm font-bold text-cyan">
            AI正在分析视频内容...
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <MetricCard label="吸引力评分" value={`${analysis.attentionScore}/100`} />
          <MetricCard label="钩子强度" value={`${analysis.hookStrength}/100`} tone="mint" />
          <MetricCard label="预计停留提升" value={analysis.retentionLift} tone="coral" />
          <MetricCard label="预计互动提升" value={analysis.engagementLift} tone="mint" />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-line bg-white/[0.04] p-4">
            <p className="text-sm text-white/50">视频类型</p>
            <p className="mt-2 text-lg font-bold">{analysis.category}</p>
          </div>
          <div className="rounded-lg border border-line bg-white/[0.04] p-4">
            <p className="text-sm text-white/50">视觉风格</p>
            <p className="mt-2 text-lg font-bold">{analysis.visualStyle}</p>
          </div>
          <div className="rounded-lg border border-line bg-white/[0.04] p-4">
            <p className="text-sm text-white/50">主要元素</p>
            <p className="mt-2 text-lg font-bold">{analysis.elements.join(" / ")}</p>
          </div>
          <div className="rounded-lg border border-line bg-white/[0.04] p-4">
            <p className="text-sm text-white/50">推荐结构</p>
            <p className="mt-2 text-lg font-bold text-cyan">{analysis.recommendedHook}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-panel/88 p-5 shadow-lift">
        <div className="flex items-center gap-2">
          <Captions className="text-coral" size={20} />
          <h2 className="text-lg font-black">AI Content Recommendations</h2>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
              标题
            </p>
            <div className="space-y-2">
              {copyPack.titles.map((title) => (
                <div key={title} className="rounded-md bg-white/[0.055] px-3 py-2 text-sm">
                  {title}
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
              文案
            </p>
            <div className="space-y-2">
              {copyPack.captions.map((caption) => (
                <div key={caption} className="rounded-md bg-white/[0.055] px-3 py-2 text-sm">
                  {caption}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-md bg-white/[0.055] px-3 py-3">
            <Hash className="mt-0.5 text-cyan" size={16} />
            <p className="text-sm leading-6">{copyPack.hashtags.join(" ")}</p>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-white/[0.055] px-3 py-3">
            <CalendarClock className="text-mint" size={16} />
            <p className="text-sm">AI Publishing Strategy：{copyPack.publishTime}</p>
          </div>
        </div>
      </div>
    </section>
  );
});

export default function ViralHookStudio() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeExportRef = useRef(false);
  const [selectedTemplate, setSelectedTemplate] = useState<HookTemplate>(templates[0]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [status, setStatus] = useState("上传一段素材，生成增长分析和轻量导出。");
  const [progress, setProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportLogs, setExportLogs] = useState<string[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [adCount, setAdCount] = useState(15);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>(() => generateAnalysis(null, templates[0]));
  const [copyPack, setCopyPack] = useState<CopyPack>(() => generateCopyPack(generateAnalysis(null, templates[0])));

  const selectedIndex = useMemo(
    () => templates.findIndex((template) => template.id === selectedTemplate.id) + 1,
    [selectedTemplate]
  );

  const appendLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    console.info(`[HookFlow AI] ${message}`);
    setExportLogs((current) => [`${time} ${message}`, ...current].slice(0, 10));
  }, []);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (exportResult?.url) URL.revokeObjectURL(exportResult.url);
    };
  }, [videoUrl, exportResult?.url]);

  const onFileChange = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const isVideo = file.type === "video/mp4" || file.type === "video/quicktime";
      const hasValidExtension = /\.(mp4|mov)$/i.test(file.name);

      if (!isVideo && !hasValidExtension) {
        setStatus("请选择 MP4 或 MOV 格式的视频。");
        showToast("error", "文件格式不支持");
        return;
      }

      if (file.size <= 0) {
        setStatus("视频文件为空，请重新选择。");
        showToast("error", "视频文件为空");
        return;
      }

      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (exportResult?.url) URL.revokeObjectURL(exportResult.url);

      const nextVideoUrl = URL.createObjectURL(file);
      setVideoFile(file);
      setVideoUrl(nextVideoUrl);
      setExportResult(null);
      setProgress(0);
      setExportLogs([]);
      setIsAnalyzing(true);
      setStatus("AI正在分析视频内容...");
      appendLog(`素材已加载：${file.name}，${formatSize(file.size)}`);

      try {
        const framePayload = await extractAnalysisFrames(nextVideoUrl);
        appendLog("已抽取开头 / 中间 / 结尾三帧，并压缩到 400px 内");

        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 4800);
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            ...framePayload,
            template: selectedTemplate.name
          })
        });
        window.clearTimeout(timeout);

        if (!response.ok) throw new Error("AI 分析接口异常");
        const data = (await response.json()) as AnalyzeResponse;
        setAnalysis(data.analysis);
        setCopyPack(data.copyPack);
        setStatus(
          data.source === "gemini"
            ? "Gemini 已完成内容理解和增长建议。"
            : "已使用本地视觉启发式完成增长分析。"
        );
        appendLog(data.source === "gemini" ? "Gemini Vision 分析完成" : "本地 fallback 分析完成");
      } catch {
        const fallbackAnalysis = generateAnalysis(null, selectedTemplate);
        setAnalysis(fallbackAnalysis);
        setCopyPack(generateCopyPack(fallbackAnalysis));
        setStatus("AI 分析超时，已使用本地快速策略生成建议。");
        appendLog("AI 分析超时，使用客户端快速兜底");
      } finally {
        setIsAnalyzing(false);
      }
    },
    [appendLog, exportResult?.url, selectedTemplate, showToast, videoUrl]
  );

  const drawFrame = useCallback(
    (
      context: CanvasRenderingContext2D,
      video: HTMLVideoElement,
      width: number,
      height: number,
      mode: ExportMode
    ) => {
      const effect = selectedTemplate.exportEffect;
      const time = video.currentTime;

      context.save();
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#050509";
      context.fillRect(0, 0, width, height);

      let scale = 1;
      let flip = false;
      if (effect === "zoom") scale = 1.04 + Math.min(time / 1.5, 1) * 0.05;
      if (effect === "pulse") scale = 1 + Math.sin(time * Math.PI * 3) * 0.018;
      if (effect === "fast") scale = 1.035;
      if (effect === "reverse") flip = true;

      const videoRatio = video.videoWidth / video.videoHeight;
      const canvasRatio = width / height;
      let drawWidth = width;
      let drawHeight = height;
      if (videoRatio > canvasRatio) {
        drawHeight = width / videoRatio;
      } else {
        drawWidth = height * videoRatio;
      }

      drawWidth *= scale;
      drawHeight *= scale;
      const x = (width - drawWidth) / 2;
      const y = (height - drawHeight) / 2;

      if (flip) {
        context.translate(width, 0);
        context.scale(-1, 1);
        context.drawImage(video, width - x - drawWidth, y, drawWidth, drawHeight);
      } else {
        context.drawImage(video, x, y, drawWidth, drawHeight);
      }

      if (effect === "subtitle") {
        context.fillStyle = "rgba(0,0,0,0.58)";
        context.fillRect(width * 0.14, height * 0.1, width * 0.72, 72);
        context.font = "800 42px Arial, Helvetica, sans-serif";
        context.fillStyle = "white";
        context.textAlign = "center";
        context.fillText("先别划走", width / 2, height * 0.1 + 49);
      }

      if (mode === "watermark") {
        context.font = "700 24px Arial, Helvetica, sans-serif";
        const text = "Made by Hook AI";
        const metrics = context.measureText(text);
        const boxWidth = metrics.width + 34;
        const boxHeight = 46;
        const boxX = width - boxWidth - 24;
        const boxY = height - boxHeight - 22;
        context.fillStyle = "rgba(0,0,0,0.48)";
        context.fillRect(boxX, boxY, boxWidth, boxHeight);
        context.fillStyle = "rgba(255,255,255,0.94)";
        context.textAlign = "left";
        context.fillText(text, boxX + 17, boxY + 31);
      }

      context.restore();
    },
    [selectedTemplate.exportEffect]
  );

  const runCanvasExport = useCallback(
    async (mode: ExportMode) => {
      if (!videoFile || !videoUrl || activeExportRef.current) {
        if (!videoFile) showToast("error", "请先上传视频");
        return;
      }

      const mimeType = getSupportedRecorder();
      if (!mimeType) {
        showToast("error", "当前浏览器不支持轻量导出");
        return;
      }

      activeExportRef.current = true;
      setIsExportModalOpen(false);
      setIsExporting(true);
      setExportResult(null);
      setProgress(0);
      setExportLogs([]);

      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      let animationId = 0;

      try {
        appendLog("使用 Canvas + MediaRecorder 轻量导出");
        appendLog("跳过 FFmpeg WASM 全量转码，优先保证秒级体验");

        video.src = videoUrl;
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        await waitForVideoReady(video);

        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 8;
        const sourceWidth = video.videoWidth || 720;
        const sourceHeight = video.videoHeight || 1280;
        const maxLongSide = 720;
        const scale = Math.min(1, maxLongSide / Math.max(sourceWidth, sourceHeight));
        const width = Math.max(2, Math.round((sourceWidth * scale) / 2) * 2);
        const height = Math.max(2, Math.round((sourceHeight * scale) / 2) * 2);
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas 初始化失败");

        const canvasStream = canvas.captureStream(30);
        const sourceStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
        sourceStream?.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
        const recorder = new MediaRecorder(canvasStream, {
          mimeType,
          videoBitsPerSecond: 1_500_000
        });
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };

        const finished = new Promise<Blob>((resolve, reject) => {
          recorder.onerror = () => reject(new Error("浏览器录制失败"));
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            const minimumExpectedSize = Math.min(200_000, Math.max(20_000, duration * 5_000));
            if (blob.size <= minimumExpectedSize) reject(new Error("导出文件过小，录制未完整完成"));
            else resolve(blob);
          };
        });

        video.currentTime = 0;
        await video.play();
        recorder.start(250);
        appendLog(`导出参数：${width}x${height} / 30fps / ${mimeType}`);
        appendLog(`完整视频导出：约 ${Math.ceil(duration)} 秒`);

        const startedAt = performance.now();
        const render = () => {
          if (!activeExportRef.current) return;
          const elapsed = (performance.now() - startedAt) / 1000;

          drawFrame(context, video, width, height, mode);
          const percent = Math.min(98, Math.round((video.currentTime / duration) * 100));
          setProgress(percent);
          setStatus(`正在轻量导出：${percent}%`);

          if (video.ended || video.currentTime >= duration - 0.05 || elapsed >= duration + 1.5) {
            recorder.stop();
            video.pause();
            return;
          }

          animationId = window.requestAnimationFrame(render);
        };

        animationId = window.requestAnimationFrame(render);
        const blob = await finished;
        const url = URL.createObjectURL(blob);
        const extension = getFileExtension(mimeType);

        setExportResult({
          url,
          size: blob.size,
          mode,
          fileName: `hookflow-${selectedTemplate.id}.${extension}`,
          mimeType,
          duration
        });
        setProgress(100);
        setStatus(`导出成功，文件大小 ${formatSize(blob.size)}，耗时约 ${Math.ceil(duration)} 秒。`);
        appendLog(`导出完成：${formatSize(blob.size)}`);
        showToast("success", "导出成功");
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误";
        appendLog(`导出失败：${message}`);
        setStatus("导出失败，请换一段较短视频或使用 Chrome / Edge 浏览器。");
        showToast("error", "导出失败，未生成异常文件");
      } finally {
        window.cancelAnimationFrame(animationId);
        video.pause();
        video.removeAttribute("src");
        video.load();
        activeExportRef.current = false;
        setIsExporting(false);
      }
    },
    [
      appendLog,
      drawFrame,
      selectedTemplate.exportEffect,
      selectedTemplate.id,
      showToast,
      videoFile,
      videoUrl
    ]
  );

  const startRewardedAd = useCallback(() => {
    setIsExportModalOpen(false);
    setIsAdPlaying(true);
    setAdCount(15);

    let next = 15;
    const timer = window.setInterval(() => {
      next -= 1;
      setAdCount(next);
      if (next <= 0) {
        window.clearInterval(timer);
        window.setTimeout(() => {
          setIsAdPlaying(false);
          showToast("success", "广告观看完成，已解锁无水印导出");
          runCanvasExport("rewarded");
        }, 700);
      }
    }, 1000);
  }, [runCanvasExport, showToast]);

  const openExportModal = useCallback(() => {
    if (!videoFile) {
      setStatus("请先上传视频。");
      showToast("error", "请先上传视频");
      return;
    }
    setIsExportModalOpen(true);
  }, [showToast, videoFile]);

  const handleTemplateSelect = useCallback((template: HookTemplate) => {
    setSelectedTemplate(template);
  }, []);

  return (
    <main className="min-h-screen px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-line bg-white/[0.055] px-4 py-4 shadow-lift backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-white text-ink shadow-glow">
              <Sparkles size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-normal sm:text-3xl">HookFlow AI</h1>
              <p className="text-sm text-white/62">AI Creator Growth Assistant</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/68">
            <span className="rounded-md border border-line bg-panelSoft px-3 py-2">
              秒级轻量导出
            </span>
            <span className="rounded-md border border-line bg-panelSoft px-3 py-2">
              增长分析
            </span>
            <span className="rounded-md border border-line bg-panelSoft px-3 py-2">
              Vercel Ready
            </span>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="rounded-lg border border-line bg-panel/90 shadow-lift backdrop-blur">
            <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan">
                  创作者增长工作台
                </p>
                <h2 className="mt-1 text-lg font-bold">{selectedTemplate.name}</h2>
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-cyan disabled:cursor-not-allowed disabled:opacity-55"
                onClick={openExportModal}
                disabled={!videoFile || isExporting || isAdPlaying}
              >
                {isExporting ? <LoaderCircle className="animate-spin" size={17} /> : <Download size={17} />}
                {isExporting ? "正在导出" : "导出增长版视频"}
              </button>
            </div>

            <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_14rem]">
              <div
                className={`relative grid min-h-[26rem] overflow-hidden rounded-lg border border-line bg-black ${selectedTemplate.previewClass}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  onFileChange(event.dataTransfer.files.item(0));
                }}
              >
                {videoUrl ? (
                  <>
                    <video
                      key={videoUrl}
                      className="h-full w-full object-contain"
                      src={videoUrl}
                      controls
                      playsInline
                      preload="auto"
                      onEnded={() => setStatus("视频已完整播放完毕。")}
                    />
                    {selectedTemplate.id === "subtitle" ? (
                      <div className="pointer-events-none absolute left-1/2 top-[12%] -translate-x-1/2 whitespace-nowrap rounded-md bg-black/55 px-5 py-2 text-center text-2xl font-black text-white sm:text-4xl">
                        先别划走
                      </div>
                    ) : null}
                    <div className="pointer-events-none absolute bottom-4 right-4 rounded-md bg-black/50 px-3 py-2 text-xs font-semibold text-white/90">
                      Made by Hook AI
                    </div>
                  </>
                ) : (
                  <button
                    className="m-auto flex w-full max-w-sm flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-white/28 bg-white/[0.03] p-8 text-center transition hover:border-cyan hover:bg-cyan/5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="grid h-16 w-16 place-items-center rounded-md bg-white text-ink">
                      <Upload size={28} />
                    </span>
                    <span>
                      <span className="block text-xl font-black">上传视频</span>
                      <span className="mt-2 block text-sm leading-6 text-white/62">
                        上传本地素材，生成增长诊断和导出版本
                      </span>
                    </span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  accept="video/mp4,video/quicktime,.mp4,.mov"
                  onChange={(event) => onFileChange(event.target.files?.item(0) ?? null)}
                />
              </div>

              <aside className="flex flex-col gap-3">
                <button
                  className="flex items-center justify-center gap-2 rounded-md border border-line bg-panelSoft px-4 py-3 text-sm font-bold transition hover:border-cyan"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isExporting}
                >
                  <FileVideo size={17} />
                  上传视频
                </button>

                <div className="rounded-lg border border-line bg-white/[0.045] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <Gauge size={16} className="text-cyan" />
                      导出进度
                    </span>
                    <span className="text-xs text-white/52">{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan via-mint to-coral transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-3 min-h-10 text-sm leading-5 text-white/62">{status}</p>
                </div>

                {exportResult ? (
                  <div className="rounded-lg border border-mint/40 bg-mint/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-black text-mint">
                      <BadgeCheck size={17} />
                      导出成功
                    </div>
                    <p className="mt-2 text-sm text-white/72">文件大小：{formatSize(exportResult.size)}</p>
                    <p className="mt-1 text-xs text-white/50">
                      {exportResult.mode === "watermark" ? "免费导出（带水印）" : "广告导出（无水印）"}
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      格式：{exportResult.mimeType.includes("mp4") ? "MP4" : "WebM"}，时长约 {Math.ceil(exportResult.duration)} 秒
                    </p>
                    <a
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-coral px-4 py-3 text-sm font-black text-white transition hover:bg-coral/88"
                      href={exportResult.url}
                      download={exportResult.fileName}
                    >
                      <Download size={17} />
                      下载视频
                    </a>
                  </div>
                ) : null}
              </aside>
            </div>
          </div>

          <TemplateSelector
            selectedId={selectedTemplate.id}
            disabled={isExporting}
            onSelect={handleTemplateSelect}
          />
        </section>

        <AnalysisDashboard analysis={analysis} copyPack={copyPack} isAnalyzing={isAnalyzing} />

        <section className="grid gap-5 lg:grid-cols-[1fr_23rem]">
          <div className="rounded-lg border border-line bg-white/[0.04] p-4 text-sm text-white/62">
            <div className="mb-3 flex items-center gap-2 text-white">
              <BarChart3 size={17} className="text-mint" />
              <span className="font-bold">导出日志</span>
            </div>
            <div className="studio-scrollbar max-h-36 overflow-auto rounded-md bg-black/24 p-3 font-mono text-xs leading-6 text-white/58">
              {exportLogs.length ? exportLogs.map((log) => <div key={log}>{log}</div>) : <div>等待导出任务开始...</div>}
            </div>
          </div>
          <footer className="grid gap-3 rounded-lg border border-line bg-white/[0.04] p-4 text-sm text-white/62">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-mint" />
              模板 {selectedIndex} / {templates.length}
            </div>
            <div>当前架构：Canvas + MediaRecorder 轻量导出。</div>
            <div>适合明日演示：快、稳、无需服务器处理。</div>
          </footer>
        </section>
      </div>

      {isExportModalOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-lg border border-line bg-panel p-5 shadow-lift">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan">
                  导出方式
                </p>
                <h2 className="mt-1 text-2xl font-black">请选择导出方式</h2>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded-md border border-line bg-white/[0.04] transition hover:bg-white/10"
                onClick={() => setIsExportModalOpen(false)}
                disabled={isExporting}
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <button
                className="rounded-lg border border-line bg-white/[0.045] p-5 text-left transition hover:border-cyan hover:bg-cyan/10 disabled:opacity-55"
                onClick={() => runCanvasExport("watermark")}
                disabled={isExporting}
              >
                <div className="flex items-center gap-2 text-lg font-black">
                  <Download size={19} />
                  免费导出（带水印）
                </div>
                <p className="mt-4 text-sm leading-6 text-white/64">
                  视频右下角显示：
                  <br />
                  <span className="font-bold text-white">Made by Hook AI</span>
                </p>
              </button>
              <button
                className="rounded-lg border border-coral/45 bg-coral/10 p-5 text-left transition hover:border-coral hover:bg-coral/16 disabled:opacity-55"
                onClick={startRewardedAd}
                disabled={isExporting}
              >
                <div className="flex items-center gap-2 text-lg font-black">
                  <Crown size={19} />
                  观看广告导出（无水印）
                </div>
                <p className="mt-4 text-sm leading-6 text-white/64">
                  观看 15 秒广告后解锁无水印导出。
                </p>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAdPlaying ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink px-5 text-center">
          <div className="w-full max-w-md rounded-lg border border-line bg-white/[0.055] p-8 shadow-lift">
            {adCount > 0 ? (
              <>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-coral">
                  广告播放中...
                </p>
                <div className="mt-8 text-8xl font-black tabular-nums text-white">{adCount}</div>
                <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-coral via-cyan to-mint transition-all"
                    style={{ width: `${((15 - adCount) / 15) * 100}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <BadgeCheck className="mx-auto text-mint" size={54} />
                <h2 className="mt-5 text-2xl font-black">广告观看完成</h2>
                <p className="mt-3 text-white/64">已解锁无水印导出</p>
              </>
            )}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed right-4 top-4 z-[60] rounded-lg border px-4 py-3 text-sm font-bold shadow-lift ${
            toast.type === "success"
              ? "border-mint/45 bg-mint/15 text-mint"
              : "border-coral/45 bg-coral/15 text-coral"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}
