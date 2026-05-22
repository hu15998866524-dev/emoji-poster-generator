# Emoji Poster Generator

一个 Next.js 小工具，用中文关键词生成带英文匹配和 emoji 的海报式排版。

## 运行

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:3000` 或终端提示的本地地址。

如果开发服务开着时又执行过 `npm run build`，页面可能会因为 Next 缓存混用报错。恢复方式：

```bash
rm -rf .next
npm run dev
```

## 功能

- 输入中文关键词，按换行、逗号、顿号拆成关键词，并自动匹配英文；常用词优先用本地映射，其他中文会通过在线翻译接口补英文
- 自动补 `#`、匹配语义 emoji，并把 emoji 插入到文字中间
- 支持背景色、文字色、emoji 密度、字体大小控制
- 支持 9:16 手机海报和 16:9 横版封面
- 支持随机重排和导出 PNG
