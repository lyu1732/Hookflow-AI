# HookFlow AI 部署说明

## 部署就绪结论

HookFlow AI 已准备好部署到 Vercel。

- Next.js App Router：支持
- 生产构建：使用 `pnpm build`
- 服务器端视频处理：无
- 数据库：无
- 登录 / 注册：无
- Stripe：无
- 真实广告 SDK：无
- FFmpeg WASM：默认不使用
- 浏览器端轻量导出：Canvas + MediaRecorder
- 动态分析接口：`app/api/analyze/route.ts`
- Gemini Vision：可选，通过 `GEMINI_API_KEY` 启用

## 为什么本地必须运行命令

`localhost:3000` 是本机开发地址。任何 Next.js 项目在本地预览时都需要一个本地 Web 服务，所以必须运行 `pnpm dev` 或 `pnpm start`。

部署到 Vercel 后，Vercel 会自动运行构建并托管网站。用户访问公开 URL 时不需要运行任何终端命令。

## 非技术用户部署步骤

1. 把项目上传到 GitHub。
2. 打开 Vercel。
3. 用 GitHub 登录。
4. 点击 `Add New Project`。
5. 选择 HookFlow AI 项目仓库。
6. 保持默认 Next.js 配置。
7. 点击 `Deploy`。
8. 等待 1-3 分钟。
9. 使用 Vercel 生成的公开链接访问网站。

如需启用 Gemini：

1. 在 Vercel 项目中打开 `Settings`。
2. 打开 `Environment Variables`。
3. 新增 `GEMINI_API_KEY`。
4. 重新部署项目。

## 推荐 Vercel 配置

- Framework Preset: `Next.js`
- Install Command: `pnpm install`
- Build Command: `pnpm build`
- Output Directory: 默认
- Node.js Version: 20 或 22

## 架构说明

当前 MVP 采用纯前端导出架构：

1. 用户上传本地视频。
2. 浏览器创建本地 object URL 用于预览。
3. 前端抽取开头 / 中间 / 结尾三帧，压缩为 400px 内低质量 JPEG。
4. 前端把三帧、视频时长、画幅比例、颜色分布指标发送到 `/api/analyze`。
5. API 优先调用 Gemini 1.5 Flash Vision。
6. Gemini 失败或没有 key 时，API 使用本地视觉启发式 fallback。
7. 导出时创建隐藏 video 和 canvas。
8. 每一帧把 video 绘制到 canvas，并叠加模板效果、水印或字幕。
9. 使用 MediaRecorder 录制 canvas stream。
10. 生成 Blob 下载链接。

这套架构不依赖服务器处理视频，因此适合 Vercel 部署。

## FFmpeg WASM 兼容性

FFmpeg WASM 可以在 Vercel 部署的网站中运行，因为它实际运行在用户浏览器里，不运行在 Vercel 服务器上。

但它有明显演示风险：

- WASM 文件大，首次加载慢。
- 对浏览器 CPU 压力大。
- 需要更严格的跨源隔离配置。
- 移动端和普通笔记本性能不稳定。
- 短视频导出可能从几十秒到十几分钟不等。

因此当前 demo 使用 Canvas + MediaRecorder 作为默认导出方案。
