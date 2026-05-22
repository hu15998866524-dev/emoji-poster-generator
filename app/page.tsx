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
const DEFAULT_FONT_SIZE_BY_RATIO: Record<AspectRatio, number> = {
  "9:16": 40,
  "16:9": 40
};

export default function Home() {
  const [input, setInput] = useState(DEFAULT_TEXT);
  const [seed, setSeed] = useState(18);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#111111");
  const [density, setDensity] = useState<Density>("medium");
  const [ratio, setRatio] = useState<AspectRatio>("9:16");
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE_BY_RATIO[ratio]);
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

  return (
    <main className={styles.app}>
      <section className={styles.stage} aria-label="海报预览">
        <div
          className={`${styles.posterFrame} ${ratio === "16:9" ? styles.landscape : ""}`}
        >
          <PosterCanvas
            refNode={posterRef}
            lines={lines}
            bgColor={bgColor}
            textColor={textColor}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            ratio={ratio}
          />
        </div>
      </section>

      <aside className={styles.studio} aria-label="海报控制台">
        <div className={styles.brandBlock}>
          <p>Emoji Poster Generator</p>
          <h1>文字封面生成器</h1>
        </div>

        <label className={styles.inputBlock}>
          <span>输入文案</span>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入中文关键词，每行、逗号或顿号都会参与拆分，英文会自动匹配"
          />
        </label>

        <div className={styles.actions}>
          <button className={styles.primaryButton} onClick={generateFromTextarea}>
            生成
          </button>
          <button className={styles.secondaryButton} onClick={randomize}>
            随机重排
          </button>
          <button className={styles.secondaryButton} onClick={exportPng}>
            导出 PNG
          </button>
        </div>

        <div className={styles.controlGrid}>
          <ColorControl label="背景颜色" value={bgColor} onChange={setBgColor} />
          <ColorControl label="文字颜色" value={textColor} onChange={setTextColor} />

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

          <label className={styles.control}>
            <span>画布比例</span>
            <select
              value={ratio}
              onChange={(event) => {
                const nextRatio = event.target.value as AspectRatio;
                setRatio(nextRatio);
                setFontSize(DEFAULT_FONT_SIZE_BY_RATIO[nextRatio]);
              }}
            >
              <option value="9:16">9:16 手机海报</option>
              <option value="16:9">16:9 横版封面</option>
            </select>
          </label>
        </div>

        <label className={styles.slider}>
          <span>字体大小</span>
          <strong>{fontSize}px</strong>
          <input
            type="range"
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.target.value))}
          />
        </label>

        <div className={styles.examples}>
          {examples.map((example) => (
            <button
              key={example.name}
              onClick={() => {
                setInput(example.text);
                setSeed(example.seed);
              }}
            >
              {example.name}
            </button>
          ))}
        </div>
      </aside>
    </main>
  );
}

function PosterCanvas({
  refNode,
  lines,
  bgColor,
  textColor,
  fontSize,
  onFontSizeChange,
  ratio
}: {
  refNode: React.RefObject<HTMLDivElement | null>;
  lines: PosterLine[];
  bgColor: string;
  textColor: string;
  fontSize: number;
  onFontSizeChange: (value: number) => void;
  ratio: AspectRatio;
}) {
  const preset = posterPresets[ratio];

  const startFontResize = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);

      const startX = event.clientX;
      const startY = event.clientY;
      const startSize = fontSize;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const dragDelta = (moveEvent.clientX - startX + moveEvent.clientY - startY) * 0.24;
        const nextSize = Math.round(startSize + dragDelta);
        onFontSizeChange(clamp(nextSize, MIN_FONT_SIZE, MAX_FONT_SIZE));
      };

      const stopResize = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", stopResize);
        window.removeEventListener("pointercancel", stopResize);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopResize);
      window.addEventListener("pointercancel", stopResize);
    },
    [fontSize, onFontSizeChange]
  );

  return (
    <div className={styles.canvasShell}>
      <div
        ref={refNode}
        className={`${styles.poster} ${ratio === "16:9" ? styles.posterLandscape : ""}`}
        style={{
          backgroundColor: bgColor,
          color: textColor,
          aspectRatio: ratio === "9:16" ? "9 / 16" : "16 / 9",
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
      <button
        type="button"
        className={styles.resizeHandle}
        onPointerDown={startFontResize}
        aria-label="拖动调整字体大小"
        title="拖动调整字体大小"
      />
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
