/*
 * 播控板：只画 manifest.js 里的数，不自己算。
 * 每一段一条，条下写绝对时间（精确到毫秒）；没有绝对时间的条还在，时间留空。
 */
(function() {
  'use strict';

  var PX_PER_SECOND = 26; // 条的横向比例
  var MIN_BAR_PX = 8; // EXTINF 0 的垫片也要看得出有一条
  var CELL_MIN_PX = 176; // 每格最小宽度，保证毫秒时间放得下

  var el = function(tag, className, text) {
    var node = document.createElement(tag);

    if (className) {
      node.className = className;
    }
    if (text != null) {
      node.textContent = text;
    }
    return node;
  };

  var baseName = function(uri) {
    var index = uri.lastIndexOf('/');

    return index === -1 ? uri : uri.slice(index + 1);
  };

  var fmt3 = function(n) {
    return (Math.round(n * 1000) / 1000).toFixed(3);
  };

  // 绝对时间推算用的时长：播放列表写下的时长
  var playlistDurationOf = function(seg) {
    return typeof seg.playlistDuration === 'number' ? seg.playlistDuration : seg.duration;
  };

  // 一场的格子 = 正式段 + 末尾还没出地址的 preloadSegment
  var rowsOf = function(feed) {
    var rows = feed.manifest.segments.slice();

    if (feed.manifest.preloadSegment) {
      rows.push(feed.manifest.preloadSegment);
    }
    return rows;
  };

  var barWidthOf = function(seg) {
    var seconds = typeof playlistDurationOf(seg) === 'number' ? playlistDurationOf(seg) : 0;

    if (!seconds && seg.parts && seg.parts.length) {
      seconds = seg.parts.reduce(function(sum, part) {
        return sum + (part.duration || 0);
      }, 0);
    }
    return Math.max(Math.round(seconds * PX_PER_SECOND), MIN_BAR_PX);
  };

  var renderCell = function(seg, index) {
    var cell = el('div', 'cell');

    cell.style.minWidth = CELL_MIN_PX + 'px';
    cell.appendChild(el('div', 'seg-index', '#' + index));

    var bar = el('div', 'bar');

    bar.style.width = barWidthOf(seg) + 'px';

    if (seg.parts && !seg.uri) {
      bar.classList.add('preload');
      bar.title = '地址还没写出来（仅 EXT-X-PART）';
    }
    if (typeof seg.playlistDuration === 'number' && seg.playlistDuration === 0) {
      bar.classList.add('filler');
      bar.title = 'EXTINF 0 垫片：绝对时间按 0 秒走，播放器拿 0.01 秒';
    }
    if (seg.dateTimeString) {
      var anchor = el('span', 'anchor', '⚓');

      anchor.title = 'EXT-X-PROGRAM-DATE-TIME: ' + seg.dateTimeString;
      bar.appendChild(anchor);
    }
    cell.appendChild(bar);

    var name = seg.uri ? baseName(seg.uri) : '（地址未出 · 仅 EXT-X-PART）';

    cell.appendChild(el('div', 'seg-name', name));

    var durText;

    if (typeof seg.playlistDuration === 'number' && seg.playlistDuration !== seg.duration) {
      durText = 'EXTINF ' + fmt3(seg.playlistDuration) + 's · 播放器 ' + fmt3(seg.duration) + 's';
    } else if (typeof seg.duration === 'number') {
      durText = 'EXTINF ' + fmt3(seg.duration) + 's';
    } else if (seg.parts && seg.parts.length) {
      durText = seg.parts.length + ' 截 part · 共 ' + fmt3(seg.parts.reduce(function(sum, part) {
        return sum + (part.duration || 0);
      }, 0)) + 's';
    } else {
      durText = '';
    }
    cell.appendChild(el('div', 'seg-dur', durText));

    // 绝对时间精确到毫秒；没有就留空
    var time = el('div', 'seg-time');

    if (typeof seg.programDateTime === 'number') {
      var iso = new Date(seg.programDateTime).toISOString();
      var tPos = iso.indexOf('T');

      time.appendChild(el('span', 'date', iso.slice(0, tPos)));
      time.appendChild(el('span', 'clock', iso.slice(tPos + 1)));
      cell.title = iso;
    }
    cell.appendChild(time);

    return cell;
  };

  var renderFeed = function(feed) {
    var section = el('section', 'feed');

    section.appendChild(el('h2', null, feed.title));

    var meta = feed.source;

    if (typeof feed.manifest.discontinuitySequence === 'number') {
      meta += ' · EXT-X-DISCONTINUITY-SEQUENCE:' + feed.manifest.discontinuitySequence + '（只是序号，不切钟）';
    }
    section.appendChild(el('div', 'feed-meta', meta));
    section.appendChild(el('div', 'feed-note', feed.note));

    var lane = el('div', 'lane');
    var group = null;
    var clockNo = 0;

    rowsOf(feed).forEach(function(seg, index) {
      if (seg.discontinuity || group === null) {
        if (seg.discontinuity) {
          var cut = el('div', 'cut');

          cut.appendChild(el('span', 'cut-icon', '✂'));
          cut.appendChild(el('span', 'cut-label', 'EXT-X-DISCONTINUITY'));
          lane.appendChild(cut);
        }
        clockNo += 1;
        group = el('div', 'group ' + (clockNo % 2 === 1 ? 'clock-a' : 'clock-b'));
        group.appendChild(el('div', 'clock-tag', '钟 ' + clockNo));
        lane.appendChild(group);
      }
      group.appendChild(renderCell(seg, index));
    });

    section.appendChild(lane);
    return section;
  };

  var manifest = window.PLAYOUT_MANIFEST;

  document.getElementById('generated-at').textContent = manifest.generatedAt;

  var wall = document.getElementById('wall');

  manifest.feeds.forEach(function(feed) {
    wall.appendChild(renderFeed(feed));
  });
})();
