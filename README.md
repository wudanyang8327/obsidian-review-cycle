# ReviewCycle

ReviewCycle 是一款面向 Obsidian 的回顾插件，让你以「间隔重复」的方式持续复习旧笔记并掌握下一次回顾的节奏。

## 功能亮点
- 🚀 **一键回顾**：命令面板或侧边栏按钮立即触发每日回顾，一次专注一篇笔记。
- 🧠 **智能筛选**：根据自定义间隔自动跳过近期复习过的笔记，只打开最需要回顾的目标。
- 📅 **历史面板**：右侧面板展示全部已跟踪笔记、上次回顾时间、下一次预计时间及逾期状态。
- 🔄 **自动记录**：每次回顾后写入 `.obsidian/plugins/review-cycle/data.json`，并刷新历史视图。
- ⚙️ **可配置**：自定义回顾间隔天数，完全掌控节奏。

## 快速开始
1. 在 Obsidian 中启用 ReviewCycle 插件。
2. 通过以下方式之一启动回顾：
   - 命令面板搜索 `Start Daily Review`；
   - 点击左侧 Ribbon 上的 ReviewCycle 图标。
3. 插件会：
   - 获取 Vault 中的所有 Markdown 笔记并过滤掉近期已回顾的条目；
  - 随机挑选符合条件的第一篇笔记并在当前窗格中打开；
   - 记录当前时间作为最新回顾时间，计算下一次回顾日期；
   - 在历史面板中实时更新结果，并通过通知提示所回顾的笔记标题。

## 界面与命令
- **Commands**
  - `Start Daily Review`：开始当日回顾。
  - `Open Review History`：在右侧窗格打开历史数据面板。
- **Ribbon Icon**
  - 点击左侧 ReviewCycle 图标可以快速触发 `Start Daily Review`。
- **Review History Panel**
  - 展示当前跟踪笔记数量、设置的回顾间隔、逾期与缺失文件统计；
  - 支持点击笔记标题直接跳转；
  - “Last review / Next review” 列按精确时间排序，方便识别最新与逾期条目。

## 设置
在 **Settings → Community plugins → ReviewCycle** 中可配置：
- **Review interval (days)**：两次回顾之间至少间隔的天数，默认 30。

设置变更会立即生效，并通过 `this.saveData()` 持久化。

## 数据存储
- 路径：`<Vault>/.obsidian/plugins/review-cycle/data.json`
- 作用：记录每篇笔记最近一次回顾的时间戳（UTC 格式 `YYYY-MM-DDTHH:mm:ss`）。
- 示例：

```json
{
  "notes/学习计划.md": "2025-10-01T22:30:00",
  "notes/系统设计.md": "2025-09-14T09:45:12"
}
```

删除该文件不会影响插件正常使用，下次回顾时会自动重新生成。

## 开发与构建
- 安装依赖：`npm install`
- 开发调试（监听模式）：`npm run dev`
- 生产构建：`npm run build`

构建后，把 `main.js`、`manifest.json`（以及可选的 `styles.css`）复制到 `<Vault>/.obsidian/plugins/review-cycle/` 目录即可手动部署。

## 许可协议
本插件以 MIT License 发布，欢迎基于此进行二次开发或贡献改进。
