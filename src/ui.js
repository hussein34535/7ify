/* ==========================================================================
   NAGHAM STUDIO — ui: rendering, interaction, keyboard
   ========================================================================== */
(function () {
  'use strict';

  const NG = window.NG;
  const {
    $, $$, esc, fmt, t, state, getTrack, byLang, coverHTML, paintCover, clamp, clampText, bus, engine, save
  } = NG;
  const TRACKS = NG.TRACKS;

  const ui = {
    view: 'home',
    viewTrackId: null,
    hist: ['home'],
    histIdx: 0,
    genre: 'all',
    libTab: 'playlists',
    q: '',
    isSearchingOnline: false,
    recentSearches: [],
    npTab: 'now',
    sheetTab: 'player',
    dragging: false,
    ctx: { home: [], search: [], lib: [] },
    activePl: null,
    following: new Set(['amrDiab'])
  };

  const el = {
    rail: $('#railList'),
    chips: $('#genreChips'),
    home: $('#view-home'),
    search: $('#view-search'),
    library: $('#view-library'),
    studio: $('#view-studio'),
    track: $('#view-track'),
    scroll: $('#scroll'),
    np: $('#npBody'),
    npPanel: $('#nowPanel'),
    sheet: $('#sheet'),
    sheetPanel: $('#sheetPanel'),
    toasts: $('#toasts'),
    q: $('#q'),
    searchWrap: $('#searchWrap'),
    qClear: $('#qClear'),
    newPlForm: $('#newPlForm'),
    newPlName: $('#newPlName'),
    newPlDlg: $('#newPlDlg'),
    fileInput: $('#fileInput'),
    shortcutsDlg: $('#shortcutsDlg'),
    confirmDlg: $('#confirmDlg'),
    vol: $('#vol')
  };

  const ic = (name, cls) => '<svg class="ic ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  const L = (obj) => esc(byLang(obj) || '');
  const isFav = (id) => state.favorites.indexOf(id) !== -1;

  function trackArt(tr, cls, eager) {
    return coverHTML(tr, cls, eager);
  }

  const art = (colors, motif) => coverHTML({ colors, motif });

  function coverWithIcon(item, iconName, wrapClass) {
    const html = coverHTML(item, '', true);
    const icon = wrapClass ? '<span class="' + wrapClass + '">' + ic(iconName) + '</span>' : ic(iconName);
    return html.replace('</span>', icon + '</span>');
  }

  function playlistCover(pl, eager) {
    const first = (pl.trackIds || []).map(getTrack).filter(Boolean)[0];
    return coverHTML({
      colors: pl.colors,
      motif: pl.motif,
      art: first ? first.art : '',
      photo: first ? first.photo : ''
    }, '', eager);
  }

  function artistAvatar(a) {
    const tr = getTrack(a.track);
    const src = tr ? (tr.art || tr.photo) : '';
    if (!src) {
      return '<span class="avatar-art"><b>' + esc((a.name.ar || '?').slice(0, 1)) + '</b></span>';
    }
    return '<span class="avatar-art has-photo"><img class="avatar-img" src="' + src + '" alt="" loading="lazy" decoding="async" onerror="this.remove();this.parentNode.classList.remove(\'has-photo\')"></span>';
  }

  function eq() {
    return '<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  }

  function likeIcon(on) { return '<svg class="ic" aria-hidden="true"><use href="#i-' + (on ? 'heart-fill' : 'heart') + '"></use></svg>'; }

  function emptyState(icon, title, body) {
    return '<div class="empty">' + ic(icon) + '<h3>' + esc(title) + '</h3><p>' + esc(body) + '</p></div>';
  }

  function sectionHead(title, sub, action) {
    return '<div class="section-head"><div><h2>' + esc(title) + '</h2>' +
      (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' +
      (action ? '<button class="section-more" data-action="go" data-view="' + action + '">' + esc(t('common.seeAll')) + '</button>' : '') +
      '</div>';
  }

  /* ---------- date / greeting -------------------------------------------- */

  function greetingKey() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'greet.morning';
    if (h >= 12 && h < 17) return 'greet.afternoon';
    if (h >= 17 && h < 22) return 'greet.evening';
    return 'greet.night';
  }

  function dateText() {
    try {
      return new Intl.DateTimeFormat(state.lang === 'ar' ? 'ar-EG' : 'en-GB', {
        weekday: 'long', day: 'numeric', month: 'long'
      }).format(new Date());
    } catch (e) { return ''; }
  }

  /* ---------- derived data ------------------------------------------------ */

  function filteredTracks() {
    if (ui.genre === 'all') return TRACKS.slice();
    return TRACKS.filter((tr) => tr.genre === ui.genre);
  }

  function playlistTracks(pl) {
    return (pl.trackIds || []).map(getTrack).filter(Boolean);
  }

  function countLabel(n, kind) {
    if (state.lang === 'ar') {
      if (kind === 'lists') {
        if (n === 1) return 'قائمة واحدة';
        if (n === 2) return 'قائمتان';
        if (n >= 3 && n <= 10) return n + ' قوائم';
        return n + ' قائمة';
      }
      if (n === 1) return 'أغنية واحدة';
      if (n === 2) return 'أغنيتان';
      if (n >= 3 && n <= 10) return n + ' أغانٍ';
      return n + ' أغنية';
    }
    if (kind === 'lists') return n + (n === 1 ? ' playlist' : ' playlists');
    return n + (n === 1 ? ' song' : ' songs');
  }

  /* ---------- rail -------------------------------------------------------- */

  function renderRail() {
    const likedCount = state.favorites.length;
    const likedActive = ui.view === 'library' && ui.libTab === 'liked';
    const liked = '<button class="rail-item is-liked' + (likedActive ? ' is-active' : '') + '" data-action="open-liked">' +
      coverWithIcon(getTrack(state.favorites[0]) || { colors: ['#2B1055', '#5B3B8F', '#C7B4FF'], motif: 'rings' }, 'heart') +
      '<span class="rail-item-text"><span class="rail-item-title">' + esc(t('rail.liked')) + '</span>' +
      '<span class="rail-item-sub">' + esc(t('rail.playlist')) + ' • ' + likedCount + '</span></span></button>';

    const pls = state.playlists.map((pl) => {
      const count = (pl.trackIds || []).length;
      return '<button class="rail-item' + (ui.activePl === pl.id ? ' is-active' : '') + '" data-action="playlist" data-id="' + pl.id + '">' +
        playlistCover(pl) +
        '<span class="rail-item-text"><span class="rail-item-title clamp-1">' + L(pl.name) + '</span>' +
        '<span class="rail-item-sub">' + esc(t('rail.playlist')) + ' • ' + count + '</span></span></button>';
    }).join('');

    el.rail.innerHTML = liked + pls;
  }

  /* ---------- chips ------------------------------------------------------- */

  function renderChips() {
    el.chips.innerHTML = NG.GENRES.map((g) =>
      '<button class="chip" data-action="genre" data-id="' + g.id + '" aria-pressed="' + (ui.genre === g.id) + '">' + esc(t(g.key)) + '</button>'
    ).join('');
  }

  /* ---------- home -------------------------------------------------------- */

  const BROWSE = [
    { genre: 'arabic', title: { ar: 'موسيقى عربية', en: 'Arabic' }, colors: ['#3B1206', '#8A2E11', '#F5B27B'], motif: 'orb' },
    { genre: 'rap', title: { ar: 'راب مصري', en: 'Egyptian Rap' }, colors: ['#220608', '#6B1119', '#FF8A8A'], motif: 'dots' },
    { genre: 'classic', title: { ar: 'كلاسيكيات', en: 'Classics' }, colors: ['#241A04', '#5C4409', '#F0D07B'], motif: 'arcs' },
    { genre: 'electronic', title: { ar: 'إلكتروني', en: 'Electronic' }, colors: ['#1A0E3C', '#4A2E91', '#A58BFF'], motif: 'rings' }
  ];

  function browseTiles() {
    return '<div class="browse-grid">' + BROWSE.map((b) => {
      const t0 = TRACKS.find((tr) => tr.genre === b.genre) || TRACKS[0];
      return '<button class="browse-tile" data-action="genre" data-id="' + b.genre + '" style="background:' + b.colors[1] + '">' +
        '<h3>' + L(b.title) + '</h3>' +
        coverHTML({ colors: b.colors, motif: b.motif, art: t0.art, photo: t0.photo }) + '</button>';
    }).join('') + '</div>';
  }

  function rowHTML(tr, index, ctxName) {
    const current = state.trackId === tr.id;
    const fav = isFav(tr.id);
    const playing = current && engine.playing;
    return '<div class="row' + (current ? ' is-current' : '') + '">' +
      '<button class="row-hit" data-action="play" data-id="' + tr.id + '" data-ctx="' + ctxName + '">' +
      '<span class="row-index">' + (playing ? eq() : (index + 1)) + '</span>' +
      '<span class="row-art">' + trackArt(tr) + '</span>' +
      '<span class="row-main"><span class="row-title clamp-1">' + L(tr.title) + '</span>' +
      '<span class="row-artist clamp-1">' + L(tr.artist) + '</span>' +
      (tr._matchedLyric && ctxName === 'search' ? ('<span class="row-lyric-match clamp-1" title="مطابقة من الكلمات"><svg class="ic" aria-hidden="true" style="width:11px;height:11px;fill:var(--accent);display:inline-block;vertical-align:baseline;margin-inline-end:4px;"><use href="#i-lyrics"></use></svg>«... ' + esc(tr._matchedLyric) + ' ...»</span>') : '') +
      '</span>' +
      '<span class="row-album clamp-1">' + L(tr.album) + '</span>' +
      '<span class="row-dur num">' + fmt(tr.duration) + '</span>' +
      '</button>' +
      '<button class="row-more" data-action="open-track" data-id="' + tr.id + '" title="' + esc(t('track.fullPage') || 'صفحة الأغنية') + '" aria-label="' + esc(t('track.fullPage') || 'صفحة الأغنية') + '">' + ic('disc') + '</button>' +
      '<button class="row-like' + (fav ? ' is-liked' : '') + '" data-action="like" data-id="' + tr.id + '" data-like="' + tr.id + '" aria-pressed="' + fav + '" aria-label="' + esc(t('player.like')) + '">' + likeIcon(fav) + '</button>' +
      '</div>';
  }

  function artistCard(a) {
    return '<button class="artist" data-action="play" data-id="' + a.track + '">' +
      artistAvatar(a) +
      '<span class="artist-name clamp-1">' + L(a.name) + '</span>' +
      '<span class="artist-sub clamp-1">' + L(a.sub) + '</span></button>';
  }

  function renderHome() {
    const pool = filteredTracks();
    const poolIds = pool.map((tr) => tr.id);
    ui.ctx.home = poolIds;
    const featured = pool[0] || getTrack('t1');
    const recentIds = state.recent.filter((id) => getTrack(id)).slice(0, 4);
    const jump = (recentIds.length ? recentIds : poolIds.slice(0, 4)).map(getTrack).filter(Boolean);
    const mixes = state.playlists.slice(0, 4);
    const trending = pool.slice(0, 7);
    const fav = isFav(featured.id);
    const featuredPlaying = state.trackId === featured.id && engine.playing;

    let html = '<div class="greet"><div><h1>' + esc(t(greetingKey())) + '</h1><p>' + esc(t('greet.sub')) + '</p></div>' +
      '<span class="greet-date">' + esc(dateText()) + '</span></div>';

    html += '<article class="hero" aria-labelledby="heroTitle" style="--c1:' + featured.colors[0] + ';--c2:' + featured.colors[1] + ';--c3:' + featured.colors[2] + '">' +
      '<div class="hero-art">' + trackArt(featured, 'hero-cover', true) + '</div>' +
      '<div class="hero-content">' +
      '<span class="hero-tag">' + ic('sparkle') + ' ' + esc(featured.source === 'file' ? t('player.local') : t('hero.badge')) + ' · ' + featured.year + '</span>' +
      '<h1 id="heroTitle">' + L(featured.title) + '</h1>' +
      '<div class="hero-meta"><span class="hero-artist">' + L(featured.artist) + '</span>' +
      '<span class="sep hero-sep-1"></span><span class="hero-album">' + esc(t('hero.album')) + ' · ' + L(featured.album) + '</span>' +
      '<span class="sep hero-sep-2"></span><span class="hero-genre">' + esc(NG.genreLabel(featured.genre)) + '</span></div>' +
      '<div class="hero-cta">' +
      '<button class="hero-play" data-action="play" data-id="' + featured.id + '" data-ctx="home">' +
      ic(featuredPlaying ? 'pause' : 'play') + esc(featuredPlaying ? t('player.pause') : t('hero.play')) + '</button>' +
      '<button class="hero-ghost" data-action="open-track" data-id="' + featured.id + '">' + ic('expand') + esc(t('hero.immersive')) + '</button>' +
      '<button class="btn" data-action="like" data-id="' + featured.id + '" data-like="' + featured.id + '" aria-pressed="' + fav + '" aria-label="' + esc(t('player.like')) + '">' + likeIcon(fav) + '</button>' +
      '</div></div></article>';

    if (!pool.length) {
      html += '<div class="section">' + emptyState('music', t('search.emptyTitle'), t('search.emptyBody')) + '</div>';
      el.home.innerHTML = html;
      return;
    }

    html += '<section class="section">' + sectionHead(t('sec.jump'), t('sec.jumpSub')) +
      '<div class="jump-grid">' + jump.map((tr) =>
        '<button class="jump" data-action="play" data-id="' + tr.id + '" data-ctx="home">' +
        trackArt(tr) + '<span class="jump-title clamp-2">' + L(tr.title) + '</span>' +
        '<span class="jump-play play-btn" aria-hidden="true">' + ic('play') + '</span></button>'
      ).join('') + '</div></section>';

    if (mixes.length) {
      html += '<section class="section">' + sectionHead(t('sec.mixes'), t('sec.mixesSub'), 'library') +
        '<div class="shelf">' + mixes.map((pl) => {
          const count = playlistTracks(pl).length;
          const current = ui.activePl === pl.id;
          return '<button class="card' + (current ? ' is-current' : '') + '" data-action="playlist" data-id="' + pl.id + '">' +
            '<span class="card-art">' + playlistCover(pl) +
            '<span class="fab play-btn" aria-hidden="true">' + ic('play') + '</span></span>' +
            '<span class="card-title clamp-1">' + L(pl.name) + '</span>' +
            '<span class="card-sub clamp-2">' + L(pl.sub) + ' · ' + esc(countLabel(count, 'songs')) + '</span></button>';
        }).join('') + '</div></section>';
    }

    html += '<section class="section">' + sectionHead(t('sec.trending'), t('sec.trendingSub')) +
      '<div class="rows">' + trending.map((tr, i) => rowHTML(tr, i, 'home')).join('') + '</div></section>';

    html += '<section class="section">' + sectionHead(t('sec.artists'), t('sec.artistsSub'), 'search') +
      '<div class="artist-grid">' + NG.ARTISTS.slice(0, 6).map(artistCard).join('') + '</div></section>';

    el.home.innerHTML = html;
  }

  /* ---------- search ------------------------------------------------------ */

  function searchIntro() {
    const recent = ui.recentSearches.slice(0, 6);
    let html = '<div class="search-head"><div><h1>' + esc(t('search.title')) + '</h1>' +
      '<p>' + esc(t('search.noQueryBody')) + '</p></div></div>';

    const suggestions = ['عمرو دياب', 'ويجز - البخت', 'كايروكي', 'فيروز', 'تامر حسني', 'شيرين', 'The Weeknd', 'أم كلثوم'];
    html += '<section class="section">' + sectionHead(t('search.quickSuggestions'), '') +
      '<div class="recent-chips">' + suggestions.map((q) =>
        '<button class="recent-chip" data-action="quick-search" data-q="' + esc(q) + '">' + ic('search') + esc(q) + '</button>'
      ).join('') + '</div></section>';

    if (recent.length) {
      html += '<section class="section">' + sectionHead(t('search.recent'), '') +
        '<div class="recent-chips">' + recent.map((q) =>
          '<button class="recent-chip" data-action="recent-search" data-q="' + esc(q) + '">' + ic('clock') + esc(q) + '</button>'
        ).join('') + '<button class="recent-chip" data-action="clear-recent">' + ic('x') + esc(t('search.clearRecent')) + '</button></div></section>';
    }
    html += '<section class="section">' + sectionHead(t('search.browse'), '') + browseTiles() + '</section>';
    return html;
  }

  function triggerOnlineSearch(query) {
    const q = String(query || '').trim();
    if (!q || q.length < 2) return;
    ui.isSearchingOnline = true;
    NG.searchOnline(q, (results) => {
      ui.isSearchingOnline = false;
      if (ui.q.trim() === q) {
        if (!NG.searchTracks(q).length && (!results || results.length === 0)) {
          NG.ensureFallbackTrack(q);
        }
        if (ui.view === 'search') renderSearch();
      }
    });
  }

  function renderSearch() {
    const q = ui.q.trim();
    if (!q) { el.search.innerHTML = searchIntro(); return; }

    const songs = NG.searchTracks(q);
    const artists = NG.searchArtists(q);
    ui.ctx.search = songs.map((tr) => tr.id);

    const statusBadge = ui.isSearchingOnline
      ? ' <span style="font-size:12px;opacity:0.75;display:inline-flex;align-items:center;gap:4px;">· ' + ic('sparkle') + esc(t('search.searchingOnline')) + '</span>'
      : '';

    let html = '<div class="search-head"><div><h1>' + esc(t('search.resultsFor', { q: q })) + '</h1>' +
      '<p>' + esc(t('search.count', { n: songs.length + artists.length })) + statusBadge + '</p></div>' +
      '<button class="btn" data-action="clear-search">' + ic('x') + esc(t('search.clear')) + '</button></div>';

    if (!songs.length && !artists.length) {
      if (ui.isSearchingOnline) {
        html += '<div style="padding:48px 16px;text-align:center;color:var(--muted);">' +
          '<div style="font-size:15px;font-weight:600;margin-bottom:8px;">' + esc(t('search.searchingOnline')) + '</div>' +
          '</div>';
      } else {
        html += emptyState('search', t('search.emptyTitle'), t('search.emptyBody'));
        html += '<section class="section" style="margin-top:18px">' + sectionHead(t('search.browse'), '') + browseTiles() + '</section>';
      }
      el.search.innerHTML = html;
      return;
    }

    const top = songs[0] || (artists[0] ? getTrack(artists[0].track) : null);
    if (top) {
      const topArtist = artists[0] && songs.length === 0;
      const topColors = topArtist ? artists[0].colors : top.colors;
      const topArt = topArtist
        ? '<span class="avatar-art" style="width:96px;--c1:' + topColors[0] + ';--c2:' + topColors[1] + ';--c3:' + topColors[2] + '"><span>' + esc((artists[0].name.ar || '?').slice(0, 1)) + '</span></span>'
        : trackArt(top);
      html += '<div class="result-top"><div class="section"><h2 style="font-size:15px;font-weight:700;margin-bottom:10px">' + esc(t('search.top')) + '</h2>' +
        '<button class="top-result" data-action="play" data-id="' + top.id + '" data-ctx="search">' +
        topArt +
        '<span class="badge">' + esc(topArtist ? t('search.artists') : t('search.song')) + '</span>' +
        '<span class="top-title clamp-1">' + L(topArtist ? artists[0].name : top.title) + '</span>' +
        '<span class="top-sub clamp-1">' + L(topArtist ? artists[0].sub : top.artist) + '</span>' +
        (top._matchedLyric ? ('<span class="top-lyric-match clamp-1"><svg class="ic" aria-hidden="true" style="width:12px;height:12px;fill:var(--accent);display:inline-block;vertical-align:middle;margin-inline-end:4px;"><use href="#i-lyrics"></use></svg>مطابقة من الكلمات: «... ' + esc(top._matchedLyric) + ' ...»</span>') : '') +
        '<span class="fab play-btn" aria-hidden="true">' + ic('play') + '</span></button></div>' +
        '<div class="section"><h2 style="font-size:15px;font-weight:700;margin-bottom:10px">' + esc(t('search.songs')) + '</h2>' +
        '<div class="rows">' + songs.slice(0, 10).map((tr, i) => rowHTML(tr, i, 'search')).join('') + '</div></div></div>';
    }

    if (artists.length && songs.length) {
      html += '<section class="section">' + sectionHead(t('search.artists'), '') +
        '<div class="artist-grid">' + artists.slice(0, 6).map(artistCard).join('') + '</div></section>';
    }

    if (songs.length + artists.length < 5) {
      html += '<section class="section" style="margin-top:8px">' + sectionHead(t('search.browse'), '') + browseTiles() + '</section>';
    }

    el.search.innerHTML = html;
  }

  /* ---------- library ----------------------------------------------------- */

  function libTabs() {
    const tabs = [['playlists', 'library.tabPlaylists'], ['liked', 'library.tabLiked'], ['artists', 'library.tabArtists']];
    return '<div class="lib-tabs" role="tablist" aria-label="' + esc(t('library.title')) + '">' + tabs.map(([id, key]) =>
      '<button class="lib-tab" role="tab" data-action="library-tab" data-tab="' + id + '" aria-selected="' + (ui.libTab === id) + '">' + esc(t(key)) + '</button>'
    ).join('') + '</div>';
  }

  function renderLibrary() {
    const favs = state.favorites.map(getTrack).filter(Boolean);
    const count = favs.length;
    const onLiked = ui.libTab === 'liked';
    const heading = onLiked ? t('library.liked') : t('library.title');
    const subline = onLiked ? t('library.likedSub') : t('library.librarySub');

    const firstFav = favs[0];
    const likedCover = firstFav
      ? coverWithIcon(firstFav, 'heart', 'lib-heart')
      : '<span class="cover art-rings" style="--c1:#241046;--c2:#5B3B8F;--c3:#D3C2FF"><span class="lib-heart">' + ic('heart') + '</span></span>';

    let html = '<div class="lib-head">' +
      '<span class="lib-mark" aria-hidden="true">' + ic('heart') + '</span>' +
      likedCover +
      '<div style="min-width:0"><div class="muted" style="font-size:11px;font-weight:600">' + esc(t('library.plSub')) + '</div>' +
      '<h1>' + esc(heading) + '</h1>' +
      '<p>' + esc(subline) + '</p>' +
      '<div class="lib-meta"><span>' + esc(countLabel(count, 'songs')) + '</span><span class="sep" style="width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.5"></span><span>' + esc(countLabel(state.playlists.length, 'lists')) + '</span></div>' +
      '<div class="lib-actions"><button class="play-btn" data-action="play-favorites" aria-label="' + esc(t('library.playAll')) + '">' + ic('play') + '</button>' +
      '<button class="btn" data-action="new-playlist">' + ic('plus') + esc(t('library.newPlaylist')) + '</button></div></div></div>';

    html += libTabs();

    if (ui.libTab === 'playlists') {
      if (!state.playlists.length) {
        html += emptyState('music', t('library.emptyPl'), t('library.emptyPlBody'));
      } else {
        html += '<div class="pl-grid">' + state.playlists.map((pl) => {
          const items = playlistTracks(pl);
          return '<button class="card' + (ui.activePl === pl.id ? ' is-current' : '') + '" data-action="playlist" data-id="' + pl.id + '">' +
            '<span class="card-art">' + playlistCover(pl) +
            '<span class="fab play-btn" aria-hidden="true">' + ic('play') + '</span></span>' +
            '<span class="card-title clamp-1">' + L(pl.name) + '</span>' +
            '<span class="card-sub clamp-1">' + L(pl.sub) + '</span>' +
            '<span class="card-sub">' + esc(countLabel(items.length, 'songs')) + '</span></button>';
        }).join('') + '</div>';
      }
    } else if (ui.libTab === 'liked') {
      if (!favs.length) html += emptyState('heart', t('library.emptyLiked'), t('library.emptyLikedBody'));
      else {
        ui.ctx.lib = favs.map((tr) => tr.id);
        html += '<div class="rows">' + favs.map((tr, i) => rowHTML(tr, i, 'lib')).join('') + '</div>';
      }
    } else {
      html += '<div class="artist-grid">' + NG.ARTISTS.map(artistCard).join('') + '</div>';
    }

    el.library.innerHTML = html;
  }

  /* ---------- studio ------------------------------------------------------ */

  function themeCards() {
    return '<div class="theme-grid">' + NG.THEMES.map((th) =>
      '<button class="theme-card" data-action="theme" data-id="' + th.id + '" aria-pressed="' + (state.theme === th.id) + '">' +
      '<span class="theme-swatch">' + th.swatch.map((c) => '<span style="background:' + c + '"></span>').join('') + '</span>' +
      '<b><span>' + esc(byLang({ ar: th.ar, en: th.en })) + '</span><i></i></b></button>'
    ).join('') + '</div>';
  }

  function accentDots() {
    return NG.ACCENTS.map((hex) =>
      '<button class="accent-dot" data-action="accent" data-id="' + hex + '" style="background:' + hex + '" aria-pressed="' + (state.accent.toLowerCase() === hex.toLowerCase()) + '" aria-label="' + hex + '"></button>'
    ).join('');
  }

  function renderStudio() {
    const html = '<div class="studio-head"><h1>' + esc(t('studio.title')) + '</h1><p>' + esc(t('studio.sub')) + '</p></div>' +
      '<div class="studio-grid"><div>' +
      '<section class="panel-block"><h2>' + esc(t('studio.theme')) + '</h2><p>' + esc(t('studio.themeSub')) + '</p>' + themeCards() + '</section>' +
      '<section class="panel-block"><h2>' + esc(t('studio.accent')) + '</h2><p>' + esc(t('studio.accentSub')) + '</p>' +
      '<div class="accent-row">' + accentDots() +
      '<label class="accent-custom" title="' + esc(t('studio.accent')) + '">' + ic('plus') +
      '<input type="color" id="accentCustom" value="' + state.accent + '" aria-label="' + esc(t('studio.accent')) + '"></label></div></section>' +
      '<section class="panel-block"><h2>' + esc(t('studio.density')) + '</h2><p>' + esc(t('studio.densitySub')) + '</p>' +
      '<div class="opt-list">' +
      '<button class="opt" data-action="density" data-id="comfortable" aria-pressed="' + (state.density === 'comfortable') + '"><span class="opt-text"><b>' + esc(t('density.comfort')) + '</b><span>' + esc(t('density.comfortSub')) + '</span></span><span class="opt-mark">' + ic('check') + '</span></button>' +
      '<button class="opt" data-action="density" data-id="compact" aria-pressed="' + (state.density === 'compact') + '"><span class="opt-text"><b>' + esc(t('density.compact')) + '</b><span>' + esc(t('density.compactSub')) + '</span></span><span class="opt-mark">' + ic('check') + '</span></button>' +
      '</div></section></div>' +

      '<div>' +
      '<section class="panel-block"><h2>' + esc(t('studio.audio')) + '</h2><p>' + esc(t('studio.audioSub')) + '</p>' +
      '<div class="engine-card"><span class="dot"></span><span><b>' + esc(t('studio.engine')) + '</b><span>' + esc(t('studio.engineSub')) + '</span></span></div>' +
      '<div class="btn-row">' +
      '<button class="btn btn-accent" data-action="import">' + ic('upload') + esc(t('studio.file')) + '</button>' +
      '<button class="btn" data-action="go" data-view="library">' + ic('library') + esc(t('library.tabLiked')) + '</button></div></section>' +

      '<section class="panel-block"><h2>' + esc(t('studio.language')) + '</h2><p>' + esc(t('studio.languageSub')) + '</p>' +
      '<div class="opt-list">' +
      '<button class="opt" data-action="lang-set" data-id="ar" aria-pressed="' + (state.lang === 'ar') + '"><span class="opt-text"><b>' + esc(t('lang.ar')) + '</b><span>RTL · العربية</span></span><span class="opt-mark">' + ic('check') + '</span></button>' +
      '<button class="opt" data-action="lang-set" data-id="en" aria-pressed="' + (state.lang === 'en') + '"><span class="opt-text"><b>' + esc(t('lang.en')) + '</b><span>LTR · English</span></span><span class="opt-mark">' + ic('check') + '</span></button>' +
      '</div></section>' +

      '<section class="panel-block"><h2>' + esc(t('studio.motion')) + '</h2><p>' + esc(t('studio.motionSub')) + '</p>' +
      '<div class="switch-row"><span><b>' + esc(state.motion ? t('motion.on') : t('motion.off')) + '</b><span>' + esc(t('studio.motionSub')) + '</span></span>' +
      '<button class="switch" data-action="motion" aria-pressed="' + state.motion + '" aria-label="' + esc(t('studio.motion')) + '"><i></i></button></div></section>' +

      '<section class="panel-block"><h2>' + esc(t('studio.reset')) + '</h2><p>' + esc(t('studio.resetSub')) + '</p>' +
      '<button class="btn btn-danger" data-action="reset-open">' + ic('trash') + esc(t('studio.reset')) + '</button></section>' +

      '<section class="panel-block"><h2>' + esc(t('studio.about')) + '</h2><p>' + esc(t('studio.aboutText')) + '</p></section>' +
      '</div></div>';
    el.studio.innerHTML = html;
    const custom = $('#accentCustom');
    if (custom) {
      custom.addEventListener('input', () => {
        setAccent(custom.value, false);
      });
      custom.addEventListener('change', () => saveAndRender());
    }
  }

  /* ---------- player ------------------------------------------------------ */

  function renderPlayer() {
    const tr = getTrack(state.trackId);
    if (!tr) return;
    const fav = isFav(tr.id);
    const artEl = $('#pArt');
    if (artEl) {
      paintCover(artEl, tr, true);
    }
    $('#pTitle').textContent = byLang(tr.title);
    $('#pTitleBtn').setAttribute('aria-label', byLang(tr.title) + ' — ' + byLang(tr.artist));
    $('#pArtist').textContent = byLang(tr.artist);
    const mark = $('#pMark');
    mark.hidden = false;
    mark.textContent = tr.source === 'file' ? t('player.local') : t('player.synth');
    $('#pDur').textContent = fmt(tr.duration);
    $('#pLike').setAttribute('aria-pressed', String(fav));
    $('#pLikeIcon').querySelector('use').setAttribute('href', fav ? '#i-heart-fill' : '#i-heart');
    $('#pLike').classList.toggle('is-liked', fav);
    const stage = document.querySelector('.stage');
    if (stage) stage.style.setProperty('--tint', tr.colors[1]);
    refreshTransport();
    syncProgress();
  }

  function refreshTransport() {
    const playing = engine.playing;
    const icon = playing ? 'pause' : 'play';
    ['#pPlayIcon', '#pPlayIconMini', '#shPlayIcon'].forEach((sel) => {
      const node = $(sel);
      if (node) node.querySelector('use').setAttribute('href', '#i-' + icon);
    });
    const spPlay = $('.sp-play-btn');
    if (spPlay) {
      const isCur = state.trackId === (ui.viewTrackId || state.trackId);
      const isAct = isCur && playing;
      spPlay.classList.toggle('is-playing', isAct);
      const useEl = spPlay.querySelector('use');
      if (useEl) useEl.setAttribute('href', '#i-' + (isAct ? 'pause' : 'play'));
      spPlay.dataset.action = isAct ? 'toggle' : 'play';
      spPlay.setAttribute('aria-label', t(isAct ? 'player.pause' : 'player.play'));
    }
    $$('[data-action="toggle"]').forEach((b) => b.setAttribute('aria-label', t(playing ? 'player.pause' : 'player.play')));
    const shuffle = state.shuffle;
    ['#bShuffle', '#shShuffle'].forEach((sel) => {
      const b = $(sel);
      if (b) b.setAttribute('aria-pressed', String(shuffle));
    });
    $$('[data-action="shuffle"]').forEach((b) => b.classList.toggle('is-on', shuffle));
    const rep = state.repeat;
    ['#bRepeat', '#shRepeat'].forEach((sel) => {
      const b = $(sel);
      if (b) b.setAttribute('aria-pressed', String(rep !== 'off'));
    });
    $$('[data-action="repeat"]').forEach((b) => b.classList.toggle('is-on', rep !== 'off'));
    const badge = $('#repeatBadge');
    if (badge) badge.hidden = rep !== 'one';
    const muteIcon = $('#muteIcon');
    if (muteIcon) muteIcon.querySelector('use').setAttribute('href', state.muted || state.volume === 0 ? '#i-mute' : '#i-volume');
    $('#bMute').setAttribute('aria-pressed', String(state.muted));
    $('#bMute').setAttribute('aria-label', t(state.muted ? 'player.unmute' : 'player.mute'));
    el.vol.value = String(state.volume);
    el.vol.style.setProperty('--vol', state.volume + '%');
    const activePl = state.playlists.find((p) => p.id === ui.activePl);
    if (activePl) ui.activePl = activePl.id;
  }

  function syncProgress() {
    const tr = getTrack(state.trackId);
    if (!tr) return;
    const pos = engine.getPosition();
    paintProgress(pos, tr.duration);
  }

  function paintProgress(pos, duration) {
    const pct = duration > 0 ? clamp((pos / duration) * 100, 0, 100) : 0;
    const pSeek = $('#pSeek');
    const shSeek = $('#shSeek');
    if (pSeek) pSeek.style.setProperty('--pct', pct + '%');
    if (shSeek) shSeek.style.setProperty('--pct', pct + '%');
    const mini = $('#miniProgress');
    if (mini && mini.firstElementChild) mini.firstElementChild.style.width = pct + '%';
    $('#pCur').textContent = fmt(pos);
    $('#shCur').textContent = fmt(pos);
    $('#pDur').textContent = fmt(duration);
    $('#shDur').textContent = fmt(duration);
    if (pSeek) {
      pSeek.setAttribute('aria-valuenow', String(Math.round(pct)));
      pSeek.setAttribute('aria-valuetext', fmt(pos));
    }
    if (shSeek) {
      shSeek.setAttribute('aria-valuenow', String(Math.round(pct)));
      shSeek.setAttribute('aria-valuetext', fmt(pos));
    }
    updateLyricHighlight(pos);
  }

  function updateLyricHighlight(pos) {
    const nodes = $$('.lyric[data-t]');
    if (!nodes.length) return;
    let active = -1;
    nodes.forEach((n) => { if (pos >= Number(n.dataset.t)) active = Number(n.dataset.t); });
    nodes.forEach((n) => {
      const isAct = Number(n.dataset.t) === active;
      n.classList.toggle('is-active', isAct);
      if (isAct && ui.view === 'track') {
        const list = n.closest('.sp-lyrics-content') || n.closest('.sp-lyrics-list');
        if (list && !ui.dragging) {
          const top = n.offsetTop - list.offsetTop - (list.clientHeight / 2) + (n.clientHeight / 2);
          list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
      }
    });
  }

  /* ---------- now panel --------------------------------------------------- */

  function creditHTML(tr) {
    const name = tr.source === 'file' ? byLang(tr.artist) : byLang(tr.artist).split('&')[0].trim();
    const key = 'artist:' + name;
    const followed = ui.following.has(key);
    return '<div class="np-credits"><h4>' + esc(t('sheet.player')) + '</h4>' +
      '<div class="credit"><div><div class="credit-name">' + esc(name) + '</div>' +
      '<div class="credit-role">' + esc(tr.source === 'file' ? t('player.local') : t('player.synth')) + ' · ' + esc(NG.genreLabel(tr.genre)) + '</div></div>' +
      '<button class="follow-btn" data-action="follow" data-id="' + esc(key) + '" aria-pressed="' + followed + '">' + esc(t(followed ? 'artist.following' : 'artist.follow')) + '</button></div></div>';
  }

  function miniTrack(tr) {
    return '<button class="mini-track" data-action="play" data-id="' + tr.id + '" data-ctx="queue">' +
      trackArt(tr) + '<span style="min-width:0"><span class="mini-track-title clamp-1">' + L(tr.title) + '</span>' +
      '<span class="mini-track-sub clamp-1">' + L(tr.artist) + '</span></span></button>';
  }

  function renderNowPanel() {
    const tr = getTrack(state.trackId);
    if (!tr) return;
    const fav = isFav(tr.id);

    if (ui.npTab === 'queue') {
      if (!state.queue.length) {
        el.np.innerHTML = emptyState('queue', t('queue.empty'), t('queue.emptyBody'));
        return;
      }
      el.np.innerHTML = '<div class="queue-list">' + state.queue.map((id, i) => {
        const q = getTrack(id);
        if (!q) return '';
        return '<div class="q-row' + (q.id === state.trackId ? ' is-current' : '') + '">' +
          '<button class="q-hit" data-action="play" data-id="' + q.id + '" data-ctx="queue">' +
          '<span class="num">' + (i + 1) + '</span>' + trackArt(q) +
          '<span style="min-width:0"><span class="mini-track-title q-title clamp-1">' + L(q.title) + '</span>' +
          '<span class="mini-track-sub clamp-1">' + L(q.artist) + '</span></span></button>' +
          '<button class="q-remove" data-action="queue-remove" data-index="' + i + '" aria-label="' + esc(t('queue.remove')) + '">' + ic('x') + '</button></div>';
      }).join('') + '</div>';
      return;
    }

    if (ui.npTab === 'lyrics') {
      const lyrics = tr.lyrics || [];
      if (!lyrics.length) {
        el.np.innerHTML = emptyState('lyrics', t('lyrics.empty'), t('lyrics.emptyBody'));
        return;
      }
      el.np.innerHTML = '<div class="lyrics">' + lyrics.map((line) =>
        '<button class="lyric" data-action="seek-lyric" data-t="' + line.t + '">' + esc(byLang(line)) +
        '<em>' + esc(state.lang === 'ar' ? line.en : line.ar) + '</em></button>'
      ).join('') + '</div>';
      updateLyricHighlight(engine.getPosition());
      return;
    }

    const idx = state.queue.indexOf(state.trackId);
    const nextIds = [];
    for (let i = 1; i <= 3; i++) {
      const id = state.queue[(idx + i) % Math.max(1, state.queue.length)];
      if (id && id !== tr.id && nextIds.indexOf(id) === -1) nextIds.push(id);
    }

    el.np.innerHTML = '<div class="np-cover-wrap"><span class="np-glow" style="background:' + tr.colors[2] + '"></span>' +
      '<button style="width:100%;display:block" data-action="open-track" data-id="' + tr.id + '" aria-label="' + esc(t('track.fullPage') || 'عرض صفحة الأغنية') + '">' + trackArt(tr) + '</button></div>' +
      '<div class="np-track"><div style="min-width:0"><h3 class="clamp-2">' + L(tr.title) + '</h3><p class="clamp-1">' + L(tr.artist) + '</p></div>' +
      '<div class="np-actions">' +
        '<button class="icon-btn" data-action="open-track" data-id="' + tr.id + '" aria-label="' + esc(t('track.fullPage') || 'صفحة الأغنية') + '" title="' + esc(t('track.fullPage') || 'صفحة الأغنية') + '"><svg class="ic" aria-hidden="true"><use href="#i-disc"></use></svg></button>' +
        '<button class="icon-btn' + (fav ? ' is-liked' : '') + '" data-action="like" data-id="' + tr.id + '" data-like="' + tr.id + '" aria-pressed="' + fav + '" aria-label="' + esc(t('player.like')) + '">' + likeIcon(fav) + '</button>' +
      '</div></div>' +
      '<div class="muted" style="font-size:11.5px;margin-top:6px">' + L(tr.album) + ' · ' + tr.year + '</div>' +
      creditHTML(tr) +
      '<p class="muted" style="font-size:11.5px;line-height:1.8;margin-top:12px">' + L(tr.bio) + '</p>' +
      (nextIds.length ? '<div class="np-next"><div class="np-next-head"><h4>' + esc(t('sheet.queue')) + '</h4></div>' +
        nextIds.map((id) => miniTrack(getTrack(id))).join('') + '</div>' : '');
  }

  /* ---------- sheet ------------------------------------------------------- */

  function sheetPlayerPanel(tr) {
    const lyrics = tr.lyrics || [];
    const first = lyrics.slice(0, 2);
    return (first.length ? '<div class="np-credits">' + first.map((l) =>
      '<p style="font-size:13px;line-height:1.9">' + esc(byLang(l)) + '</p>'
    ).join('') + '</div>' : '') +
      '<div class="np-next" style="margin-top:18px"><div class="np-next-head"><h4>' + esc(t('sheet.queue')) + '</h4>' +
      '<button class="section-more" data-action="sheet-tab" data-tab="queue">' + esc(t('common.seeAll')) + '</button></div>' +
      (state.queue.length ? state.queue.slice(0, 5).map((id) => getTrack(id)).filter(Boolean).map(miniTrack).join('') : '<p class="muted" style="font-size:12px">' + esc(t('queue.empty')) + '</p>') +
      '</div>';
  }

  function sheetQueuePanel() {
    if (!state.queue.length) return emptyState('queue', t('queue.empty'), t('queue.emptyBody'));
    return '<div class="queue-list">' + state.queue.map((id, i) => {
      const q = getTrack(id);
      if (!q) return '';
      return '<div class="q-row' + (q.id === state.trackId ? ' is-current' : '') + '">' +
        '<button class="q-hit" data-action="play" data-id="' + q.id + '" data-ctx="queue">' +
        '<span class="num">' + (i + 1) + '</span>' + trackArt(q) +
        '<span style="min-width:0"><span class="mini-track-title q-title clamp-1">' + L(q.title) + '</span>' +
        '<span class="mini-track-sub clamp-1">' + L(q.artist) + '</span></span></button>' +
        '<button class="q-remove" data-action="queue-remove" data-index="' + i + '" aria-label="' + esc(t('queue.remove')) + '">' + ic('x') + '</button></div>';
    }).join('') + '</div>';
  }

  function sheetLyricsPanel(tr) {
    const lyrics = tr.lyrics || [];
    if (!lyrics.length) return emptyState('lyrics', t('lyrics.empty'), t('lyrics.emptyBody'));
    return '<div class="lyrics">' + lyrics.map((line) =>
      '<button class="lyric" data-action="seek-lyric" data-t="' + line.t + '">' + esc(byLang(line)) +
      '<em>' + esc(state.lang === 'ar' ? line.en : line.ar) + '</em></button>'
    ).join('') + '</div>';
  }

  function sheetInfoPanel(tr) {
    if (!tr) return '';
    return '<div class="sheet-info-panel">' +
      '<div class="info-card">' +
        '<div class="info-row"><span class="info-label">' + esc(t('hero.album')) + '</span><span class="info-val">' + L(tr.album) + '</span></div>' +
        '<div class="info-row"><span class="info-label">سنة الإصدار</span><span class="info-val">' + (tr.year || '2024') + '</span></div>' +
        '<div class="info-row"><span class="info-label">النوع الموسيقي</span><span class="info-val">' + esc(NG.genreLabel(tr.genre)) + '</span></div>' +
        '<div class="info-row"><span class="info-label">المدة الزمنية</span><span class="info-val">' + fmt(tr.duration) + '</span></div>' +
        '<div class="info-row"><span class="info-label">جودة الصوت</span><span class="info-val badge-quality">HQ 320kbps Master Stream</span></div>' +
      '</div>' +
      (tr.bio ? '<div class="info-bio"><h4>عن العمل والفنان</h4><p>' + L(tr.bio) + '</p></div>' : '') +
      '<div class="info-actions">' +
        '<button class="btn btn-accent" data-action="open-track" data-id="' + tr.id + '"><svg class="ic" aria-hidden="true"><use href="#i-external"></use></svg> ' + esc(t('track.fullPage') || 'عرض صفحة الأغنية الكاملة') + '</button>' +
        '<button class="btn" data-action="new-playlist">' + ic('plus') + ' إضافة لقائمة تشغيل</button>' +
        '<button class="btn" data-action="copy-song-link" data-id="' + tr.id + '">' + ic('sparkle') + ' مشاركة الأغنية</button>' +
      '</div>' +
    '</div>';
  }

  function renderSheet() {
    const tr = getTrack(state.trackId);
    if (!tr) return;
    const artEl = $('#shArt');
    if (artEl) paintCover(artEl, tr, true);
    const glow = $('#shGlow');
    if (glow) glow.style.background = tr.colors[2];
    $('#sheetTitle').textContent = byLang(tr.title);
    $('#shTitleMobile').textContent = byLang(tr.title);
    $('#shArtist').textContent = byLang(tr.artist);
    $('#shArtistMobile').textContent = byLang(tr.artist);
    $('#shAlbum').textContent = byLang(tr.album) + ' · ' + tr.year;

    const shLike = $('#shLike');
    if (shLike) {
      const fav = isFav(tr.id);
      shLike.dataset.like = tr.id;
      shLike.dataset.id = tr.id;
      shLike.setAttribute('aria-pressed', String(fav));
      shLike.classList.toggle('is-liked', fav);
      const icon = $('#shLikeIcon');
      if (icon) icon.querySelector('use').setAttribute('href', fav ? '#i-heart-fill' : '#i-heart');
    }

    $$('.sheet-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ui.sheetTab)));
    el.sheetPanel.innerHTML = ui.sheetTab === 'queue' ? sheetQueuePanel()
      : ui.sheetTab === 'lyrics' ? sheetLyricsPanel(tr)
      : ui.sheetTab === 'about' ? sheetInfoPanel(tr)
      : sheetPlayerPanel(tr);
    refreshTransport();
    updateLyricHighlight(engine.getPosition());
  }

  /* ---------- spotify track page ------------------------------------------ */

  const ARTIST_BIOS = {
    'عمرو دياب': {
      bio: {
        ar: 'الهضبة عمرو دياب، أسطورة البوب العربي والحائز على جوائز الموسيقى العالمية وسجل غينيس للأرقام القياسية كأكثر فنان عربي حصداً للجوائز العالمية والمبيعات.',
        en: 'Amr Diab, the "Father of Mediterranean Music", multiple World Music Award winner and Guinness World Record holder for best-selling Middle Eastern artist.'
      },
      listeners: '14,892,105'
    },
    'شيرين': {
      bio: {
        ar: 'شيرين عبد الوهاب، من أهم وأعذب الأصوات النسائية في العالم العربي، تميزت بإحساسها الطربي العالي وألبوماتها الأكثر مبيعاً في الشرق الأوسط.',
        en: 'Sherine Abdel-Wahab, one of the most celebrated and beloved voices in Arabic music, acclaimed for her emotional depth and iconic chart-topping albums.'
      },
      listeners: '9,431,220'
    },
    'ويجز': {
      bio: {
        ar: 'ويجز، رائد مشهد التراب والراب في مصر والعالم العربي، تصدّر قوائم الاستماع العالمية بأعماله المؤثرة مثل البخت وأسياد الصوت ودورك جاي.',
        en: 'Wegz, the pioneer of Egyptian rap and trap, dominating Arab streaming charts with landmark releases such as El Bakht and Dorak Gai.'
      },
      listeners: '8,210,540'
    },
    'كايروكي': {
      bio: {
        ar: 'فرقة الروك المستقل الرائدة في مصر والوطن العربي، تميزت بكلماتها المعبرة عن قضايا الشباب وألحانها التي ألهمت أجيالاً في ألبومات روما ونقطة بيضا.',
        en: 'Cairokee, the iconic Egyptian indie rock band renowned for soulful lyrics and anthems that resonated across generations in albums like Roma and Noqta Beida.'
      },
      listeners: '6,150,890'
    },
    'أم كلثوم': {
      bio: {
        ar: 'كوكب الشرق وسيدة الغناء العربي، أعظم صوت في تاريخ الموسيقى العربية الكلاسيكية، صنفتها مجلة رولينغ ستون ضمن أعظم مئة مغنٍ في التاريخ.',
        en: 'Umm Kulthum, the Star of the East, widely regarded as the greatest singer in the history of Arabic music and ranked among Rolling Stone\'s 100 greatest singers of all time.'
      },
      listeners: '4,870,410'
    },
    'فيروز': {
      bio: {
        ar: 'جارة القمر وصوت الصباح العربي، قدمت مع الأخوين رحباني مكتبة موسيقية خالدة تخطت حدود الشرق لتصل إلى مسارح العالم الكبرى في الأولمبيا والرويال ألبرت هول.',
        en: 'Fairouz, the Jewel of Lebanon and Voice of the Morning, whose timeless collaborations with the Rahbani brothers defined modern Levantine music.'
      },
      listeners: '7,320,110'
    },
    'مروان بابلو': {
      bio: {
        ar: 'عراب التراب المصري، أحدث ثورة في مشهد الهيب هوب المستقل ومزج الإيقاعات الإلكترونية الحديثة بالثقافة البصرية في كنترول والجميزة.',
        en: 'Marwan Pablo, widely credited as the godfather of Egyptian trap, redefining contemporary Arabic hip hop with Control and El Gemeza.'
      },
      listeners: '5,420,900'
    },
    'نانسي عجرم': {
      bio: {
        ar: 'ملكة البوب العربي وسفيرة النوايا الحسنة، حققت ألبوماتها مبيعات خيالية وحازت على جائزة الموسيقى العالمية كأفضل مبيعات في الشرق الأوسط.',
        en: 'Nancy Ajram, queen of Arab pop and multi-platinum artist, celebrated across the globe for her infectious hooks and performances.'
      },
      listeners: '11,200,450'
    },
    'ذا ويكند': {
      bio: {
        ar: 'أبيل تسفاي (The Weeknd)، الحائز على جوائز غرامي وعشرات الأرقام القياسية، صاحب أغنية Blinding Lights الأكثر استماعاً في تاريخ بيلبورد.',
        en: 'The Weeknd, multi-Grammy-winning Canadian visionary behind "Blinding Lights", the biggest Billboard Hot 100 song in history.'
      },
      listeners: '108,450,230'
    },
    'دافت بانك': {
      bio: {
        ar: 'الثنائي الفرنسي الأسطوري لموسيقى الفرانش هاوس والإلكترونيك، أحدثوا ثورة في الموسيقى العالمية بألبوماتهم الرائدة Random Access Memories وDiscovery.',
        en: 'Daft Punk, the pioneering French electronic music duo whose synthesis of funk, house, and synthpop shaped modern music.'
      },
      listeners: '32,150,000'
    },
    'جورج وسوف': {
      bio: {
        ar: 'سلطان الطرب جورج وسوف، قامة فنية استثنائية وأحد أعظم وأندر الأصوات الطربية في تاريخ الموسيقى العربية المعاصرة، اشتهر بأدائه العاطفي الخالد في روائع مثل إسمعيني بكلمة، حلف القمر، وكلام الناس.',
        en: 'George Wassouf, the "Sultan of Tarab", one of the most legendary and revered vocalists in contemporary Arab music history.'
      },
      listeners: '12,450,800'
    }
  };

  function getStreamsCount(tr) {
    if (tr.streams) return Number(tr.streams).toLocaleString('en-US');
    let seed = 0;
    const str = (tr.id || '') + (tr.title && (tr.title.ar || tr.title.en) || '') + (tr.artist && (tr.artist.ar || tr.artist.en) || '');
    for (let i = 0; i < str.length; i++) seed = (seed * 31 + str.charCodeAt(i)) >>> 0;
    const count = 15000000 + (seed % 285000000);
    return count.toLocaleString('en-US');
  }

  function openTrackPage(id) {
    const tr = getTrack(id) || getTrack(state.trackId);
    if (!tr) return;
    ui.viewTrackId = tr.id;
    if (el.sheet && el.sheet.open) closeSheet();
    setView('track');
  }

  function renderTrackPage() {
    const id = ui.viewTrackId || state.trackId;
    const tr = getTrack(id) || getTrack(state.trackId) || TRACKS[0];
    if (!tr) return;

    const isCurrent = state.trackId === tr.id;
    const isPlaying = isCurrent && engine.playing;
    const fav = isFav(tr.id);
    const colors = tr.colors || ['#121212', '#282828', '#1ED760'];
    const accentCol = colors[1] || colors[0] || '#1ED760';
    const bgCol = colors[0] || '#121212';
    const artistName = byLang(tr.artist);
    const artistKey = 'artist:' + (tr.source === 'file' ? artistName : artistName.split('&')[0].trim());
    const isFollowing = ui.following.has(artistKey);

    const artistData = ARTIST_BIOS[tr.artist && (tr.artist.ar || tr.artist.en)] || null;
    const bioText = (tr.bio && L(tr.bio)) || (artistData ? byLang(artistData.bio) : (
      state.lang === 'ar' ?
        ('استمع إلى عمل «' + L(tr.title) + '» للفنان ' + artistName + ' بجودة استوديو 320kbps ومزامنة كاملة عبر منصة نغم.') :
        ('Listen to "' + L(tr.title) + '" by ' + artistName + ' in pristine master audio quality with real-time lyrics.')
    ));
    const listenersCount = artistData ? artistData.listeners : (tr.streams ? Math.floor(Number(tr.streams) / 15).toLocaleString('en-US') : '8,420,910');

    const sameArtist = TRACKS.filter((t) => t.id !== tr.id && ((t.artist && t.artist.ar === tr.artist.ar) || t.genre === tr.genre)).slice(0, 5);
    const lyrics = tr.lyrics || [];

    let html = '<div class="sp-page" style="--sp-accent: ' + accentCol + '; --sp-bg: ' + bgCol + ';">';

    // 1. Spotify Dynamic Ambient Hero
    html += '<section class="sp-hero">' +
      '<div class="sp-hero-glow" style="background: radial-gradient(circle at 20% 40%, ' + accentCol + ' 0%, transparent 70%);" aria-hidden="true"></div>' +
      '<div class="sp-hero-wrap">' +
        '<div class="sp-cover-box">' +
          trackArt(tr, 'sp-cover', true) +
        '</div>' +
        '<div class="sp-hero-meta">' +
          '<div class="sp-kicker">' + esc(t('track.kicker') || 'أغنية') + '</div>' +
          '<h1 class="sp-title clamp-2" title="' + L(tr.title) + '">' + L(tr.title) + '</h1>' +
          '<div class="sp-subline">' +
            '<button class="sp-artist-chip" data-action="filter-artist" data-artist="' + esc(tr.artist.ar || tr.artist.en) + '">' +
              artistAvatar({ name: tr.artist, track: tr.id }) +
              '<span class="sp-artist-link">' + L(tr.artist) + '</span>' +
            '</button>' +
            '<span class="sp-sep">•</span>' +
            '<span class="sp-album-text">' + L(tr.album) + '</span>' +
            '<span class="sp-sep">•</span>' +
            '<span class="sp-year-text">' + (tr.year || 2024) + '</span>' +
            '<span class="sp-sep">•</span>' +
            '<span class="sp-dur-text num">' + fmt(tr.duration) + '</span>' +
            '<span class="sp-sep">•</span>' +
            '<span class="sp-streams-text num">' + getStreamsCount(tr) + ' ' + esc(t('track.streams') || 'استماع') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';

    // 2. Spotify Action Bar
    html += '<div class="sp-actions-bar">' +
      '<div class="sp-actions-left">' +
        '<button class="sp-play-btn ' + (isPlaying ? 'is-playing' : '') + '" data-action="' + (isPlaying ? 'toggle' : 'play') + '" data-id="' + tr.id + '" data-ctx="track" aria-label="' + (isPlaying ? esc(t('player.pause')) : esc(t('player.play')) + ': ' + L(tr.title)) + '">' +
          '<svg class="ic" aria-hidden="true"><use href="#i-' + (isPlaying ? 'pause' : 'play') + '"></use></svg>' +
        '</button>' +
        '<button class="sp-icon-btn ' + (fav ? 'is-liked' : '') + '" data-action="like" data-id="' + tr.id + '" data-like="' + tr.id + '" aria-pressed="' + fav + '" aria-label="' + esc(t('player.like')) + '">' +
          likeIcon(fav) +
        '</button>' +
        '<button class="sp-icon-btn" data-action="new-playlist" aria-label="إضافة إلى قائمة تشغيل" title="إضافة لقائمة تشغيل">' +
          '<svg class="ic" aria-hidden="true"><use href="#i-plus"></use></svg>' +
        '</button>' +
        '<button class="sp-icon-btn" data-action="copy-song-link" data-id="' + tr.id + '" aria-label="' + esc(t('track.copyLink') || 'نسخ الرابط') + '" title="' + esc(t('track.copyLink') || 'نسخ رابط الأغنية') + '">' +
          '<svg class="ic" aria-hidden="true"><use href="#i-arrow"></use></svg>' +
        '</button>' +
      '</div>' +
      '<div class="sp-actions-right">' +
        '<span class="sp-badge-hq">' +
          '<svg class="ic" aria-hidden="true"><use href="#i-sparkle"></use></svg> ' +
          '<span>HQ 320kbps Master Stream</span>' +
        '</span>' +
      '</div>' +
    '</div>';

    // 3. Two-Column Spotify Layout Grid
    html += '<div class="sp-grid">' +
      '<div class="sp-col-main">' +
        '<div class="sp-lyrics-card">' +
          '<div class="sp-card-head">' +
            '<h2>' + esc(t('track.lyrics') || 'كلمات الأغنية') + '</h2>' +
            '<span class="sp-live-badge"><span class="sp-live-dot"></span> ' + (lyrics.length ? 'متزامنة LIVE' : 'استماع') + '</span>' +
          '</div>' +
          '<div class="sp-lyrics-content">' +
            (lyrics.length ? (
              '<div class="lyrics sp-lyrics-list">' + lyrics.map((line) =>
                '<button class="lyric sp-lyric" data-action="seek-lyric" data-t="' + line.t + '">' +
                  '<span class="sp-lyric-main">' + esc(byLang(line)) + '</span>' +
                  '<span class="sp-lyric-sub">' + esc(state.lang === 'ar' ? line.en : line.ar) + '</span>' +
                '</button>'
              ).join('') + '</div>'
            ) : (
              '<div class="sp-lyrics-empty">' +
                '<div class="sp-wave-bars"><i style="--h:24px"></i><i style="--h:48px"></i><i style="--h:32px"></i><i style="--h:56px"></i><i style="--h:36px"></i></div>' +
                '<p class="sp-lyrics-empty-title">استمتع بالألحان والموسيقى النقية</p>' +
                '<p class="sp-lyrics-empty-sub">يتم تحديث كلمات الأغاني وتزامنها بشكل مستمر عبر مكتبة نغم ستوديو.</p>' +
              '</div>'
            )) +
          '</div>' +
        '</div>' +

        (sameArtist.length ? (
          '<div class="sp-more-section">' +
            '<div class="section-head"><div><h3>' + esc((t('track.moreBy') || 'المزيد من {artist}').replace('{artist}', artistName)) + '</h3></div></div>' +
            '<div class="sp-more-list">' +
              sameArtist.map((st, i) =>
                '<div class="sp-more-row' + (state.trackId === st.id ? ' is-current' : '') + '">' +
                  '<button class="sp-more-hit" data-action="play" data-id="' + st.id + '" data-ctx="track">' +
                    '<span class="sp-more-idx">' + (state.trackId === st.id && engine.playing ? eq() : (i + 1)) + '</span>' +
                    '<span class="sp-more-art">' + trackArt(st) + '</span>' +
                    '<span class="sp-more-info"><span class="sp-more-title clamp-1">' + L(st.title) + '</span><span class="sp-more-sub clamp-1">' + L(st.album) + '</span></span>' +
                    '<span class="sp-more-dur num">' + fmt(st.duration) + '</span>' +
                  '</button>' +
                  '<button class="row-like ' + (isFav(st.id) ? 'is-liked' : '') + '" data-action="like" data-id="' + st.id + '" data-like="' + st.id + '" aria-pressed="' + isFav(st.id) + '">' +
                    likeIcon(isFav(st.id)) +
                  '</button>' +
                '</div>'
              ).join('') +
            '</div>' +
          '</div>'
        ) : '') +
      '</div>' +

      '<div class="sp-col-side">' +
        '<div class="sp-artist-card">' +
          '<div class="sp-artist-header">' +
            '<div class="sp-artist-avatar-wrap">' +
              artistAvatar({ name: tr.artist, track: tr.id }) +
            '</div>' +
            '<div class="sp-artist-header-info">' +
              '<div class="sp-artist-kicker-row">' +
                '<span class="sp-artist-kicker">فنان</span>' +
                '<div class="sp-verified-tag">' +
                  '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>' +
                  '<span>' + esc(t('track.verified') || 'فنان موثق') + '</span>' +
                '</div>' +
              '</div>' +
              '<h3 class="sp-artist-title">' + artistName + '</h3>' +
              '<div class="sp-artist-listeners num">' + listenersCount + ' ' + esc(t('track.monthlyListeners') || 'مستمع شهرياً') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="sp-artist-body">' +
            '<p class="sp-artist-bio">' + esc(bioText) + '</p>' +
            '<button class="sp-follow-btn ' + (isFollowing ? 'is-following' : '') + '" data-action="follow" data-id="' + esc(artistKey) + '" aria-pressed="' + isFollowing + '">' +
              esc(t(isFollowing ? 'artist.following' : 'artist.follow')) +
            '</button>' +
          '</div>' +
        '</div>' +

        '<div class="sp-credits-card">' +
          '<h4>' + esc(t('track.credits') || 'بيانات الأغنية والإنتاج') + '</h4>' +
          '<div class="sp-credits-table">' +
            '<div class="sp-credit-row"><span>الفنان الرئيسي</span><b>' + artistName + '</b></div>' +
            '<div class="sp-credit-row"><span>الألبوم / الإصدار</span><b>' + L(tr.album) + '</b></div>' +
            '<div class="sp-credit-row"><span>سنة النشر</span><b>' + (tr.year || 2024) + '</b></div>' +
            '<div class="sp-credit-row"><span>جودة البث</span><b class="badge-accent">Master 320kbps Lossless</b></div>' +
            '<div class="sp-credit-row"><span>المصدر التقني</span><b>' + (tr.source === 'file' ? 'ملف محلي (Local Storage)' : (tr.ytId ? 'YouTube HQ Audio' : 'Apple Music Master')) + '</b></div>' +
          '</div>' +
          '<div class="sp-copyright-notice">' +
            '© 2026 NAGHAM Records. All Rights Reserved. مرخص للاستماع التفاعلي الكامل.' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div></div>';

    el.track.innerHTML = html;
    updateLyricHighlight(engine.getPosition());
  }

  /* ---------- players: actions ------------------------------------------- */

  function renderAll() {
    renderRail();
    renderChips();
    renderView();
    renderPlayer();
    renderNowPanel();
    if (el.sheet.open) renderSheet();
    syncLikes();
    updateNav();
  }

  function renderView() {
    const stageBar = $('.stage-bar');
    if (stageBar) stageBar.hidden = ui.view === 'track';
    if (ui.view === 'home') renderHome();
    else if (ui.view === 'search') renderSearch();
    else if (ui.view === 'library') renderLibrary();
    else if (ui.view === 'track') renderTrackPage();
    else renderStudio();
    if (el.sheet.open) renderSheet();
  }

  function updateNav() {
    $$('[data-nav]').forEach((b) => {
      const active = b.dataset.nav === ui.view;
      b.classList.toggle('is-active', active);
      if (active) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
  }

  function syncLikes() {
    const fav = isFav(state.trackId);
    const likeBtn = $('#pLike');
    if (likeBtn) {
      likeBtn.setAttribute('aria-pressed', String(fav));
      likeBtn.classList.toggle('is-liked', fav);
      const icon = $('#pLikeIcon');
      if (icon) icon.querySelector('use').setAttribute('href', fav ? '#i-heart-fill' : '#i-heart');
    }
    const shLike = $('#shLike');
    if (shLike) {
      shLike.setAttribute('aria-pressed', String(fav));
      shLike.classList.toggle('is-liked', fav);
      const shIcon = $('#shLikeIcon');
      if (shIcon) shIcon.querySelector('use').setAttribute('href', fav ? '#i-heart-fill' : '#i-heart');
    }
    $$('[data-like]').forEach((b) => {
      const on = isFav(b.dataset.like);
      b.classList.toggle('is-liked', on);
      b.setAttribute('aria-pressed', String(on));
      const use = b.querySelector('use');
      if (use) use.setAttribute('href', on ? '#i-heart-fill' : '#i-heart');
      if (b.classList.contains('icon-btn')) b.innerHTML = likeIcon(on);
    });
  }

  function setView(view, push) {
    if (['home', 'search', 'library', 'studio', 'track'].indexOf(view) === -1) return;
    if (push !== false && ui.hist[ui.histIdx] !== view) {
      ui.hist = ui.hist.slice(0, ui.histIdx + 1);
      ui.hist.push(view);
      ui.histIdx = ui.hist.length - 1;
    }
    ui.view = view;
    $$('[data-view-section]').forEach((s) => { s.hidden = s.dataset.viewSection !== view; });
    renderView();
    updateNav();
    if (el.scroll) el.scroll.scrollTop = 0;
  }

  function playTrack(id, context) {
    const tr = getTrack(id);
    if (!tr) return;
    const same = state.trackId === id;
    if (same && engine.playing) { engine.pause(); return; }

    if (Array.isArray(context) && context.length) {
      const ids = context.filter((x) => getTrack(x));
      if (ids.length) state.queue = ids.indexOf(id) === -1 ? [id].concat(ids) : ids.slice();
    }
    if (state.queue.indexOf(id) === -1) state.queue.push(id);

    if (!same) {
      state.trackId = id;
      if (ui.view === 'track') ui.viewTrackId = id;
      state.recent = [id].concat(state.recent.filter((x) => x !== id)).slice(0, 8);
      engine.load(tr);
    }
    engine.play();
    save();
    renderAll();
  }

  function playPlaylist(plId) {
    const pl = state.playlists.find((p) => p.id === plId);
    if (!pl) return;
    const items = playlistTracks(pl);
    if (!items.length) { toast(t('toast.playlistEmpty')); return; }
    ui.activePl = pl.id;
    playTrack(items[0].id, items.map((x) => x.id));
  }

  function stepTrack(dir) {
    const q = state.queue.map(getTrack).filter(Boolean);
    if (!q.length) return;
    const ids = q.map((x) => x.id);
    const i = ids.indexOf(state.trackId);
    if (dir < 0 && engine.getPosition() > 3) { engine.seek(0); syncProgress(); return; }
    let nextId;
    if (state.shuffle && ids.length > 1) {
      do { nextId = ids[Math.floor(Math.random() * ids.length)]; } while (nextId === state.trackId && ids.length > 1);
    } else {
      const n = i + dir;
      nextId = ids[(n + ids.length) % ids.length];
    }
    if (nextId === state.trackId) { engine.seek(0); syncProgress(); return; }
    state.trackId = nextId;
    engine.load(getTrack(nextId));
    engine.play().catch(() => {});
    save();
    renderAll();
  }

  function onEnded() {
    if (state.repeat === 'one') {
      engine.seek(0);
      engine.play().catch(() => {});
      return;
    }
    const ids = state.queue.filter((id) => getTrack(id));
    const i = ids.indexOf(state.trackId);
    const isLast = i === ids.length - 1;
    if (isLast && state.repeat === 'off') {
      const dur = (getTrack(state.trackId) || {}).duration || 0;
      engine.stop(true);
      engine.pos = dur;
      refreshTransport();
      renderView();
      syncProgress();
      return;
    }
    stepTrack(1);
  }

  function toggleLike(id) {
    const i = state.favorites.indexOf(id);
    if (i === -1) state.favorites.push(id);
    else state.favorites.splice(i, 1);
    save();
    syncLikes();
    if (ui.view === 'library') renderLibrary();
    if (ui.npTab === 'now') renderNowPanel();
    if (el.sheet.open) renderSheet();
    toast(t(i === -1 ? 'toast.liked' : 'toast.unliked'));
  }

  function toast(message) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = ic('check') + '<span></span>';
    node.lastElementChild.textContent = message;
    el.toasts.appendChild(node);
    while (el.toasts.children.length > 3) el.toasts.firstElementChild.remove();
    window.setTimeout(() => {
      node.classList.add('is-out');
      window.setTimeout(() => node.remove(), 220);
    }, 2600);
  }

  function openSheet(tab) {
    if (window.innerWidth >= 680) {
      openTrackPage(state.trackId);
      return;
    }
    if (tab) ui.sheetTab = tab;
    renderSheet();
    if (!el.sheet.open) {
      if (typeof el.sheet.showModal === 'function') el.sheet.showModal();
      else el.sheet.setAttribute('open', '');
    }
  }

  function closeSheet() {
    if (el.sheet.open) el.sheet.close();
    else el.sheet.removeAttribute('open');
  }

  function setAccent(hex, rerender) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    state.accent = hex;
    NG.applyTheme();
    if (rerender !== false) { renderStudio(); if (el.sheet.open) renderSheet(); }
  }

  function setTheme(id) {
    state.theme = id;
    NG.applyTheme();
    save();
    renderStudio();
  }

  function saveAndRender() {
    save();
    renderAll();
  }

  /* ---------- seek binding ------------------------------------------------ */

  function bindSeek(node, onCommit) {
    if (!node) return;
    let dragging = false;
    const ratioAt = (clientX) => {
      const rect = node.getBoundingClientRect();
      if (!rect.width) return 0;
      return clamp((clientX - rect.left) / rect.width, 0, 1);
    };
    const preview = (ratio) => {
      const tr = getTrack(state.trackId);
      const dur = tr ? tr.duration : 0;
      node.style.setProperty('--pct', (ratio * 100) + '%');
      const pos = ratio * dur;
      $('#pCur').textContent = fmt(pos);
      $('#shCur').textContent = fmt(pos);
      node.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
      node.setAttribute('aria-valuetext', fmt(pos));
    };
    node.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      ui.dragging = true;
      node.classList.add('is-dragging');
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      preview(ratioAt(e.clientX));
      e.preventDefault();
    });
    node.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      preview(ratioAt(e.clientX));
    });
    const finish = (e) => {
      if (!dragging) return;
      dragging = false;
      ui.dragging = false;
      node.classList.remove('is-dragging');
      const ratio = ratioAt(e.clientX === undefined ? node.getBoundingClientRect().left : e.clientX);
      onCommit(ratio);
    };
    node.addEventListener('pointerup', finish);
    node.addEventListener('pointercancel', finish);
    node.addEventListener('keydown', (e) => {
      const dur = (getTrack(state.trackId) || {}).duration || 0;
      const cur = engine.getPosition();
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        engine.seek(clamp(cur + (e.key === 'ArrowRight' ? 5 : -5), 0, dur));
        syncProgress();
      } else if (e.key === 'Home') {
        e.preventDefault();
        e.stopPropagation();
        engine.seek(0);
        syncProgress();
      } else if (e.key === 'End') {
        e.preventDefault();
        e.stopPropagation();
        engine.seek(dur);
        syncProgress();
      }
    });
  }

  /* ---------- dialogs ----------------------------------------------------- */

  function renderShortcuts() {
    $('#shortcutList').innerHTML = [
      ['Space', 'shortcuts.play'], ['N', 'shortcuts.next'], ['P', 'shortcuts.prev'],
      ['← / →', 'shortcuts.seek'], ['M', 'shortcuts.mute'], ['S', 'shortcuts.shuffle'],
      ['R', 'shortcuts.repeat'], ['/', 'shortcuts.search'], ['F', 'shortcuts.sheet'],
      ['Esc', 'shortcuts.close'], ['?', 'shortcuts.help']
    ].map(([key, label]) =>
      '<div class="shortcut"><span>' + esc(t(label)) + '</span><kbd>' + esc(key) + '</kbd></div>'
    ).join('');
  }

  /* ---------- event wiring ------------------------------------------------ */

  function onAction(action, node) {
    switch (action) {
      case 'go': setView(node.dataset.view); break;
      case 'back':
        if (ui.histIdx > 0) { ui.histIdx -= 1; setView(ui.hist[ui.histIdx], false); }
        break;
      case 'forward':
        if (ui.histIdx < ui.hist.length - 1) { ui.histIdx += 1; setView(ui.hist[ui.histIdx], false); }
        break;
      case 'play': playTrack(node.dataset.id, ui.ctx[node.dataset.ctx]); break;
      case 'playlist': playPlaylist(node.dataset.id); break;
      case 'play-favorites': {
        const ids = state.favorites.filter((id) => getTrack(id));
        if (!ids.length) { toast(t('library.emptyLiked')); break; }
        ui.libTab = 'liked';
        setView('library');
        playTrack(ids[0], ids);
        break;
      }
      case 'like': toggleLike(node.dataset.id); break;
      case 'toggle': engine.toggle(); break;
      case 'next': stepTrack(1); break;
      case 'prev': stepTrack(-1); break;
      case 'shuffle':
        state.shuffle = !state.shuffle;
        save(); refreshTransport();
        break;
      case 'repeat': {
        const order = ['off', 'all', 'one'];
        state.repeat = order[(order.indexOf(state.repeat) + 1) % 3];
        save(); refreshTransport();
        break;
      }
      case 'mute':
        state.muted = !state.muted;
        engine.setVolume();
        save(); refreshTransport();
        break;
      case 'import': el.fileInput.click(); break;
      case 'shortcuts':
        renderShortcuts();
        el.shortcutsDlg.showModal();
        break;
      case 'reset-open': el.confirmDlg.showModal(); break;
      case 'reset-confirm': resetStudio(); break;
      case 'close-dlg': {
        const dlg = node.closest('dialog');
        if (dlg) dlg.close();
        break;
      }
      case 'theme': setTheme(node.dataset.id); break;
      case 'accent': setAccent(node.dataset.id); saveAndRender(); break;
      case 'density':
        state.density = node.dataset.id;
        NG.applyTheme(); saveAndRender();
        break;
      case 'motion':
        state.motion = !state.motion;
        NG.applyTheme(); saveAndRender();
        break;
      case 'new-playlist': openPlaylistForm(); break;
      case 'open-liked':
        ui.libTab = 'liked';
        setView('library');
        break;
      case 'library-tab':
        ui.libTab = node.dataset.tab;
        renderLibrary();
        renderRail();
        break;
      case 'genre':
        ui.genre = node.dataset.id;
        renderChips();
        if (ui.view !== 'home') setView('home');
        else renderHome();
        break;
      case 'clear-search':
        el.q.value = '';
        ui.q = '';
        el.qClear.hidden = true;
        el.searchWrap.classList.remove('has-value');
        if (ui.view === 'search') renderSearch();
        el.q.focus();
        break;
      case 'quick-search':
      case 'recent-search':
        el.q.value = node.dataset.q;
        ui.q = node.dataset.q;
        el.qClear.hidden = false;
        el.searchWrap.classList.add('has-value');
        if (ui.view !== 'search') setView('search');
        else renderSearch();
        triggerOnlineSearch(ui.q);
        break;
      case 'clear-recent':
        ui.recentSearches = [];
        renderSearch();
        break;
      case 'open-sheet':
        if (node.id === 'pTitleBtn' && window.innerWidth >= 1024) {
          openTrackPage(state.trackId);
        } else {
          openSheet(node.dataset.tab);
        }
        break;
      case 'close-sheet': closeSheet(); break;
      case 'open-track': {
        const id = node.dataset.id || state.trackId;
        openTrackPage(id);
        break;
      }
      case 'filter-artist': {
        const a = node.dataset.artist;
        if (a) {
          el.q.value = a;
          ui.q = a;
          el.qClear.hidden = false;
          el.searchWrap.classList.add('has-value');
          if (ui.view !== 'search') setView('search');
          else renderSearch();
          triggerOnlineSearch(a);
        }
        break;
      }
      case 'copy-song-link': {
        const tr = getTrack(node.dataset.id || state.trackId);
        if (tr) {
          const txt = byLang(tr.title) + ' - ' + byLang(tr.artist);
          try { navigator.clipboard.writeText(txt + ' • ' + window.location.href); } catch (e) {}
          toast(t('track.copied') || 'تم نسخ معلومات الأغنية بنجاح');
        }
        break;
      }
      case 'sheet-tab':
        ui.sheetTab = node.dataset.tab;
        renderSheet();
        break;
      case 'np-tab':
        ui.npTab = node.dataset.tab;
        $$('[data-action="np-tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ui.npTab)));
        renderNowPanel();
        break;
      case 'seek-lyric':
        engine.seek(Number(node.dataset.t));
        syncProgress();
        break;
      case 'queue-remove': removeFromQueue(Number(node.dataset.index)); break;
      case 'follow': {
        const key = node.dataset.id;
        if (ui.following.has(key)) ui.following.delete(key); else ui.following.add(key);
        renderNowPanel();
        if (ui.view === 'track') renderTrackPage();
        break;
      }
      case 'toggle-panel': {
        const hidden = document.documentElement.classList.toggle('panel-hidden');
        $('#panelToggle').setAttribute('aria-pressed', String(!hidden));
        break;
      }
      case 'lang': toggleLang(); break;
      case 'lang-set': setLang(node.dataset.id); break;
      default: break;
    }
  }

  function removeFromQueue(index) {
    if (index < 0 || index >= state.queue.length) return;
    if (state.queue.length <= 1) return;
    const removed = state.queue[index];
    state.queue.splice(index, 1);
    if (removed === state.trackId) {
      const nextId = state.queue[Math.min(index, state.queue.length - 1)];
      state.trackId = nextId;
      engine.load(getTrack(nextId));
      engine.play().catch(() => {});
    }
    save();
    renderAll();
  }

  function openPlaylistForm() {
    el.newPlName.value = '';
    if (typeof el.newPlDlg.showModal === 'function') el.newPlDlg.showModal();
    else el.newPlDlg.setAttribute('open', '');
    el.newPlName.focus();
  }

  function createPlaylist(name) {
    const clean = clampText(name, 48);
    if (!clean) { el.newPlDlg.close(); return; }
    const palette = NG.SEED_PLAYLISTS[state.playlists.length % NG.SEED_PLAYLISTS.length];
    const tr = getTrack(state.trackId);
    state.playlists.unshift({
      id: NG.uid('p'),
      name: { ar: clean, en: clean },
      sub: { ar: tr ? byLang(tr.artist) : '', en: tr ? byLang(tr.artist) : '' },
      colors: palette.colors.slice(),
      motif: palette.motif,
      trackIds: tr ? [tr.id] : []
    });
    el.newPlDlg.close();
    saveAndRender();
    toast(t('playlist.created'));
    ui.libTab = 'playlists';
    setView('library');
  }

  function resetStudio() {
    el.confirmDlg.close();
    NG.reset();
    NG.applyTheme();
    NG.applyI18n();
    engine.stop(true);
    engine.load(getTrack(state.trackId));
    engine.pos = 0;
    engine.setVolume();
    sanityCheck();
    save();
    renderAll();
    renderShortcuts();
    toast(t('toast.resetDone'));
  }

  function toggleLang() {
    setLang(state.lang === 'ar' ? 'en' : 'ar');
  }

  function setLang(lang) {
    if (lang !== 'ar' && lang !== 'en') return;
    if (state.lang === lang) return;
    state.lang = lang;
    NG.applyTheme();
    NG.applyI18n();
    save();
    renderAll();
    renderShortcuts();
    toast(t('toast.lang'));
  }

  function sanityCheck() {
    state.favorites = state.favorites.filter((id) => getTrack(id));
    state.queue = state.queue.filter((id) => getTrack(id));
    state.recent = state.recent.filter((id) => getTrack(id));
    state.playlists.forEach((pl) => { pl.trackIds = pl.trackIds.filter((id) => getTrack(id)); });
    if (!state.queue.length) state.queue = ['t1', 't2', 't3', 't4'];
    if (!getTrack(state.trackId)) state.trackId = state.queue[0];
  }

  function bind() {
    document.addEventListener('click', (e) => {
      const node = e.target.closest('[data-action]');
      if (!node) {
        const brief = e.target.closest('.np-brief, .player-mini-progress');
        if (brief) openSheet();
        return;
      }
      const action = node.dataset.action;
      if (node.tagName === 'A' && node.getAttribute('href') === '#') e.preventDefault();
      onAction(action, node);
    });

    el.q.addEventListener('input', () => {
      ui.q = el.q.value;
      el.qClear.hidden = !ui.q;
      el.searchWrap.classList.toggle('has-value', !!ui.q);
      if (ui.view !== 'search') setView('search');
      else renderSearch();
      triggerOnlineSearch(ui.q);
    });

    el.q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = el.q.value.trim();
        if (v) {
          ui.recentSearches = [v].concat(ui.recentSearches.filter((x) => x !== v)).slice(0, 6);
          triggerOnlineSearch(v);
          renderSearch();
        }
      } else if (e.key === 'Escape') {
        el.q.value = '';
        ui.q = '';
        el.qClear.hidden = true;
        el.searchWrap.classList.remove('has-value');
        renderSearch();
        el.q.blur();
      }
    });

    el.newPlForm.addEventListener('submit', (e) => {
      e.preventDefault();
      createPlaylist(el.newPlName.value);
    });

    el.fileInput.addEventListener('change', async () => {
      const files = el.fileInput.files;
      if (!files || !files.length) return;
      engine.ensure();
      try {
        const made = await engine.loadFiles(files);
        if (!made.length) { toast(t('toast.importError')); return; }
        playTrack(made[0].id, made.map((x) => x.id));
        toast(t('toast.imported'));
      } catch (err) {
        toast(t('toast.importError'));
      }
      el.fileInput.value = '';
    });

    el.vol.addEventListener('input', () => {
      state.volume = Number(el.vol.value);
      if (state.volume > 0) state.muted = false;
      engine.setVolume();
      el.vol.style.setProperty('--vol', state.volume + '%');
      refreshTransport();
    });
    el.vol.addEventListener('change', () => { save(); refreshTransport(); });

    el.sheet.addEventListener('click', (e) => {
      if (e.target === el.sheet) closeSheet();
    });
    el.sheet.addEventListener('close', () => { ui.dragging = false; });    el.confirmDlg.addEventListener('click', (e) => { if (e.target === el.confirmDlg) el.confirmDlg.close(); });
    el.shortcutsDlg.addEventListener('click', (e) => { if (e.target === el.shortcutsDlg) el.shortcutsDlg.close(); });
    el.newPlDlg.addEventListener('click', (e) => { if (e.target === el.newPlDlg) el.newPlDlg.close(); });

    bus.addEventListener('state', () => { refreshTransport(); renderView(); renderNowPanel(); });
    bus.addEventListener('tick', (e) => {
      if (ui.dragging) return;
      paintProgress(e.detail.pos, e.detail.duration);
    });
    bus.addEventListener('ended', onEnded);
    bus.addEventListener('meta', () => { renderPlayer(); renderView(); });
    bus.addEventListener('app-toast', (e) => toast(t(e.detail.key)));
    bus.addEventListener('error', () => toast(t('toast.importError')));

    document.addEventListener('keydown', (e) => {
      const target = e.target;
      const tag = (target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
      if (e.key === 'Escape') {
        if (el.sheet.open) { closeSheet(); return; }
        if (el.shortcutsDlg.open) { el.shortcutsDlg.close(); return; }
        if (el.confirmDlg.open) { el.confirmDlg.close(); return; }
        if (el.newPlDlg.open) { el.newPlDlg.close(); return; }
        if (ui.q) {
          el.q.value = '';
          ui.q = '';
          el.qClear.hidden = true;
          el.searchWrap.classList.remove('has-value');
          renderSearch();
        }
        if (typing) target.blur();
        closeSheet();
        return;
      }
      if (typing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      if (key === '/') {
        e.preventDefault();
        el.q.focus();
        el.q.select();
        return;
      }
      if (key === '?' || (key === '/' && e.shiftKey)) {
        e.preventDefault();
        renderShortcuts();
        el.shortcutsDlg.showModal();
        return;
      }
      if (key === ' ' || key === 'Spacebar') {
        if (target.closest && target.closest('button, a, [role="slider"], [role="button"]')) return;
        e.preventDefault();
        engine.toggle();
        return;
      }
      const k = key.toLowerCase();
      if (k === 'n') { e.preventDefault(); stepTrack(1); }
      else if (k === 'p') { e.preventDefault(); stepTrack(-1); }
      else if (k === 'm') { e.preventDefault(); state.muted = !state.muted; engine.setVolume(); save(); refreshTransport(); }
      else if (k === 's') { e.preventDefault(); state.shuffle = !state.shuffle; save(); refreshTransport(); }
      else if (k === 'r') { e.preventDefault(); state.repeat = ['off', 'all', 'one'][(['off', 'all', 'one'].indexOf(state.repeat) + 1) % 3]; save(); refreshTransport(); }
      else if (k === 'f') { e.preventDefault(); if (el.sheet.open) closeSheet(); else openSheet(); }
      else if (key === 'ArrowRight') { e.preventDefault(); engine.seek(engine.getPosition() + 5); syncProgress(); }
      else if (key === 'ArrowLeft') { e.preventDefault(); engine.seek(engine.getPosition() - 5); syncProgress(); }
    });

    document.addEventListener('pointerdown', () => {});
  }
  function boot() {
    sanityCheck();
    NG.applyTheme();
    NG.applyI18n();
    bind();
    bindSeek($('#pSeek'), (ratio) => { engine.seek(ratio * (getTrack(state.trackId) || {}).duration); syncProgress(); });
    bindSeek($('#shSeek'), (ratio) => { engine.seek(ratio * (getTrack(state.trackId) || {}).duration); syncProgress(); });
    engine.load(getTrack(state.trackId));
    renderShortcuts();
    renderAll();
    syncProgress();
    el.vol.value = String(state.volume);
    el.vol.style.setProperty('--vol', state.volume + '%');
    $$('[data-view-section]').forEach((s) => { s.hidden = s.dataset.viewSection !== ui.view; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.__nagham = { ui, state, playTrack, stepTrack, setView, openSheet, closeSheet, openTrackPage, renderTrackPage };
})();
