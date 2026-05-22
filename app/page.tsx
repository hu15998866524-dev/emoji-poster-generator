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
      <section className={styles.stage} aria-label="海报预览">
        <div
          className={`${styles.posterFrame} ${
            posterPresets[ratio].orientation === "landscape" ? styles.landscape : ""
          } ${posterPresets[ratio].orientation === "square" ? styles.square : ""}`}
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

          <label className={`${styles.control} ${styles.imageControl}`}>
            <span>背景图片</span>
            <div className={styles.imageUploadRow}>
              <input type="file" accept="image/*" onChange={uploadBackgroundImage} />
              {bgImage ? (
                <button type="button" onClick={removeBackgroundImage}>
                  移除
                </button>
              ) : null}
            </div>
            <small>{bgImageName || "未上传图片"}</small>
          </label>

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
                setFontSize(posterPresets[nextRatio].defaultFontSize);
              }}
            >
              {RATIO_OPTIONS.map((option) => (
                <option value={option} key={option}>
                  {posterPresets[option].label}
                </option>
              ))}
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
