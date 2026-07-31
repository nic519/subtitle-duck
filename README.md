# 字幕鸭（Subtitle Duck）
 
[<img src="https://raw.githubusercontent.com/nic519/subtitle-duck/master/assets/app-icon.png" alt="字幕鸭应用图标" width="180">](https://github.com/nic519/subtitle-duck/blob/master/assets/app-icon.png)

## 核心功能

### 字幕翻译

导入 SRT 字幕，选择目标语言，查看翻译进度并导出结果。

![字幕翻译](https://files.seeusercontent.com/2026/07/30/r2jY/2026-07-31-001725.png)

### 字幕生成

使用 Whisper / faster-whisper 从本地视频生成字幕，支持视频预览、时间区间选择、进度查看和任务取消。

![字幕生成](https://files.seeusercontent.com/2026/07/30/6zFg/2026-07-31-001719.png)

### 字幕合并

选择视频和字幕文件，使用 FFmpeg 将字幕合并到视频中并导出。

![字幕合并](https://files.seeusercontent.com/2026/07/30/p9Zi/2026-07-31-001600.png)

## 技术架构

- React + TypeScript：桌面端界面和交互
- Vite：前端构建
- Electrobun：桌面窗口、本地文件和系统能力
- FFmpeg：视频与字幕合并
- Whisper / faster-whisper：语音转字幕
- Bun：依赖管理、测试和脚本运行

核心工作流逻辑位于 `src/subtitle-mux/`，桌面端能力位于 `src/desktop/`，页面和组件位于 `src/pages/` 与 `src/components/`。

## 开发

```bash
bun install

# 启动桌面开发环境
bun run dev
```

本地字幕生成和字幕合并需要可用的 FFmpeg；字幕生成还需要 Whisper / faster-whisper 运行环境和模型。

## 常用命令

```bash
bun run build    # 构建当前平台的桌面应用
bun run verify   # 启动并验证当前平台的本地构建
bun run package  # 打包当前平台的发布产物
bun test         # 运行测试
```
