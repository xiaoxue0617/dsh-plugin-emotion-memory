# dsh-plugin-emotion-memory

> **Source-available**: free for personal and non-commercial use; commercial use requires a license.
> 源码公开、非商业使用；商用需授权。详见 [LICENSE](./LICENSE)。

Emotional memory and mood for [DeepSeek Harness](https://github.com/deepseek-ai) (DSH).
It remembers moments that carried feeling, lets them fade over time, and quietly adds the ones that still matter to every turn.

- **Local only** — no network, no telemetry, no API keys
- **No dependencies** — plain ESM, runs inside the DSH host
- **Two effects** — four tools for the model, plus one small block of context per turn

## Download

| Source | URL |
| --- | --- |
| jsDelivr (fast in CN) | `https://cdn.jsdelivr.net/gh/xiaoxue0617/dsh-plugin-emotion-memory@v1.0.0/dist/dsh-plugin-emotion-memory-1.0.0.tgz` |
| Gitee | `https://gitee.com/xiaoxue0617/dsh-plugin-emotion-memory/raw/main/dist/dsh-plugin-emotion-memory-1.0.0.tgz` |
| GitHub | `https://raw.githubusercontent.com/xiaoxue0617/dsh-plugin-emotion-memory/main/dist/dsh-plugin-emotion-memory-1.0.0.tgz` |

The tarball also lives in this repo at `dist/dsh-plugin-emotion-memory-1.0.0.tgz`.

## Install

Ask DSH to install the tarball path:

```
install this DSH plugin: <path to dsh-plugin-emotion-memory-1.0.0.tgz>
```

Or: Settings → Plugins → Install bundle → pick the `.tgz`.

Requires a DSH build that supports plugin bundles.

## Tools

| Tool | Purpose |
| --- | --- |
| `emotion_remember` | Store a meaningful moment: `text`, `emotion`, `intensity` (1–5), optional `people` |
| `emotion_recall` | Retrieve memories by keyword; recalled entries gain weight |
| `emotion_mood` | Read or set the current mood |
| `emotion_forget` | Delete one memory by id |

## Behaviour

Each turn, DSH gets a small block like:

```
## 情感记忆（本地存储）
- 当前心情：开心（强度 3/5）
- 还记得这些事：
- 2026/11/1 今天装好了插件，我挺开心（开心 · 3）
用法：自然想起、自然提一句，不要逐条背诵…
```

Decay and limits:

| Rule | Default |
| --- | --- |
| Memory half-life | 21 days |
| Mood half-life | 3 days (drifts back to calm) |
| Recall boost | +15% weight per hit |
| Max memories | 200 |
| Injected per turn | top 8 |

## Data

```
<user home>/.dsh/emotion-memory.json
```

Plain JSON. Delete the file to wipe everything; the plugin recreates it.

## Configuration

The bundle patch ships sensible defaults:

```yaml
- insert:
    - id: emotion-memory
      name: 'dsh-plugin-emotion-memory'
      config:
        halfLifeDays: 21
        maxMemories: 200
        injectLimit: 8
```

`storeFile` can point the JSON elsewhere.

## Why two separate ideas

- **Memory** answers "what happened that mattered" — event-shaped, decays slowly.
- **Mood** answers "how do I feel right now" — state-shaped, decays fast.

Keeping them apart means a strong memory does not permanently pin the mood, and a good mood does not erase what hurt.

## License

**非商业使用许可（附署名与免责）v1.0** — see [LICENSE](./LICENSE).

| 允许 | 要求 | 禁止 |
| --- | --- | --- |
| 个人使用、修改、非商业分发 | 保留版权声明与许可全文 | 任何商业用途 |
| 学术研究、公益项目 | 注明原作者与项目地址 | 移除署名、谎称原创 |
| 打包进非营利作品集 | 修改版须标注「基于…修改」 | 收费 SaaS、代部署收费 |

**商业使用需事先取得书面授权**，联系方式见 LICENSE 文件。

## Attribution

If you redistribute this plugin or a modified version, keep this notice:

```
dsh-plugin-emotion-memory
Copyright (c) 2026 小雪
Licensed under the Non-Commercial License v1.0 (attribution required, commercial use prohibited).
```

## Disclaimer

本软件按「现状」提供，不附带任何担保。作者不对使用本软件造成的任何损失负责，包括数据丢失、设备损坏、账号异常、业务中断或第三方索赔。

使用前请自行备份数据，并确认你的部署环境与使用场景符合当地法律法规。完整免责条款见 [LICENSE](./LICENSE) 第五节。

## 商业授权

如需在商业产品、收费服务或营利性业务中使用，请先联系作者取得书面授权（联系方式见 LICENSE）。
