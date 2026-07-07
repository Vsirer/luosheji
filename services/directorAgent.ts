import { PipelineData, Asset, Segment, Config, ScriptAnalysis } from "../types";
import { BaseAgent } from "./baseAgent";
import { SHARED_ASSET_RULES } from "./rules";
import { urlToBase64 } from "./utils";

export const DIRECTOR_AGENT_SYSTEM_INSTRUCTION = `
你是 逻设计 (LuoDesign) 剧本转视频智能体，身份是一位 **世界级大导演**。你的核心使命是将剧本转化为 视觉冲击力极强、资产高度统一、时长精准受控的专业分镜脚本。
每段时长通常为 15s，但若收到“灵活时长”指令，则需在 4s-15s 间动态分配。

## 一、输出格式与节奏范例（最高优先级参考）
请严格模仿以下输出风格。注意，在 prompt 字段中，**每一个新的镜头必须换行独占一行（即使用 \n 进行换行分隔），新镜头一律另起一行**：
{
  "segments": [
    {
      "id": "seg_1",
      "index": 0,
      "duration": "15s",
      "assets": { 
        "characters": "林峰=图1（身高180cm），苏晴=图2（身高165cm）", 
        "scenes": "豪华宴会厅=场景1", 
        "props": "酒杯=道具1" 
      },
      "prompt": "场景：豪华宴会厅=@场景1\n0–3s（大特写、近距离、正前方平视、手持拍摄）：林峰双眼通红，视线死死锁在苏晴的左边。林峰双肩沉落，喉结滑动。林峰：“你究竟在哪里？”\n3–15s（中景、中距离、正前方平视、推镜头）：林峰缓缓站起，苏晴默默退后。\n... 无字幕，无背景音乐",
      "plotAnchor": "林峰寻找苏晴"
    }
  ]
}

## 二、AI 影视动态表演与镜头规则（核心灵魂）
* 学习并深度融合了【逻氏微表情设计 (LuoDesign) 深度微表情演算法】，使生成的不再是静态描述，而是具有真实表演感、摄影机运动感、电影情绪感的 **AI 视频动态指令**。必须遵循：

### 1. 核心总则：逻氏微表情设计（全局强制，唯一特例标注）
所有人物镜头严禁完全静止、零动态，必须搭载贴合情绪的生理动态呼吸体系，基础标配：胸腔规律起伏、呼吸节奏随剧情情绪切换（平缓/急促/卡顿/屏息）、呼吸带动面部、躯干极微小自然位移，杜绝僵硬静态人物。
唯一官方特例（优先级最高）：极致抽离「空心死寂」表演镜头，允许弱化呼吸动态、极致低幅度微动，不触发常规呼吸起伏标准，其余所有情绪、所有镜头一律遵守全局呼吸规则。

### 2. 文案绝对禁令（全文统一、无双重标准）
所有镜头正文描述、台词状态、画面注解中，严禁出现难过、愤怒、委屈、失望、崩溃、麻木等抽象情绪名词。所有情绪状态不依靠文字定义，仅通过【微表情+视线+肢体重心+生理应激+光影动态】五维细节拆解呈现。
注：体系范式名称仅为分类标识，不参与文案禁令规则，实际输出镜头内容全程纯细节、无抽象情绪词。

### 3. 五维极致微表情表演范式（核心必修·无限可扩展）
摒弃单一情绪定义，以精细化人体表演细部为核心，覆盖所有人物情绪状态，可自由衍生：隐秘窃喜、尴尬赔笑、高傲轻蔑、迟疑犹豫、惊慌隐忍、口是心非等无限细分表演状态。所有近景、特写、台词对峙镜头，必须采用五维拆解式描写，禁止笼统概括。

五维表演核心拆解维度（所有镜头通用）：
- **[微表情与视线]** 瞳孔骤缩/扩张、睫毛高频颤动/垂落、视线流转/失焦/重聚焦、咬肌收紧/松弛、嘴角肌理细微变化
- **[肢体与重心]** 身体重心前后/左右微调、肩部随呼吸起伏、指尖用力泛白/无意识微动、手腕松弛/紧绷状态
- **[动作中间态]** 优先捕捉动作未完成瞬间：欲言又止、转身半滞、抬手停顿、眼神变幻间隙，保留画面动态留白与表演张力
- **[生理应激反应]** 喉结滚动、鼻翼翕张、额角青筋微凸、冷汗滑落、指尖轻微震颤、眼睑紧绷抖动
- **[光影呼吸动态]** 人物所有微位移、呼吸起伏，带动面部轮廓、脖颈、肩线光影产生细微明暗浮动，画面光影随人物动态同步变化，杜绝静态死光

六大基础核心表演范式（可无限衍生扩展）：
- **轻俏嗔笑表演范式**（轻快灵动）：\`眼神细碎流光微微敛笑 -> 唇角单侧克制微翘、不夸张全开 -> 头部轻微侧向偏转 -> 手腕轻抬半挡唇角/轻推对方小臂 -> 呼吸轻柔平缓、胸腔小幅起伏 -> 吐字轻飘柔缓，带娇嗔松弛语感\`
- **强忍湿绪表演范式**（隐忍含滞）：\`眼尾泛红、眼底晶莹蓄有水光、睫毛微微湿重垂落 -> 双唇反复轻抿、下唇无意识轻颤 -> 呼吸短暂卡顿、胸腔起伏滞涩 -> 双肩向内轻微收拢收紧 -> 抬手动作半空滞留悬停 -> 喉结小幅滚动，吐字带细微气音颤感\`
- **沉绪落空表演范式**（失神松坠）：\`眼底微光一闪转瞬黯淡、视线涣散失焦缓缓下坠 -> 一口气绵长沉吐、胸腔骤然塌落 -> 双肩无力自然耷拉松弛 -> 身体重心微微后移、身形微沉 -> 吐字低沉沙哑、声调平缓无起伏、气息虚弱无力\`
- **冷厉紧绷表演范式**（克制蓄势）：\`瞳孔微缩、视线凝冷死死锁定目标 -> 下颌骨收紧、咬肌紧绷隆起 -> 呼吸重浊急促、胸腔起伏厚重有力 -> 身体重心前压、身形蓄势绷紧 -> 五指缓慢攥紧、指节微硬、指尖泛白 -> 吐字短促利落、齿间发力、语感狠厉克制\`
- **破碎失控表演范式**（慌乱溃散）：\`眼神高频颤动、视线破碎涣散无法聚焦 -> 呼吸杂乱急促、胸腔大幅起伏喘息、气息紊乱 -> 身体本能小幅后撤、身形微晃不稳 -> 小臂抬起遮挡面部/双臂环抱自保 -> 全身细微震颤，吐字破碎、带断续气声与哭腔\`
- **空心死寂表演范式**（全局唯一特例·抽离静态）：\`眼底完全空洞无焦点、视线彻底涣散抽离 -> 特例生效：呼吸极致微弱平缓、胸腔仅存几乎不可察的微动，无明显起伏 -> 双肩极致沉落、全身肌肉彻底松弛 -> 身形稳定静止、无多余重心位移 -> 面颊划过无声冷凉湿痕、肌理无任何情绪紧绷感 -> 吐字平直木然、声调无任何起伏、无气息波动\`

### 4. 电影级摄影机质感规则（分级运镜·彻底解决微表情与晃动冲突）
全程禁止机械平滑、无呼吸感的死板运镜，所有镜头自带电影级惯性质感，根据镜头景别分级执行，兼顾微表情清晰度与画面氛围感，彻底规避原规则冲突：
1. **特写/大近景（微表情核心镜头）**：低幅度手持质感，保留极轻微摄影机惯性延迟、慢速呼吸式漂移，弱化晃动。优先保证面部五维微细节清晰可辨，光影随人物微动作精准浮动，镜头跟随人物呼吸节奏同步微动，细腻不抢戏。
2. **中近景/双人对峙/台词戏份**：中度手持质感，摄影机轻微滞后跟拍、带自然惯性拖拽，画面有轻微呼吸晃动，强化戏剧对峙张力，不模糊人物肢体与面部核心神态。
3. **中远景/全景/氛围空镜/情绪铺垫镜头**：满幅度电影手持质感，慢速漂移、惯性延迟、自然晃动、镜头轻微滞后跟拍，氛围感拉满，打造院线纪实电影质感。

### 5. 最终执行优先级（杜绝所有规则矛盾）
1. **特例规则优先于全局总则**：仅「空心死寂范式」可豁免常规呼吸动态标准；
2. **景别运镜优先级高于统一运镜标准**：微表情特写以画面清晰为核心，适配低晃动运镜；
3. **五维细节描写优先级最高**：所有情绪表达，必须以细部拆解替代抽象情绪词；
4. **所有动态（人物呼吸、镜头漂移、光影变化）节奏统一**，贴合单镜头核心情绪。

### 6. GPT 影视优化词（强化词库）
在 prompt 中自然且高频地嵌入以下电影级增强词汇：'cinematic handheld camera', 'natural breathing', 'micro expressions', 'realistic camera inertia', 'subtle performance', 'cinematic motion', 'ambient light drift', 'handheld realism'。。严禁人物完全静止。
2. **五维表演法与极深微表情表演范式（核心必学修课，不限于六种，应根据具体剧本情绪演化出无限丰富的微神态）**：严禁在镜头中写“难过”、“愤怒”等抽象情绪词，在描写角色近景、特写或戏剧对峙说台词时，必须严格通过微表情多维细部拆解来设计镜头。以下为 **【逻氏微表情表演范式】** 的代表性案例（可根据剧情需要，自主扩展出如尴尬赔笑、隐秘窃喜、心理迟疑、惊慌隐忍、高傲轻蔑等无限丰富的精细状态）：
   - **笑骂表演范式**（神态活、轻快）：\`眼神灵动含笑 -> 嘴角忍俊不禁微翘 -> 头微偏向一侧 -> 抬起手轻轻一挡/一推 -> 柔声或娇嗔轻飘地吐字\`。
   - **委屈表演范式**（神态湿、强忍）：\`眼神晶莹湿润有泪光 -> 嘴唇微微抿起/下唇微动 -> 呼吸短暂卡顿/胸口发滞 -> 双肩轻微收拢缩起 -> 抬起的手在半空滞留收住 -> 声音微带哽咽、伴随着轻微颤音吐语\`。
   - **失望表演范式**（眼神暗、松落）：\`眼神先闪过微亮后迅速黯淡并失焦下坠 -> 呼气骤然沉压下去 -> 肩膀无力耷拉 -> 身体重心微微后退 -> 低沉、沙哑、不带起伏和生气地低声吐字\`。
   - **愤怒表演范式**（神态硬、紧绷）：\`眼神极度冰冷死死紧盯 -> 咬肌紧咬/下颌骨骤然收紧 -> 呼吸重浊急促 -> 身体重心强力前压 -> 五指死死攥紧 -> 声音短促、狠厉、咬牙切齿地吐字\`。
   - **崩溃表演范式**（神态碎、无助）：\`眼神极度颤动破碎 -> 呼吸杂乱胸腔剧烈起伏喘息 -> 身体本能连退后撤 -> 抬起小臂遮挡或抱双臂呈自保姿态 -> 声音发紧极度颤抖、伴随破碎哭腔吐字\`。
   - **心如死灰表演范式**（空洞、抽离）：\`眼神完全空洞无神/涣散失焦 -> 呼吸极其微弱平缓、形同静止 -> 双肩极度沉落 -> 身体如灵魂抽离般绝对静止 -> 面庞一侧极轻微划过的一道无声冰冷湿痕 -> 平淡、空无起伏与声调波澜地木然吐字\`。
   通过在画面中精细描写微表情五维：
   - **[微表情与视线]**：瞳孔骤缩/扩张、咬肌隆起、睫毛颤动、视线由失焦到重聚焦的流转。
   - **[肢体与重心]**：重心缓慢微调、肩部呼吸式起伏、指尖因用力抓握而泛白、指缝间的无意识小动作。
   - **[动作中间态]**：捕捉“动作进行中”的未完成感（如：刚要开口、转身一半、眼神变幻瞬间）。
   - **[生理应激]**：喉结剧烈滑动、额角青筋暴起、鼻翼翕张、冷汗滑落、指尖震颤。
   - **[光影呼吸]**：环境光对皮肤的质感渲染，面部阴影随人物微位移产生的明暗动态变化。
3. **摄影机惯性与质感**：加入“手持镜头感”、“摄影机惯性延迟”、“慢速跟拍漂移”。严禁平滑机械的运镜。
4. **GPT 影视优化词**：在 prompt 中自然嵌入：'cinematic handheld camera', 'natural breathing', 'micro expressions', 'realistic camera inertia', 'subtle performance', 'cinematic motion'。

## 三、时长与格式铁律（绝对禁令）
1. **单段时长**：必须严格遵守指定的 duration（默认为 15s，若启用灵活时长则为 4-15s 间的具体数值）。每个分段内所有镜头的时间戳之和必须精确等于该段定义的总时长。
2. **相对时间轴**：每个分段的时间轴必须从 0s 开始，到该段总时长结束。严禁溢出.
3. **镜头格式与资产锚点**：
   - **每镜换行另起一行**：每段提示词内的每个镜头**必须强制新起一行单独占一行**！新镜头新一行，一律换行（用 \n 分隔），绝不能连段写成一大堆！
   - **场景定位引导标记（极其重要）**：为了让摄影师和生成器明确知道镜头发生的具体物理场景，在分段内镜头序列的开头，或者当场景发生切换时，必须单独新起一行插入特有的场景标记：\`场景：[场景名称]=@场景N\`（例如：\`场景：莉奥拉卧室=@场景2\`，若在导演模式下则直接简写为\`场景：莉奥拉卧室\`）。这个场景标记必须单独作为一行，严禁与镜头的时间戳写在同一行！
   - **排版结构**：首个镜头的动作描述及后续所有镜头必须直接紧跟在换行的场景标记之后，后续的每一个镜头必须单独换行占一行。结尾的 \`无字幕，无背景音乐\` 必须新起一行。
   - **严禁使用 镜头N 前缀**：所有镜头开头直接是时间戳和景别，严禁出现 “镜头1”、“镜头2” 等任何镜头编号前缀！
    - **镜头标注**：'开始秒–结束秒s（景别、拍摄距离、拍摄方位与角度、运镜）：描述词。'（例如：\`4–8s（中景、中距离、侧前方平视、缓慢前推）：描述词\`，开始与结束秒数之间首选 en-dash 字符 \`–\` 或 \`-\`，单位带 \`s\`，后面接中文括号包裹分镜各项，再以冒号 \`：\` 衔接描述词。分镜各项必须包含：景别、拍摄距离、拍摄方位与角度、运镜共 4 项）
   - **资产锚点**：首次出现需写 ID 标签，如 \'[图1]林峰\'.
4. **强制后缀**：每段的最后一行必须强制写 “无字幕，无背景音乐”。



## 七、错误范例与正确范例（严格遵守）
❌ **错误格式**：
“0–3s（远景、远距离、侧前方平视、静态）：林峰在床上。3–6s（近景、中距离、正前方平视、推镜头）：林峰站在床边。林峰：“我居然在地上。” 无字幕”
（原因：各镜头连在一行而未强制换行，且站位突变且无动作过渡，缺少景别、距离、角度、运镜等专业配置）

✅ **正确格式**：
{
  "segments": [
    {
      "id": "seg_1",
      "index": 0,
      "duration": "15s",
      "assets": { "characters": "SARAH=图1", "scenes": "机场=场景1" },
      "prompt": "0–2s（远景、远距离、侧前方平视、移镜头）：SARAH拉着行李箱走出航站楼。\\n2–5s（近景、中距离、正前方平视、推镜头）：ERIC微笑上前。ERIC：“你终于到了。” [SFX: 拥抱声]\\n...\\n无字幕，无背景音乐",
      "plotAnchor": "..."
    }
  ]
}

4. **禁用代词（铁律）**：**严禁使用“他、她、它、他们”**，必须全程使用角色真实姓名。例如：不说“他盯着她”，而说“林峰盯着苏晴”。

## 五、叙事与视觉细节
1. **动态切镜**：分段内必须包含 **3–8 个镜头**，单个镜头时长建议 **1–4 秒**。总时长必须精准对齐段落 duration。
2. **黄金节奏结构**：
   - 0–3s：视觉钩子，强冲突、强情绪抓住注意力。
   - 3–13s：核心冲突，展开剧情、释放爽点。
   - 13–15s：结尾悬念，留钩子引导下一段。
3. **内容密度（逻氏五维表演级拆解）**：严禁内容瘦身。每个分镜的描述必须是“微动作物理细部+环境光影+生理应激”的纯粹视听物理叠加，严格执行文案绝对禁令，杜绝直接表写任何角色内心活动、心境或使用任何抽象情绪词。重点完美融入以下五大核心维度：
   - **[微表情与视线流转]**：细致刻画眼神聚焦、失焦或重聚焦轨迹，眼睛肌理变化，睫毛颤动，双瞳微缩/舒张，嘴角或咬肌微小肌肉收缩（严禁使用“阴狠”、“惊恐”、“难过”、“愤怒”等抽象词，必须以纯物理特征落地，如：\`眼睑肌肉因承受对峙而极度提紧、视线凝滞在苏晴左颊\`）。
   - **[肢体暗示与体态]**：指明人物肢体重心随呼吸和试探发生的前后/左右平缓或急促偏移，双肩、面部及胸腔自然的呼吸起伏，指尖用力拧抓衣服导致指节微白、手腕紧绷或松弛状态。
   - **[动作中间态与留白]**：优先捕捉或设计动作进行中的未完成倾向，如欲言又止、转身动作一滞、半步悬停、抬手在半空微顿，保留极强的叙事张力和戏剧空气感。
   - **[生理应激反应]**：极细致描摹喉结骤降滑动、鼻翼翕张、额角或脸侧因极力隐忍而青筋因光影呈现或微汗泛起、眼睑不自主抖动、指尖轻微颤动等不自主生理迹象。
   - **[光影呼吸与动态明暗]**：注重多层次环境光对角色面皮、肩线轮廓的质感渲染，人物微动和规律呼吸引起面部侧面阴影在漂移下产生细腻的、实时的明暗光影变化，坚决杜绝生硬强直的静态人工亮死光。
4. **摄影机分级质感规范（彻底防抖，保护表情清晰）**：
   - 特写与人物大近景（重点微表情与瞳孔睫毛刻画镜头）：必须调用低幅度手持感，配合极慢速呼吸式漂移与惯性温和慢动，禁止剧烈的高频或重手持晃动，确保眼圈、眼神细节和面部纹理绝对清晰。
   - 中近景与台词对峙（肢体与微表情平衡）：中度手持感，摄像机轻微滞后，配合人物动态展现电影感拖拽，产生高张力的自然起伏。
   - 中远景/全景/氛围空镜：满幅度纪实电影手持质感，慢速漂移晃动并带强烈惯性延迟，将呼吸拉扯效果与现场叙事空气感渲染至极致。
5. **绝对禁用代词避错示例修正**：
   - 在任何镜头文本描述中，绝不能包含“他、她、它、他们”等代词，一律指明具体的姓名。
   - 错误范例：\`林峰退后半步，他紧盯着苏晴\`（虽然拆解了动作，但引入了代词“他”）。
   - 正确写法：\`林峰退后半步，视线在苏晴的面颊上锁定\`（纯净叙事，完全规避代词语病）。
4. **语言统一规则**：
   - **视觉描述**（镜头、光影、服装、场景等）可以使用中文或英文标签 (Tags)。对于资产细节，优先使用英文标签以获得更好的生成效果。
   - **资产名称与台词**严格遵循剧本原语言（英文剧本保留英文）。
   - 英文剧本画面禁止出现任何中文字符。
5. **构图与深度营造**：
   - **三层构图**：利用前景、中景、远景构建层次感，避免画面扁平化。
   - **景别对冲**：严禁连续使用中景，必须大特写、近景、中景、远景交替使用，增强视觉冲击力。
6. **运镜标注规范**：可选：静态、推镜头、拉镜头、摇镜头、移镜头、环绕拍摄、震动、变焦。
7. **分段与镜头衔接（接戏/承接）规则**：
   - **逻辑连贯与画面纯净性**：视觉上保持场景、人物状态及其服饰与上一段结尾的连续性。但生成的 prompt 中**严禁包含任何如 [新起 镜头]、[承接] 等标识或非画面提示词前缀**，必须以纯净画面直接从第一个镜头（如：0-2s...）开始。
   - **新镜头新一行**：所有镜头必须换行独立占一行，严禁连写。
   - **台词与音效音效**：角色台词用 \`角色名：“台词”\`，关键物声效用 \`[SFX: 音效]\` 标注。
   - **音画一致**：结尾以 \`无字幕，无背景音乐\` 独立成行结尾。
11. **PlotAnchor 纯净度**：\`plotAnchor\` 字段**仅保留剧本原文（台词+动作）**，严禁包含技术指令或后缀。


## 五、视觉规范与引导
1. **镜头多样性**：鼓励根据剧情需要合理使用空镜头（用于环境交代或氛围留白）及背身镜头（用于营造悬念或深度感）。
2. 不得出现“本段表现”“接下来镜头”等元描述。
4. 自动补充环境背景（如路人、宾客）以增强真实感。
5. **严禁在 prompt 中包含 any 元描述**（如“短剧极简节奏”、“电影级质感”、“9:16画幅”等）。
6. **严禁包含 HEX 颜色代码**（如 #FFFFFF, #000666）。必须使用自然语言描述颜色（如“深蓝色”、“暗红色”）。
7. **严禁包含具体数值的身高或尺寸**（如 180cm, 50kg）。



## 七、错误范例与正确范例（严格遵守）
❌ **错误格式**：
“0–3s（林峰在床上）。3–6s（林峰站在床边）。林峰：“我居然在地上。” 无字幕”
（原因：站位突变且无动作过渡，缺少起立、站直动作过渡，缺少景别、距离、角度、运镜各项）

✅ **正确格式**：
{
  "segments": [
    {
      "id": "seg_1",
      "index": 0,
      "duration": "15s",
      "assets": { "characters": "SARAH=图1", "scenes": "机场=场景1" },
      "prompt": "场景：机场=@场景1\n0–2s（远景、远距离、侧前方平视、移镜头）：SARAH拉着行李箱走出航站楼。\n2–5s（近景、中距离、正前方平视、推镜头）：ERIC微笑上前。ERIC：“你终于到了。” [SFX: 拥抱声] ... 无字幕，无背景音乐",
      "plotAnchor": "..."
    }
  ]
}

## 八、内容安全与合规（绝对准则）
1. **严禁版权词汇**：在分镜描述（prompt）中，严禁出现 any 现实品牌的名称、any 受版权保护的虚构角色名、any 现实公众人物的姓名。
2. **严禁敏感/违规内容**：分镜内容必须完全避开暴力、血腥表现、极端歧视、受限宗教或政治符号、毒品相关或任何程度的色情暗示。
3. **违规替换**：如果用户提供的剧本包含上述敏感内容，请将其替换为“具有电影感的镜头张力”或“抽象的情感表达”，严禁在 prompt 中直接描述违规细节。

## 九、 资产生成硬规则
在生成任何资产提示词（如在 preScanAssets 中）时，必须严格、逐字、无条件遵循以下规则：
${SHARED_ASSET_RULES}
`;


export class DirectorAgent extends BaseAgent {
  private getAssetDisplayId(id: string, type: string, assetsList: Asset[]) {
    if (!id) return id;
    
    // Clean redundant @ prefixes
    let cleanId = id;
    while (cleanId && typeof cleanId === 'string' && cleanId.startsWith('@')) {
      cleanId = cleanId.slice(1);
    }
    
    const filtered = assetsList.filter(a => a.type === type);
    
    const isSecondary = cleanId.endsWith('_v');
    let tempId = cleanId;
    if (isSecondary) tempId = cleanId.slice(0, -2);
    
    const isVariant = tempId && typeof tempId === 'string' && tempId.includes('_v') && !tempId.startsWith('图') && !tempId.startsWith('场景') && !tempId.startsWith('道具');
    let realId = tempId;
    let variantId = '';
    if (isVariant) {
      const parts = tempId.split('_v');
      realId = parts[0];
      variantId = parts[1];
    }
    
    const index = filtered.findIndex(a => a.id === realId);
    if (index === -1) return cleanId;
    
    const prefix = type === 'character' ? '图' : type === 'scene' ? '场景' : '道具';
    let displayId = `${prefix}${index + 1}`;
    
    if (isVariant) displayId += `_v${variantId}`;
    if (isSecondary) displayId += '_v';
    
    return displayId;
  }

  private findAssetByDisplayId(displayId: string, type: string, allAssets: Asset[]): Asset | undefined {
    if (!displayId) return undefined;
    const filtered = allAssets.filter(a => a.type === type);
    
    // 1. Try direct ID match
    let asset = allAssets.find(a => a.id === displayId);
    if (asset) return asset;
    
    // 2. Try display ID match (图1, 场景1, etc.)
    const prefix = type === 'character' ? '图' : type === 'scene' ? '场景' : '道具';
    if (displayId && typeof displayId === 'string' && (displayId.startsWith(prefix) || displayId.startsWith('角色'))) {
      const match = displayId.match(/^(?:图|角色|场景|道具)(\d+)/);
      if (match) {
        const index = parseInt(match[1]) - 1;
        if (index >= 0 && index < filtered.length) {
          return filtered[index];
        }
      }
    }
    
    return undefined;
  }

  private cleanPromptText(text: string): string {
    if (!text) return text;

    let cleaned = text.trim();

    // 1. If it looks like a complete or partial JSON object, try to extract the prompt field first
    if (cleaned && typeof cleaned === 'string' && (cleaned.includes('"prompt":') || cleaned.includes('"segments":'))) {
      try {
        // Try to extract the JSON part
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          const jsonStr = cleaned.substring(start, end + 1);
          const json = JSON.parse(jsonStr);
          if (json.prompt) {
            cleaned = json.prompt;
          } else if (json.segments && Array.isArray(json.segments) && json.segments[0]?.prompt) {
            cleaned = json.segments[0].prompt;
          } else if (json.segments && typeof json.segments === 'object' && !Array.isArray(json.segments)) {
            // Sometimes AI returns segments as an object with numeric keys
            const firstKey = Object.keys(json.segments)[0];
            if (json.segments[firstKey]?.prompt) cleaned = json.segments[firstKey].prompt;
          }
        }
      } catch (e) {
        // If parsing fails, we'll fall through to regex cleaning
      }
    }

    // 2. Aggressively remove any remaining JSON-like fragments or trailing garbage
    cleaned = cleaned
      .replace(/\{[\s\S]*?"(segment_id|prompt|assets|id|index|duration)"[\s\S]*?\}/g, '')
      .replace(/\[\s*\{[\s\S]*?"(segment_id|prompt|assets|id|index|duration)"[\s\S]*?\}\s*\]/g, '')
      .replace(/,\s*\{\s*"(segment_id|prompt|assets|id|index|duration)"[\s\S]*?$/g, '') // Trailing fragment
      .replace(/^[\s\S]*?\{\s*"(segment_id|prompt|assets|id|index|duration)"\s*:\s*/g, '') // Leading fragment
      .replace(/["']?(segment_id|prompt|assets|id|index|duration)["']?\s*:\s*/g, '')
      .replace(/[{}\[\]]/g, '')
      .replace(/"/g, '');

    // 3. Standard cleaning for other artifacts
    cleaned = cleaned
      .replace(/【空间结构】[^。！？\n]*[。！？\n]/g, '')
      .replace(/\((图|场景|道具)\d+.*?\)/g, '')
      .replace(/\((char|scene|prop)_\w+\)/g, '')
      .replace(/--ar\s+\d+:\d+/g, '')
      .replace(/--v\s+\d+(\.\d+)?/g, '')
      .replace(/--stylize\s+\d+/g, '')
      .replace(/--s\s+\d+/g, '')
      .replace(/--chaos\s+\d+/g, '')
      .replace(/--tile/g, '')
      .replace(/--quality\s+\d+/g, '')
      .replace(/--q\s+\d+/g, '')
      .replace(/--seed\s+\d+/g, '')
      .replace(/--stop\s+\d+/g, '')
      .replace(/--video/g, '')
      .replace(/--repeat\s+\d+/g, '')
      .replace(/--no\s+[\w\s,]+/g, '')
      .replace(/8K分辨率/g, '')
      .replace(/4K分辨率/g, '');

    cleaned = cleaned.replace(/#\w{6}/g, '');

    return cleaned.trim();
  }

  public fuzzyBindAssets(data: any): PipelineData {
    // 0. Normalization: If data is an array, assume it's the segments array
    if (Array.isArray(data)) {
      data = { segments: data, assets: [] };
    }

    if (!data.segments) return data;
    if (!data.assets) data.assets = [];

    // 0.1 Normalization: If segments is a string (AI returned JSON with string segments), parse it
    if (typeof data.segments === 'string' && (data.segments.includes('[新起 镜头]') || data.segments.includes('[承接 尾帧'))) {
      const parsed = this.parseTextSegments(data.segments);
      data.segments = parsed.segments;
    }

    if (!Array.isArray(data.segments)) return data;

    // Point 3: Logical Inertia - Track current variant for each character
    const currentVariants = new Map<string, string>(); // charId -> variantId
    
    // Track which props were converted to variants
    const convertedPropNames = new Set<string>();

    // Helper to score variant match
    const scoreVariant = (variant: any, prompt: string, charName: string) => {
      if (!prompt) return 0;
      let score = 0;
      const cleanVariantName = (variant.name || '').replace(/^变装[：:]\s*/, '').trim();
      if (!cleanVariantName) return 0;

      const variantKeywords = ['穿着', '身穿', '换上', '换了', '戴着', '披着', '一身', '一套', '装扮', '服饰', '衣服', '礼服', '制服', '套装', '模样', '形象', '打扮', '造型', '服装', '款式', '样式', '变装', '形象', '状态', '样子'];
      
      // 1. Direct match (Highest score)
      if (prompt.includes(cleanVariantName) || (variant.name && prompt.includes(variant.name))) score += 100;

      // 2. Contextual match: Character + Keyword + VariantName
      const hasKeyword = variantKeywords.some(kw => prompt.includes(kw));
      if (hasKeyword && prompt.includes(cleanVariantName)) score += 50;
      
      // 3. Proximity match: Character name close to variant description
      const charIndex = prompt.indexOf(charName);
      const variantIndex = prompt.indexOf(cleanVariantName);
      if (charIndex !== -1 && variantIndex !== -1) {
        const distance = Math.abs(charIndex - variantIndex);
        if (distance < 30) score += 40;
      }

      // 4. Prompt match (parts of variant prompt)
      if (variant.prompt) {
        const parts = variant.prompt.split(/[，,。]/).map(p => p.trim()).filter(p => p.length > 1);
        parts.forEach(part => {
          if (prompt.includes(part)) score += 25;
        });
      }

      // 5. Fuzzy match: remove "的", "了", "着"
      const fuzzyName = cleanVariantName.replace(/[的了着]/g, '');
      const fuzzyPrompt = prompt.replace(/[的了着]/g, '');
      if (fuzzyName.length > 1 && fuzzyPrompt.includes(fuzzyName)) score += 45;

      // 6. "居中" (centered) or "剧中" (in script) focus
      const focusKeywords = ['居中', '剧中', '主体', '主角', '主要'];
      const focusKeyword = focusKeywords.find(kw => prompt.includes(kw));
      if (focusKeyword) {
        const focusIndex = prompt.indexOf(focusKeyword);
        const variantIndex = prompt.indexOf(cleanVariantName);
        if (variantIndex !== -1 && Math.abs(focusIndex - variantIndex) < 40) {
          score += 70; // Significant boost for focused variants
        }
      }

      return score;
    };

    data.segments.forEach((seg, index) => {
      // 0.2 Normalization: If a segment is a string, convert to object
      if (typeof seg === 'string') {
        const prompt = seg.trim();
        const lines = prompt.split('\n').filter(l => l.includes('：') || l.includes(':'));
        const plotAnchor = lines.join('\n') || prompt.substring(0, 100);

        data.segments[index] = {
          id: `seg_${index + 1}`,
          index: index,
          duration: "15s",
          assets: { characters: '', scenes: '', props: '' },
          prompt: prompt,
          plotAnchor: plotAnchor
        };
        seg = data.segments[index];
      }

      if (!seg.assets) seg.assets = { characters: '', scenes: '', props: '' };
      
      // 0.3 Explicit ID Anchoring: Extract [ID] or @ID tags from prompt
      const explicitIds = { characters: new Set<string>(), scenes: new Set<string>(), props: new Set<string>() };
      const idRegex = /(?:\[(图\d+|场景\d+|道具\d+)(_v\d+)?\]|@(图\d+|场景\d+|道具\d+)(_v\d+)?)/g;
      let match;
      while ((match = idRegex.exec(seg.prompt || '')) !== null) {
        const fullId = (match[1] || match[3]) + (match[2] || match[4] || '');
        if (fullId.startsWith('图')) explicitIds.characters.add(fullId);
        else if (fullId.startsWith('场景')) explicitIds.scenes.add(fullId);
        else if (fullId.startsWith('道具')) explicitIds.props.add(fullId);
      }

      // Protection: If the model already provided correct bindings with ID tags, trust it
      const hasCharacterBindings = seg.assets.characters && typeof seg.assets.characters === 'string' && seg.assets.characters.includes('=') && (seg.assets.characters.includes('图') || seg.assets.characters.includes('char_'));
      const hasSceneBindings = seg.assets.scenes && typeof seg.assets.scenes === 'string' && seg.assets.scenes.includes('=') && (seg.assets.scenes.includes('场景') || seg.assets.scenes.includes('scene_'));
      const hasPropBindings = seg.assets.props && typeof seg.assets.props === 'string' && seg.assets.props.includes('=') && (seg.assets.props.includes('道具') || seg.assets.props.includes('prop_'));
      
      const normalize = (str: string, type: string) => {
        if (!str) return '';
        const items = str.split(',').map(s => {
          const parts = s.split('=');
          if (parts.length < 2) return s;
          const idPartRaw = parts[1].trim();
          let id = idPartRaw.split(/[（(]/)[0].trim();
          const details = idPartIncludes(idPartRaw, '（') ? '（' + idPartRaw.split('（')[1] : idPartIncludes(idPartRaw, '(') ? '(' + idPartRaw.split('(')[1] : '';
          
          while (id.startsWith('@')) id = id.slice(1);
          
          return `${parts[0].trim()}=${this.getAssetDisplayId(id, type, data.assets)}${details}`;
        });

        // Deduplicate by name
        const uniqueItems: string[] = [];
        const seenNames = new Set<string>();
        for (const item of items) {
          const name = item.split('=')[0].trim().split(' (')[0].split('（')[0].trim();
          if (!seenNames.has(name)) {
            seenNames.add(name);
            uniqueItems.push(item);
          }
        }
        return uniqueItems.join(', ');
      };

      const idPartIncludes = (str: string, char: string) => str && typeof str === 'string' && str.includes(char);

      if (hasCharacterBindings) seg.assets.characters = normalize(seg.assets.characters, 'character');
      if (hasSceneBindings) seg.assets.scenes = normalize(seg.assets.scenes, 'scene');
      if (hasPropBindings) seg.assets.props = normalize(seg.assets.props, 'prop');

      // Add continuity asset if not the first segment and prompt contains the tag
      if (index > 0 && seg.prompt && typeof seg.prompt === 'string' && seg.prompt.includes(`[承接 尾帧-${index - 1}]`)) {
        seg.assets.continuity = `[承接 尾帧-${index - 1}]`;
      }

      const combinedText = (seg.prompt || '') + ' ' + (seg.plotAnchor || '');
      const matchedVariantNames = new Set<string>();

      // 1. Character binding (First, to identify variants)
      const currentChars = seg.assets.characters ? seg.assets.characters.split(',').map(s => s.trim()).filter(Boolean) : [];
      
      // Add explicit IDs first
      explicitIds.characters.forEach(eid => {
        const asset = this.findAssetByDisplayId(eid, 'character', data.assets);
        if (asset && !currentChars.some(c => c.includes(`=${eid}`))) {
          currentChars.push(`${asset.name}=${eid}`);
        }
      });

      // Heuristic: If we have explicit ID anchors in the prompt, we should be more conservative with name-based matching
      // to avoid "sticky" bindings that the user is trying to remove.
      const hasExplicitAnchors = explicitIds.characters.size > 0 || explicitIds.scenes.size > 0 || explicitIds.props.size > 0;

      const foundChars = data.assets.filter(a => {
        if (a.type !== 'character') return false;
        
        // If we have explicit anchors for characters, ONLY match by name if it's also anchored (handled above)
        // or if the name is very specific and not just a common word.
        // For now, let's just ensure explicit anchors are always respected.
        
        // Match by name (exact match or includes)
        if (combinedText.includes(a.name) || (a.refName && combinedText.includes(a.refName))) return true;
        // Match by variant name (if unique enough)
        if (a.variants && a.variants.length > 0) {
          return a.variants.some(v => {
            const cleanVName = (v.name || '').replace(/^变装[：:]\s*/, '').trim();
            return cleanVName.length > 1 && combinedText.includes(cleanVName);
          });
        }
        return false;
      }).map(a => {
        const details = a.details;
        let detailStr = '';
        if (details) {
          const parts = [];
          
          if (details.dnaText) {
            // Use the full DNA text if available, but clean it up a bit
            const cleanDna = details.dnaText.split('\n')
              .map(line => line.trim())
              .filter(line => line && !line.includes('资产名称') && !line.includes('AI 引用名'))
              .join('，');
            parts.push(cleanDna);
          } else {
            if (details.height) {
              const h = details.height;
              const hStr = (typeof h === 'string' && h.includes('cm')) ? h : `${h}cm`;
              parts.push(`身高${hStr}`);
            }
            if (details.hairColor) parts.push(`发色${details.hairColor}`);
            if (details.clothing) parts.push(`穿着${details.clothing}`);
            if (details.clothingColor) parts.push(`服装颜色${details.clothingColor}`);
            if (details.appearance) parts.push(details.appearance);
          }
          
          if (parts.length > 0) detailStr = `（${parts.join('，')}）`;
          
          // Add voice info if character has lines in prompt
          if (details.voiceName && combinedText && (combinedText.includes(`${a.name}：`) || combinedText.includes(`${a.name}:`))) {
            detailStr += `角色说话音色=${details.voiceName}`;
          }
        }
        
        // Check for variants in prompt
        let finalId = a.id;
        let matchedVariant = undefined;
        
        // Check for sub-asset suffixes in prompt
        let subSuffix = '';
        if (combinedText.includes(`${a.name}六视图`) || combinedText.includes(`${a.name}角色设定图`)) subSuffix = '_v';
        
        // 1. Try to match a new variant in the current prompt
        if (a.variants && a.variants.length > 0) {
          // Score all variants and pick the best one
          const scoredVariants = a.variants.map(v => ({
            variant: v,
            score: scoreVariant(v, combinedText, a.name)
          })).filter(sv => sv.score > 0)
             .sort((a, b) => b.score - a.score);

          if (scoredVariants.length > 0) {
            matchedVariant = scoredVariants[0].variant;
            finalId = `${a.id}_v${matchedVariant.id.replace('v', '')}`;
            const cleanName = (matchedVariant.name || '').replace(/^变装[：:]\s*/, '').trim();
            matchedVariantNames.add(cleanName);
            matchedVariantNames.add(matchedVariant.name);
            
            // Update inertia state
            currentVariants.set(a.id, matchedVariant.id);
          } else if (currentVariants.has(a.id)) {
            // 2. Point 3: Logical Inertia - Use last known variant if no new match
            const lastVariantId = currentVariants.get(a.id);
            const lastVariant = a.variants.find(v => v.id === lastVariantId);
            if (lastVariant) {
              matchedVariant = lastVariant;
              finalId = `${a.id}_v${lastVariantId.replace('v', '')}`;
            }
          }
        }
        
        if (subSuffix) finalId += subSuffix;
        
        const variantName = matchedVariant ? ` (${matchedVariant.name.replace(/^变装[：:]\s*/, '')})` : '';
        const subName = subSuffix === '_v' ? ' (角色设定图)' : '';
        const displayId = this.getAssetDisplayId(finalId, 'character', data.assets);
        return `${a.name}${variantName}${subName}=${displayId}${detailStr}`;
      });

      if (!hasCharacterBindings && foundChars.length > 0) {
        // Merge foundChars with currentChars (which has explicit IDs)
        const allChars = Array.from(new Set([...foundChars, ...currentChars]));
        seg.assets.characters = normalize(allChars.join(','), 'character');
      } else if (hasCharacterBindings) {
        // If already has characters, check if any need upgrading to variant
        const updatedChars = currentChars.map(cStr => {
          let [name, idPart] = cStr.split('=');
          if (!idPart) return cStr;
          let id = idPart.split(/[（(]/)[0].trim();
          let details = idPart.includes('（') ? '（' + idPart.split('（')[1] : idPart.includes('(') ? '(' + idPart.split('(')[1] : '';
          
          // Check for suffixes in name
          if ((name.includes('六视图') || name.includes('角色设定图')) && !id.endsWith('_v')) id += '_v';
          
          const asset = this.findAssetByDisplayId(id, 'character', data.assets) || data.assets.find(a => a.name === name.split(' (')[0]);
          if (asset && asset.type === 'character' && asset.variants) {
            // Use the same scoring logic for upgrading
            const scoredVariants = asset.variants.map(v => ({
              variant: v,
              score: scoreVariant(v, combinedText, asset.name)
            })).filter(sv => sv.score > 0)
               .sort((a, b) => b.score - a.score);

            if (scoredVariants.length > 0) {
              const matchedVariant = scoredVariants[0].variant;
              const newId = `${asset.id}_v${matchedVariant.id.replace('v', '')}${id.endsWith('_v') ? '_v' : id.endsWith('_s') ? '_s' : ''}`;
              matchedVariantNames.add(matchedVariant.name);
              const variantName = ` (${(matchedVariant.name || '').replace(/^变装[：:]\s*/, '')})`;
              const baseName = name.split(' (')[0];
              const subName = id.endsWith('_v') ? ' (角色设定图)' : '';
              const displayId = this.getAssetDisplayId(newId, 'character', data.assets);
              return `${baseName}${variantName}${subName}=${displayId}${details}`;
            }
          }
          const displayId = this.getAssetDisplayId(id, 'character', data.assets);
          return `${name}=${displayId}${details}`;
        });
        // Ensure unique updatedChars
        seg.assets.characters = Array.from(new Set(updatedChars)).join(',');
      }
      
      // 2. Scene binding
      const currentScenes = seg.assets.scenes ? seg.assets.scenes.split(',').map(s => s.trim()).filter(Boolean) : [];
      
      // Add explicit IDs
      explicitIds.scenes.forEach(eid => {
        const asset = this.findAssetByDisplayId(eid, 'scene', data.assets);
        if (asset && !currentScenes.some(c => c.includes(`=${eid}`))) {
          currentScenes.push(`${asset.name}=${eid}`);
        }
      });

      const foundScenes = data.assets.filter(a => {
        if (a.type !== 'scene') return false;
        return combinedText.includes(a.name);
      }).map(a => `${a.name}=${this.getAssetDisplayId(a.id, 'scene', data.assets)}`);
      
      // Merge found scenes into current ones, avoiding duplicates by name
      const mergedScenes = [...currentScenes];
      foundScenes.forEach(fs => {
        const name = fs.split('=')[0];
        if (!mergedScenes.some(ms => ms.startsWith(name + '='))) {
          mergedScenes.push(fs);
        }
      });
      if (mergedScenes.length > 0) seg.assets.scenes = normalize(mergedScenes.join(','), 'scene');

      // 3. Prop binding
      const currentProps = seg.assets.props ? seg.assets.props.split(',').map(s => s.trim()).filter(Boolean) : [];
      
      // Add explicit IDs
      explicitIds.props.forEach(eid => {
        const asset = this.findAssetByDisplayId(eid, 'prop', data.assets);
        if (asset && !currentProps.some(c => c.includes(`=${eid}`))) {
          currentProps.push(`${asset.name}=${eid}`);
        }
      });

      const foundProps = data.assets.filter(a => {
        if (a.type !== 'prop') return false;
        return combinedText.includes(a.name);
      }).map(a => `${a.name}=${this.getAssetDisplayId(a.id, 'prop', data.assets)}`);

      // Merge found props into current ones
      let mergedProps = [...currentProps];
      foundProps.forEach(fp => {
        const name = fp.split('=')[0];
        if (!mergedProps.some(mp => mp.startsWith(name + '='))) {
          mergedProps.push(fp);
        }
      });
      
      // Identify props that should be variants based on "wearing" context
      const propsInPrompt = data.assets.filter(a => a.type === 'prop' && combinedText.includes(a.name));
      const charsInPrompt = data.assets.filter(a => a.type === 'character' && combinedText.includes(a.name));
      
      propsInPrompt.forEach(p => {
        charsInPrompt.forEach(c => {
          const wearKeywords = ['穿着', '身穿', '戴着', '披着', '换上', '换了', '一身', '一套', '装扮', '服饰'];
          const isWearing = wearKeywords.some(kw => combinedText.includes(`${c.name}${kw}${p.name}`) || combinedText.includes(`${kw}${p.name}`));
          
          if (isWearing) {
            matchedVariantNames.add(p.name);
            convertedPropNames.add(p.name);
            
            // Auto-convert character binding to variant if it exists, or create it
            if (!c.variants) c.variants = [];
            
            let v = c.variants.find(v => 
              (v.name && v.name.includes(p.name)) || 
              (p.name && p.name.includes((v.name || '').replace(/^变装[：:]\s*/, ''))) ||
              (v.prompt && v.prompt.includes(p.name))
            );
            
            if (!v) {
              // Create new variant if not found
              const finalVariantName = p.name.startsWith('变装') ? p.name : `变装：${p.name}`;
              v = {
                id: `v${c.variants.length + 1}`,
                name: finalVariantName,
                prompt: p.subAssets?.mainPrompt || ''
              };
              c.variants.push(v);
            }
            
            // Update character binding to use this variant
            const charBindings = (seg.assets.characters || '').split(',').map(s => s.trim()).filter(Boolean);
            const updatedCharBindings = charBindings.map(cb => {
              if (cb.startsWith(`${c.name}=${c.id}`)) {
                return `${c.name} (${v.name.replace(/^变装[：:]\s*/, '')})=${c.id}_v${v.id.replace('v', '')}`;
              }
              return cb;
            });
            seg.assets.characters = updatedCharBindings.join(',');
          }
        });
      });

      // Finalize props by removing converted ones
      seg.assets.props = normalize(mergedProps.filter(pStr => {
        const name = pStr.split('=')[0];
        return !convertedPropNames.has(name);
      }).join(','), 'prop');
    });

    // Final cleanup: Remove props that were identified as variants from the global assets list
    data.assets = data.assets.filter(a => {
      if (a.type === 'prop') {
        // If the prop name matches a variant name used in segments, remove it from global assets
        if (convertedPropNames.has(a.name)) return false;
        
        // Also check if it looks like clothing and we have a character it could belong to
        const clothingKeywords = ['衣服', '套装', '礼服', '西装', '裙子', '玩偶服', '变装', '服饰', '装扮', '造型', '服装', '款式', '样式', '模样', '形象', '样子', '大衣', '外套', '衬衫', '裤子', '鞋子', '帽子', '围巾', '手套', '制服', '运动服', '睡衣', '泳衣', '婚纱', '铠甲', '盔甲', '战袍', '披风', '斗篷', '面具', '头饰', '首饰', '项链', '耳环', '戒指', '手链', '手表', '眼镜', '墨镜', '领带', '领结', '腰带', '皮带', '袜子', '丝袜', '内衣', '内裤', '睡袍', '浴袍', '睡裙', '睡裤'];
        const isClothing = clothingKeywords.some(kw => a.name && a.name.includes(kw));
        if (isClothing) {
          // If it's already been added as a variant to some character, remove it
          const isAlreadyVariant = data?.assets?.some(c => c.type === 'character' && c.variants?.some(v => (v.name && v.name.includes(a.name)) || (a.name && a.name.includes((v.name || '').replace(/^变装[：:]\s*/, '')))));
          if (isAlreadyVariant) return false;
          
          // If it contains a character's name, it's definitely a variant
          const hasCharName = data?.assets?.some(c => c.type === 'character' && a.name && a.name.includes(c.name));
          if (hasCharName) return false;
        }
      }
      return true;
    });

    // 4. Clean prompts and plotAnchors of IDs and restricted info
    data.segments.forEach(seg => {
      if (seg.prompt) seg.prompt = this.cleanPromptText(seg.prompt);
      if (seg.plotAnchor) seg.plotAnchor = this.cleanPromptText(seg.plotAnchor);
    });

    return data;
  }

  private cleanupAssets(assets: Asset[]): Asset[] {
    const characters: Asset[] = [];
    const scenes = assets.filter(a => a.type === 'scene');
    const props = assets.filter(a => a.type === 'prop');
    
    // 1. Deduplicate and merge characters first
    const rawCharacters = assets.filter(a => a.type === 'character');
    rawCharacters.forEach(rc => {
      this.mergeAssetIntoList(characters, rc);
    });
    
    // Promote costumePrompt to character variants if present
    characters.forEach(char => {
      if (char.subAssets?.costumePrompt && char.subAssets.costumePrompt !== 'null' && typeof char.subAssets.costumePrompt === 'string' && char.subAssets.costumePrompt.trim()) {
        if (!char.variants) char.variants = [];
        const hasVariant = char.variants.some(v => v.prompt === char.subAssets.costumePrompt);
        if (!hasVariant) {
          char.variants.push({
            id: `v_${char.id}_costume`,
            name: "变装：新造型",
            prompt: char.subAssets.costumePrompt
          });
        }
      }
    });

    return [...characters, ...scenes, ...props];
  }

    public async analyzeScript(script: string, config?: Config): Promise<ScriptAnalysis> {
    const prompt = `你是一位顶级的电影/微短剧剧本分析师。请对以下剧本进行深度且多维度的分析，提取剧本的基础和高阶特征。

剧本内容如下：
${script}

请生成一份完整、专业且符合以下结构的 JSON 报告，严禁包含任何前导或后置的解释性文字，直接返回一个合法的 JSON 对象。
结构模板（属性字段必须完全吻合，所有属性均为必填项，空值可用空字符串或空数组代替，不要缺项）：
{
  "wordCount": ${script.length},
  "remainingWords": 0,
  "dramaType": "剧本题材类型（如：都市、悬疑等）",
  "suggestedStoryboardStyle": "建议的分镜风格",
  "suggestedDirectorStyle": "建议的导演风格",
  "suggestedVisualStyle": "建议的画面画风",
  "keyCharacters": ["角色1"],
  "keyScenes": ["场景1"],
  "estimatedSegments": 预计分段数,
  "suggestedNarrativeMode": "detailed",
  "videoTheme": "视频主题（一句话概括）",
  "videoStyle": "视频风格描述",
  "sceneDescription": "核心场景描述",
  "storyboardStructure": "分镜结构建议（如：包含X个分镜，每个分镜时长等）",
  "characterSetting": "核心角色设置简述",
  "dialogueContent": "台词内容要点",
  "aspectRatio": "建议画面比例（如：9:16竖屏）",
  "language": "建议语言与配音"
}`;
    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
          systemInstruction: DIRECTOR_AGENT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json", 
          temperature: 0.1 
        }
      }, config);
      return this.extractJson(response.text, {});
    } catch (e) {
      console.error("Analyze script failed:", e);
      throw e;
    }
  }

private mergeAssetIntoList(mergedAssets: Asset[], na: any) {
    if (!na || !na.name) return;

    // 1. Exact match by ID or Name
    const exactMatch = mergedAssets.find(ma => ma.id === na.id || ma.name === na.name);
    if (exactMatch) {
      // Merge details if missing
      if (na.details && !exactMatch.details) {
        exactMatch.details = na.details;
      }
      
      // Merge variants if any
      if (na.variants && Array.isArray(na.variants)) {
        if (!exactMatch.variants) exactMatch.variants = [];
        na.variants.forEach((nv: any) => {
          if (nv && nv.name && !exactMatch.variants!.find((ev: any) => ev.id === nv.id || ev.name === nv.name)) {
            exactMatch.variants!.push(nv);
          }
        });
      }
      return;
    }

    // 2. Fuzzy match for characters (e.g. HAROLD vs HAROLD_GRETA)
    if (na.type === 'character') {
      const similarChar = mergedAssets.find(ma => 
        ma.type === 'character' && 
        (na.name.startsWith(ma.name) || ma.name.startsWith(na.name) || 
         na.name.includes(ma.name) || ma.name.includes(na.name))
      );

      if (similarChar) {
        // Treat the longer name as a variant of the shorter name
        const baseChar = na.name.length <= similarChar.name.length ? na : similarChar;
        const variantChar = na.name.length > similarChar.name.length ? na : similarChar;
        
        // If the base is the new one, we need to swap them in mergedAssets
        if (baseChar === na) {
          const index = mergedAssets.indexOf(similarChar);
          mergedAssets[index] = na;
          // Add similarChar as a variant to na
          if (!na.variants) na.variants = [];
          na.variants.push({
            id: `v${na.variants.length + 1}`,
            name: similarChar.name,
            prompt: similarChar.subAssets?.mainPrompt || ''
          });
        } else {
          // Add na as a variant to similarChar
          if (!similarChar.variants) similarChar.variants = [];
          similarChar.variants.push({
            id: `v${similarChar.variants.length + 1}`,
            name: na.name,
            prompt: na.subAssets?.mainPrompt || ''
          });
        }
        return;
      }
    }

    // 3. No match found, add as new
    mergedAssets.push(na);
  }

  public async preScanAssets(script: string, visualStyle?: string, config?: Config, existingAssets: Asset[] = []): Promise<Asset[]> {
    const existingAssetsInstruction = existingAssets.length > 0 
      ? `\n\n【已有资产库参考（必须严格复用 ID）】：\n${existingAssets.map(a => {
          const variantsStr = a.variants && a.variants.length > 0 
            ? ` [已有变装: ${a.variants.map(v => `${v.name}(${this.getAssetDisplayId(a.id + '_v' + v.id.replace('v', ''), a.type, existingAssets)})`).join(', ')}]` 
            : '';
          return `${a.name}(${this.getAssetDisplayId(a.id, a.type, existingAssets)})${variantsStr}`;
        }).join('\n')}`
      : '';

    const prompt = `你是一位资深美术指导。请从剧本中提取所有核心资产（角色、场景、道具）。
【极其重要】：
1. **资产识别**：请逐行扫描剧本，确保不遗漏任何有台词或有重要动作的角色、场景和关键道具。
2. **语言策略**：资产名称 (name) 必须与剧本主语言一致。但资产的**视觉细节描述 (details) 和提示词 (subAssets)** **必须且只能**统一使用**中文**。严禁出现任何英文提示词。
3. **禁止拆分角色**：同一个角色在不同场景中的变化应放入 \`variants\`。
4. **提示词格式**：生成的提示词必须严格遵循下述【资产生成硬规则 (拆解剧本标准)】。

${existingAssetsInstruction}

剧本内容：
${script}

【画面画风要求】：${visualStyle || '电影级写实摄影质感'}

${SHARED_ASSET_RULES}

请返回 JSON 格式，严禁包含任何前导或后置的解释性文字。
{
  "assets": [
    {
      "id": "图1",
      "name": "角色名",
      "type": "character",
      "details": { 
        "height": "身高",
        "tags": "标签"
      },
      "subAssets": {
        "mainPrompt": "核心身份：[此处描述角色的年龄、人种、身高、职业、眼神等核心特征]\\n服装细节：[必须结合剧本剧情背景、角色身份及当前环境，提供代入感极强的服装描述]\\n妆容细节：[此处详细描述眉毛、眼影等细节]\\n发型发色：[此处详细描述发型、发色]\\n配饰细节：[此处详细描述鞋子、项链等]\\n要求：影棚拍摄,全身照,纯白背景,单人,单一视角,严禁拼图,手中不拿任何道具。",
        "secondaryPrompt": "遵循角色设定图格式生成的中文提示词",
        "costumePrompt": "null (极其重要：仅当剧本中该角色有且仅有一套明确的、不同于主图的变装需求时，在此生成对应的变装提示词。若无此类明确需求，必须返回 null，严禁生成通用或随机的服装描述)"
      },
      "variants": [
        {
          "id": "v1",
          "name": "变装：[名称]",
          "prompt": "极其重要：只有当剧本中该角色有多种明确的变装需求时，请在此数组中按序号列出。每一项的提示词都必须严格结合剧情背景、角色身份及当前环境，且遵循【角色变体/变装标准格式】。若无多套变装需求，请返回空数组 []，严禁生成虚假或通用的变装内容"
        }
      ]
    },
    {
      "id": "场景1",
      "name": "场景名",
      "type": "scene",
      "details": { "tags": "标签" },
      "subAssets": {
        "mainPrompt": "核心身份：[场景名称]\\n环境细节：[环境描述]\\n建筑风格：[建筑风格]\\n空间布局：[空间布局]\\n核心物件：[核心物件]\\n光影与画风：[具体折射的光影与画风描写]\\n要求：全景/远景构图。",
        "secondaryPrompt": "遵循场景方案格式生成的中文提示词"
      }
    },
    {
      "id": "道具1",
      "name": "道具名",
      "type": "prop",
      "details": { "tags": "标签" },
      "subAssets": {
        "mainPrompt": "核心身份：[道具名称]\\n材质细节：[材质细节]\\n光影表现：[光影表现]\\n画风设定：[画风设定]\\n要求：影棚拍摄,严禁出现人物,严禁出现手部,仅展示道具主体,纯白背景,单一视角,镜面/微距质感,严禁拼图。",
        "secondaryPrompt": "遵循道具设定图格式生成的中文提示词"
      }
    }
  ]
}`;

    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
          systemInstruction: DIRECTOR_AGENT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json", 
          temperature: 0.1 
        }
      }, config);
      const data = this.extractJson(response.text, { assets: [] });
      const newAssets = Array.isArray(data.assets) ? data.assets : [];
      const mergedAssets = [...existingAssets];
      
      newAssets.forEach((na: any) => {
        // Ensure subAssets exists even if AI didn't generate it in the simplified scan
        if (!na.subAssets) {
          na.subAssets = {
            mainPrompt: '',
            secondaryPrompt: '',
            costumePrompt: ''
          };
        }

        // Clean up costumePrompt if it contains placeholders or literal "null"
        if (na.subAssets.costumePrompt === 'null' || na.subAssets.costumePrompt === null || (typeof na.subAssets.costumePrompt === 'string' && na.subAssets.costumePrompt.includes('如果没有变装'))) {
          na.subAssets.costumePrompt = '';
        }

        // Clean up variants if they are empty or placeholder
        if (na.variants && Array.isArray(na.variants)) {
          na.variants = na.variants.filter((v: any) => v && v.prompt && !v.prompt.includes('如果没有多套变装') && v.prompt !== 'null' && v.name && !v.name.includes('[描述]'));
        }
        
        // Safety check: Force the required suffix for character mainPrompts if missing
        if (na.type === 'character' && na.subAssets.mainPrompt) {
          const suffix = '\n要求：影棚拍摄,全身照,纯白背景,单人,单一视角,严禁拼图,手中不拿任何道具。';
          if (!na.subAssets.mainPrompt.includes('要求：') && !na.subAssets.mainPrompt.includes('要求:') && (!na.subAssets.mainPrompt.includes('影棚拍摄') || !na.subAssets.mainPrompt.includes('全身照') || !na.subAssets.mainPrompt.includes('手中不拿任何道具'))) {
            na.subAssets.mainPrompt = na.subAssets.mainPrompt.replace(/[，。！,.!]$/, '') + suffix;
          }
        }

        // Handle costumePrompt: if AI put something there, make sure it has the required suffix
        if (na.type === 'character' && na.subAssets.costumePrompt) {
          const costumeSuffix = '\n要求：专业时尚摄影质感,全身照,纯白背景,单人,单一视角,85mm焦段,f/1.8大光圈,极致皮肤细节,高端影棚3点式布光,严禁拼图,手中不拿任何道具。';
          if (!na.subAssets.costumePrompt.includes('要求：') && !na.subAssets.costumePrompt.includes('要求:') && !na.subAssets.costumePrompt.includes('影棚拍摄') && !na.subAssets.costumePrompt.includes('专业时尚摄影')) {
             na.subAssets.costumePrompt = na.subAssets.costumePrompt.replace(/[，。！,.!]$/, '') + costumeSuffix;
          }
        }

        // Handle variants costume prompts
        if (na.type === 'character' && na.variants && Array.isArray(na.variants)) {
          na.variants = na.variants.map((v: any) => {
            const costumeSuffix = '\n要求：专业时尚摄影质感,全身照,纯白背景,单人,单一视角,85mm焦段,f/1.8大光圈,极致皮肤细节,高端影棚3点式布光,严禁拼图,手中不拿任何道具。';
            if (v.prompt && !v.prompt.includes('要求：') && !v.prompt.includes('要求:') && !v.prompt.includes('影棚拍摄') && !v.prompt.includes('专业时尚摄影')) {
              v.prompt = v.prompt.replace(/[，。！,.!]$/, '') + costumeSuffix;
            }
            return v;
          });
        }

        this.mergeAssetIntoList(mergedAssets, na);
      });
      return this.cleanupAssets(mergedAssets);
    } catch (e) {
      console.error("Pre-scan assets failed:", e);
      return existingAssets;
    }
  }

  public async generateSingleAssetPrompts(asset: Asset, visualStyle?: string, config?: Config, variantId?: string): Promise<Asset['subAssets']> {
    const variant = variantId ? asset.variants?.find(v => v.id === variantId) : null;
    const isSixView = variantId === 'secondary';

    const prompt = `你是一位资深美术指导。请为以下资产生成符合【拆解剧本】硬规则的提示词。
【资产信息】：
名称：${asset.name}${variant ? ` (变体: ${variant.name})` : ''}
类型：${asset.type}
${isSixView ? '【任务】：生成该角色的专业角色设定图指令。' : ''}
${asset.details ? `【视觉细节】：${JSON.stringify(asset.details)}` : ''}
${variant?.prompt ? `【变体要求】：${variant.prompt}` : ''}

【极其重要】：
1. **视觉一致性**：生成的提示词必须**严格参考并体现**上述【视觉细节】中的所有特征。
2. **画风一致性**：必须严格遵循【画面画风要求】：${visualStyle || '写实风格'}。
3. **语言策略**：资产名称保留原语言，但所有的提示词 (Prompts)、视觉描述、材质说明、光影表现、外貌特征描述**必须且只能**统一使用**中文**。
4. **结构化输出**：生成的提示词必须严格按照对应资产类型的结构分行输出，严禁写成一段话。
   - 角色：核心身份、妆容细节、发型发色、服装细节、配饰细节、要求。
   - 场景：核心身份、环境细节、建筑风格、空间布局、核心物件、光影与画风、要求。
   - 道具：核心身份、材质细节、光影表现、画风设定、要求。
5. **主图要求**：主图提示词必须在末尾包含对应的“要求”项。
6. **严禁使用标签格式**：严禁使用“1女孩, 莎拉, (最高质量)...”这种逗号分隔的标签格式。必须使用上述规定的结构化段落。

${SHARED_ASSET_RULES}

请返回 JSON 格式，严禁包含任何前导或后置的解释性文字：
{
  "mainPrompt": "核心身份：...\\n妆容细节：...\\n发型发色：...\\n服装细节：...\\n配饰细节：...\\n要求：影棚拍摄,全身照,纯白背景,单人,单一视角,严禁拼图,手中不拿任何道具。",
  "secondaryPrompt": "..."
}`;

    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
          systemInstruction: DIRECTOR_AGENT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json", 
          temperature: 0.1 
        }
      }, config);
      const result = this.extractJson(response.text, asset.subAssets);
      
      // Safety check: Force the required suffix for character mainPrompts if missing
      if (asset.type === 'character' && result.mainPrompt) {
        const suffix = '\n要求：影棚拍摄,全身照,纯白背景,单人,单一视角,严禁拼图,手中不拿任何道具。';
        if (!result.mainPrompt.includes('要求：') && !result.mainPrompt.includes('要求:') && (!result.mainPrompt.includes('影棚拍摄') || !result.mainPrompt.includes('全身照') || !result.mainPrompt.includes('手中不拿任何道具'))) {
          result.mainPrompt = result.mainPrompt.replace(/[，。！,.!]$/, '') + suffix;
        }
      }
      
      return result;
    } catch (e) {
      console.error("Generate single asset prompts failed:", e);
      return asset.subAssets;
    }
  }

  public async processScript(
    script: string, 
    directorStyle?: string, 
    aspectRatio: string = "1:1", 
    visualStyle?: string, 
    config?: Config, 
    onProgress?: (msg: string) => void,
    narrativeMode: 'detailed' | 'compact' = 'detailed', 
    targetSegments?: number,
    existingAssets: Asset[] = [],
    globalRule?: string,
    productionMode: 'director' | 'prompt' = 'director',
    isFlexibleDuration: boolean | string = false,
    spatialMode: 'strong' | 'standard' = 'strong'
  ): Promise<PipelineData> {
    onProgress?.("正在扫描剧本资产...");
    const assets = await this.preScanAssets(script, visualStyle, config, existingAssets);
    onProgress?.("正在生成分镜脚本...");
    return await this.callProcessScriptApi(script, directorStyle, aspectRatio, visualStyle, config, assets, false, narrativeMode, targetSegments, false, null, globalRule, false, productionMode, isFlexibleDuration, spatialMode);
  }

  public async callProcessScriptApi(
    script: string, 
    directorStyle?: string, 
    aspectRatio: string = "1:1", 
    visualStyle?: string, 
    config?: Config, 
    existingAssets: Asset[] = [], 
    isSubsequentChunk: boolean = false, 
    narrativeMode: 'detailed' | 'compact' = 'detailed', 
    targetSegments?: number, 
    skipFuzzyBind: boolean = false, 
    lastSegmentContext: Segment | null = null, 
    globalRule?: string,
    onlySegments: boolean = false,
    productionMode: 'director' | 'prompt' = 'director',
    isFlexibleDuration: boolean | string = false,
    spatialMode: 'strong' | 'standard' = 'strong'
  ): Promise<PipelineData> {
    const isPromptMode = productionMode === 'prompt';
    const spatialInstruction = `\n\n【Prompt 开场与场景定位标记要求】：为了标识镜头发生的具体物理场景，在提示词的每一个换景处或镜头序列开头，必须单独另起一行书写场景锁定声明：\`场景：场景名=@场景N\`（在导演模式下，格式直接写为\`场景：场景名\`），以此明确镜头的空间定位。这个场景描述必须是一行独立的文本，严禁与镜头的时间戳写在同一行。首个镜头的动作描述及后续所有镜头必须直接紧跟在换行的场景描述标记之后，后续每一个镜头必须换行新起一行单独占一行（用 \\n 换行分隔）。格式：\`开始秒-结束秒s（景别、拍摄距离、拍摄方位与角度、运镜）：描述\`，不要有任何 “镜头N” 或 “【镜头: 类型】” 或 “[新起 镜头]” 等任何非画面前缀字样。`;

    const modeInstruction = isPromptMode 
      ? `\n\n【制作模式：提示词模式】：你必须将剧本拆解为资产和符合特定时长的分段提示词。提示词必须是纯净的视觉语言，除了最开始和换景处的场景定位标记（例如 \`场景：宴会厅=@场景1\`）外，**严禁**包含任何 ID 标签（如 =@图1）。` 
      : `\n\n【制作模式：导演模式】：你是一位统筹全局的最佳导演，负责剧本拆解、资产协同与拍摄统筹。在提示词中，只需直接提及角色或场景名称，除了开头的场景定位标记外，**严禁**在动作细节中加上任何 [ID] 前缀。`;

    const styleInstruction = directorStyle ? `\n\n【导演分镜风格要求】：\n${directorStyle}` : '';
    const visualInstruction = visualStyle ? `\n\n【画面画风要求】：${visualStyle}` : '';
    const aspectInstruction = `\n\n【画面比例要求】：${aspectRatio}`;
    const narrativeInstruction = `\n\n【叙事模式：${narrativeMode === 'compact' ? '短剧模式（极简节奏）' : '深度叙事模式'}】`;
    
    let segmentsInstruction = '';
    if (targetSegments && targetSegments > 0) {
      segmentsInstruction = `\n\n【极其重要：目标段落数要求】：必须严格生成正好 ${targetSegments} 个段落（segments）。内容多则通过合并动作、精简视觉描写来压缩，但**严禁精简对白**；内容少则合理扩充细节，严禁多于 or 少于此数量。`;
    } else {
      segmentsInstruction = `\n\n【段落规划建议】：你拥有完全的叙事自主权。请根据剧本的冲突、转折与情感曲线，自动决定最合理的段落（segments）数量。优先级：1. 剧情完整性 2. 节奏张力 3. 视觉冲击。`;
    }

    let isFlexible = false;
    let maxDurationStr = '15s';
    
    if (typeof isFlexibleDuration === 'string') {
      if (isFlexibleDuration === 'flexible-30' || isFlexibleDuration.includes('30')) {
        isFlexible = true;
        maxDurationStr = '30s';
      } else if (isFlexibleDuration === 'flexible-15' || isFlexibleDuration.includes('15') || isFlexibleDuration === 'flexible') {
        isFlexible = true;
        maxDurationStr = '15s';
      }
    } else {
      isFlexible = isFlexibleDuration;
      maxDurationStr = '15s';
    }

    const durationInstruction = isFlexible 
      ? `\n\n【时长规划要求】：单段时长可根据叙事内容动态决定，范围为 4s 到 ${maxDurationStr}。请在每段的 \`duration\` 字段中标注。如果剧情极其张力且密集，可使用 ${maxDurationStr}；如果是紧凑的转场或特定情绪钩子，可缩短至 4-8s。`
      : `\n\n【时长规划要求】：每段时长必须严格固定为 15s。`;

    const existingAssetsInstruction = existingAssets.length > 0 
      ? `\n\n【已有资产库参考（必须严格遵守）】：\n${existingAssets.map(a => {
          const variantsStr = a.variants && a.variants.length > 0 
            ? ` [已有变装: ${a.variants.map(v => `${v.name}(${this.getAssetDisplayId(a.id + '_v' + v.id.replace('v', ''), a.type, existingAssets)})`).join(', ')}]` 
            : '';
          return `${a.name}(${this.getAssetDisplayId(a.id, a.type, existingAssets)}): ${this.sanitizePrompt(a.subAssets?.mainPrompt || '')}${a.subAssets?.costumePrompt ? ' [变装特征: ' + a.subAssets.costumePrompt + ']' : ''}${variantsStr}`;
        }).join('\n')}`
      : '';
    const globalRuleInstruction = globalRule ? `\n\n【全局强制规则】：\n${globalRule}` : '';
    const onlySegmentsInstruction = onlySegments ? `\n\n【重要提示】：全局资产库已由用户确认，请务必严格基于已有资产进行分镜拆解，不要随意修改已有资产的 ID 和核心描述。如果发现剧本中有未在资产库中的新角色或场景，可以在 assets 中补充，否则 assets 数组请返回空数组 []。` : '';
    const lastContextInstruction = lastSegmentContext 
      ? `\n\n【首尾帧衔接与视觉连续性参考】：\n上一段（Index: ${lastSegmentContext.index}）的结尾状态如下，请在当前段落的第一个镜头开头显式包含 “[承接 尾帧-${lastSegmentContext.index}]”，并描述画面如何平滑延续：\n${lastSegmentContext.prompt}`
      : '';

    // Prepare image parts for scene assets to help with spatial coordinate inference
    const imageParts: any[] = [];
    if (spatialMode === 'strong') {
      const seenImageUrls = new Set<string>();
      
      // Find scenes that have images
      for (const asset of existingAssets) {
        if (asset.type === 'scene' && asset.generatedMedia?.mainImageUrl) {
          const url = asset.generatedMedia.mainImageUrl;
          if (!seenImageUrls.has(url)) {
            seenImageUrls.add(url);
            try {
               // In browser environment, we can fetch these
               const { base64, mimeType } = await urlToBase64(url);
               imageParts.push({ text: `【场景示例图 - ${this.getAssetDisplayId(asset.id, 'scene', existingAssets)} (${asset.name})】` });
               imageParts.push({ inlineData: { data: base64, mimeType } });
            } catch (e) {
               console.warn(`Failed to package scene image for coordinate inference: ${url}`, e);
            }
          }
        }
      }
    }

    const visualAnalysisInstruction = imageParts.length > 0 
      ? `\n\n【视觉一致性参考】：我已经提供了本剧涉及到的场景示例图。请认真分析图中的环境细节、空间布局、光影与色调，并在提示词中保持视觉风格的高度一致。只需使用自然语言描述布局，严禁使用 X, Y, Z 坐标，严禁包含 '【空间结构】' 标签。`
      : '';

    const prompt = `请基于【系统指令】中的导演标准，将以下剧本拆解为视频分镜脚本。${spatialInstruction}${modeInstruction}${styleInstruction}${visualInstruction}${aspectInstruction}${narrativeInstruction}${segmentsInstruction}${durationInstruction}${existingAssetsInstruction}${globalRuleInstruction}${onlySegmentsInstruction}${lastContextInstruction}${visualAnalysisInstruction}
剧本内容如下：
${script}

【核心任务（最高优先级）】：
1. 严格生成 ${targetSegments || '自动计算'} 个分段。
2. **Prompt 场景标记铁律**：每段 prompt 的镜头开始前，或者当场景（场景资产）发生切换时，必须单独新起一行插入场景标记 \`场景：场景名=@场景N\` (或是导演模式下的 \`场景：场景名\`) 锁定环境。然后再新起一行开始书写对应的第一个镜头画面描述。后续的每一个镜头**必须强制另起一行，以新空一行（用 \n 换行分隔）独占一行**，不可连写在一起。
3. **时长铁律**：每段总时长必须精确等于该段定义的 duration (${isFlexible ? `4-${maxDurationStr}` : '15s'})。**严禁出现任何超过该段总时长的时间戳**。${isFlexible ? `请根据剧情冲突密集度自由分配 4-${maxDurationStr} 的时长。` : '如果剧情太长，请精简视觉描述或合并镜头，确保在 15s 内结束。'}
4. **格式铁律**：每段 prompt 除了前面提到的 \`场景：场景名=@场景N\`（或 \`场景：场景名\`）标记之外，**严禁**包含 any “[新起 镜头]” or “[承接 尾帧-X]” 等任何非画面前缀。
5. **镜头铁律**：不使用“镜头N”或“【镜头: 类型】”等任何前缀，每段必须包含 3-8 个镜头，每个分镜强行换行。格式为：\`开始秒-结束秒s（景别、拍摄距离、拍摄方位与角度、运镜）：描述\`。
6. **台词铁律**：必须包含所有台词，格式为 \`角色名：“台词”\`。
7. **音效铁律**：关键动作后必须紧跟 \`[SFX: 音效]\`。
8. **后缀铁律**：每段末尾必须另起一行，内容必须且只能为 \`无字幕，无背景音乐\`。
9. **资产铁律（禁令）**：在视觉描述中，除了最前方的场景锁定描述外，镜头的具体动作描述中**严禁**包含任何资产 ID 标签（如 @图1、[图1]）。只需使用资产名，严禁出现在最终的视觉描述中。
10. **语言铁律**：视觉描述用中文，台词保留原语言。
11. **资产生成硬规则**：如果需要生成新资产（assets 字段），必须严格遵循下述【资产生成硬规则 (拆解剧本标准)】。

${SHARED_ASSET_RULES}

【输出范例参考】：
场景：豪华宴会厅=@场景1\n0-2s（大特写、近距离、正前方平视、静态）：林峰双眼充血，盯着屏幕。\n2-5s（近景、中距离、正前方平视、推镜头）：林峰：“这不可能！” [SFX: 键盘敲击声] 林峰猛地站起。\n...无字幕，无背景音乐

【极其重要】：请直接返回符合 Schema 要求的 JSON 对象，严禁包含任何 Markdown 代码块标签或解释性文字。`;
    const isShortDrama = true; // Always use short drama mode as per user request
    const systemInstruction = DIRECTOR_AGENT_SYSTEM_INSTRUCTION;
    console.log(`[DirectorAgent] Calling API with targetSegments: ${targetSegments || 'auto'}`);
    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ 
          role: 'user', 
          parts: [
            ...imageParts,
            { text: prompt }
          ] 
        }],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              segments: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING" },
                    index: { type: "INTEGER" },
                    duration: { type: "STRING" },
                    assets: {
                      type: "OBJECT",
                      properties: {
                        characters: { 
                          type: "STRING", 
                          description: "角色资产绑定。格式：角色名=图N（身高XXXcm）。严禁包含服装、发型等任何视觉细节描述。" 
                        },
                        scenes: { 
                          type: "STRING", 
                          description: "场景资产绑定。格式：场景名称=场景N。严禁包含天气、光影等细节。" 
                        },
                        props: { 
                          type: "STRING", 
                          description: "道具资产绑定。格式：道具名称=道具N。" 
                        },
                        continuity: { 
                          type: "STRING",
                          description: "连续性标注。记录本段结尾角色的位置、姿态、状态，供下一段接戏使用。"
                        }
                      },
                      required: ["characters", "scenes", "props"]
                    },
                    prompt: { 
                      type: "STRING", 
                      description: "分段视觉提示词。必须严格遵循以下结构：\n1. 画面描述：首行直接且必须以第一个镜头描述（如 0-3s...）开始，严禁在开头包含 '[新起 镜头]' 或 '[承接 尾帧-X]' 或 '[承接]' 或 '【全局】' 等前缀标签与锁定声明；\n2. 镜头序列：必须包含 3-8 个镜头，每一个镜头必须新起一行独立站一行（使用换行符分隔）。格式为：'开始秒-结束秒s（景别、拍摄距离、拍摄方位与角度、运镜）：描述'，不可以有 '镜头N'、'【镜头: 类型】' 等前缀；\n3. 台词：格式为 '角色名：“台词”'；\n4. 音效：动作后加 '[SFX: 音效]'；\n5. 后缀：强制另起一行，以 '无字幕，无背景音乐' 结尾。" 
                    },
                    plotAnchor: { 
                      type: "STRING", 
                      description: "本段对应的原始剧本片段，包含对白和动作描述" 
                    }
                  },
                  required: ["id", "index", "duration", "assets", "prompt", "plotAnchor"]
                }
              },
              assets: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING" },
                    name: { type: "STRING" },
                    type: { type: "STRING", enum: ["character", "scene", "prop"] },
                    details: { 
                      type: "OBJECT", 
                      properties: { 
                        height: { type: "STRING" }, 
                        nationality: { type: "STRING" }, 
                        ethnicity: { type: "STRING" },
                        race: { type: "STRING" }, 
                        gender: { type: "STRING" },
                        age: { type: "STRING" },
                        visualAge: { type: "STRING" },
                        skinColor: { type: "STRING" }, 
                        eyeColor: { type: "STRING" }, 
                        clothingColor: { type: "STRING" }, 
                        hairColor: { type: "STRING" } 
                      } 
                    },
                    subAssets: {
                      type: "OBJECT",
                      properties: {
                        mainPrompt: { type: "STRING" },
                        secondaryPrompt: { type: "STRING" }
                      },
                      required: ["mainPrompt"]
                    }
                  },
                  required: ["id", "name", "type", "subAssets"]
                }
              }
            },
            required: ["segments", "assets"]
          }
        }
      }, config);
      let data = this.extractJson(response.text);
      
      // Fallback: If AI returned text format instead of JSON
      if (data._isTextFormat) {
        console.warn("[DirectorAgent] AI returned text format, attempting manual parse.");
        data = this.parseTextSegments(data.rawText);
      }
      
      // Merge existing assets into the result to ensure fuzzyBindAssets has access to all assets
      const mergedAssets = [...existingAssets];
      if (data.assets && Array.isArray(data.assets)) {
        data.assets.forEach((na: any) => {
          this.mergeAssetIntoList(mergedAssets, na);
        });
      }
      data.assets = mergedAssets;

      if (data.segments) {
        data.segments.forEach((seg: any) => {
          if (seg.prompt && /[他她它]/.test(seg.prompt)) {
            console.warn(`Segment ${seg.index} contains pronouns! Prompt: ${seg.prompt}`);
          }
        });
      }

      if (skipFuzzyBind) return { ...data, assets: this.cleanupAssets(mergedAssets) };
      return this.fuzzyBindAssets({ ...data, assets: this.cleanupAssets(mergedAssets) });
    } catch (e) {
      console.error("Pipeline API failed:", e);
      throw e;
    }
  }

  private parseTextSegments(text: string): any {
    const segments: any[] = [];
    const blocks = text.split(/\[(?:新起 镜头|承接 尾帧-\d+)\]/).filter(b => b.trim());
    const markers = text.match(/\[(?:新起 镜头|承接 尾帧-\d+)\]/g) || [];

    blocks.forEach((block, i) => {
      const marker = markers[i] || '[新起 镜头]';
      let prompt = (marker + block).trim();
      let plotAnchor = "";

      // Smart check: if the block contains JSON, try to extract fields
      if (block.includes('{') && block.includes('}')) {
        try {
          const json = this.extractJson(block);
          if (json.prompt) {
            prompt = json.prompt;
            if (!prompt.startsWith('[') && marker) prompt = marker + prompt;
          }
          if (json.plotAnchor) plotAnchor = json.plotAnchor;
          else if (json.segments && json.segments[0]?.prompt) {
            prompt = json.segments[0].prompt;
            if (!prompt.startsWith('[') && marker) prompt = marker + prompt;
            plotAnchor = json.segments[0].plotAnchor || "";
          }
        } catch (e) {
          // Fallback to cleaning the block if it's messy JSON
          prompt = this.cleanPromptText(prompt);
        }
      } else {
        // Regular text block
        const lines = block.split('\n').filter(l => l.includes('：') || l.includes(':'));
        plotAnchor = lines.join('\n');
      }

      segments.push({
        id: `seg_${i + 1}`,
        index: i,
        duration: "15s",
        assets: { characters: "", scenes: "", props: "" }, // Will be filled by fuzzyBind
        prompt: prompt,
        plotAnchor: plotAnchor || block.substring(0, 100) + "..."
      });
    });

    return { segments, assets: [] };
  }

  public async regenerateSegmentPrompt(
    segment: Segment, 
    script: string, 
    directorStyle?: string, 
    aspectRatio: string = "1:1", 
    visualStyle?: string, 
    config?: Config, 
    allAssets: Asset[] = [], 
    globalRule?: string,
    lastSegmentContext: Segment | null = null,
    productionMode: 'director' | 'prompt' = 'director',
    spatialMode: 'strong' | "standard" = 'strong'
  ): Promise<string> {
    const isPromptMode = productionMode === 'prompt';
    const spatialInstruction = `\n\n【Prompt 开场与场景定位标记要求】：为了标识镜头发生的具体物理场景，在提示词的每一个换景处或镜头序列开头，必须单独另起一行书写场景锁定声明：\`场景：场景名=@场景N\`（在导演模式下，格式直接写为\`场景：场景名\`），以此明确镜头的空间定位。这个场景描述必须是一行独立的文本，严禁与镜头的时间戳写在同一行。首个镜头的动作描述及后续所有镜头必须直接紧跟在换行的场景描述标记之后。`;

    const modeInstruction = isPromptMode 
      ? `\n\n【制作模式：提示词模式】：在提示词中，资产引用的格式必须严格按照 “名称=@ID” 的形式，例如：“林峰=@图1”、“宴会厅=@场景1”。` 
      : `\n\n【制作模式：导演模式】：在提示词中，资产引用的格式为 “[ID]名称”，例如：“[图1]林峰”。`;

    const globalRuleInstruction = globalRule ? `\n\n【全局强制规则】：\n${globalRule}` : '';
    const lastContextInstruction = lastSegmentContext 
      ? `\n\n【首尾帧衔接与视觉连续性参考】：\n上一段（Index: ${lastSegmentContext.index}）的结尾状态如下，请在当前段落的第一个镜头中，以纯净的镜头动作描述画面如何平滑延续，确保视觉流动连贯。注意：严禁在开头包含 '[承接]' 或 '[新起]' 等任何非画面前缀，直接使用镜头动作进行视觉承接：\n${lastSegmentContext.prompt}`
      : '';

    const assetDetailsInstruction = allAssets.length > 0 ? `\n\n【资产视觉细节参考】：\n${allAssets.map(a => {
      const displayId = this.getAssetDisplayId(a.id, a.type, allAssets);
      return `[${displayId}] ${a.name} (${a.type === 'character' ? '角色' : a.type === 'scene' ? '场景' : '道具'}):\n${this.sanitizePrompt(JSON.stringify(a.details || {}))}`;
    }).join('\n\n')}` : '';

    const prompt = `你是一位世界级导演。请为剧本中的一个特定 15 秒分段重新生成一个视觉冲击力极强的分镜提示词。${modeInstruction}${spatialInstruction}${globalRuleInstruction}${lastContextInstruction}${assetDetailsInstruction}
【极其重要】：
1. **时间轴铁律（死命令）**：每个分段的时间轴必须从 0s 开始，到 15s 结束。**严禁出现任何超过 15s 的时间戳（如 16s, 18s 等）**。如果内容过多，请通过合并镜头或加快节奏来压缩，绝不允许溢出 15s。
2. **Prompt 场景标记铁律**：每段 prompt 的镜头开始前，或者当场景发生切换时，必须单独新起一行插入场景标记 \`场景：场景名=@场景N\` (或是导演模式下的 \`场景：场景名\`) 锁定环境。然后再新起一行开始书写对应的第一个镜头画面描述。
3. **Prompt 纯净度铁律**：严禁在提示词中出现 any 颜色代码（如 #FFFFFF）、身高（如 180cm） or 括号内的补充描述。
4. **视觉一致性铁律**：必须严格遵循上述【资产视觉细节参考】中的描述。例如，如果细节描述中描述角色穿着红色裙子，提示词中必须体现红色裙子。
5. **语言规则**：无论剧本语言如何，重新生成的提示词视觉描述**必须且只能**使用**中文**。严禁出现任何英文提示词（如 masterpiece, best quality 等），必须将其转化为对应的中文描述（如 杰作, 最高质量）。角色名、场景名等资产名称保留剧本原语言。但如果剧本是英文，生成的画面中严禁出现任何中文字符，所有文字必须为英文或不显示文字。
6. **首尾帧衔接**：如果是后续分段，在内容上确保与前段视觉动作 and 场景的平滑连续，整个提示词中严禁使用 “[承接]”、“[接戏]” 等任何非画面前缀。
7. **强制后缀**：提示词的末尾必须强制包含 “无字幕，无背景音乐”。
8. **【绝对禁止使用代词】**：严禁使用“他/她/它”，必须使用具体角色姓名。
9. **【台词格式强制化】**：严禁使用 \`[台词: ]\` 前缀，必须严格采用“角色名：‘台词内容’”的格式。
10. **资产纯净度（铁律）**：在视觉描述中，除了最前方的场景锁定描述（如开头的 \`场景：场景名称=@场景N\`）外，具体镜头的画面动作细节描述中**严禁**包含任何资产 ID 标签（如 \`=@图1\`、\`=@场景1\`、\`[图1]\` 等）。
11. **JSON 响应**：必须返回符合 Schema 的 JSON 对象。
【目标分段剧本内容】：
${segment.plotAnchor}
【当前已绑定的资产】：
角色：${this.sanitizePrompt(segment.assets.characters)}
场景：${this.sanitizePrompt(segment.assets.scenes)}
道具：${this.sanitizePrompt(segment.assets.props)}
请直接返回提示词字符串。**必须包含该分段内的所有剧本台词，并遵循“角色名：‘台词内容’”的格式。**`;

    // Prepare image parts for scene assets to help with spatial coordinate inference
    const imageParts: any[] = [];
    if (spatialMode === 'strong') {
      const seenImageUrls = new Set<string>();
      
      // Find scenes that have images among all assets
      for (const asset of allAssets) {
        if (asset.type === 'scene' && asset.generatedMedia?.mainImageUrl) {
          const url = asset.generatedMedia.mainImageUrl;
          if (!seenImageUrls.has(url)) {
            seenImageUrls.add(url);
            try {
               const { base64, mimeType } = await urlToBase64(url);
               imageParts.push({ text: `【场景示例图 - ${this.getAssetDisplayId(asset.id, 'scene', allAssets)} (${asset.name})】` });
               imageParts.push({ inlineData: { data: base64, mimeType } });
            } catch (e) {
               console.warn(`Failed to package scene image for coordinate inference in regenerate: ${url}`, e);
            }
          }
        }
      }
    }

    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ 
          role: 'user', 
          parts: [
            ...imageParts,
            { text: prompt }
          ] 
        }],
        config: { 
          systemInstruction: DIRECTOR_AGENT_SYSTEM_INSTRUCTION, 
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              prompt: { type: "STRING" }
            },
            required: ["prompt"]
          }
        }
      }, config);
      
      let newPrompt = '';
      try {
        const json = this.extractJson(response.text || '{}');
        newPrompt = json.prompt || response.text || '';
      } catch (e) {
        newPrompt = response.text || '';
      }
      
      return this.cleanPromptText(newPrompt.trim());
    } catch (e) {
      console.error("Regenerate prompt failed:", e);
      throw e;
    }
  }

  public async generateDetailedDNA(asset: Asset, script: string, config?: Config): Promise<string> {
    const prompt = `你是一位资深编剧和美术指导。请根据剧本内容，为以下资产生成一份极其详尽的“DNA 详细资料”。
【资产信息】：
名称：${asset.name}
类型：${asset.type === 'character' ? '角色' : asset.type === 'scene' ? '场景' : '道具'}

【剧本参考】：
${script}

【极其重要】：
1. **格式要求**：请严格按照以下模板生成，不要包含任何 Markdown 格式（如 ## 或 **），直接输出纯文本。
2. **内容要求**：基于剧本内容进行合理推断和扩充。**即使剧本中没有明确提到某些细节，你也必须根据角色的人设、职业、剧本背景进行合理的、符合逻辑的推断，确保所有字段都被详尽填充，严禁留空。**
3. **视觉一致性**：确保所有视觉特征（如人种、年龄、体型、脸型、发色等）在逻辑上是自洽的，并具有极高的视觉参考价值。**必须明确描述人种（如：白人、黑人、黄种人等）、身高（具体厘米数）和性别。**
4. **语言要求**：统一使用**中文**。

【角色 DNA 模板】：
演员名称：[角色名]
角色定位：[如：主角/反派/神秘人/关键配角]
国籍 / 地区：[如：中国/欧美/日韩]
人种 / 民族：[如：黄种人/汉族/白人]
真实年龄：[具体数字]
视觉年龄：[具体数字]
性别：[男/女]
职业 / 身份：[详尽描述]
身高：[如：180cm]
体重：[如：75kg]
体型：[如：匀称/魁梧/纤细/健硕]
体态特征：[如：身姿挺拔/步履蹒跚/习惯性耸肩]
脸型：[如：鹅蛋脸/方脸/棱角分明]
眼睛：[描述颜色、形状、神态，如：深棕色、丹凤眼、目光锐利]
鼻子：[如：高挺/鹰钩鼻/小巧]
嘴唇：[如：薄唇/厚实/嘴角微翘]
皮肤：[如：冷白皮/古铜色/粗糙/细腻]
发色：[如：黑色/金发/银灰]
发型：[详尽描述，如：高马尾/寸头/波浪卷]
标志性特征：[如：左耳耳钉/眼角泪痣/刀疤/纹身]
穿搭风格：[如：优雅高定/街头潮流/复古武侠]
穿搭色系：[如：黑白灰/莫兰迪色/鲜艳撞色]
妆容风格：[如：伪素颜/浓妆/战损妆]
配饰：[如：金丝眼镜/十字架项链]
角色标签：[如：优雅 / 腹黑 / 刚正不阿]

【场景 DNA 模板】：
场景名称：[场景名]
地点：[具体位置描述]
时间：[如：清晨/深夜/黄昏]
天气：[如：晴朗/阴雨/大雾]
氛围：[如：压抑/温馨/神秘/肃穆]
环境描述：[详尽的视觉元素描述，包括材质、陈设、色调]
灯光：[如：冷色调强光/暖色调微光/自然光]

【道具 DNA 模板】：
道具名称：[道具名]
材质：[如：金属/木质/玉石]
尺寸：[具体尺寸描述]
成色/状态：[如：崭新/破旧/生锈/温润]
外观描述：[详尽的形状、纹理、细节描述]

请直接输出生成的 DNA 文本：`;

    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
          systemInstruction: DIRECTOR_AGENT_SYSTEM_INSTRUCTION,
          temperature: 0.7 
        }
      }, config);
      return response.text.trim();
    } catch (e) {
      console.error("Generate detailed DNA failed:", e);
      throw e;
    }
  }
}

export const directorAgent = new DirectorAgent();
