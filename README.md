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
- Electrobun 2.0.4（Bun 主进程）：桌面窗口、本地文件和系统能力
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

首次运行 `dev` 或 `build` 会通过 `electrobun sync` 下载配套工具链并生成 `.hutch/devkit`（需要网络）。该目录不提交；依赖仍由 Bun 和 `bun.lock` 管理。

本地字幕生成和字幕合并需要可用的 FFmpeg；字幕生成还需要 Whisper / faster-whisper 运行环境和模型。

## 常用命令

```bash
bun run build    # 构建当前平台的桌面应用
bun run verify   # 启动并验证当前平台的本地构建
bun run package  # 打包当前平台的发布产物
bun test         # 运行测试
```

### 托管 Faster Whisper 环境

在“字幕生成”中点击“一键安装识别环境”。应用先检查 PATH、Homebrew、`~/.local/bin` 和 `~/.cargo/bin` 中可运行的 uv（最低 0.6），优先复用；找不到时才下载固定版本、校验 SHA-256 后使用应用专用 uv。安装不修改系统 Python，也不要求管理员权限。

Python 3.12、隔离环境、下载缓存和模型保存在 Electrobun 的 `Utils.paths.userData/faster-whisper` 下，均不放入安装包。首次使用需要网络和额外磁盘空间；Python 与模型完整安装后可离线识别。依赖版本和哈希由 `resources/faster-whisper/requirements.lock` 固定，更新时使用对应 `requirements.in` 重新生成并验证。

模型下载与当前配置独立：选择模型、点击下载，校验完成后再点“使用此模型”。后台任务支持取消和重试，切换页面不会中断；重试复用已校验的完整文件，当前文件中断后重新下载。已有托管环境时，模型下载完成前还会实际加载并转写短静音样本。手动 Python 路径、本地 CT2 模型导入和下载链接继续保留。

Windows/Linux 的自动安装路径需要在对应系统上验证；macOS 本地运行验证不能替代跨平台验收。

依赖安装可选择官方 PyPI 或清华镜像，仅作用于此次托管安装，不修改系统 pip/uv 配置，两者都执行锁文件哈希校验。界面显示耗时、最近输出与不定进度；安装子进程连续 3 分钟无输出或运行超过 10 分钟会停止并提示重试，取消后会强制回收未正常退出的子进程。

“一键准备识别”在 App 后台依次检测 uv、安装 Python 与 faster-whisper、下载所选模型、执行模型加载和短音频转写校验，全部通过后自动启用。单独下载模型仍不会切换配置。uv、Python、faster-whisper 与当前模型分项显示就绪状态，缺模型不掩盖已安装的运行环境。
