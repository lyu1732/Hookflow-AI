# HookFlow AI

HookFlow AI 是一个演示用 AI Creator Growth Assistant。它不是传统视频剪辑工具，而是帮助创作者上传素材后快速得到增长分析、爆款结构建议、标题文案推荐，并导出一版适合演示的轻量视频。

## 核心能力

- 上传本地 MP4 / MOV 视频
- 上传后生成 3 个结果：Hook 1、Hook 2、Hook 3
- 用户先看结果，再选择一个或多个版本导出
- Mock AI 分析：视频类型、主要元素、视觉风格、吸引力评分、钩子强度、预计停留率和互动率提升
- Mock AI 文案：标题、文案、标签、推荐发布时间
- 动态 AI 分析：上传后抽取开头 / 中间 / 结尾三帧，压缩为 400px 内低质量 JPEG，再请求 `/api/analyze`
- 可选 Gemini Vision：配置 `GEMINI_API_KEY` 后使用 Gemini 1.5 Flash Vision；失败时自动走本地视觉启发式 fallback
- 轻量浏览器导出：Canvas + MediaRecorder
- 免费导出带水印：`Made by Hook AI`
- 观看 15 秒模拟广告后无水印导出

## 为什么不再使用 FFmpeg WASM

旧架构用 FFmpeg WASM 做完整视频转码。这个方案功能强，但浏览器内 CPU 压力很大，4.5MB 视频可能需要十几分钟，演示体验不可接受。

当前 MVP 改为 Canvas + MediaRecorder：

- 不加载大型 FFmpeg WASM 包
- 不做虚拟文件系统读写
- 不做完整转码
- 输出长边限制为 720px
- 录制 30fps、约 1.5Mbps
- 优先保证秒级导出和交互流畅

## 本地运行

```bash
pnpm install
pnpm dev
```

打开：

```text
http://localhost:3000
```

## Gemini 配置

创建 `.env.local`：

```bash
GEMINI_API_KEY=你的 Gemini API Key
```

没有 API Key 时，系统会使用本地 fallback。Fallback 不依赖文件名，而是基于当前模板、视频时长、画幅比例、三帧亮度/饱和度/对比度/色温/边缘能量生成分析。

## 生产构建

```bash
pnpm build
pnpm start
```

## Vercel 部署

1. 打开 [vercel.com](https://vercel.com)
2. 点击 `Add New Project`
3. 选择 HookFlow AI 所在的 GitHub 仓库
4. Framework Preset 选择 `Next.js`
5. Build Command 使用 `pnpm build`
6. Output Directory 保持默认
7. 点击 `Deploy`

部署完成后，Vercel 会生成一个公开访问地址。

## Vercel 兼容性说明

当前版本没有服务器端视频处理，没有数据库，没有登录系统，也没有 Stripe 或广告 SDK。视频分析和导出都在浏览器端完成，因此可以部署到 Vercel 的静态/Serverless Next.js 环境。

FFmpeg WASM 本身也可以部署在 Vercel 上，但通常需要 COOP / COEP 响应头、较大的 WASM 资源加载和更高的浏览器 CPU 开销。为了明日 demo 的可靠性和速度，当前版本默认不使用 FFmpeg WASM。

## 已知限制

- MediaRecorder 在不同浏览器支持的视频格式不同。Chrome / Edge 通常导出 WebM；部分 Safari 版本可能支持 MP4。
- 当前 AI 分析和文案是演示用 mock 逻辑，还没有接入真实多模态模型。
- 轻量导出优先速度，不追求专业剪辑软件级别的逐帧精确效果。
