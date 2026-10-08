# 🛠️ Tools - 在线工具集

一个轻量级的 Web 工具集合，无需安装任何软件即可使用。

---

## 📂 工具列表

| 工具 | 功能 | 链接 |
|------|------|------|
| **📚 Swagger Viewer** | 本地渲染 OpenAPI/Swagger 文档（YAML/JSON） | [打开](swagger-viewer.html) |
| **📄 XML Tool** | 格式化、压缩、转义/解码 XML | [打开](xml-tool.html) |
| **📊 JSON Viewer** | 美化查看 JSON 数据，支持树形展开 | [打开](json-viewer.html) |
| **⚙️ Jenkins Env Compare** | 比较 Jenkins 环境变量差异 | [打开](jenkins-env-compare.html) |
| **📅 Outlook Table Compare** | 比较 Outlook 表格内容 | [打开](outlook-table-compare.html) |

---

## 📄 XML Tool 详情

### 核心功能

| 操作 | 快捷键 | 说明 |
|------|--------|------|
| **格式化** | - | Pretty Print，缩进美化显示 XML 结构（自动去除 `\` 转义） |
| **压缩** | - | Minify，移除空白字符减小体积（自动去除 `\` 转义） |
| **加转义** | - | Encode Entities (`<` → `&lt;`) |
| **去转义** | - | Decode Entities (`\` → 真实字符，`&lt;` → `<`) |

### 特殊处理

工具会自动识别并处理以下转义形式：
- `\"` → `"` (双引号)
- `\'` → `'` (单引号)
- `\\` → `\` (反斜杠)
- `&lt;` → `<` (XML 实体)
- `&gt;` → `>` (XML 实体)
- `&amp;` → `&` (XML 实体)

### 使用方法

1. **打开工具**: 在浏览器中打开 `/home/peter/gitcode/tools/xml-tool.html`
2. **输入数据**: 在左侧文本框粘贴或输入 XML 内容
3. **选择操作**: 点击顶部按钮执行相应操作
4. **查看结果**: 右侧面板显示处理后的结果
5. **保存输出**: 点击「导出」或「复制结果」

### 技术特点

- ✨ 纯 JavaScript，无依赖库
- 🌐 浏览器原生 API (DOMParser, XMLSerializer)
- 💾 localStorage 自动保存上次输入
- 🎯 支持中文和特殊字符
- 🖥️ 兼容 Chrome/Edge/Firefox/Safari

### 示例

```xml
<!-- 原始紧凑格式 -->
<root><user id="123"><name>John Doe</name></user></root>

<!-- 格式化后 -->
<?xml version="1.0" encoding="UTF-8"?>
<root>
  <user id="123">
    <name>John Doe</name>
  </user>
</root>
```

---

## 📊 JSON Viewer

用于查看和搜索大型 JSON 文件，支持树形展开/收起。

- 树形结构展示
- 关键词高亮搜索
- 支持 .json/.js 等格式
- 自动识别嵌套对象

---

## ⚙️ Jenkins Env Compare

比较两个 Jenkins 实例的环境变量配置，快速识别差异。

- 对比两个环境的变量列表
- 高亮显示新增、删除、修改的项
- 支持文本粘贴或文件上传

---

## 📅 Outlook Table Compare

专为 Outlook 邮件中的表格设计的比较工具。

- 解析 HTML 表格
- 并排对比单元格内容
- 差异高亮显示

---

## 📚 Swagger Viewer

在浏览器本地渲染 OpenAPI/Swagger 文档（官方 Swagger UI 外观），文件不上传。

- 三种加载方式：打开文件 / 拖拽到页面 / 粘贴文本（支持 `.yaml` `.yml` `.json`）
- 左侧原始内容可编辑，`Ctrl+Enter` 或点「▶ 解析」重新渲染
- 🔎 页面内查找：按路径/摘要/operationId/标签过滤并定位，`Enter` 下一个、`Shift+Enter` 上一个、`Esc` 清除（浏览器 Ctrl+F 搜不到折叠内容，用这个）；GO/上一个/下一个只做高亮+滚动定位，不自动展开操作详情
- 内部 `$ref` 渲染前预解析内联，修复 `file://` 下 schema 不渲染并报 "Evaluation failed on URI" 的问题
- 📦 localStorage 缓存：自动保存上次内容（输入防抖 0.8s + 解析时落盘），重新打开自动恢复并渲染，「🗑️ 清空」同时清除缓存（>3MB 不缓存）
- 顶部徽章显示 title / version / OpenAPI 版本 / paths / operations 数量
- 已禁用 Try it out（仅查看，不发请求），`file://` 双击直接可用
- 依赖本地 `vendor/` 目录（`swagger-ui-dist@5.30.0` + `js-yaml@4`，打开页面无需联网、无需等待 CDN；5.30.0 为锁定版本 —— 5.31+ 虚拟化列表只挂载可视区操作，会导致页面内搜索漏检）

---

## 📁 项目结构

```
/home/peter/gitcode/tools/
├── index.html                    # 工具中心首页
├── swagger-viewer.html           # Swagger/OpenAPI 查看器（新！）
├── vendor/                       # Swagger Viewer 本地依赖（swagger-ui 5.30.0 + js-yaml）
├── xml-tool.html                 # XML 工具（新！）
├── json-viewer.html              # JSON 查看器
├── jenkins-env-compare.html      # Jenkins 环境比较
├── outlook-table-compare.html    # Outlook 表格比较
├── mermaid-viewer.html           # Mermaid 流程图编辑器
├── test-report.html              # XML Tool 测试报告
├── test-xml-tool.py              # 自动化测试脚本
└── README.md                     # 本文件
```

---

## 🔧 本地运行

如果需要通过 HTTP 服务器访问（避免 file://协议限制）：

```bash
cd /home/peter/gitcode/tools
python3 -m http.server 8080
# 然后打开 http://localhost:8080
```

---

## 📝 更新日志

### v1.1.6 (2026-10-06)
- 🔧 修复 XML Tool：格式化后缩进层级错乱（闭合标签 `</x>` 被误判为开始标签，缩进只增不减，深层节点全部顶格堆在一起）—— 本地格式化算法 `prettyXml` 已修正，闭合标签正确回退一层；验证二次格式化结果幂等
- 🗑️ 移除失效的 vkbeautify CDN 引用（`vkbeautify.min.js` 路径实际 404，从未加载成功，线上一直走的是本地兜底算法）；格式化完全本地化，离线 / `file://` 下零外部依赖

### v1.1.5 (2026-09-30)
- ✨ XML Tool 输入区升级为 overlay 编辑器（类 Postman）：行号栏 + 缩进竖线 + XML 语法高亮（标签红/属性蓝/字符串绿/注释灰/声明橙），透明 textarea 叠加高亮层；输入防抖 150ms、格式化/缓存恢复即时刷新，垂直与水平滚动同步，Tab 键插入两个空格
- 🐛 修复：行号内容撑高布局导致 textarea 不出滚动条 —— 编辑器改为绝对定位，面板固定高度内部滚动；5000 行文档高亮渲染约 480ms（仅在停止输入或格式化时触发）

### v1.1.4 (2026-09-30)
- ✨ 新增 XML Tool：localStorage 内容缓存 —— 输入/格式化后自动保存（防抖 500ms，>3MB 不缓存），重新打开自动恢复上次内容并延后渲染节点视图（提示「↻ 已从缓存恢复」）；点「清空」同步删除缓存

### v1.1.3 (2026-09-30)
- 🔧 修复 XML Tool：直接 Ctrl+V 粘贴带 `\"` 转义的 XML（如 SOAP 报文日志）后点「格式化/压缩」报解析错误 —— 该路径此前不走 `decodeEscapes`；现在原始解析失败时自动去转义重试，并提示「已自动去除转义并格式化完成」
- ✨ 新增 XML Tool：节点视图可隐藏 —— 点「XML 节点视图」标题栏的「隐藏」，左侧「输入 XML」占满整行（最大化编辑），输入区标题栏出现「显示节点视图」按钮可恢复

### v1.1.2 (2026-09-30)
- ⚡ 打开提速：`swagger-ui-bundle.js` / `swagger-ui.css` / `js-yaml.min.js` 从 CDN 下载到本地 `vendor/`，打开页面不再等待 jsdelivr（原先冷打开 ~9s，全部是 CDN 下载时间）
- ⚡ 缓存恢复改为「先首屏、后渲染」：打开时先显示页面与源码内容，大文档的解析+渲染延后执行，不再白屏等待
- 🔎 搜索行为调整：GO / 上一个 / 下一个不再自动展开操作详情，只做红框高亮 + 滚动定位；手动展开的操作不受影响

### v1.1.1 (2026-09-29)
- 🔧 修复：锁定 `swagger-ui-dist@5.30.0`。`@5` 指向 5.33.0 后引入虚拟化操作列表（仅挂载视口内 op），页面内搜索对大文档（如 Amadeus Digital Experience API 2.0, 336 ops）只匹配到可视区 3 个操作而报「无匹配」
- ✅ 验证：Amadeus 2.0 spec 搜索 `/special-service-requests` → 1/7 定位；TSP spec 搜索 `verify` → 1/7 定位

### v1.1.0 (2026-09-29)
- 📚 新增：Swagger/OpenAPI Viewer - 本地渲染 OpenAPI 文档（文件/拖拽/粘贴）

### v1.0.0 (2026-06-16)
- ✨ 新增：XML Tool - 格式化/压缩/转义工具
- ✅ 全部功能测试通过 (100%)
- 📸 添加截图和测试报告

### v0.3.0 (2025-05-12)
- 📊 新增：JSON Viewer
- 🏗️ 优化：统一 UI 风格

### v0.2.0 (2025-05-12)
- ⚙️ 新增：Jenkins Env Compare

### v0.1.0 (2025-03-28)
- 📅 新增：Outlook Table Compare
- 🚀 初始版本发布

---

## 👤 维护者

Peter - CodeMate 团队  
[issues](mailto:admin@cathaypacific.com) · [contributing](mailto:dev@cathaypacific.com)

---

**Last Updated**: 2026-10-06  
**License**: Internal Use Only (Cathay Pacific)
