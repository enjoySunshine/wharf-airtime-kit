wharf-airtime-kit

npm run build

## 赛事直播 · 绝对时间清单与播控板

播出服务器吃的是 `manifest.json`；播控板（`board/`）读的是同一次解析生成的
`board/manifest.js`。清单上的绝对时间一改，两处一起变——它们由同一趟解析写出：

```
npm run build:board      # 解析 playlists/ → manifest.json + board/manifest.js
npm run verify:airtime   # 逐格核对各场绝对时间，并检查两份清单是同一份数
npm run test:offline     # 不装依赖跑项目测试（qunit 用替身，解析器是 src/ 真代码）
```

改完 `playlists/` 下的播放列表后重跑 `build:board`，刷新 `board/index.html`
（本地直接打开即可）即可逐格对照。

### 目录

- `playlists/` 各场的媒体播放列表（解析输入）
- `src/parser.js` 清单解析（播出服务器吃的就是这份解析；不引入 hls.js / dash.js / shaka-player）
- `manifest.json` 播出服务器消费的解析清单（生成物）
- `board/` 播控板页面：`index.html` + `board.js` + `styles.css`，数据在 `manifest.js`（生成物）
- `scripts/build-board.mjs` 同一趟解析写出两份清单
- `scripts/verify-airtime.mjs` 逐格核对
- `scripts/offline/` 离线跑测试的钩子与替身

### 绝对时间口径

1. `EXT-X-PROGRAM-DATE-TIME` 是下一段的锚点；标签和段之间隔着
   `EXT-X-DISCONTINUITY` 行也不改归属。
2. 同一条钟内：下一段 = 上一段 + 播放列表写下的 `EXTINF` 时长。
3. 同一条钟内允许倒推：锚点前的段 = 后一段 − 自己写下的时长。
4. `EXT-X-DISCONTINUITY` 切钟：不跨刀顺推，也不跨刀倒推；没有锚点的钟整段留空。
5. `EXT-X-DISCONTINUITY-SEQUENCE` 只是接着计的序号，不切钟。
6. `EXTINF` 写成 0 的垫片：绝对时间按单子上的 0 秒走（下一段与垫片同刻）；
   交给播放器的时长仍是 0.01 秒（段上另记 `playlistDuration: 0`），两个数同时守住。
7. 末尾只有 `EXT-X-PART`、地址还没写出来的段：和前一段同属一条钟就带上自己的
   绝对时间；刚切过信号、新锚点还没来则留空。
