import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 5;

type FrameMetric = {
  brightness: number;
  saturation: number;
  contrast: number;
  warmth: number;
  edgeEnergy: number;
};

type AnalyzeRequest = {
  frames: string[];
  metrics: FrameMetric[];
  template: string;
  duration: number;
  aspectRatio: number;
};

const prompt = `You are a Senior TikTok and Meta Growth Strategist.

Analyze the uploaded video frames.

Infer:

* video category
* visual style
* main elements
* attention score
* hook strength
* retention lift estimate
* engagement lift estimate

Generate:

* 3 viral titles
* 3 captions
* hashtags
* publish time recommendation

Return strict JSON only using this exact schema:
{
  "original": "uploaded video",
  "analysis": {
    "category": "string",
    "elements": ["string"],
    "visualStyle": "string",
    "attentionScore": 78,
    "hookStrength": 82,
    "engagementLift": "+12%",
    "retentionLift": "+18%",
    "recommendedHook": "string"
  },
  "copyPack": {
    "titles": ["string", "string", "string"],
    "captions": ["string", "string", "string"],
    "hashtags": ["#tag"],
    "publishTime": "19:00-21:00"
  },
  "hooks": [
    { "type": "hook1", "video_url": "client-generated", "description": "variant 1", "score": 86 },
    { "type": "hook2", "video_url": "client-generated", "description": "variant 2", "score": 91 },
    { "type": "hook3", "video_url": "client-generated", "description": "variant 3", "score": 83 }
  ]
}`;

const clampScore = (value: number) => Math.max(62, Math.min(94, Math.round(value)));

const averageMetric = (metrics: FrameMetric[]) => {
  const safe = metrics.length ? metrics : [{ brightness: 0.5, saturation: 0.4, contrast: 0.25, warmth: 0.5, edgeEnergy: 0.25 }];
  return safe.reduce(
    (acc, item) => ({
      brightness: acc.brightness + item.brightness / safe.length,
      saturation: acc.saturation + item.saturation / safe.length,
      contrast: acc.contrast + item.contrast / safe.length,
      warmth: acc.warmth + item.warmth / safe.length,
      edgeEnergy: acc.edgeEnergy + item.edgeEnergy / safe.length
    }),
    { brightness: 0, saturation: 0, contrast: 0, warmth: 0, edgeEnergy: 0 }
  );
};

const localFallback = (payload: AnalyzeRequest) => {
  const metric = averageMetric(payload.metrics);
  const vertical = payload.aspectRatio < 0.8;
  const short = payload.duration <= 12;
  const vivid = metric.saturation > 0.45;
  const bright = metric.brightness > 0.55;
  const warm = metric.warmth > 0.54;
  const detailHeavy = metric.edgeEnergy > 0.28 || metric.contrast > 0.32;

  const category = detailHeavy
    ? "产品种草 / 教程演示"
    : vivid && vertical
      ? "舞蹈表演 / 生活方式"
      : warm
        ? "美食生活 / 场景记录"
        : "创作者日常 / 观点内容";

  const visualStyle = bright
    ? "明亮高曝光 / 适合强字幕钩子"
    : vivid
      ? "高饱和竖屏 / 适合节奏型开场"
      : "低调真实感 / 适合悬念式开场";

  const recommendedHook =
    warm
      ? "Hook 1"
      : detailHeavy
        ? "Hook 2"
        : short
          ? "Hook 3"
          : "Hook 2";

  const attentionScore = clampScore(68 + metric.saturation * 16 + metric.contrast * 20 + (vertical ? 5 : 0));
  const hookStrength = clampScore(66 + metric.edgeEnergy * 24 + (short ? 6 : 0) + (detailHeavy ? 5 : 0));
  const retentionLift = `+${Math.round(10 + metric.contrast * 18 + (short ? 4 : 0))}%`;
  const engagementLift = `+${Math.round(8 + metric.saturation * 15 + (vertical ? 3 : 0))}%`;

  return {
    original: "uploaded video",
    analysis: {
      category,
      elements: detailHeavy
        ? ["主体细节", "信息密度", "近景画面"]
        : vivid
          ? ["人物/动作", "节奏变化", "强视觉色彩"]
          : ["场景氛围", "叙事空间", "情绪表达"],
      visualStyle,
      attentionScore,
      hookStrength,
      engagementLift,
      retentionLift,
      recommendedHook
    },
    copyPack: {
      titles: [
        "最后3秒千万别划走",
        detailHeavy ? "这个细节很多人第一遍没看懂" : "这个开场我反复看了十遍",
        vivid ? "这条节奏感真的太强了" : "普通素材这样开头，停留率直接拉满"
      ],
      captions: [
        "把最有信息量的画面提前，观众才有理由继续看。",
        recommendedHook === "Hook 2" ? "第一秒直接给结果感，后面再补过程。" : "用节奏和反差把前3秒做得更有停留感。",
        "这条适合做短标题强提示，再配合评论区引导互动。"
      ],
      hashtags: vivid ? ["#viral", "#creator", "#短视频增长", "#节奏感", "#hook"] : ["#creator", "#内容运营", "#viral", "#hook", "#增长"],
      publishTime: vertical ? "19:00-21:00" : "12:00-13:30"
    },
    hooks: [
      {
        type: "hook1",
        video_url: "client-generated",
        description: "Hook 1：强化声音、质感和第一秒冲击，适合制造强停留。",
        score: clampScore(hookStrength + 2)
      },
      {
        type: "hook2",
        video_url: "client-generated",
        description: "Hook 2：将更接近结果/峰值的片段前置，制造结果先行的好奇心。",
        score: clampScore(attentionScore + 5)
      },
      {
        type: "hook3",
        video_url: "client-generated",
        description: "Hook 3：用更快节奏的开场包装视觉重点，形成明显差异。",
        score: clampScore((attentionScore + hookStrength) / 2)
      }
    ],
    source: "local-fallback"
  };
};

const parseGeminiJson = (text: string) => {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Gemini returned non-JSON content");
  return JSON.parse(cleaned.slice(start, end + 1));
};

export async function POST(request: Request) {
  const payload = (await request.json()) as AnalyzeRequest;
  const fallback = () => NextResponse.json(localFallback(payload));

  if (!process.env.GEMINI_API_KEY) return fallback();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(3600),
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  text: JSON.stringify({
                    template: payload.template,
                    duration: payload.duration,
                    aspectRatio: payload.aspectRatio,
                    frameMetrics: payload.metrics
                  })
                },
                ...payload.frames.slice(0, 3).map((frame) => ({
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: frame
                  }
                }))
              ]
            }
          ],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 900,
            response_mime_type: "application/json"
          }
        })
      }
    );

    if (!response.ok) throw new Error(`Gemini error ${response.status}`);
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned empty content");

    const parsed = parseGeminiJson(text);
    if (!parsed?.analysis || !parsed?.copyPack) throw new Error("Gemini returned invalid schema");
    const fallbackData = localFallback(payload);
    return NextResponse.json({
      ...parsed,
      original: parsed.original ?? "uploaded video",
      hooks: Array.isArray(parsed.hooks) && parsed.hooks.length >= 3 ? parsed.hooks : fallbackData.hooks,
      source: "gemini"
    });
  } catch {
    return fallback();
  }
}
