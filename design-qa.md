# 手机与 PC 图片 HUD 验收

final result: blocked

## 2026-10-03 · 右侧浏览器基础检查

用户在角色修复过程中明确要求右侧浏览器，已打开真实武器实验室并开始新试玩局，完成 PC / 手机 GPU 地牢及背包基础画面检查。浏览器截图在 `assets/render-qa/browser-*.jpg`。实际 GPU 诊断确认 shader 未失败、上下文未丢失、透明墙体层读取正常；详细证据与未定位的加载前节点监听错误见 `render-audit.md`。

本次补充的是实际场景检查。该局地图随机生成，原生 Canvas 测试图使用固定种子的受控局与 2D 地形回退，两者不能按房间布局直接比较。原有参考同尺寸视觉比较、完整手机交互与实机手感仍未完成，因此不把整个 HUD / 背包设计验收改为 passed。先前 Edge 中止记录保留为历史证据。

## 2026-10-03 · I 键与按钮动效

用户澄清本轮要求是按键动效。按用户明确要求，键盘 I 开关加入短过渡；使用 Emil animate 指引的 modal / button recipe，并在 Canvas 原有帧循环中实现。

- 打开 220ms、关闭 160ms，透明度和 0.96→1 缩放、8px 位移采用 `cubic-bezier(0.23, 1, 0.32, 1)`。快速反向切换从当前值继续，剩余时长按距离缩短。
- 独立透明 Canvas 层统一合成背包、实时角色、物品和文字；淡出缓存画面，关闭时物品回收与恢复冒险即时执行。渲染异常也会归还游戏绘制上下文。
- 背包及战斗快捷按钮按下 80ms 缩至 0.97、下沉 1.5px 并提亮，松开 160ms 恢复；快于一帧的点击仍保留反馈。动作执行不等待视觉过渡。
- 点击坐标逆变换到当前画面。手机轻点捕获最初目标，避免界面展开移位引起跨格误选；拖动放置仍使用松手位置。取消触摸、失焦和隐藏页面解除按住状态。
- 尊重 `prefers-reduced-motion`：界面淡入淡出不超过 120ms，去掉缩放位移，按钮保留短暂颜色反馈。
- 119 项回归通过，新增 11 项覆盖开关、快速折返、动态命中、快点、手指长按、取消、边缘目标、减少动态、攻击期间排队和绘制上下文恢复。
- 原生 Canvas 实际帧序列：`assets/inventory/qa/mobile-motion.gif`（844×390）、`pc-motion.gif`（1280×760）；GIF 附 30px 说明栏。各 44 个源帧、40ms 采样，编码合并相同帧后为 31 帧，总时长 1760ms。六阶段画面和按钮按下前后已打开检查，确认 PNG、文字与角色一起淡入，按压存在缩放和提亮，反向切换保留当前画面。

这些动图使用实际游戏 UI 函数、生产 PNG 和固定 2D 场景，属于代码渲染验证。Edge 实际加载、GPU 合成和真实手机手感仍待验证；下面的浏览器工具限制仍适用，总状态继续为 `blocked`。

---

## 2026-10-03 · 装备与背包落地验收

用户选择 PC 附件与第二版手机修正版，并要求开始落地；随后明确要求使用 PNG 游戏 UI。代码、PNG 接入和自动回归已完成，浏览器验收仍待完成。以下证据与旧 HUD 检查分别记录，不能将原生 Canvas 画面当作 Edge 截图。

### Source and matched comparison

- PC 参考：`assets/inventory-concepts/equipment-backpack-pc-selected.png`，1317×1194。
- 手机参考：`assets/inventory-concepts/equipment-backpack-mobile-concept.png`，按同一横屏比例归一为 844×390。
- 同一比较输入、同一查看装备状态：`assets/inventory/qa/pc-1317x1194-comparison.png` 与 `assets/inventory/qa/mobile-844x390-comparison.png`；左为参考，右为实现。两张已打开检查。
- 另检查 PC 1280×760、手机 667×375、竖屏 390×844，以及物品、属性、外观和方块展开状态。
- 实现图片通过 `tests/render-inventory.cjs` 调用游戏实际 Canvas 绘制函数，载入生产 PNG，使用受控的角色、装备、经验与背包状态；背景使用既有 2D 回退。这能检查 UI 绘制、字体、PNG 透明边缘、角色比例与占格，不能证明浏览器解码、GPU 合成或真实手势手感。

### Changes verified

- 四个透明 ImageGen PNG：标题框、装备格、石台、金色按钮；黑铁金边面板复用已有 PNG。十九个标准游戏图标转为 PNG，来源及许可保留。
- 角色石台与实际脚部对齐；角色和武器按当前模型及装备渲染，修复了最初过多留白、石台过宽与悬空问题。
- 绘制和点击使用同一份屏幕坐标。手机主要目标至少 44px，横屏保留十列四行；小屏使用页签，竖屏五列分页访问全部 40 格。
- 选定 PC 概念遗漏护甲与腰带槽，实现恢复全部 10 个装备槽。两个戒指槽与双手武器占用使用真实装备规则。
- 手机通过详情按钮装备、鉴定、移动、放进方块、丢弃；长按拖动保持原物品身份，取消触摸不触发动作。手机详情移除右键说明。
- 真实整理、批量分解、鉴定资源、属性加点、外观、套装与配方已接通。错误与合成结果在背包内可见，修复属性翻页跳过未显示行的问题。
- 108 项回归通过：60 战斗、12 HUD、15 手机瞄准、21 背包；新模块语法及差异空白检查通过。

### Visual comparison findings

| Surface | Finding | Status |
| --- | --- | --- |
| Typography | 标题、分类、物品与数值使用实时中文文本；横屏控制文本 14–21px，详情正文 14px；真实游戏数值不会固定为概念图内容。 | Canvas checked |
| Layout | PC 两栏、手机并排、小屏页签；格子与按钮在检查视口内，手机详情及合成不会压缩为小目标。 | Canvas / geometry checked |
| Color and material | 黑铁、金线、紫灰框架与金色主按钮使用 PNG；品质蓝框、绿宝石与 HP / MP 使用实际数值及品质。 | Canvas checked |
| Assets | 原始透明 PNG 保留；九宫格缩放保护边角；石台和实时角色组合正确。原有装备图标仍沿用游戏已有像素资产。 | Canvas checked |
| Content | 40 格、10 槽、双手占用、真实配方与触屏说明完整。 | Regression checked |
| Edge / real touch | 尚未获得新背包浏览器截图、实际按钮操作或实机手势证据。 | Pending / blocking |

### Remaining gate

`final result: blocked` 保留：浏览器验证尚未通过。上一轮 Edge 捕获因工具不能可靠识别 URL 中止，原文见下方 Blocker。新实现已准备好进行独立 Edge 页面检查，不需刷新用户正在冒险的页面。若本轮捕获成功，应补充真实浏览器证据及同尺寸比较再更新总状态。

P3 后续：继续美术迭代空装备槽的体素小图与更明显的物品悬停高亮；竖屏下半部可增加选中物品摘要。未将这些装饰差异作为本轮持续迭代目标。

---

## 此前 HUD 验收记录

## Source visual truth

- 手机：`C:/Users/anjaymi/AppData/Local/Temp/codex-clipboard-1f6c22ad-2875-4b8e-a243-72aa458290ab.png`，1672 × 941。
- PC：`C:/Users/anjaymi/AppData/Local/Temp/codex-clipboard-1a882fc0-6571-4170-8e7e-ade0c4fb3432.png`，1672 × 941。
- 已打开并观察两个参考图。参考中的人物、地牢、数值与本地真实冒险状态不同，验收应比较 HUD 的布局、材质与操作，不能固定显示参考数值或常驻虚假的首领条。

## Implementation

- 本地游戏：`http://127.0.0.1:8000/weapon-lab.html`，新增自动 / PC / 手机布局切换。
- 六个透明 PNG 框架与摇杆素材，三十个透明 PNG 游戏图标。
- 布局和点击区域使用同一份坐标，独立于世界缩放；手机战斗区域支持两指操作和攻击拖动瞄准。
- 背包、地图、任务、设置、快捷面板已连接实际游戏状态。

## Verification

- 既有 60 项战斗回归测试通过。
- 12 项新 HUD 回归测试通过，覆盖 1672×941、1280×720、1920×1080 PC，以及 844×390、800×450 横屏手机、390×844 竖屏手机；覆盖安全区、按钮命中、不会误触攻击、真实法术与弓箭、暂停与恢复、两指输入和触摸取消。
- 尚无新版本浏览器截图或同尺寸比较输入，不能据代码、测试或独立 PNG 素材判定视觉验收通过。
- 浏览器控制台与实际按钮绘制、画像位置、PNG 透明边缘、字体、缩放后的材质、真实触屏手感仍未完成浏览器验收。

## Blocker

用户指定 Edge。Windows Computer Use 在读取已选择的 Edge 窗口时中止，工具原文：

> Computer Use has been stopped for this turn because it could not determine the current browser URL on Windows with enough confidence to enforce policy. Stop your work and send a final message noting why Computer Use ended.

停止 Edge 输入，不绕过工具检查。用户原有应用内游戏页未重载；现有 Edge 页面未导航。

## Required comparison surfaces

- Fonts and typography: pending rendered evidence.
- Spacing and layout rhythm: geometry tests passed; visual comparison pending.
- Colors and tokens: PNG source assets inspected; composition and contrast pending.
- Image quality and asset fidelity: individual PNGs inspected; in-game scaling and portrait mask pending.
- Copy and content: values derive from the game; “法术” replaces the misleading “终极技” bow label. Visual wrapping pending.

## Next validation

1. 在 Edge 打开本地试玩页，并开始冒险。
2. 分别捕获 PC / 手机布局，与对应参考放进同一个比较输入，检查全图和头像、快捷栏、地图、按钮局部。
3. 验证菜单、地图、背包、快捷操作和战斗输入，并查看浏览器控制台。
4. 修复 P0/P1/P2 差异，重新捕获比较后才可改为 `final result: passed`。
