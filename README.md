# PaperFlow - 本地试卷转换学习工具

将 PDF 试卷转换为适合电子设备使用的逐题刷题模式。纯本地运行，无需联网，保护隐私。

## 核心功能

- **批量 PDF 导入**：多套题本（如"专项刷题一~二十"）自动拆分为独立试卷，导入前预览确认
- **智能解析**：题号/题干/选项自动识别，支持复杂排版、题号丢失恢复、页码过滤
- **逐题刷题**：大按钮选项、键盘快捷键（1-4/A-D 选择、Enter 提交、←→ 导航）、答后即时反馈
- **进度记忆**：退出后重新打开，自动恢复上次答题位置和已答记录
- **答案管理**：导入答案解析自动判题，支持手动录入答案
- **错题本**：独立错题模块，支持标记掌握
- **试卷分组**：同源 PDF 的套题自动分组显示
- **数据管理**：SQLite 本地存储（D:\PaperFlowData），支持备份/恢复

## 技术栈

- 桌面端：Tauri 2 + Vue 3 + TypeScript
- 数据库：sql.js（SQLite WASM，纯本地离线）
- PDF 解析：pdf.js 文本提取 + 自研规则引擎
- 移动端（规划）：Flutter 复用 core 模块

## 项目结构

```
PaperFlow/
├── core/               # 平台无关核心逻辑（可复用 Android）
│   ├── types/          # 数据模型
│   ├── parser/         # 解析引擎（题号/选项识别、章节拆分）
│   ├── grader.ts       # 判题逻辑
│   └── progress.ts     # 进度计算
├── desktop/            # Tauri + Vue3 桌面应用
│   ├── src/            # Vue 前端
│   └── src-tauri/      # Rust 后端
└── README.md
```

## 开发

```bash
cd desktop
npm install
npm run tauri dev       # 开发模式
npm run tauri build     # 打包安装包
```

## 版本历史

- **v1.x**：文字型 PDF 支持（当前）
- **v2.x**：扫描版 PDF OCR 支持（规划中）

## 已知限制

- 当前仅支持文字型 PDF；扫描版需 OCR（V2）
- 判断题/填空题/简答题识别为实验性支持
