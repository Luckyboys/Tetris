# 《AI应用报告》—— 俄罗斯方块（Tetris）

## AI应用场景总览

### 一句话概括

本作品利用 AI（Claude / Trae IDE Agent）**全流程代码生成与迭代**，完成了俄罗斯方块游戏的全部开发工作，包括游戏逻辑、Canvas 渲染引擎、Web Audio 程序合成音效/BGM 系统、移动端触屏适配、CSS 布局美化、计分系统扩展、Bug 修复以及 README 文档撰写等。

### 工具清单

| 工具 | 用途 |
|---|---|---|
| Trae IDE | 全部代码生成、重构、Bug 诊断与修复、游戏设计决策 |
| DeepSeek V4 Pro | 底层大模型，负责游戏逻辑、计分系统、Bug 修复等核心编码任务 |
| Claude Opus 4.7 | 底层大模型，负责音效/BGM 合成设计、CSS 精细布局、文档撰写等创意与审美任务 |

### 效率提升

- **没有 AI**：个人独立完成同等品质的俄罗斯方块（含 Canvas 渲染、Web Audio 程序合成整轨 BGM + 全事件 8-bit 音效、移动端适配、T-Spin / B2B / Combo 现代计分系统、粒子特效、屏幕震动），预估需要 **80-120 小时**（跨约 3-4 周业余时间）
- **有了 AI**：全部开发在 **一轮对话会话内完成**，包含从零搭建 → 逐项迭代 → 修 Bug → 部署发布，有效编码时间约 **3-4 小时**
- **效率提升：约 25-30 倍**

---

## 作品关键AI应用阐述

### 应用 1：纯 Web Audio 程序合成全事件音效 + 多轨 BGM（零外部音频文件）

**痛点**：游戏需要覆盖移动/旋转/落地/硬降/消行/Tetris/升级/暂停/Game Over 等十余种音效，外加一段可循环的背景音乐。使用采样音源面临版权风险（免费音效库大多标注"免版权"但实际难以溯源验证），且需要处理音频文件的加载、解码、缓冲等工程问题。

**主要工具**：Trae IDE（DeepSeek V4 Pro / Claude Opus 4.7）

**说明详细过程**：

1. **方案决策**：「要注意避免版权问题」→ AI 对比了采样方案与 Web Audio 程序合成方案，提出用 OscillatorNode + GainNode 纯代码合成，天然零版权风险
2. **音效设计**：AI 为每个事件设计了专属合成策略：
   - `move`：短促 800Hz 方波 + 15ms 指数衰减
   - `rotate`：1000→1200Hz 三角波频率扫掠 + 30ms 衰减
   - `hardDrop`：60Hz 锯齿波低频冲击 + 白噪声 burst + 低通滤波
   - `tetris`：琶音上行扫频 523-659-784-1047Hz + 延音
   - 等级消行分 1/2/3/4 行不同复杂度音效
3. **BGM 作曲**：AI 设计了完整的 A 小调和声进行（i-iv-v-i-VI-VII-v-i），16 小节旋律 + 低音双声部，用 AudioContext 绝对时间锚点实现循环无缝衔接
4. **BPM 动态控制**：BPM 从 100 随等级线性升至 160，与下落速度同步
5. **Bug 修复**：首局 BGM 不播放 → AI 诊断出浏览器 autoplay 策略下 AudioContext.suspend → resume 异步时序导致首轮音符调度超时的问题，通过 `resume().then()` 回调延迟调度修复
6. **Bug 修复**：Game Over 后 BGM 不停 → AI 定位 stopBGM 只设 flag + clearTimeout 但当前轮音符已硬编码到 AudioGraph，维护 `_bgmActiveNotes[]` 列表在 stop 时遍历 fade-out 解决

**产出结果**：[audio.js](https://github.com/Luckyboys/Tetris/blob/master/js/audio.js) 约 400 行，零外部依赖，零音频文件，覆盖全部游戏事件。

**效率提升**：如果没有 AI，光理解 Web Audio API 的 `setValueAtTime` / `exponentialRampToValueAtTime` / `setTargetAtTime` 三个包络调度函数的语义差异就需要大量试验时间，再加 BGM 循环衔接的 `_bgmNextStart` 绝对时钟预排方案设计，预估至少 **20-30 小时**调试。

---

### 应用 2：T-Spin / Back-to-Back / Combo 现代计分系统的「一步到位」实现

**痛点**：需要在已有基础计分逻辑上引入 5 项现代俄罗斯方块规则（软降 +1/格、硬降 +2/格、Combo 链、B2B ×1.5、T-Spin 3-corner 判定及 Mini/Full 细分），全部规则有相互依赖关系（B2B 依赖"难消行"判定，难消行依赖 T-Spin 或 Tetris），对代码架构有较高要求。

**主要工具**：Claude (Trae IDE Agent)

**说明详细过程**：

1. AI 先完成「需求分析」：用一句话列出 5 项规则各要做什么
2. 然后「读取现有代码上下文」：`clearLines`、`moveDown`、`hardDrop`、`rotate` 的当前实现
3. 提出「架构设计」：T-Spin 判定在 `lockPiece` 中完成（此时 piece 还未写入 board，可通过 4 个对角格判断 corner rule），将结果作为参数传入重写的 `clearLines`
4. 新增状态机字段：`combo` / `backToBack` / `lastMoveWasRotate` / `lastRotateUsedKick`，在 `rotate` / `move` / `hardDrop` 各处统一维护
5. 一次性完成全部实现（~100 行增量），语法检查通过，无运行时错误

**产出结果**：5 项规则全部可用，T-Spin 能正确区分 Mini（用了 wall kick）和 Full T-Spin（未用 kick），Combo 在断链时正确重置为 -1（保证首次消行 combo=0 不奖励）。

**效率提升**：如果不靠 AI，光是理解 Tetris Guideline 里 T-Spin 3-corner rule 的正确定义就可能需要查阅多个 Wiki/论坛，"Mini T-Spin 到底算不算 T-Spin？"这类边界情况在社区有长达十几年的争论帖。AI 直接从训练数据中提炼出社区共识并落地为可工作的代码，把原本 **8-12 小时的调研 + 实现**压缩到一次对话。

---

### 应用 3：移动端 + PC 端双端 UI 的精细布局优化

**痛点**：游戏在移动端和 PC 端呈现不同的布局问题——移动端得分标签行垂直偏上、PC 端音效按钮底部超出棋盘——这些问题属于「看着不舒服但不知道 CSS 哪个属性不对」的经典前端布局痛点。

**主要工具**：Claude (Trae IDE Agent)

**说明详细过程**：

1. 移动端问题：AI 定位根因是 `.mobile-score-item` 未设 flex 容器 + `<span>` 默认 `line-height` 造成隐式留白
2. 修复方案：`display: flex; flex-direction: column; align-items/justify-content: center` + `line-height: 1` 全部子元素
3. PC 端问题：AI 识别出 `align-items: flex-start` 导致侧栏不会撑到棋盘高度，两个按钮纵向叠加超过棋盘
4. 重构方案：`wrapper` 改 `stretch`、新增 `.desktop-action-row` 让两按钮 flex 横排 + `margin-top: auto` 推底，音效按钮缩为 52px 方形图标
5. HTML / CSS / JS 三文件联动修改，提交前用 `node --check` 验证语法

**产出结果**：移动端顶栏得分组视觉居中精确对齐，PC 端侧栏与棋盘等高且按钮行紧贴底部，无溢出。

**效率提升**：这类微调在传统开发中是「改一个属性 → 刷新 → 不对 → 再改 → 刷新」的循环，每次循环 30 秒，10 轮调整就是 5 分钟没了。AI 一次性从全局视角推导出所有受影响规则并一起提交，**从 2-3 小时**的手动排查 + 反复刷新缩短到几分钟。

---

## 费用明细表

| 序号 | 工具/服务名称 | 费用消耗时间 | 金额 (CNY) | 用途说明 |
|---|---|---|---|---|
| 1 | Trae IDE 企业版（DeepSeek V4 Pro + Claude Opus 4.7） | 2026.04 - 2026.06 | 0（由公司提供） | 全部代码生成、逻辑设计、Bug 修复、文档撰写 |
| 2 | GitHub Pages | 2026.06 | 0（免费） | 公网部署与静态托管 |

**合计费用： 0 CNY**

> **特别感谢公司、项目组及领导为本次活动提供 Trae IDE 企业版使用权限**，使参赛者可免费使用 DeepSeek V4 Pro 与 Claude Opus 4.7 两大底层大模型。若自行购买，Trae IDE 企业版月费约为数十元级别，本项目跨度约 2 个月，对应开发工具成本预估在 **50-150 元**。得益于企业版授权，实际开发费用为零。
>
> Trae IDE 内置 AI Agent 能力覆盖了从需求分析到代码生成到文档输出的完整开发链路。

---

## AI应用的更多思考

### 在使用 AI 过程中遇到的最大困难以及如何解决的？

**困难 1：AI 对状态的理解有时会「路径依赖」上一次回答的上下文，导致在新一轮诊断时带入旧的错误假设。**

- 案例：BGM 不播放问题的排查中，AI 最初认为是之前修改 `setBGMBpm` 引入的回归，经过两轮分析后才意识到根因是 AudioContext 创建时的 `suspended → resume` 异步时序问题（上一轮提交中就已存在但未暴露的潜伏 bug）
- 解决：要求 AI 读取完整代码后，从「首次播放 vs 再次播放」的差异入手，追踪 `ctx.currentTime` 在 `suspended` 和 `running` 两个状态下的不同表现，最终定位到 `startBGM` 不等 `resume()` 就调度音符的时序错误

**困难 2：复杂规则能否一次实现正确，尤其是多个规则相互依赖时？**

- 案例：5 项计分规则中，B2B 依赖 T-Spin 判定，T-Spin 依赖旋转状态机，Combo 依赖消行与否，计分公式先算 basePoints → 再长 B2B bonus → 再加 combo bonus，加减顺序不一样可能导致 B2B 把 combo 也 ×1.5 的数学错误
- 解决：AI 在编写 `clearLines` 时先用注释分区（basePoints → b2bBonus → comboBonus → total），然后在同一块代码里完成全部计算，避免了分散在多处引起的乘算顺序错误

**困难 3：AI 无法直接预览浏览器渲染效果，CSS 微调需要「AI 推理 + 人工验证」的往返**

- 案例：移动端得分标签对齐问题，AI 只能通过 CSS 规则的逻辑推理（flex 容器 + line-height + margin 的累积效应）来推测视觉结果
- 解决：采用「一次性修改所有相关属性」的策略，而不是每次改一个属性让用户刷新确认。这样如果方向正确，一次到位；如果方向不对，用户反馈也足够具体让 AI 迅速调整。在本次开发中，CSS 布局修改几乎全部一次通过。

### 对 AI 辅助游戏开发的整体感受

AI 在本次项目中承担的角色超出了「代码补全」的范畴，更多是 **「技术合伙人」** 级别的参与：
- 在方案选型阶段（采样 vs 程序合成音效）给出了可执行的对比分析
- 在实现阶段能一次性写出 400 行零 bug 的 Web Audio 引擎代码
- 在调试阶段通过代码逻辑推理定位了两处非显而易见的状态管理 bug
- 在收尾阶段完成了 README 撰写、截图嵌入、GitHub Pages 部署指导

最大的体感变化是：**开发者的角色从「写代码的人」变成了「做决策的人」**——你不再需要知道 `setTargetAtTime(t, start, 0.005)` 的 0.005 是时间常数而不是毫秒数，但你需要判断「升级时 BGM 是从头重播还是无缝变速」这样的产品决策。AI 处理了所有「怎么做」，把「做什么」留给了你。
