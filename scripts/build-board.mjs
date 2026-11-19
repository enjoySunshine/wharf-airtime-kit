/**
 * 用 src/ 里的真实解析器解析 playlists/ 下的各场播放列表，
 * 同一趟解析写出两份文件，保证清单上的绝对时间一改，两处一起变：
 *
 *   manifest.json       播出服务器吃的解析清单
 *   board/manifest.js   播控板读的同一份清单（本地打开也能用）
 *
 * 用法：node scripts/build-board.mjs
 */
import {register} from 'node:module';

register('./offline/hooks.mjs', import.meta.url);

const {default: Parser} = await import('../src/parser.js');
const {readFileSync, writeFileSync} = await import('node:fs');
const path = await import('node:path');
const {fileURLToPath} = await import('node:url');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FEEDS = [
  {
    file: '01-first-half.m3u8',
    title: '上半场 · 连续三段',
    note: 'EXT-X-DISCONTINUITY-SEQUENCE:3 只是序号接着计，不切钟；三段沿同一条钟顺推。'
  },
  {
    file: '02-halftime-cut.m3u8',
    title: '中场一刀 · 刀后无新标签',
    note: 'EXT-X-DISCONTINUITY 之后没有新的绝对时间标签：刀后两段留空，刀前的钟停在刀前最后一段。'
  },
  {
    file: '03-tag-after-cut.m3u8',
    title: '另一场 · 标签在刀后第一段',
    note: '刀前两段留空（不跨刀倒推）；刀后从标签写下的 18:00:00.000 起走。'
  },
  {
    file: '04-tag-on-second-after-cut.m3u8',
    title: '标签在刀后第二段',
    note: '刀前一段留空；刀后 8 秒段与锚点同一条钟，倒推为 17:59:52.000。'
  },
  {
    file: '05-tag-before-cut.m3u8',
    title: '标签紧挨切换标记前',
    note: '标签落在刀后第一段上：刀前一段留空，刀后从 18:00:00.000 起走。'
  },
  {
    file: '06-zero-filler-forward.m3u8',
    title: '垫片 EXTINF 0 · 顺推',
    note: '绝对时间按播放列表写下的 0 秒走，垫片后一段不晚 10 毫秒；播放器拿到的时长仍是 0.01 秒。'
  },
  {
    file: '07-zero-filler-backfill.m3u8',
    title: '垫片 EXTINF 0 · 倒着补',
    note: '0 秒垫片不占时间，与后一段同刻 12:00:10.000；播放器拿到的时长仍是 0.01 秒。'
  },
  {
    file: '08-live-parts-same-timeline.m3u8',
    title: '直播末尾 · 仅 EXT-X-PART（同一条钟）',
    note: '地址还没写出来的最后一段与前一段同一条钟，必须带上自己的绝对时间 12:00:04.000。'
  },
  {
    file: '09-live-parts-after-cut.m3u8',
    title: '先切信号 · 仅 EXT-X-PART',
    note: '先切了信号、新的绝对时间还没出现，末尾只有 part 的段留空。'
  },
  {
    file: '10-second-tag-mid-timeline.m3u8',
    title: '锚点后又写了一个新标签',
    note: '同一条钟上又来了一个标签：第二段起按 12:00:20.500 走，多出的 500 毫秒是单子上写的。'
  },
  {
    file: '11-late-tag.m3u8',
    title: '标签来得晚 · 无切换',
    note: '标签在第三段，中间没有切换：前两段在同一条钟上倒推。'
  }
];

const feeds = FEEDS.map(({file, title, note}) => {
  const parser = new Parser();

  parser.push(readFileSync(path.join(ROOT, 'playlists', file), 'utf8'));
  parser.end();

  return {
    id: file.replace(/\.m3u8$/, ''),
    title,
    note,
    source: `playlists/${file}`,
    manifest: parser.manifest
  };
});

const playoutManifest = {
  generatedAt: new Date().toISOString(),
  feeds
};

const json = JSON.stringify(playoutManifest, null, 2);

writeFileSync(path.join(ROOT, 'manifest.json'), `${json}\n`);
writeFileSync(path.join(ROOT, 'board', 'manifest.js'), `window.PLAYOUT_MANIFEST = ${json};\n`);

console.log(`已解析 ${feeds.length} 场：manifest.json（播出服务器）与 board/manifest.js（播控板）同趟生成。`);
