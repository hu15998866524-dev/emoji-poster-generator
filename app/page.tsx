"use client";

import { toPng } from "html-to-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccentStyle,
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
type BackgroundStyle =
  | "solid"
  | "cream"
  | "sunset"
  | "ocean"
  | "night"
  | "aurora"
  | "newsprint"
  | "sticky";
type TextureStyle = "none" | "paper" | "grain" | "grid";
type TextEffect = "none" | "shadow" | "outline" | "glow";
type PosterTheme = {
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
  accent: AccentStyle;
  seed: number;
};

const DRAFT_KEY = "mixtype-poster-draft-v1";
const MAX_SEED_HISTORY = 10;

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
  cream:
    "radial-gradient(circle at 18% 12%, rgba(255,255,255,.9), transparent 31%), linear-gradient(145deg, #fff8e9 0%, #f2dfc0 100%)",
  sunset: "linear-gradient(145deg, #ffdd6f 0%, #ff7e73 48%, #b75cff 100%)",
  ocean: "linear-gradient(145deg, #081b33 0%, #0d5c75 52%, #52d3c6 100%)",
  night: "radial-gradient(circle at 25% 20%, #5b48ff 0%, #171236 34%, #070711 78%)",
  aurora:
    "radial-gradient(circle at 18% 15%, #f4ff77 0%, transparent 28%), radial-gradient(circle at 82% 24%, #ff78d1 0%, transparent 34%), linear-gradient(145deg, #5847ff 0%, #0b1238 82%)",
  newsprint:
    "linear-gradient(90deg, transparent 49.5%, rgba(28,25,20,.08) 50%, transparent 50.5%), #eee8da",
  sticky:
    "linear-gradient(135deg, rgba(255,255,255,.5) 0 18%, transparent 18%), linear-gradient(145deg, #fff37b 0%, #ffd54f 100%)"
};

const STYLE_PRESETS: PosterTheme[] = [
  {
    id: "cream",
    name: "奶油手帐",
    note: "暖奶油 / 手写感 / 马克笔",
    swatches: ["#fff8e9", "#3f3025", "#ff8c78"],
    bgColor: "#fff8e9",
    textColor: "#3f3025",
    backgroundStyle: "cream",
    texture: "paper",
    font: "zcool",
    layout: "dynamic",
    effect: "none",
    density: "medium",
    accent: "marker",
    seed: 86
  },
  {
    id: "editorial",
    name: "杂志留白",
    note: "宋体 / 暖纸 / 波浪线",
    swatches: ["#f2eadb", "#17140f", "#b7492e"],
    bgColor: "#f2eadb",
    textColor: "#17140f",
    backgroundStyle: "solid",
    texture: "paper",
    font: "serif",
    layout: "editorial",
    effect: "none",
    density: "low",
    accent: "wave",
    seed: 142
  },
  {
    id: "newspaper",
    name: "报纸排版",
    note: "黑白 / 高密度 / 色块反白",
    swatches: ["#eee8da", "#17140f", "#cf332b"],
    bgColor: "#eee8da",
    textColor: "#17140f",
    backgroundStyle: "newsprint",
    texture: "paper",
    font: "serif",
    layout: "editorial",
    effect: "none",
    density: "high",
    accent: "reverse",
    seed: 221
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
    accent: "reverse",
    seed: 287
  },
  {
    id: "sticky",
    name: "便利贴风",
    note: "便签黄 / 随手记 / 波浪线",
    swatches: ["#fff37b", "#282313", "#ff6b73"],
    bgColor: "#fff37b",
    textColor: "#282313",
    backgroundStyle: "sticky",
    texture: "paper",
    font: "zcool",
    layout: "stacked",
    effect: "shadow",
    density: "medium",
    accent: "wave",
    seed: 344
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
    accent: "marker",
    seed: 413
  },
  {
    id: "aurora",
    name: "极光电波",
    note: "高饱和 / 光晕 / 反白",
    swatches: ["#5847ff", "#f4ff77", "#fff8ff"],
    bgColor: "#5847ff",
    textColor: "#fff8ff",
    backgroundStyle: "aurora",
    texture: "grain",
    font: "sans",
    layout: "stacked",
    effect: "glow",
    density: "high",
    accent: "reverse",
    seed: 608
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
    accent: "wave",
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
  const [accentStyle, setAccentStyle] = useState<AccentStyle>("marker");
  const [headerLeft, setHeaderLeft] = useState("#MixedType");
  const [headerRight, setHeaderRight] = useState("2026");
  const [footerLeft, setFooterLeft] = useState("Designed with everyday words");
  const [footerRight, setFooterRight] = useState("CN / EN / Emoji");
  const [previewZoom, setPreviewZoom] = useState(66);
  const [englishOverrides, setEnglishOverrides] = useState<Record<string, string>>({});
  const [lineOverrides, setLineOverrides] = useState<Record<number, LineOverride>>({});
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [translationStatus, setTranslationStatus] = useState<"idle" | "loading" | "error">("idle");
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "error">("idle");
  const [paletteStatus, setPaletteStatus] = useState("");
  const [seedHistory, setSeedHistory] = useState<number[]>([18]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [batchSeeds, setBatchSeeds] = useState<number[]>([]);
  const [draggedLine, setDraggedLine] = useState<number | null>(null);
  const [draftReady, setDraftReady] = useState(false);
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
        lineOverrides,
        accentStyle
      }),
    [accentStyle, density, englishOverrides, input, layoutStyle, lineOverrides, seed]
  );

  const applyStylePreset = useCallback((preset: PosterTheme) => {
    setBgColor(preset.bgColor);
    setTextColor(preset.textColor);
    setBackgroundStyle(preset.backgroundStyle);
    setTexture(preset.texture);
    setFontChoice(preset.font);
    setLayoutStyle(preset.layout);
    setTextEffect(preset.effect);
    setDensity(preset.density);
    setAccentStyle(preset.accent);
    setSeed(preset.seed);
    setBgImage(null);
    setBgImageName("");
    setPaletteStatus("");
    setSeedHistory((current) => [preset.seed, ...current.filter((item) => item !== preset.seed)].slice(0, MAX_SEED_HISTORY));
    setHistoryIndex(0);
  }, []);

  const updateLineOverride = useCallback((index: number, patch: LineOverride) => {
    setLineOverrides((current) => ({
      ...current,
      [index]: { ...current[index], ...patch }
    }));
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved) as Partial<{
          input: string;
          seed: number;
          bgColor: string;
          bgImage: string | null;
          bgImageName: string;
          textColor: string;
          density: Density;
          ratio: AspectRatio;
          fontSize: number;
          fontChoice: FontChoice;
          layoutStyle: LayoutStyle;
          backgroundStyle: BackgroundStyle;
          texture: TextureStyle;
          textEffect: TextEffect;
          accentStyle: AccentStyle;
          headerLeft: string;
          headerRight: string;
          footerLeft: string;
          footerRight: string;
          englishOverrides: Record<string, string>;
          lineOverrides: Record<number, LineOverride>;
          seedHistory: number[];
          historyIndex: number;
        }>;

        if (draft.input) setInput(draft.input);
        if (typeof draft.seed === "number") setSeed(draft.seed);
        if (draft.bgColor) setBgColor(draft.bgColor);
        if (draft.bgImage) setBgImage(draft.bgImage);
        if (draft.bgImageName) setBgImageName(draft.bgImageName);
        if (draft.textColor) setTextColor(draft.textColor);
        if (draft.density) setDensity(draft.density);
        if (draft.ratio) setRatio(draft.ratio);
        if (typeof draft.fontSize === "number") setFontSize(draft.fontSize);
        if (draft.fontChoice) setFontChoice(draft.fontChoice);
        if (draft.layoutStyle) setLayoutStyle(draft.layoutStyle);
        if (draft.backgroundStyle) setBackgroundStyle(draft.backgroundStyle);
        if (draft.texture) setTexture(draft.texture);
        if (draft.textEffect) setTextEffect(draft.textEffect);
        if (draft.accentStyle) setAccentStyle(draft.accentStyle);
        if (draft.headerLeft !== undefined) setHeaderLeft(draft.headerLeft);
        if (draft.headerRight !== undefined) setHeaderRight(draft.headerRight);
        if (draft.footerLeft !== undefined) setFooterLeft(draft.footerLeft);
        if (draft.footerRight !== undefined) setFooterRight(draft.footerRight);
        if (draft.englishOverrides) setEnglishOverrides(draft.englishOverrides);
        if (draft.lineOverrides) setLineOverrides(draft.lineOverrides);
        if (draft.seedHistory?.length) {
          const savedHistory = draft.seedHistory.slice(0, MAX_SEED_HISTORY);
          setSeedHistory(
            typeof draft.historyIndex === "number" || typeof draft.seed !== "number"
              ? savedHistory
              : [draft.seed, ...savedHistory.filter((item) => item !== draft.seed)].slice(
                  0,
                  MAX_SEED_HISTORY
                )
          );
        }
        if (typeof draft.historyIndex === "number") {
          setHistoryIndex(
            Math.max(
              0,
              Math.min(draft.historyIndex, (draft.seedHistory?.length ?? 1) - 1)
            )
          );
        }
      }
    } catch (error) {
      console.warn("Draft restore failed", error);
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;

    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            input,
            seed,
            bgColor,
            bgImage: bgImage && bgImage.length < 1_500_000 ? bgImage : null,
            bgImageName,
            textColor,
            density,
            ratio,
            fontSize,
            fontChoice,
            layoutStyle,
            backgroundStyle,
            texture,
            textEffect,
            accentStyle,
            headerLeft,
            headerRight,
            footerLeft,
            footerRight,
            englishOverrides,
            lineOverrides,
            seedHistory,
            historyIndex
          })
        );
      } catch (error) {
        console.warn("Draft save failed", error);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [
    accentStyle,
    backgroundStyle,
    bgColor,
    bgImage,
    bgImageName,
    density,
    draftReady,
    englishOverrides,
    fontChoice,
    fontSize,
    footerLeft,
    footerRight,
    headerLeft,
    headerRight,
    historyIndex,
    input,
    layoutStyle,
    lineOverrides,
    ratio,
    seed,
    seedHistory,
    textColor,
    textEffect,
    texture
  ]);

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
    const nextSeed = Math.floor(Math.random() * 100000);
    setSeed(nextSeed);
    setSeedHistory((current) =>
      [nextSeed, seed, ...current.filter((item) => item !== seed && item !== nextSeed)].slice(
        0,
        MAX_SEED_HISTORY
      )
    );
    setHistoryIndex(0);
  }, [seed]);

  const showPreviousSeed = useCallback(() => {
    const nextIndex = Math.min(historyIndex + 1, seedHistory.length - 1);
    if (nextIndex === historyIndex) return;
    setHistoryIndex(nextIndex);
    setSeed(seedHistory[nextIndex]);
  }, [historyIndex, seedHistory]);

  const generateBatch = useCallback(() => {
    const start = Math.floor(Math.random() * 90000) + 1000;
    setBatchSeeds(Array.from({ length: 6 }, (_, index) => start + index * 137));
  }, []);

  const chooseBatchSeed = useCallback(
    (nextSeed: number) => {
      setSeed(nextSeed);
      setSeedHistory((current) =>
        [nextSeed, seed, ...current.filter((item) => item !== seed && item !== nextSeed)].slice(
          0,
          MAX_SEED_HISTORY
        )
      );
      setHistoryIndex(0);
      setBatchSeeds([]);
    },
    [seed]
  );

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

  const loadBackgroundFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = typeof reader.result === "string" ? reader.result : null;
      setBgImage(imageUrl);
      setBgImageName(file.name);
      setBackgroundStyle("solid");
      if (!imageUrl) return;

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 48;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, size, size);
        const pixels = context.getImageData(0, 0, size, size).data;
        const color = extractDominantColor(pixels);
        const foreground = pickReadableTextColor(color);
        setBgColor(color);
        setTextColor(foreground);
        setPaletteStatus(`已取色 ${color}，文字对比度 ${contrastRatio(color, foreground).toFixed(1)}:1`);
      };
      image.src = imageUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  const uploadBackgroundImage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    loadBackgroundFile(file);
    event.target.value = "";
  }, [loadBackgroundFile]);

  const removeBackgroundImage = useCallback(() => {
    setBgImage(null);
    setBgImageName("");
    setPaletteStatus("");
  }, []);

  const reorderLine = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const items = splitEditableLines(input);
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      setInput(items.join("\n"));
      setLineOverrides({});
      setSelectedLine(toIndex);
    },
    [input]
  );

  if (!draftReady) {
    return (
      <main className={styles.app}>
        <div className={styles.draftLoading} role="status">
          正在恢复上次草稿…
        </div>
      </main>
    );
  }

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
                headerLeft={headerLeft}
                headerRight={headerRight}
                footerLeft={footerLeft}
                footerRight={footerRight}
                selectedLine={selectedLine}
                onSelectLine={setSelectedLine}
                draggedLine={draggedLine}
                onDragStart={setDraggedLine}
                onDragEnd={() => setDraggedLine(null)}
                onDropLine={(index) => {
                  if (draggedLine !== null) reorderLine(draggedLine, index);
                  setDraggedLine(null);
                }}
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
            <div className={styles.stageTools}>
              <button
                className={styles.canvasHint}
                type="button"
                onClick={showPreviousSeed}
                disabled={historyIndex >= seedHistory.length - 1}
              >
                <BackIcon />
                <span>上一张</span>
              </button>
              <button className={styles.canvasHint} type="button" onClick={() => setPreviewZoom(66)}>
                <FrameIcon />
                <span>适应画布</span>
              </button>
            </div>
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
              <button className={styles.secondaryButton} onClick={showPreviousSeed} disabled={historyIndex >= seedHistory.length - 1}>
                <BackIcon />
                上一张
              </button>
              <button className={styles.secondaryButton} onClick={generateBatch}>
                <GridIcon />
                批量海选
              </button>
            </div>

            {batchSeeds.length > 0 ? (
              <div className={styles.batchPicker}>
                <div className={styles.batchHeader}>
                  <strong>选择一个版式继续编辑</strong>
                  <button type="button" onClick={() => setBatchSeeds([])}>关闭</button>
                </div>
                <div className={styles.batchGrid}>
                  {batchSeeds.map((batchSeed) => (
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`选择版式 ${batchSeed}`}
                      key={batchSeed}
                      onClick={() => chooseBatchSeed(batchSeed)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          chooseBatchSeed(batchSeed);
                        }
                      }}
                    >
                      <PosterThumbnail
                        input={input}
                        seed={batchSeed}
                        density={density}
                        englishOverrides={englishOverrides}
                        layoutStyle={layoutStyle}
                        accentStyle={accentStyle}
                        bgColor={bgColor}
                        bgImage={bgImage}
                        textColor={textColor}
                        fontSize={fontSize}
                        fontFamily={FONT_FAMILIES[fontChoice]}
                        backgroundStyle={backgroundStyle}
                        texture={texture}
                        textEffect={textEffect}
                        ratio={ratio}
                        headerLeft={headerLeft}
                        headerRight={headerRight}
                        footerLeft={footerLeft}
                        footerRight={footerRight}
                        lineOverrides={lineOverrides}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

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
                    setSeedHistory((current) =>
                      [example.seed, seed, ...current.filter((item) => item !== seed && item !== example.seed)].slice(
                        0,
                        MAX_SEED_HISTORY
                      )
                    );
                    setHistoryIndex(0);
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
            <SectionHeading number="02" title="一键风格主题" />
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

          <section className={styles.panelSection}>
            <SectionHeading number="05" title="页眉页脚" />
            <div className={styles.metaGrid}>
              <label className={styles.control}>
                <span>左上</span>
                <input type="text" value={headerLeft} onChange={(event) => setHeaderLeft(event.target.value)} />
              </label>
              <label className={styles.control}>
                <span>右上</span>
                <input type="text" value={headerRight} onChange={(event) => setHeaderRight(event.target.value)} />
              </label>
              <label className={styles.control}>
                <span>左下</span>
                <input type="text" value={footerLeft} onChange={(event) => setFooterLeft(event.target.value)} />
              </label>
              <label className={styles.control}>
                <span>右下</span>
                <input type="text" value={footerRight} onChange={(event) => setFooterRight(event.target.value)} />
              </label>
            </div>
          </section>

          <section className={`${styles.panelSection} ${styles.styleSection}`}>
            <SectionHeading number="06" title="样式" />
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
                  <option value="cream">奶油柔光</option>
                  <option value="sunset">日落渐变</option>
                  <option value="ocean">深海渐变</option>
                  <option value="night">午夜光晕</option>
                  <option value="aurora">极光渐变</option>
                  <option value="newsprint">报纸底纹</option>
                  <option value="sticky">便利贴黄</option>
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

              <label className={styles.control}>
                <span>关键词强调</span>
                <select
                  value={accentStyle}
                  onChange={(event) => setAccentStyle(event.target.value as AccentStyle)}
                >
                  <option value="marker">马克笔涂抹</option>
                  <option value="reverse">色块反白</option>
                  <option value="wave">波浪下划线</option>
                  <option value="none">关闭强调</option>
                </select>
              </label>

              <label className={`${styles.control} ${styles.imageControl}`}>
                <span>背景图片</span>
                <div
                  className={styles.imageUpload}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const file = event.dataTransfer.files?.[0];
                    if (file?.type.startsWith("image/")) loadBackgroundFile(file);
                  }}
                >
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
                {paletteStatus ? (
                  <small className={styles.paletteStatus}>{paletteStatus}</small>
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
      <label className={styles.control}>
        <span>本行强调</span>
        <select
          value={override?.accent ?? line.accent}
          onChange={(event) => onChange({ accent: event.target.value as AccentStyle })}
        >
          <option value="none">不强调</option>
          <option value="marker">马克笔涂抹</option>
          <option value="reverse">色块反白</option>
          <option value="wave">波浪下划线</option>
        </select>
      </label>
      <small className={styles.dragHint}>也可以直接拖动海报中的文字行调整顺序</small>
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

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" />
      <rect x="14" y="4" width="6" height="6" />
      <rect x="4" y="14" width="6" height="6" />
      <rect x="14" y="14" width="6" height="6" />
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
  headerLeft,
  headerRight,
  footerLeft,
  footerRight,
  selectedLine,
  onSelectLine,
  draggedLine = null,
  onDragStart,
  onDragEnd,
  onDropLine,
  interactive = true
}: {
  refNode?: React.RefObject<HTMLDivElement | null>;
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
  headerLeft: string;
  headerRight: string;
  footerLeft: string;
  footerRight: string;
  selectedLine: number | null;
  onSelectLine?: (index: number) => void;
  draggedLine?: number | null;
  onDragStart?: (index: number) => void;
  onDragEnd?: () => void;
  onDropLine?: (index: number) => void;
  interactive?: boolean;
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
        "--poster-pad": preset.pad,
        "--poster-text-color": textColor,
        "--accent-contrast": pickReadableTextColor(textColor)
      } as React.CSSProperties}
    >
      <div className={styles.posterTopline}>
        <span>{headerLeft}</span>
        <span>{headerRight}</span>
      </div>
      <div className={styles.posterText}>
        {lines.map((line, index) => {
          const accentClass =
            line.accent === "marker"
              ? styles.accentMarker
              : line.accent === "reverse"
                ? styles.accentReverse
                : line.accent === "wave"
                  ? styles.accentWave
                  : "";
          return (
          <div
            role={interactive ? "button" : undefined}
            key={`${line.label}-${index}-${line.english}`}
            className={`${styles.posterLine} ${styles.posterLineButton} ${draggedLine === index ? styles.draggingLine : ""}`}
            aria-label={interactive ? `编辑第 ${index + 1} 行：${line.label}` : undefined}
            aria-pressed={interactive ? selectedLine === index : undefined}
            onClick={() => onSelectLine?.(index)}
            draggable={interactive}
            onDragStart={() => onDragStart?.(index)}
            onDragEnd={onDragEnd}
            onDragOver={(event) => {
              if (interactive) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              onDropLine?.(index);
            }}
            tabIndex={interactive ? 0 : undefined}
            onKeyDown={(event) => {
              if (interactive && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                onSelectLine?.(index);
              }
            }}
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
            <span className={`${styles.lineContent} ${accentClass}`}>
              {line.fragments.map((fragment, fragmentIndex) =>
                fragment.type === "emoji" ? (
                  <span className={styles.emoji} key={`${fragment.value}-${fragmentIndex}`}>
                    {fragment.value}
                  </span>
                ) : (
                  <span key={`${fragment.value}-${fragmentIndex}`}>{fragment.value}</span>
                )
              )}
            </span>
          </div>
          );
        })}
      </div>
      <div className={styles.posterFoot}>
        <span>{footerLeft}</span>
        <span>{footerRight}</span>
      </div>
    </div>
  );
}

function PosterThumbnail({
  input,
  seed,
  density,
  englishOverrides,
  layoutStyle,
  accentStyle,
  bgColor,
  bgImage,
  textColor,
  fontSize,
  fontFamily,
  backgroundStyle,
  texture,
  textEffect,
  ratio,
  headerLeft,
  headerRight,
  footerLeft,
  footerRight,
  lineOverrides
}: {
  input: string;
  seed: number;
  density: Density;
  englishOverrides: Record<string, string>;
  layoutStyle: LayoutStyle;
  accentStyle: AccentStyle;
  bgColor: string;
  bgImage: string | null;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  backgroundStyle: BackgroundStyle;
  texture: TextureStyle;
  textEffect: TextEffect;
  ratio: AspectRatio;
  headerLeft: string;
  headerRight: string;
  footerLeft: string;
  footerRight: string;
  lineOverrides: Record<number, LineOverride>;
}) {
  const thumbnailLines = useMemo(
    () =>
      buildPosterLines(input, {
        density,
        seed,
        englishOverrides,
        layoutStyle,
        accentStyle,
        lineOverrides
      }),
    [accentStyle, density, englishOverrides, input, layoutStyle, lineOverrides, seed]
  );

  return (
    <PosterCanvas
      lines={thumbnailLines}
      bgColor={bgColor}
      bgImage={bgImage}
      textColor={textColor}
      fontSize={fontSize}
      fontFamily={fontFamily}
      backgroundStyle={backgroundStyle}
      texture={texture}
      textEffect={textEffect}
      layoutStyle={layoutStyle}
      ratio={ratio}
      headerLeft={headerLeft}
      headerRight={headerRight}
      footerLeft={footerLeft}
      footerRight={footerRight}
      selectedLine={null}
      interactive={false}
    />
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

function splitEditableLines(value: string) {
  return value
    .split(/[\n,，;；、]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 16);
}

function extractDominantColor(pixels: Uint8ClampedArray) {
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = pixels[index + 3];
    if (alpha < 180) continue;
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max > 245 && min > 238) continue;
    const key = `${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`;
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  let dominant = { count: 1, r: 128, g: 128, b: 128 };
  for (const bucket of buckets.values()) {
    if (bucket.count > dominant.count) dominant = bucket;
  }

  return rgbToHex(
    Math.round(dominant.r / dominant.count),
    Math.round(dominant.g / dominant.count),
    Math.round(dominant.b / dominant.count)
  );
}

function pickReadableTextColor(background: string) {
  const dark = "#111111";
  const light = "#ffffff";
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string) {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [0, 0, 0];
  const [r, g, b] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0"))
    .join("")}`;
}
