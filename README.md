<div align="center">

# ValeDesk

**Versatile Almost Local, Eventually Reasonable Assistant**

[![Version](https://img.shields.io/badge/version-0.0.8-blue.svg)](https://github.com/followcat/ValeDesk/releases)
[![Platform](https://img.shields.io/badge/platform-%20Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/followcat/ValeDesk)
[![License](https://img.shields.io/badge/license-Community-blue.svg)](LICENSE)

**支持本地模型的桌面 AI 助手**

[English](README_en.md) | [中文](README.md)

</div>

---


https://github.com/user-attachments/assets/a8c54ce0-2fe0-40c3-8018-026cab9d7483


## ✨ 功能特性

### 核心能力
- ✅ **并行执行** — 同时运行多个模型（共识模式或并行任务）
- ✅ **灵活的供应商管理** — 并排管理多个 API 供应商（OpenAI, OpenRouter, Z.AI, 本地模型）
- ✅ **任务规划** — 可视化的待办事项面板，带进度跟踪，按会话持久化
- ✅ **计划任务** — 创建提醒和定期任务，支持自动执行
- ✅ **OpenAI SDK** — 完整的 API 控制，兼容任何 OpenAI 兼容的端点
- ✅ **本地模型** — 支持 vLLM, Ollama, LM Studio
- ✅ **代码沙箱** — 支持 JavaScript (Node.js vm) 和 Python (系统子进程) 执行
- ✅ **文档支持** — PDF 和 DOCX 文本提取（内置功能，开箱即用）
- ✅ **网络搜索** — 集成 Tavily 和 Z.AI 进行互联网搜索
- ✅ **Telegram 解析** — 渲染 t.me 频道，包含反应、浏览量，支持自动滚动查看旧消息
- ✅ **安全性** — 目录沙箱机制，确保文件操作安全
- ✅ **跨平台** — Windows, macOS, Linux，支持正确的 shell 命令

### UI/UX 特性
- ✅ **现代界面** — React + Tauri，流畅的自动滚动和流式传输
- ✅ **文件差异与回滚** — 内置文件变更的可视化差异查看器，支持一键回滚
- ✅ **消息编辑** — 编辑并重新发送消息，支持历史记录截断
- ✅ **会话持久化** — 会话在应用重启后保留（基于 SQLite）
- ✅ **会话管理** — 置顶重要会话，搜索聊天记录
- ✅ **键盘快捷键** — Cmd+Enter/Ctrl+Enter 发送消息
- ✅ **拼写检查** — 内置拼写检查，支持上下文菜单建议
- ✅ **权限系统** — 工具执行的询问/默认模式控制

### 高级功能
- ✅ **技能系统** — 通过[技能市场](https://vakovalskii.github.io/ValeDesk-Skills/)扩展能力
- ✅ **记忆系统** — 在 `~/.valera/memory.md` 中持久存储用户偏好
- ✅ **Token 追踪** — 显示输入/输出 Token 数量和 API 耗时
- ✅ **优化的流式传输** — 基于 requestAnimationFrame 的 UI 更新（60fps）
- ✅ **停止生成** — 随时中断 LLM 响应
- ✅ **循环检测** — 自动检测死循环工具调用（连续 5 次以上相同的工具调用）
- ✅ **请求超时** — LLM 请求 5 分钟超时并自动重试
- ✅ **会话日志** — 在 `~/.valera/logs/sessions/` 中记录完整的请求/响应 JSON 日志

## 🤔 为什么选择 ValeDesk？

### 开放架构与完全控制
ValeDesk 不仅仅是另一个 AI 助手 — **它是一个你拥有的框架**。基于 TypeScript 和 Tauri 构建，每个组件都是透明且可修改的：

- **可读的代码库** — 结构良好、文档齐全的代码，易于理解
- **易于定制** — 添加新工具、修改提示词、更改 UI，没有黑盒
- **你的规则** — 调整行为、安全限制和工作流以匹配你的需求
- **无供应商锁定** — 适用于任何 OpenAI 兼容的 API (vLLM, Ollama, LM Studio)

### 100% 本地与隐私
一切都在**你的机器上**运行：

- **本地推理** — 使用 Ollama, vLLM 或 LM Studio 获得完全隐私
- **无数据收集** — 你的对话永远不会离开你的电脑
- **离线可用** — 无需互联网即可工作（网络搜索工具除外）
- **沙箱执行** — 安全的 JavaScript 沙箱和文件操作限制

### 实验与迭代
非常适合开发者、研究人员和 AI 爱好者：

- **测试本地模型** — 比较 Qwen, Llama, DeepSeek 等模型
- **调试 API 调用** — 每次交互都有完整的请求/响应日志
- **原型工具** — 几分钟内添加自定义函数
- **监控性能** — 追踪 Token、时间和资源使用情况

### 实际用例
```bash
# 本地运行 Ollama（免费，100% 隐私）
ollama serve
# 配置 ValeDesk: http://localhost:11434/v1

# 或者使用 vLLM 进行更快的推理
vllm serve Qwen/Qwen2.5-14B-Instruct --port 8000
# 配置 ValeDesk: http://localhost:8000/v1
```

**简而言之：** ValeDesk 让你拥有 **ChatGPT/Claude 的能力**，同时享受 **开源的自由** 和 **本地执行的隐私**。

## 🚀 快速开始

###先决条件

- **Rust** 1.74+ ([安装](https://rustup.rs/))
- **Node.js** 20+ 
- **Python 3** (用于 `execute_python` 工具)

### 开发 (macOS/Linux)

```bash
# 克隆并进入目录
git clone https://github.com/followcat/ValeDesk.git
cd ValeDesk

# 安装依赖
npm install

# 运行开发模式
make dev
```

### 测试

```bash
npm run test
```

### 构建独立应用

```bash
# 构建 DMG (macOS)
make bundle

# 输出: ValeDesk-0.0.8.dmg
```

### 手动构建步骤

```bash
# 1. 构建 sidecar 二进制文件
npm run build:sidecar

# 2. 构建 Tauri 应用
cd src-tauri && cargo build --release

# 3. 创建 DMG
hdiutil create -volname "ValeDesk" \
  -srcfolder src-tauri/target/release/bundle/macos/ValeDesk.app \
  -ov -format UDZO ValeDesk-0.0.8.dmg
```

### Windows (即将推出)

Windows 构建需要交叉编译设置。查看 `.github/workflows/` 获取 CI 构建信息。

### 配置

1. 点击应用中的 **设置** (⚙️)
2. 配置你的 API：
   - **API Key** — 你的密钥（如果是本地模型则为 `dummy-key`）
   - **Base URL** — API 端点（必须包含 `/v1`）
   - **Model Name** — 模型标识符
   - **Temperature** — 0.0-2.0 (默认: 0.3)
3. 点击 **保存设置**

### 配置示例

**本地 vLLM:**
```json
{
  "apiKey": "dummy-key",
  "baseUrl": "http://localhost:8000/v1",
  "model": "qwen3-30b-a3b-instruct-2507"
}
```

**OpenAI:**
```json
{
  "apiKey": "sk-...",
  "baseUrl": "https://api.openai.com/v1",
  "model": "gpt-4"
}
```

## 🎯 技能市场

浏览并安装 ValeDesk 的验证技能：**[技能市场](https://vakovalskii.github.io/ValeDesk-Skills/)**

<img width="974" height="1123" alt="image" src="https://github.com/user-attachments/assets/8c7fa387-599d-48ab-999a-d5b9c5f811f7" />


## 🛠️ 可用工具

所有工具遵循 `snake_case` 命名约定（`动词_名词` 模式）：

### 文件操作
| 工具 | 描述 |
|------|-------------|
| `run_command` | 执行 Shell 命令 (PowerShell/bash) |
| `read_file` | 读取文本文件内容 |
| `write_file` | 创建新文件 |
| `edit_file` | 修改文件（查找并替换） |
| `search_files` | 通过 glob 模式查找文件 (`*.pdf`, `src/**/*.ts`) |
| `search_text` | 在文件中搜索文本内容 (grep) |
| `read_document` | 提取 PDF/DOCX 文本（最大 10MB） |

### 代码执行
| 工具 | 描述 |
|------|-------------|
| `execute_js` | 在安全的 Node.js vm 沙箱中运行 JavaScript |
| `execute_python` | 运行 Python 代码（系统 Python，支持 pip 包） |

### 网络工具
| 工具 | 描述 |
|------|-------------|
| `search_web` | 搜索互联网 (Tavily/Z.AI) |
| `extract_page` | 提取完整页面内容 (仅 Tavily) |
| `read_page` | 读取网页内容 (Z.AI Reader) |
| `render_page` | 通过 Chromium 渲染重 JS 页面 (Telegram, SPA) |

### 任务管理

![photo_2026-01-19_00-55-13](https://github.com/user-attachments/assets/5d7c2122-9023-4e8a-be0d-e63b666cea7b)


| 工具 | 描述 |
|------|-------------|
| `manage_todos` | 创建/更新任务计划，带可视化进度跟踪 |

### 调度器
| 工具 | 描述 |
|------|-------------|
| `schedule_task` | 创建、列出、更新、删除计划任务 |

特性：
- **一次性提醒** — "30分钟后提醒我"
- **重复任务** — 每分钟、每小时、每天、每周、每月
- **自动执行** — 带有提示词的任务会自动开始新的聊天会话
- **原生通知** — macOS 系统通知
- **默认模型** — 设置计划任务的首选模型

### 记忆
| 工具 | 描述 |
|------|-------------|
| `manage_memory` | 存储/读取持久化用户偏好 |

> **安全性：** 所有文件操作都沙箱化限制在工作区文件夹内。

## 📦 构建

### Windows
```powershell
# 构建可执行文件和安装程序
npm run dist:win

# 输出: dist/ValeDesk Setup 0.0.8.exe
```

### macOS
```bash
# 构建 DMG (ARM64)
npm run dist:mac-arm64

# 构建 DMG (Intel x64)
npm run dist:mac-x64
```

### Linux
```bash
# 构建 AppImage
npm run dist:linux
```

## 🔐 数据存储

### 应用数据
- **Windows:** `C:\Users\YourName\AppData\Roaming\ValeDesk\`
- **macOS:** `~/Library/Application Support/ValeDesk/`
- **Linux:** `~/.config/ValeDesk/`

文件：
- `sessions.db` — SQLite 数据库，包含聊天记录、待办事项、计划任务和设置
- `api-settings.json` — API 配置
- `skills-settings.json` — 技能市场配置
- `llm-providers-settings.json` — LLM 供应商配置

### 全局数据
- `~/.valera/memory.md` — 持久化记忆存储
- `~/.valera/logs/sessions/{session-id}/` — 每个会话的 API 日志：
  - `turn-001-request.json` — 完整请求（模型、消息、工具、温度）
  - `turn-001-response.json` — 完整响应（使用情况、内容、工具调用）

## 🛠️ 贡献

查看 [CURSOR.md](CURSOR.md) 了解开发指南和项目架构。

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=followcat/ValeDesk&type=Date)](https://star-history.com/#followcat/ValeDesk&Date)

## 📄 许可证

**ValeDesk 社区许可证** — 个人和年收入低于 100 万美元的公司免费使用。大型组织需要商业许可证。

查看 [LICENSE](LICENSE) 了解完整条款。

---
