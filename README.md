# PaperFlow - 本地试卷转换学习工具

将 PDF 试卷转换为适合电子设备使用的逐题刷题模式。纯本地运行，无需联网，保护隐私。

## 技术栈

- **桌面端**: Tauri 2 + Vue 3 + TypeScript
- **数据库**: SQLite (本地存储)
- **PDF解析**: pdf.js (前端) + Rust (后端辅助)
- **移动端(计划)**: Flutter

## 项目结构

```
PaperFlow/
├── core/               # 平台无关核心逻辑（供桌面端和移动端复用）
│   ├── types/          # 数据模型
│   ├── parser/         # 解析引擎
│   ├── grader.ts       # 判题逻辑
│   └── progress.ts     # 进度计算
├── desktop/            # Tauri + Vue3 桌面应用
│   ├── src/            # Vue 前端
│   └── src-tauri/      # Rust 后端
└── README.md
```

## 功能

- 批量导入 PDF 试卷，自动解析题目
- 逐题刷题模式，自动保存进度
- 支持答案解析自动判题
- 手动录入答案
- 错题本
- 悬浮球快速入口
- 答题历史记录

## 开发

```bash
cd desktop
npm install
npm run tauri dev
```

## 构建

```bash
cd desktop
npm run tauri build
```
