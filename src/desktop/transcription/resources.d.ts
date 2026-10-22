// Bun 在主进程构建时嵌入小型锁文件，不复制 Python 或模型到安装包。
declare module "*.lock" { const content: string; export default content; }
