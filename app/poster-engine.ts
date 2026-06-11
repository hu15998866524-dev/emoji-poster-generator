export type Density = "low" | "medium" | "high";
export type AspectRatio = "9:16" | "2:3" | "3:4" | "1:1" | "4:3" | "3:2" | "16:9";
export type LayoutStyle = "dynamic" | "editorial" | "centered" | "stacked";

export type LineOverride = {
  emoji?: string;
  english?: string;
  size?: number;
};

type Fragment = {
  type: "text" | "emoji";
  value: string;
};

export type PosterLine = {
  label: string;
  english: string;
  emoji: string;
  fragments: Fragment[];
  size: string;
  width: string;
  indent: string;
  leading: string;
  opacity: number;
};

type BuildOptions = {
  density: Density;
  seed: number;
  englishOverrides?: Record<string, string>;
  layoutStyle?: LayoutStyle;
  lineOverrides?: Record<number, LineOverride>;
};

const semanticRules: Array<{ keys: string[]; english: string; emoji: string[] }> = [
  { keys: ["你好", "问候"], english: "Hello", emoji: ["👋", "☻", "✨"] },
  { keys: ["哈哈", "笑", "开心"], english: "Happy", emoji: ["😆", "☺️", "✦"] },
  { keys: ["抽烟", "烟"], english: "Smoke", emoji: ["🌫️", "☁️", "☾"] },
  { keys: ["爱好", "兴趣", "喜欢"], english: "Hobby", emoji: ["😆", "🫧", "🎧"] },
  { keys: ["困惑", "疑问", "问题"], english: "Confusions", emoji: ["💬", "🌀", "❔"] },
  { keys: ["理想", "愿望", "梦想"], english: "The Ideal", emoji: ["☁️", "🪽", "✨"] },
  { keys: ["角度", "观点", "视角"], english: "Perspective", emoji: ["🌘", "🪞", "🔭"] },
  { keys: ["工作", "职业", "任务"], english: "Work", emoji: ["🥖", "💼", "🧩"] },
  { keys: ["方法", "路径", "办法"], english: "Methods", emoji: ["🐿️", "🧰", "🪜"] },
  { keys: ["逻辑", "推理", "结构"], english: "Logic", emoji: ["🎱", "🧠", "♟️"] },
  { keys: ["思考", "思路"], english: "Thinking", emoji: ["🧠", "💭", "🔎"] },
  { keys: ["情绪", "感受", "焦虑"], english: "Mood", emoji: ["😶‍🌫️", "🌧️", "🔥"] },
  { keys: ["灵感", "创意", "想法"], english: "Inspiration", emoji: ["💡", "🌟", "🪄"] },
  { keys: ["关系", "连接", "朋友"], english: "Relations", emoji: ["🫶", "🧵", "🌿"] },
  { keys: ["学习", "知识", "阅读"], english: "Study Notes", emoji: ["📚", "🔎", "✏️"] },
  { keys: ["生活", "日常"], english: "Daily Life", emoji: ["🪴", "🏙️", "☕"] },
  { keys: ["城市"], english: "City Walk", emoji: ["🏙️", "📍", "☕"] },
  { keys: ["时间", "计划", "节奏"], english: "Time", emoji: ["⏳", "📍", "🗓️"] }
];

export const curatedEmojiPool = [
  "😀", "😄", "😆", "😊", "🙂", "😉", "😍", "🤩", "😎", "🥳",
  "🤔", "🫡", "😶‍🌫️", "😮‍💨", "😵‍💫", "🥹", "😂", "😭", "😤", "😴",
  "👋", "👏", "🙌", "🤝", "👍", "✌️", "🤞", "🫶", "💪", "🙏",
  "🧠", "👀", "👁️", "💬", "💭", "❤️", "❤️‍🔥", "💛", "💚", "💙",
  "✨", "⭐", "🌟", "💫", "🔥", "🌈", "☀️", "🌙", "☁️", "🌧️",
  "🌊", "🌿", "🍀", "🌱", "🌸", "🌻", "🪴", "🍎", "🍋", "☕",
  "🍞", "🥖", "🎂", "🎈", "🎉", "🎵", "🎧", "🎸", "🎨", "🎬",
  "📷", "💡", "🔎", "📍", "🧭", "⏳", "⏰", "🗓️", "✏️", "📝",
  "📚", "📖", "📎", "📌", "📦", "💼", "🧰", "🧩", "🎯", "🏆",
  "🚀", "✈️", "🚲", "🚶", "🏠", "🏙️", "⛰️", "🏖️", "🌍", "🪐",
  "💻", "📱", "⌨️", "🖥️", "⚙️", "🔧", "🔒", "🔑", "🔔", "📣",
  "🪄", "🪞", "🔭", "🪜", "🧵", "🫧", "🪽", "♟️", "🎱", "❔",
  "✦", "☻", "☾", "🌘", "🌀", "🌫️"
];

const extraEmojiRate: Record<Density, number> = {
  low: 0,
  medium: 0,
  high: 0.36
};

const layoutPatterns = [
  { size: 1.04, width: 82, indent: 0, leading: 0.9, opacity: 1 },
  { size: 0.76, width: 68, indent: 16, leading: 0.98, opacity: 0.92 },
  { size: 1.22, width: 94, indent: 4, leading: 0.84, opacity: 1 },
  { size: 0.86, width: 74, indent: 28, leading: 0.94, opacity: 0.96 },
  { size: 1.12, width: 88, indent: 9, leading: 0.86, opacity: 1 },
  { size: 0.7, width: 58, indent: 38, leading: 1.02, opacity: 0.88 },
  { size: 0.98, width: 76, indent: 2, leading: 0.9, opacity: 0.96 },
  { size: 1.3, width: 96, indent: 14, leading: 0.82, opacity: 1 }
];

export const posterPresets: Record<
  AspectRatio,
  { label: string; cssAspectRatio: string; pad: string; defaultFontSize: number; orientation: "portrait" | "square" | "landscape" }
> = {
  "9:16": {
    label: "9:16 手机海报",
    cssAspectRatio: "9 / 16",
    pad: "8.4%",
    defaultFontSize: 36,
    orientation: "portrait"
  },
  "2:3": {
    label: "2:3 竖版海报",
    cssAspectRatio: "2 / 3",
    pad: "8%",
    defaultFontSize: 38,
    orientation: "portrait"
  },
  "3:4": {
    label: "3:4 小红书/封面",
    cssAspectRatio: "3 / 4",
    pad: "7.2%",
    defaultFontSize: 40,
    orientation: "portrait"
  },
  "1:1": {
    label: "1:1 方图",
    cssAspectRatio: "1 / 1",
    pad: "6.6%",
    defaultFontSize: 38,
    orientation: "square"
  },
  "4:3": {
    label: "4:3 横版图",
    cssAspectRatio: "4 / 3",
    pad: "5.8%",
    defaultFontSize: 36,
    orientation: "landscape"
  },
  "3:2": {
    label: "3:2 横版图",
    cssAspectRatio: "3 / 2",
    pad: "5.6%",
    defaultFontSize: 34,
    orientation: "landscape"
  },
  "16:9": {
    label: "16:9 横版封面",
    cssAspectRatio: "16 / 9",
    pad: "5.5%",
    defaultFontSize: 32,
    orientation: "landscape"
  }
};

export const examples = [
  {
    name: "默认关键词",
    seed: 18,
    text: `爱好
困惑
理想
角度
工作
方法
逻辑`
  },
  {
    name: "工作脑内",
    seed: 57,
    text: `工作
方法
逻辑
时间
困惑
灵感
理想`
  },
  {
    name: "生活切片",
    seed: 91,
    text: `生活
城市
情绪
兴趣
关系
学习
角度`
  },
  {
    name: "情绪天气",
    seed: 126,
    text: `情绪
焦虑
开心
困惑
感受
时间
理想`
  },
  {
    name: "创意现场",
    seed: 203,
    text: `灵感
创意
想法
角度
方法
结构
节奏`
  },
  {
    name: "学习笔记",
    seed: 314,
    text: `学习
阅读
知识
思考
逻辑
问题
方法`
  },
  {
    name: "城市漫游",
    seed: 428,
    text: `城市
日常
生活
朋友
兴趣
时间
视角`
  },
  {
    name: "理想生活",
    seed: 539,
    text: `理想
梦想
愿望
生活
关系
节奏
喜欢`
  },
  {
    name: "关系练习",
    seed: 672,
    text: `关系
连接
朋友
问候
感受
困惑
角度`
  },
  {
    name: "方法清单",
    seed: 804,
    text: `方法
路径
计划
任务
结构
推理
结果`
  }
];

export function buildPosterLines(text: string, options: BuildOptions): PosterLine[] {
  const tokens = splitInput(text);
  const source = tokens.length > 0 ? tokens : splitInput(examples[0].text);

  return source.slice(0, 16).map((token, index) => {
    const rng = mulberry32(options.seed + index * 101);
    const layoutStyle = options.layoutStyle ?? "dynamic";
    const basePattern =
      layoutPatterns[(index + Math.floor(rng() * layoutPatterns.length)) % layoutPatterns.length];
    const pattern = applyLayoutStyle(basePattern, layoutStyle, index);
    const parsed = parseToken(token, options.englishOverrides);
    const override = options.lineOverrides?.[index];
    const english = override?.english ?? parsed.english;
    const emoji = override?.emoji ?? pickEmoji(token, rng);
    const extraEmoji = rng() < extraEmojiRate[options.density] ? pickEmoji(token, rng) : null;
    const fragments = buildFragments(parsed.label, english, emoji, extraEmoji, rng);
    const size = clamp(
      (pattern.size + (rng() - 0.5) * 0.14) * (override?.size ?? 1),
      0.5,
      1.65
    );

    return {
      ...parsed,
      english,
      emoji,
      fragments,
      size: size.toFixed(2),
      width: `${clamp(pattern.width + (rng() - 0.5) * 14, 52, 98).toFixed(0)}%`,
      indent: `${clamp(pattern.indent + (rng() - 0.5) * 18, 0, 42).toFixed(0)}%`,
      leading: `${clamp(pattern.leading + (rng() - 0.5) * 0.08, 0.78, 1.08).toFixed(2)}`,
      opacity: Number(clamp(pattern.opacity + (rng() - 0.5) * 0.08, 0.82, 1).toFixed(2))
    };
  });
}

function applyLayoutStyle(
  pattern: (typeof layoutPatterns)[number],
  style: LayoutStyle,
  index: number
) {
  if (style === "editorial") {
    return {
      ...pattern,
      size: index === 0 ? 1.34 : index % 3 === 0 ? 1.02 : 0.78,
      width: index === 0 ? 96 : 78,
      indent: index % 2 === 0 ? 0 : 18,
      leading: 0.92
    };
  }

  if (style === "centered") {
    return {
      ...pattern,
      size: index % 4 === 0 ? 1.18 : 0.86,
      width: 92,
      indent: 4,
      leading: 0.9
    };
  }

  if (style === "stacked") {
    return {
      ...pattern,
      size: index % 2 === 0 ? 1.16 : 0.72,
      width: index % 2 === 0 ? 94 : 72,
      indent: index % 2 === 0 ? 0 : 24,
      leading: 0.82
    };
  }

  return pattern;
}

function splitInput(text: string) {
  return text
    .split(/[\n,，;；、]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getLabelsNeedingEnglish(text: string) {
  const labels = splitInput(text)
    .map((token) => parseInputLabel(token))
    .filter((item) => item.label && !item.manualEnglish && hasChinese(item.label) && !resolveEnglish(item.label))
    .map((item) => item.label);

  return Array.from(new Set(labels));
}

function parseToken(token: string, englishOverrides: Record<string, string> = {}) {
  const clean = token.replace(/^#+/, "").trim();
  const isLatinOnly = /^[A-Za-z0-9][A-Za-z0-9\s&/.'_-]*$/.test(clean);

  if (isLatinOnly) {
    return {
      label: clean,
      english: ""
    };
  }

  const { label, manualEnglish } = parseInputLabel(clean);
  const english = manualEnglish ?? resolveEnglish(label, englishOverrides);

  return {
    label: label.replace(/^#+/, ""),
    english
  };
}

function parseInputLabel(token: string) {
  const clean = token.replace(/^#+/, "").trim();
  const englishMatch = clean.match(/[A-Za-z][A-Za-z\s&/.-]*$/);
  const label = clean.slice(0, englishMatch?.index ?? clean.length).trim() || clean;

  return {
    label: label.replace(/^#+/, ""),
    manualEnglish: englishMatch?.[0].trim()
  };
}

function buildFragments(
  label: string,
  english: string,
  emoji: string,
  extraEmoji: string | null,
  rng: () => number
): Fragment[] {
  const fragments: Fragment[] = [{ type: "text", value: `#${label}` }];
  const hasEnglish = english.length > 0;
  const emojiBeforeEnglish = !hasEnglish || rng() > 0.22;

  if (emojiBeforeEnglish) {
    fragments.push({ type: "text", value: " " }, { type: "emoji", value: emoji });
  }

  if (hasEnglish) {
    fragments.push({ type: "text", value: ` ${english}` });
  }

  if (!emojiBeforeEnglish) {
    fragments.push({ type: "text", value: " " }, { type: "emoji", value: emoji });
  }

  if (extraEmoji) {
    fragments.push({ type: "text", value: " " }, { type: "emoji", value: extraEmoji });
  }

  return fragments;
}

function pickEmoji(token: string, rng: () => number) {
  const rule = matchSemanticRule(token);
  const pool = rule && rng() < 0.75 ? rule.emoji : curatedEmojiPool;
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

function resolveEnglish(label: string, englishOverrides: Record<string, string> = {}) {
  return matchSemanticRule(label)?.english ?? englishOverrides[label] ?? "";
}

function matchSemanticRule(value: string) {
  const normalized = value.toLowerCase();
  return semanticRules.find((item) =>
    item.keys.some((key) => normalized.includes(key.toLowerCase()))
  );
}

function hasChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
