"use client";

import { toPng } from "html-to-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AspectRatio,
  Density,
  PosterLine,
  buildPosterLines,
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
const RATIO_OPTIONS: AspectRatio[] = ["9:16", "2:3", "3:4", "1:1", "4:3", "3:2", "16:9"];

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
  const [previewZoom, setPreviewZoom] = useState(66);
  const [englishOverrides, setEnglishOverrides] = useState<Record<string, string>>({});
  const posterRef = useRef<HTMLDivElement>(null);
  const labelsNeedingEnglish = useMemo(() => getLabelsNeedingEnglish(input), [input]);
  const labelsNeedingEnglishKey = labelsNeedingEnglish.join("\n");

  const lines = useMemo(
    () => buildPosterLines(input, { density, seed, englishOverrides }),
    [density, englishOverrides, input, seed]
  );

  useEffect(() => {
    const missingLabels = labelsNeedingEnglish.filter((label) => !englishOverrides[label]);
    if (missingLabels.length === 0) return;

    const controller = new AbortController();

    async function translateMissingLabels() {
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: missingLabels }),
          signal: controller.signal
        });

        if (!response.ok) return;

        const data = (await response.json()) as { translations?: Record<string, string> };
        if (!data.translations) return;

        setEnglishOverrides((current) => ({
          ...current,
          ...data.translations
        }));
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("Auto translation failed", error);
        }
      }
    }

    translateMissingLabels();

    return () => controller.abort();
  }, [englishOverrides, labelsNeedingEnglish, labelsNeedingEnglishKey]);

  const randomize = useCallback(() => {
    setSeed(Math.floor(Math.random() * 100000));
  }, []);

  const generateFromTextarea = useCallback(() => {
    randomize();
  }, [randomize]);

  const exportPng = useCallback(async () => {
    if (!posterRef.current) return;
    const dataUrl = await toPng(posterRef.current, {
      cacheBust: true,
      pixelRatio: 2.5,
      backgroundColor: bgColor
    });
    const link = document.createElement("a");
    link.download = `emoji-poster-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [bgColor]);

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
          <span>v0.2</span>
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
                ratio={ratio}
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
                onChange={(event) => setInput(event.target.value)}
                placeholder="每行输入一个关键词，英文会自动匹配"
              />
              <small>{input.length} / 500</small>
            </label>

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
                  }}
                >
                  <strong>{example.name}</strong>
                  <span>{example.text.split("\n").slice(0, 2).join(" / ")}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.panelSection}>
            <SectionHeading number="02" title="画布" />
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

          <section className={`${styles.panelSection} ${styles.styleSection}`}>
            <SectionHeading number="03" title="样式" />
            <div className={styles.controlGrid}>
              <ColorControl label="背景颜色" value={bgColor} onChange={setBgColor} />
              <ColorControl label="文字颜色" value={textColor} onChange={setTextColor} />

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
              <button className={styles.exportButton} onClick={exportPng}>
                <DownloadIcon />
                导出 PNG
              </button>
            </div>
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
  ratio
}: {
  refNode: React.RefObject<HTMLDivElement | null>;
  lines: PosterLine[];
  bgColor: string;
  bgImage: string | null;
  textColor: string;
  fontSize: number;
  ratio: AspectRatio;
}) {
  const preset = posterPresets[ratio];
  const isLandscape = preset.orientation === "landscape";

  return (
    <div
      ref={refNode}
      className={`${styles.poster} ${isLandscape ? styles.posterLandscape : ""}`}
      style={{
        backgroundColor: bgColor,
        backgroundImage: bgImage ? `url("${bgImage}")` : undefined,
        backgroundPosition: "center",
        backgroundSize: "cover",
        color: textColor,
        aspectRatio: preset.cssAspectRatio,
        "--base-font-size": `${fontSize}px`,
        "--poster-pad": preset.pad
      } as React.CSSProperties}
    >
      <div className={styles.posterTopline}>
        <span>#MixedType</span>
        <span>2026</span>
      </div>
      <div className={styles.posterText}>
        {lines.map((line, index) => (
          <div
            key={`${line.label}-${index}-${line.english}`}
            className={styles.posterLine}
            style={{
              "--line-size": line.size,
              "--line-width": line.width,
              "--line-indent": line.indent,
              "--line-leading": line.leading,
              "--line-opacity": line.opacity
            } as React.CSSProperties}
          >
            {line.fragments.map((fragment, fragmentIndex) =>
              fragment.type === "emoji" ? (
                <span className={styles.emoji} key={`${fragment.value}-${fragmentIndex}`}>
                  {fragment.value}
                </span>
              ) : (
                <span key={`${fragment.value}-${fragmentIndex}`}>{fragment.value}</span>
              )
            )}
          </div>
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
