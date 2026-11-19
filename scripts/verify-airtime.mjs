/**
 * 逐格核对：播出服务器吃的 manifest.json 与播控板读的 board/manifest.js
 * 必须是同一份数，且每场的绝对时间与播控台量过的口径一致。
 *
 * 用法：node scripts/verify-airtime.mjs
 * （先跑 node scripts/build-board.mjs 生成清单）
 */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 每场每一格应有的绝对时间（null = 留空）
const EXPECTED = {
  '01-first-half': [
    '2024-03-01T12:00:00.000Z',
    '2024-03-01T12:00:10.000Z',
    '2024-03-01T12:00:20.000Z'
  ],
  '02-halftime-cut': [
    '2024-03-01T12:00:00.000Z',
    '2024-03-01T12:00:10.000Z',
    null,
    null
  ],
  '03-tag-after-cut': [
    null,
    null,
    '2024-03-01T18:00:00.000Z',
    '2024-03-01T18:00:10.000Z'
  ],
  '04-tag-on-second-after-cut': [
    null,
    '2024-03-01T17:59:52.000Z',
    '2024-03-01T18:00:00.000Z',
    '2024-03-01T18:00:10.000Z'
  ],
  '05-tag-before-cut': [
    null,
    '2024-03-01T18:00:00.000Z',
    '2024-03-01T18:00:10.000Z'
  ],
  '06-zero-filler-forward': [
    '2024-03-01T12:00:00.000Z',
    '2024-03-01T12:00:10.000Z',
    '2024-03-01T12:00:10.000Z'
  ],
  '07-zero-filler-backfill': [
    '2024-03-01T12:00:10.000Z',
    '2024-03-01T12:00:10.000Z'
  ],
  '08-live-parts-same-timeline': [
    '2024-03-01T12:00:00.000Z',
    '2024-03-01T12:00:04.000Z'
  ],
  '09-live-parts-after-cut': [
    '2024-03-01T12:00:00.000Z',
    null
  ],
  '10-second-tag-mid-timeline': [
    '2024-03-01T12:00:00.000Z',
    '2024-03-01T12:00:20.500Z',
    '2024-03-01T12:00:30.500Z'
  ],
  '11-late-tag': [
    '2024-03-01T12:00:00.000Z',
    '2024-03-01T12:00:10.000Z',
    '2024-03-01T12:00:16.000Z'
  ]
};

// 垫片：播放器拿到的时长必须是 0.01 秒，播放列表写下的必须是 0 秒
const FILLERS = {
  '06-zero-filler-forward': 1,
  '07-zero-filler-backfill': 0
};

let failures = 0;

const check = (label, actual, expected) => {
  const pass = actual === expected;

  if (!pass) {
    failures++;
  }
  const show = (v) => (v === null || v === undefined ? '（空）' : v);

  console.log(`  ${pass ? '✓' : '✗'} ${label}: ${show(actual)}${pass ? '' : `  应为 ${show(expected)}`}`);
};

const iso = (ms) => (typeof ms === 'number' ? new Date(ms).toISOString() : null);

// 一场的格子 = 正式段 + 末尾还没出地址的 preloadSegment
const rowsOf = (feed) => {
  const rows = feed.manifest.segments.slice();

  if (feed.manifest.preloadSegment) {
    rows.push(feed.manifest.preloadSegment);
  }
  return rows;
};

const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

manifest.feeds.forEach((feed) => {
  const expected = EXPECTED[feed.id];

  console.log(`${feed.id} · ${feed.title}`);

  if (!expected) {
    failures++;
    console.log('  ✗ 核对表里没有这一场');
    return;
  }

  const rows = rowsOf(feed);

  if (rows.length !== expected.length) {
    failures++;
    console.log(`  ✗ 格子数 ${rows.length}，应为 ${expected.length}`);
    return;
  }

  rows.forEach((seg, i) => {
    check(`#${i}`, iso(seg.programDateTime), expected[i]);
  });

  if (Object.prototype.hasOwnProperty.call(FILLERS, feed.id)) {
    const filler = rows[FILLERS[feed.id]];

    check(`#${FILLERS[feed.id]} 播放器时长`, filler.duration, 0.01);
    check(`#${FILLERS[feed.id]} 播放列表写下的时长`, filler.playlistDuration, 0);
  }
});

// 播控板读的那份必须和播出服务器吃的是同一份数
const boardPayload = readFileSync(path.join(ROOT, 'board', 'manifest.js'), 'utf8')
  .replace(/^window\.PLAYOUT_MANIFEST = /, '')
  .replace(/;\s*$/, '');
const serverPayload = readFileSync(path.join(ROOT, 'manifest.json'), 'utf8').trim();

check('board/manifest.js 与 manifest.json 同一份数', boardPayload === serverPayload, true);

if (failures) {
  console.log(`\n${failures} 处不符`);
  process.exitCode = 1;
} else {
  console.log('\n全部格子核对一致。');
}
