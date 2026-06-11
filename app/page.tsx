"use client";

import { toPng } from "html-to-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AspectRatio,
  Density,
  LayoutStyle,
  LineOverride,
  PosterLine,
  buildPosterLines,
  curatedEmojiPool,
  examples,
  getLabelsNeedingEnglish,
  posterPresets
} from "./poster-engine";
import styles from "./page.module.css";

const DEFAULT_TEXT = `爱好
困惑
理想
角度
工作
方法
逻辑
情绪
灵感
关系`;

const MIN_FONT_SIZE = 28;
const MAX_FONT_SIZE = 82;
const MAX_INPUT_LENGTH = 500;
const EXPORT_WIDTH = 1080;
const TRANSLATION_DEBOUNCE_MS = 450;
const RATIO_OPTIONS: AspectRatio[] = ["9:16", "2:3", "3:4", "1:1", "4:3", "3:2", "16:9"];

type FontChoice = "sans" | "serif" | "zcool";
type BackgroundStyle = "solid" | "sunset" | "ocean" | "night";
type TextureStyle = "none" | "paper" | "grain" | "grid";
type TextEffect = "none" | "shadow" | "outline" | "glow";

const FONT_OPTIONS: Array<{ value: FontChoice; label: string; note: string }> = [
  { value: "sans", label: "思源黑体", note: "现代、利落" },
  { value: "serif", label: "思源宋体", note: "编辑、文学" },
  { value: "zcool", label: "站酷小薇体", note: "复古、标题感" }
];

const FONT_FAMILIES: Record<FontChoice, string> = {
  sans: '"Noto Sans SC", "PingFang SC", sans-serif',
  serif: '"Noto Serif SC", "Songti SC", serif',
  zcool: '"ZCOOL XiaoWei", "STKaiti", serif'
};

const BACKGROUNDS: Record<BackgroundStyle, string> = {
  solid: "none",
  sunset: "linear-gradient(145deg, #ffdd6f 0%, #ff7e73 48%, #b75cff 100%)",
  ocean: "linear-gradient(145deg, #081b33 0%, #0d5c75 52%, #52d3c6 100%)",
  night: "radial-gradient(circle at 25% 20%, #5b48ff 0%, #171236 34%, #070711 78%)"
};

const STYLE_PRESETS: Array<{
  id: string;
  name: string;
  note: string;
  swatches: string[];
  bgColor: string;
  textColor: string;
  backgroundStyle: BackgroundStyle;
  texture: TextureStyle;
  font: FontChoice;
  layout: LayoutStyle;
  effect: TextEffect;
  density: Density;
  seed: number;
}> = [
  {
    id: "editorial",
    name: "杂志留白",
    note: "宋体 / 暖纸 / 编辑式",
    swatches: ["#f2eadb", "#17140f", "#b7492e"],
    bgColor: "#f2eadb",
    textColor: "#17140f",
    backgroundStyle: "solid",
    texture: "paper",
    font: "serif",
    layout: "editorial",
    effect: "none",
    density: "low",
    seed: 142
  },
  {
    id: "citrus",
    name: "柑橘波普",
    note: "站酷 / 日落渐变 / 堆叠",
    swatches: ["#ffdd6f", "#ff7e73", "#24120e"],
    bgColor: "#ffdd6f",
    textColor: "#24120e",
    backgroundStyle: "sunset",
    texture: "grain",
    font: "zcool",
    layout: "stacked",
    effect: "shadow",
    density: "high",
    seed: 287
  },
  {
    id: "ocean",
    name: "深海蓝图",
    note: "黑体 / 冷色渐变 / 居中",
    swatches: ["#081b33", "#0d5c75", "#eaffff"],
    bgColor: "#081b33",
    textColor: "#eaffff",
    backgroundStyle: "ocean",
    texture: "grid",
    font: "sans",
    layout: "centered",
    effect: "shadow",
    density: "medium",
    seed: 413
  },
  {
    id: "midnight",
    name: "午夜霓虹",
    note: "黑体 / 紫夜 / 发光",
    swatches: ["#070711", "#5b48ff", "#f7f1ff"],
    bgColor: "#070711",
    textColor: "#f7f1ff",
    backgroundStyle: "night",
    texture: "grain",
    font: "sans",
    layout: "dynamic",
    effect: "glow",
    density: "high",
    seed: 731
  }
];

export default function Home() {
  const [input, setInput] = useState(DEFAULT_TEXT);
  const [seed, setSeed] = useState(18);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgImageName, setBgImageName] = useState("");
  const [textColor, setTextColor] = useState("#111111");
  const [density, setDensity] = useState<Density>("medium");
  const [ratio, setRatio] = useState<AspectRatio>("9:16");
  const [fontSize, setFontSize] = useState(posterPresets[ratio].defaultFontSize);
  const [fontChoice, setFontChoice] = useState<FontChoice>("sans");
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>("dynamic");
  const [backgroundStyle, setBackgroundStyle] = useState<BackgroundStyle>("solid");
  const [texture, setTexture] = useState<TextureStyle>("none");
  const [textEffect, setTextEffect] = useState<TextEffect>("none");
  const [previewZoom, setPreviewZoom] = useState(66);
  const [englishOverrides, setEnglishOverrides] = useState<Record<string, string>>({});
  const [lineOverrides, setLineOverrides] = useState<Record<number, LineOverride>>({});
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [translationStatus, setTranslationStatus] = useState<"idle" | "loading" | "error">("idle");
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "error">("idle");
  const posterRef = useRef<HTMLDivElement>(null);
  const attemptedTranslationsRef = useRef(new Set<string>());
  const labelsNeedingEnglish = useMemo(() => getLabelsNeedingEnglish(input), [input]);
  const labelsNeedingEnglishKey = labelsNeedingEnglish.join("\n");

  const lines = useMemo(
    () =>
      buildPosterLines(input, {
        density,
        seed,
        englishOverrides,
        layoutStyle,
        lineOverrides
      }),
    [density, englishOverrides, input, layoutStyle, lineOverrides, seed]
  );

  const applyStylePreset = useCallback((preset: (typeof STYLE_PRESETS)[number]) => {
    setBgColor(preset.bgColor);
    setTextColor(preset.textColor);
    setBackgroundStyle(preset.backgroundStyle);
    setTexture(preset.texture);
    setFontChoice(preset.font);
    setLayoutStyle(preset.layout);
    setTextEffect(preset.effect);
    setDensity(preset.density);
    setSeed(preset.seed);
  }, []);

  const updateLineOverride = useCallback((index: number, patch: LineOverride) => {
    setLineOverrides((current) => ({
      ...current,
      [index]: { ...current[index], ...patch }
    }));
  }, []);

  useEffect(() => {
    const unresolvedLabels = labelsNeedingEnglish.filter((label) => !englishOverrides[label]);
    const missingLabels = unresolvedLabels.filter(
      (label) => !englishOverrides[label] && !attemptedTranslationsRef.current.has(label)
    );
    if (unresolvedLabels.length === 0) {
      setTranslationStatus("idle");
      return;
    }
    if (missingLabels.length === 0) {
      setTranslationStatus("error");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setTranslationStatus("loading");

      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: missingLabels }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Translation request failed with ${response.status}`);
        }

        const data = (await response.json()) as { translations?: Record<string, string> };
        const translations = data.translations ?? {};
        missingLabels.forEach((label) => attemptedTranslationsRef.current.add(label));

        if (Object.keys(translations).length > 0) {
          setEnglishOverrides((current) => ({
            ...current,
            ...translations
          }));
        }

        setTranslationStatus(
          missingLabels.every((label) => translations[label]) ? "idle" : "error"
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          missingLabels.forEach((label) => attemptedTranslationsRef.current.add(label));
          console.warn("Auto translation failed", error);
          setTranslationStatus("error");
        }
      }
    }, TRANSLATION_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [englishOverrides, labelsNeedingEnglish, labelsNeedingEnglishKey]);

  const randomize = useCallback(() => {
    setSeed(Math.floor(Math.random() * 100000));
  }, []);

  const generateFromTextarea = useCallback(() => {
    randomize();
  }, [randomize]);

  const exportPng = useCallback(async () => {
    if (!posterRef.current) return;

    setExportStatus("loading");

    try {
      const renderedWidth = posterRef.current.getBoundingClientRect().width;
      if (renderedWidth <= 0) throw new Error("Poster has no rendered width");
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: EXPORT_WIDTH / renderedWidth,
        backgroundColor: bgColor,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.exportIgnore === "true")
      });
      const link = document.createElement("a");
      link.download = `emoji-poster-${ratio.replace(":", "x")}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      setExportStatus("idle");
    } catch (error) {
      console.warn("PNG export failed", error);
      setExportStatus("error");
    }
  }, [bgColor, ratio]);

  const uploadBackgroundImage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setBgImage(typeof reader.result === "string" ? reader.result : null);
      setBgImageName(file.name);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }, []);

  const removeBackgroundImage = useCallback(() => {
    setBgImage(null);
    setBgImageName("");
  }, []);

  return (
    <main className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.wordmark}>MIXTYPE</div>
        <div className={styles.brandDivider} />
        <h1>文字封面生成器</h1>
        <div className={styles.topbarMeta}>
          <span>Poster studio</span>
          <span>v0.3</span>
        </div>
      </header>

      <div className={styles.workspace}>
        <section className={styles.stage} aria-label="海报预览">
          <div className={styles.stageHeader}>
            <div>
              <span className={styles.stageLabel}>预览</span>
              <span className={styles.stageSize}>
                {posterPresets[ratio].label} · {ratio}
              </span>
            </div>
            <span className={styles.liveStatus}>
              <i />
              实时生成
            </span>
          </div>

          <div className={styles.canvasArea}>
            <div
              className={`${styles.posterFrame} ${
                posterPresets[ratio].orientation === "landscape" ? styles.landscape : ""
              } ${posterPresets[ratio].orientation === "square" ? styles.square : ""}`}
              style={{ "--preview-scale": previewZoom / 66 } as React.CSSProperties}
            >
              <PosterCanvas
                refNode={posterRef}
                lines={lines}
                bgColor={bgColor}
                bgImage={bgImage}
                textColor={textColor}
                fontSize={fontSize}
                fontFamily={FONT_FAMILIES[fontChoice]}
                backgroundStyle={backgroundStyle}
                texture={texture}
                textEffect={textEffect}
                layoutStyle={layoutStyle}
                ratio={ratio}
                selectedLine={selectedLine}
                onSelectLine={setSelectedLine}
              />
            </div>
          </div>

          <div className={styles.stageFooter}>
            <div className={styles.zoomControl} aria-label="预览缩放">
              <button
                type="button"
                aria-label="缩小"
                disabled={previewZoom <= 46}
                onClick={() => setPreviewZoom((current) => Math.max(46, current - 10))}
              >
                −
              </button>
              <span>{previewZoom}%</span>
              <button
                type="button"
                aria-label="放大"
                disabled={previewZoom >= 96}
                onClick={() => setPreviewZoom((current) => Math.min(96, current + 10))}
              >
                ＋
              </button>
            </div>
            <button className={styles.canvasHint} type="button" onClick={() => setPreviewZoom(66)}>
              <FrameIcon />
              <span>自动适应画布</span>
            </button>
          </div>
        </section>

        <aside className={styles.studio} aria-label="海报控制台">
          <section className={styles.panelSection}>
            <SectionHeading number="01" title="文案" />
            <label className={styles.inputBlock}>
              <span>输入关键词</span>
              <textarea
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setLineOverrides({});
                  setSelectedLine(null);
                }}
                placeholder="每行输入一个关键词，英文会自动匹配"
                maxLength={MAX_INPUT_LENGTH}
              />
              <small>{input.length} / {MAX_INPUT_LENGTH}</small>
            </label>
            <div className={styles.inputHint} role="status" aria-live="polite">
              {translationStatus === "loading" ? "正在补充英文翻译…" : null}
              {translationStatus === "error"
                ? "自动翻译失败，可在中文后直接输入英文，例如：远方 Distance"
                : null}
            </div>

            <div className={styles.actions}>
              <button className={styles.primaryButton} onClick={generateFromTextarea}>
                <SparkIcon />
                生成版式
              </button>
              <button className={styles.secondaryButton} onClick={randomize}>
                <ShuffleIcon />
                随机重排
              </button>
            </div>

            <div className={styles.exampleHeader}>
              <span>示例预设</span>
              <span>点击使用</span>
            </div>
            <div className={styles.examples}>
              {examples.slice(0, 6).map((example) => (
                <button
                  key={example.name}
                  onClick={() => {
                    setInput(example.text);
                    setSeed(example.seed);
                    setLineOverrides({});
                    setSelectedLine(null);
                  }}
                >
                  <strong>{example.name}</strong>
                  <span>{example.text.split("\n").slice(0, 2).join(" / ")}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.panelSection}>
            <SectionHeading number="02" title="风格预设" />
            <div className={styles.stylePresets}>
              {STYLE_PRESETS.map((preset) => (
                <button type="button" key={preset.id} onClick={() => applyStylePreset(preset)}>
                  <span className={styles.presetSwatches} aria-hidden="true">
                    {preset.swatches.map((swatch) => (
                      <i key={swatch} style={{ background: swatch }} />
                    ))}
                  </span>
                  <strong>{preset.name}</strong>
                  <small>{preset.note}</small>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.panelSection}>
            <SectionHeading number="03" title="画布" />
            <div className={styles.canvasControls}>
              <fieldset className={styles.ratioControl}>
                <legend>画布比例</legend>
                <div>
                  {RATIO_OPTIONS.map((option) => (
                    <button
                      type="button"
                      className={ratio === option ? styles.selected : ""}
                      aria-pressed={ratio === option}
                      onClick={() => {
                        setRatio(option);
                        setFontSize(posterPresets[option].defaultFontSize);
                      }}
                      key={option}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className={styles.control}>
                <span>Emoji 密度</span>
                <select
                  value={density}
                  onChange={(event) => setDensity(event.target.value as Density)}
                >
                  <option value="low">少</option>
                  <option value="medium">中</option>
                  <option value="high">多</option>
                </select>
              </label>
            </div>
          </section>

          <section className={styles.panelSection}>
            <SectionHeading number="04" title="行内微调" />
            {selectedLine !== null && lines[selectedLine] ? (
              <LineEditor
                line={lines[selectedLine]}
                override={lineOverrides[selectedLine]}
                onChange={(patch) => updateLineOverride(selectedLine, patch)}
                onReset={() =>
                  setLineOverrides((current) => {
                    const next = { ...current };
                    delete next[selectedLine];
                    return next;
                  })
                }
              />
            ) : (
              <button
                className={styles.emptyLineEditor}
                type="button"
                onClick={() => setSelectedLine(0)}
              >
                点击海报中的任意一行，即可单独修改 emoji、英文和字号
              </button>
            )}
          </section>

          <section className={`${styles.panelSection} ${styles.styleSection}`}>
            <SectionHeading number="05" title="样式" />
            <div className={styles.controlGrid}>
              <ColorControl label="背景颜色" value={bgColor} onChange={setBgColor} />
              <ColorControl label="文字颜色" value={textColor} onChange={setTextColor} />

              <label className={styles.control}>
                <span>海报字体</span>
                <select
                  value={fontChoice}
                  onChange={(event) => setFontChoice(event.target.value as FontChoice)}
                >
                  {FONT_OPTIONS.map((font) => (
                    <option value={font.value} key={font.value}>
                      {font.label} · {font.note}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.control}>
                <span>排版风格</span>
                <select
                  value={layoutStyle}
                  onChange={(event) => setLayoutStyle(event.target.value as LayoutStyle)}
                >
                  <option value="dynamic">自由错落</option>
                  <option value="editorial">杂志编辑</option>
                  <option value="centered">居中标题</option>
                  <option value="stacked">大小堆叠</option>
                </select>
              </label>

              <label className={styles.control}>
                <span>背景效果</span>
                <select
                  value={backgroundStyle}
                  onChange={(event) =>
                    setBackgroundStyle(event.target.value as BackgroundStyle)
                  }
                >
                  <option value="solid">纯色</option>
                  <option value="sunset">日落渐变</option>
                  <option value="ocean">深海渐变</option>
                  <option value="night">午夜光晕</option>
                </select>
              </label>

              <label className={styles.control}>
                <span>背景纹理</span>
                <select
                  value={texture}
                  onChange={(event) => setTexture(event.target.value as TextureStyle)}
                >
                  <option value="none">无纹理</option>
                  <option value="paper">纸张纤维</option>
                  <option value="grain">颗粒噪点</option>
                  <option value="grid">设计网格</option>
                </select>
              </label>

              <label className={styles.control}>
                <span>文字效果</span>
                <select
                  value={textEffect}
                  onChange={(event) => setTextEffect(event.target.value as TextEffect)}
                >
                  <option value="none">无</option>
                  <option value="shadow">投影</option>
                  <option value="outline">描边</option>
                  <option value="glow">发光</option>
                </select>
              </label>

              <label className={`${styles.control} ${styles.imageControl}`}>
                <span>背景图片</span>
                <div className={styles.imageUpload}>
                  <UploadIcon />
                  <strong>{bgImageName || "点击上传或拖拽图片到此处"}</strong>
                  <small>支持 JPG / PNG，建议 1080 × 1350 或更高</small>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={uploadBackgroundImage}
                    aria-label="上传背景图片"
                  />
                </div>
                {bgImage ? (
                  <button className={styles.removeImage} type="button" onClick={removeBackgroundImage}>
                    移除背景图片
                  </button>
                ) : null}
              </label>

              <label className={styles.slider}>
                <span>字体大小</span>
                <strong>{fontSize}px</strong>
                <div className={styles.sliderRow}>
                  <span>A</span>
                  <input
                    type="range"
                    min={MIN_FONT_SIZE}
                    max={MAX_FONT_SIZE}
                    value={fontSize}
                    onChange={(event) => setFontSize(Number(event.target.value))}
                  />
                  <span className={styles.largeA}>A</span>
                </div>
              </label>
            </div>

            <div className={styles.bottomActions}>
              <button className={styles.primaryButton} onClick={generateFromTextarea}>
                <SparkIcon />
                生成版式
              </button>
              <button
                className={styles.exportButton}
                onClick={exportPng}
                disabled={exportStatus === "loading"}
              >
                <DownloadIcon />
                {exportStatus === "loading" ? "正在导出…" : "导出 PNG"}
              </button>
            </div>
            {exportStatus === "error" ? (
              <p className={styles.exportError} role="alert">
                PNG 导出失败，请稍后重试。
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </main>
  );
}

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className={styles.sectionHeading}>
      <h2>
        <span>{number}</span>
        {title}
      </h2>
      <span aria-hidden="true">−</span>
    </div>
  );
}

function LineEditor({
  line,
  override,
  onChange,
  onReset
}: {
  line: PosterLine;
  override?: LineOverride;
  onChange: (patch: LineOverride) => void;
  onReset: () => void;
}) {
  return (
    <div className={styles.lineEditor}>
      <div className={styles.lineEditorTitle}>
        <span>正在编辑</span>
        <strong>#{line.label}</strong>
        <button type="button" onClick={onReset}>
          恢复本行
        </button>
      </div>
      <div className={styles.lineEditorGrid}>
        <label className={styles.control}>
          <span>Emoji</span>
          <select
            value={override?.emoji ?? line.emoji}
            onChange={(event) => onChange({ emoji: event.target.value })}
          >
            {curatedEmojiPool.map((emoji) => (
              <option value={emoji} key={emoji}>
                {emoji}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.control}>
          <span>英文</span>
          <input
            type="text"
            value={override?.english ?? line.english}
            onChange={(event) => onChange({ english: event.target.value })}
            placeholder="输入英文，可留空"
          />
        </label>
      </div>
      <label className={styles.lineSize}>
        <span>本行大小</span>
        <strong>{Math.round((override?.size ?? 1) * 100)}%</strong>
        <input
          type="range"
          min="60"
          max="145"
          value={Math.round((override?.size ?? 1) * 100)}
          onChange={(event) => onChange({ size: Number(event.target.value) / 100 })}
        />
      </label>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l1.45 5.15L18 9l-4.55 1.85L12 16l-1.45-5.15L6 9l4.55-1.85L12 2Z" />
      <path d="m19 14 .75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14Z" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 3h5v5M4 18l5.5-5.5M21 3l-7.2 7.2M16 21h5v-5M4 6h3.5L21 19.5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 17v3h16v-3" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M5 14v5h14v-5" />
    </svg>
  );
}

function FrameIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </svg>
  );
}

function PosterCanvas({
  refNode,
  lines,
  bgColor,
  bgImage,
  textColor,
  fontSize,
  fontFamily,
  backgroundStyle,
  texture,
  textEffect,
  layoutStyle,
  ratio,
  selectedLine,
  onSelectLine
}: {
  refNode: React.RefObject<HTMLDivElement | null>;
  lines: PosterLine[];
  bgColor: string;
  bgImage: string | null;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  backgroundStyle: BackgroundStyle;
  texture: TextureStyle;
  textEffect: TextEffect;
  layoutStyle: LayoutStyle;
  ratio: AspectRatio;
  selectedLine: number | null;
  onSelectLine: (index: number) => void;
}) {
  const preset = posterPresets[ratio];
  const isLandscape = preset.orientation === "landscape";
  const comfortableLineCount = isLandscape ? 8 : 6;
  const shrinkPerExtraLine = isLandscape ? 0.055 : 0.075;
  const contentScale = Math.max(
    isLandscape ? 0.62 : 0.52,
    1 - Math.max(0, lines.length - comfortableLineCount) * shrinkPerExtraLine
  );
  const textureClass =
    texture === "paper"
      ? styles.texturePaper
      : texture === "grain"
        ? styles.textureGrain
        : texture === "grid"
          ? styles.textureGrid
          : "";
  const textEffectClass =
    textEffect === "shadow"
      ? styles.textShadow
      : textEffect === "outline"
        ? styles.textOutline
        : textEffect === "glow"
          ? styles.textGlow
          : "";
  const layoutClass =
    layoutStyle === "centered"
      ? styles.layoutCentered
      : layoutStyle === "editorial"
        ? styles.layoutEditorial
        : layoutStyle === "stacked"
          ? styles.layoutStacked
          : "";

  return (
    <div
      ref={refNode}
      className={`${styles.poster} ${isLandscape ? styles.posterLandscape : ""} ${textureClass} ${textEffectClass} ${layoutClass}`}
      style={{
        backgroundColor: bgColor,
        backgroundImage: bgImage ? `url("${bgImage}")` : BACKGROUNDS[backgroundStyle],
        backgroundPosition: "center",
        backgroundSize: "cover",
        color: textColor,
        fontFamily,
        aspectRatio: preset.cssAspectRatio,
        "--base-font-size": `${fontSize * contentScale}px`,
        "--poster-pad": preset.pad
      } as React.CSSProperties}
    >
      <div className={styles.posterTopline}>
        <span>#MixedType</span>
        <span>2026</span>
      </div>
      <div className={styles.posterText}>
        {lines.map((line, index) => (
          <button
            type="button"
            key={`${line.label}-${index}-${line.english}`}
            className={`${styles.posterLine} ${styles.posterLineButton}`}
            aria-label={`编辑第 ${index + 1} 行：${line.label}`}
            aria-pressed={selectedLine === index}
            onClick={() => onSelectLine(index)}
            style={{
              "--line-size": line.size,
              "--line-width": line.width,
              "--line-indent": line.indent,
              "--line-leading": line.leading,
              "--line-opacity": line.opacity
            } as React.CSSProperties}
          >
            {selectedLine === index ? (
              <span className={styles.selectionRing} data-export-ignore="true" aria-hidden="true" />
            ) : null}
            {line.fragments.map((fragment, fragmentIndex) =>
              fragment.type === "emoji" ? (
                <span className={styles.emoji} key={`${fragment.value}-${fragmentIndex}`}>
                  {fragment.value}
                </span>
              ) : (
                <span key={`${fragment.value}-${fragmentIndex}`}>{fragment.value}</span>
              )
            )}
          </button>
        ))}
      </div>
      <div className={styles.posterFoot}>
        <span>Designed with everyday words</span>
        <span>CN / EN / Emoji</span>
      </div>
    </div>
  );
}

function ColorControl({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.control}>
      <span>{label}</span>
      <div className={styles.colorRow}>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
        />
      </div>
    </label>
  );
}
