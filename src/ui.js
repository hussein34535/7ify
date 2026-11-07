/* ==========================================================================
   NAGHAM STUDIO — ui: rendering, interaction, keyboard
   ========================================================================== */
(function () {
  'use strict';

  const NG = window.NG;
  const {
    $, $$, esc, fmt, norm, t, state, getTrack, getPlayableDuration, byLang, coverHTML, paintCover, clamp, clampText, bus, engine, providers, save,
    getAlbums, getArtistTracks, getArtistAlbums, getAlbumTracks
  } = NG;
  const TRACKS = NG.TRACKS;

  const ui = {
    view: 'home',
    viewTrackId: null,
    activePlaylistId: null,
    activeArtistName: null,
    activeAlbumName: null,
    hist: ['home'],
    histIdx: 0,
    genre: 'all',
    libTab: 'playlists',
    libFilter: '',
    libView: 'grid',
    q: '',
    isSearchingOnline: false,
    recentSearches: [],
    npTab: 'now',
    sheetTab: 'player',
    dragging: false,
    ctx: { home: [], search: [], lib: [], playlist: [], artist: [], album: [] },
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
    playlist: $('#view-playlist'),
    artist: $('#view-artist'),
    album: $('#view-album'),
    scroll: $('#scroll'),
    np: $('#npBody'),
    npPanel: $('#nowPanel'),
    sheet: $('#sheet'),
    sheetPanel: $('#sheetPanel'),
    toasts: $('#toasts'),
    q: $('#q'),
    searchWrap: $('#searchWrap'),
    qClear: $('#qClear'),
    searchAutocomplete: $('#searchAutocomplete'),
    newPlForm: $('#newPlForm'),
    newPlName: $('#newPlName'),
    newPlDlg: $('#newPlDlg'),
    fileInput: $('#fileInput'),
    shortcutsDlg: $('#shortcutsDlg'),
    confirmDlg: $('#confirmDlg'),
    sourcesDlg: $('#sourcesDlg'),
    sourcesList: $('#sourcesList'),
    sourcesTrackInfo: $('#sourcesTrackInfo'),
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
      const letter = typeof a.name === 'string' ? a.name.slice(0, 1) : ((a.name && (a.name.ar || a.name.en)) || '?').slice(0, 1);
      return '<span class="avatar-art"><b>' + esc(letter) + '</b></span>';
    }
    return '<span class="avatar-art has-photo"><img class="avatar-img" src="' + esc(src) + '" alt="" loading="lazy" decoding="async" onerror="this.remove();this.parentNode.classList.remove(\'has-photo\')"></span>';
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

  function providerBadgeHTML(tr) {
    return '';
  }

  function openSourcesDialog(tr) {
    if (!tr) return;
    const infoEl = $('#sourcesTrackInfo');
    const listEl = $('#sourcesList');
    if (!infoEl || !listEl) return;

    infoEl.innerHTML = '<div class="sources-track-art">' + trackArt(tr) + '</div>' +
      '<div class="sources-track-details">' +
        '<h3 class="clamp-1">' + L(tr.title) + '</h3>' +
        '<p class="clamp-1">' + L(tr.artist) + ' · ' + fmt(tr.duration) + '</p>' +
      '</div>';

    let sources = Array.isArray(tr.sources) && tr.sources.length ? tr.sources : [];
    if (!sources.length) {
      if (tr.source === 'file' || tr.playbackType === 'local') {
        sources = [{ provider: 'local', mode: 'full', duration: tr.duration, id: tr.id }];
      } else if (tr.playbackProvider === 'youtube' || tr.youtubeId) {
        sources = [{ provider: 'youtube', mode: 'embed', duration: tr.duration, id: tr.youtubeId || tr.id }];
      } else if (tr.previewUrl) {
        sources = [{ provider: 'apple', mode: 'preview', duration: tr.previewDuration || 30, previewUrl: tr.previewUrl, id: tr.id }];
      }
    }

    const activeProvider = (engine.track?.id === tr.id && engine.track?.playbackProvider) || tr.playbackProvider || (tr.source === 'file' ? 'local' : 'apple');

    listEl.innerHTML = sources.map((s) => {
      const isActive = (engine.track?.id === tr.id) && (activeProvider === s.provider);
      let provName = 'Apple Music';
      let provBadgeCls = 'prov-apple';
      let provDesc = state.lang === 'ar' ? 'معاينة صوتية رسمية من Apple Music' : 'Official 30s preview from Apple Music';
      if (s.provider === 'youtube') {
        provName = 'YouTube';
        provBadgeCls = 'prov-yt';
        provDesc = state.lang === 'ar' ? 'تشغيل كامل عبر مشغل YouTube IFrame API الرسمي' : 'Full playback via official YouTube IFrame API';
      } else if (s.provider === 'jamendo') {
        provName = 'Jamendo';
        provBadgeCls = 'prov-jam';
        provDesc = state.lang === 'ar' ? 'تشغيل كامل بترخيص Creative Commons' : 'Full playback with Creative Commons license';
      } else if (s.provider === 'archive') {
        provName = 'Internet Archive';
        provBadgeCls = 'prov-arc';
        provDesc = state.lang === 'ar' ? 'تشغيل كامل من أرشيف التسجيلات الحرة' : 'Full playback from open audio archive';
      } else if (s.provider === 'spotify') {
        provName = 'Spotify';
        provBadgeCls = 'prov-sp';
        provDesc = state.lang === 'ar' ? 'تشغيل كامل لمشتركي Spotify Premium' : 'Full playback for Spotify Premium users';
      } else if (s.provider === 'local') {
        provName = t('player.local') || 'ملف محلي';
        provBadgeCls = 'prov-loc';
        provDesc = state.lang === 'ar' ? 'ملف صوتي تم استيراده على هذا الجهاز' : 'Audio file imported on this device';
      }

      const modeLabel = s.mode === 'full' ? (t('sources.full') || 'تشغيل كامل') :
                        s.mode === 'embed' ? (t('sources.embed') || 'مشغل رسمي') :
                        (t('sources.preview') || 'معاينة ٣٠ ثانية');

      const dur = s.duration || (s.mode === 'preview' ? 30 : tr.duration);

      return '<div class="source-card ' + (isActive ? 'is-active' : '') + '">' +
        '<div class="source-card-info">' +
          '<div class="source-card-header">' +
            '<span class="source-card-name">' + esc(provName) + '</span>' +
            '<span class="badge-source ' + provBadgeCls + '">' + esc(modeLabel) + '</span>' +
            '<span class="source-card-dur num">' + fmt(dur) + '</span>' +
          '</div>' +
          '<div class="source-card-desc">' + esc(provDesc) + '</div>' +
        '</div>' +
        '<div class="source-card-actions">' +
          (isActive
            ? '<span class="badge-active-source">' + esc(t('sources.active') || 'يعمل حاليًا') + '</span>'
            : '<button class="btn btn-sm" data-action="switch-source" data-provider="' + esc(s.provider) + '" data-track-id="' + esc(tr.id) + '">' + esc(t('sources.switch') || 'تشغيل بهذا المصدر') + '</button>'
          ) +
        '</div>' +
      '</div>';
    }).join('');

    if (el.sourcesDlg) el.sourcesDlg.showModal();
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
      '<span class="row-artist clamp-1"><span class="row-artist-name">' + L(tr.artist) + '</span> ' + providerBadgeHTML(tr) + '</span>' +
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
    const artName = a.name?.ar || a.name?.en || '';
    return '<button class="artist" data-action="artist" data-artist="' + esc(artName) + '">' +
      artistAvatar(a) +
      '<span class="artist-name clamp-1">' + L(a.name) + '</span>' +
      '<span class="artist-sub clamp-1">' + L(a.sub) + '</span></button>';
  }

  function renderHome() {
    const pool = filteredTracks();
    const poolIds = pool.map((tr) => tr.id);
    ui.ctx.home = poolIds;
    const featured = pool[0] || getTrack('t1');
    const recentIds = state.recent.filter((id) => getTrack(id));
    const jumpIds = [...recentIds, ...poolIds.filter((id) => !recentIds.includes(id))].slice(0, 6);
    const jump = jumpIds.map(getTrack).filter(Boolean);
    const mixes = state.playlists.slice(0, 4);
    const trending = pool.slice(0, 7);
    const fav = isFav(featured.id);
    const featuredPlaying = state.trackId === featured.id && engine.playing;

    let html = '<div class="greet"><div><h1>' + esc(t(greetingKey())) + '</h1><p>' + esc(t('greet.sub')) + '</p></div>' +
      '<span class="greet-date">' + esc(dateText()) + '</span></div>';

    // Quick Picks 6-Grid
    html += '<section class="section section-quick-picks">' +
      '<div class="jump-grid">' + jump.map((tr) =>
        '<button class="jump group" data-action="play" data-id="' + tr.id + '" data-ctx="home">' +
        trackArt(tr) + '<span class="jump-title clamp-2">' + L(tr.title) + '</span>' +
        '<span class="jump-play play-btn" aria-hidden="true">' + ic('play') + '</span></button>'
      ).join('') + '</div></section>';

    html += '<article class="hero" aria-labelledby="heroTitle" style="display:none;--c1:' + featured.colors[0] + ';--c2:' + featured.colors[1] + ';--c3:' + featured.colors[2] + '">' +
      '<div class="hero-art">' + trackArt(featured, 'hero-cover', true) + '</div>' +
      '<div class="hero-content">' +
      '<span class="hero-tag">' + ic('sparkle') + ' ' + esc(featured.source === 'file' ? t('player.local') : t('hero.badge')) + ' · ' + featured.year + '</span>' +
      '<h1 id="heroTitle">' + L(featured.title) + '</h1>' +
      '<div class="hero-meta"><span class="hero-artist" data-action="artist" data-artist="' + esc(featured.artist?.ar || featured.artist?.en || '') + '" style="cursor:pointer">' + L(featured.artist) + '</span>' +
      '<span class="sep hero-sep-1"></span><span class="hero-album" data-action="album" data-album="' + esc(featured.album?.ar || featured.album?.en || '') + '" style="cursor:pointer">' + esc(t('hero.album')) + ' · ' + L(featured.album) + '</span>' +
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

    if (mixes.length) {
      html += '<section class="section">' + sectionHead(t('sec.mixes'), t('sec.mixesSub'), 'library') +
        '<div class="shelf">' + mixes.map((pl) => {
          const count = playlistTracks(pl).length;
          const current = ui.activePl === pl.id;
          return '<button class="card' + (current ? ' is-current' : '') + '" data-action="playlist" data-id="' + pl.id + '">' +
            '<span class="card-art">' + playlistCover(pl) +
            '<span class="fab play-btn" data-action="play-playlist" data-id="' + pl.id + '" aria-hidden="true">' + ic('play') + '</span></span>' +
            '<span class="card-title clamp-1">' + L(pl.name) + '</span>' +
            '<span class="card-sub clamp-2">' + L(pl.sub) + ' · ' + esc(countLabel(count, 'songs')) + '</span></button>';
        }).join('') + '</div></section>';
    }

    html += '<section class="section">' + sectionHead(t('sec.trending'), t('sec.trendingSub')) +
      '<div class="rows">' + trending.map((tr, i) => rowHTML(tr, i, 'home')).join('') + '</div></section>';

    html += '<section class="section">' + sectionHead(t('sec.artists'), t('sec.artistsSub'), 'search') +
      '<div class="artist-grid">' + NG.ARTISTS.slice(0, 6).map(artistCard).join('') + '</div></section>';

    const albums = getAlbums ? getAlbums().slice(0, 6) : [];
    if (albums.length) {
      html += '<section class="section">' + sectionHead(t('sec.featuredAlbums') || 'أحدث الألبومات', '') +
        '<div class="shelf">' + albums.map((alb) =>
          '<button class="card" data-action="album" data-album="' + esc(alb.name?.ar || alb.name?.en || '') + '">' +
          '<span class="card-art">' + coverHTML(alb) +
          '<span class="fab play-btn" data-action="play-album-all" data-album="' + esc(alb.name?.ar || alb.name?.en || '') + '" aria-hidden="true">' + ic('play') + '</span></span>' +
          '<span class="card-title clamp-1">' + L(alb.name) + '</span>' +
          '<span class="card-sub clamp-1">' + L(alb.artist) + (alb.year ? ' · ' + alb.year : '') + '</span></button>'
        ).join('') + '</div></section>';
    }

    const arabicTracks = TRACKS.filter((tr) => tr.genre === 'arabic').slice(0, 6);
    if (arabicTracks.length) {
      html += '<section class="section">' + sectionHead(t('sec.arabicMusic') || 'الموسيقى العربية', '') +
        '<div class="rows">' + arabicTracks.map((tr, i) => rowHTML(tr, i, 'home')).join('') + '</div></section>';
    }

    const intlTracks = TRACKS.filter((tr) => tr.genre !== 'arabic').slice(0, 6);
    if (intlTracks.length) {
      html += '<section class="section">' + sectionHead(t('sec.intlMusic') || 'الموسيقى العالمية', '') +
        '<div class="rows">' + intlTracks.map((tr, i) => rowHTML(tr, i, 'home')).join('') + '</div></section>';
    }

    el.home.innerHTML = html;
  }

  /* ---------- search ------------------------------------------------------ */

  function searchIntro() {
    const recent = ui.recentSearches.slice(0, 6);
    let html = '<div class="search-head"><div><h1>' + esc(t('search.title')) + '</h1>' +
      '<p>' + esc(t('search.noQueryBody')) + '</p></div></div>';

    html += '<div class="search-landing-box" data-action="focus-search" role="button" tabindex="0">' +
      '<svg class="ic" aria-hidden="true" style="width:20px;height:20px;fill:currentColor;flex-shrink:0;"><use href="#i-search"></use></svg>' +
      '<span>' + esc(t('search.placeholder')) + '</span>' +
      '</div>';

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

  let searchTimer = null;
  let activeSearchController = null;
  let searchSequence = 0;
  let autocompleteItems = [];
  let activeSuggestionIndex = -1;

  function closeAutocomplete() {
    if (el.searchAutocomplete) {
      el.searchAutocomplete.hidden = true;
      el.searchAutocomplete.innerHTML = '';
    }
    if (el.q) {
      el.q.setAttribute('aria-expanded', 'false');
      el.q.removeAttribute('aria-activedescendant');
    }
    activeSuggestionIndex = -1;
    autocompleteItems = [];
  }

  function setActiveSuggestion(index) {
    if (!el.searchAutocomplete || el.searchAutocomplete.hidden) return;
    const nodes = Array.from(el.searchAutocomplete.querySelectorAll('[data-autocomplete-index]'));
    if (!nodes.length) {
      activeSuggestionIndex = -1;
      return;
    }

    if (index >= nodes.length) {
      activeSuggestionIndex = -1;
    } else if (index < -1) {
      activeSuggestionIndex = nodes.length - 1;
    } else {
      activeSuggestionIndex = index;
    }

    nodes.forEach((node, i) => {
      const active = i === activeSuggestionIndex;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-selected', String(active));
    });

    if (activeSuggestionIndex >= 0 && nodes[activeSuggestionIndex]) {
      const activeNode = nodes[activeSuggestionIndex];
      el.q.setAttribute('aria-activedescendant', activeNode.id);
      activeNode.scrollIntoView({ block: 'nearest' });
    } else {
      el.q.removeAttribute('aria-activedescendant');
    }
  }

  function renderAutocomplete({ query, localSongs, remoteSongs, artists, albums, loading }) {
    if (!el.searchAutocomplete) return;
    const q = String(query || '').trim();

    if (!q) {
      const recent = ui.recentSearches.slice(0, 5);
      if (!recent.length) {
        closeAutocomplete();
        return;
      }
      autocompleteItems = recent.map((term) => ({ type: 'recent', term, label: term }));
      activeSuggestionIndex = -1;
      let html = '<div class="autocomplete-section">' +
        '<div class="autocomplete-header">' + esc(t('search.recent') || 'عمليات البحث الأخيرة') + '</div>' +
        recent.map((term, i) =>
          '<button class="autocomplete-item" role="option" id="ac-item-' + i + '" data-autocomplete-index="' + i + '" data-type="recent" data-term="' + esc(term) + '">' +
            '<span class="autocomplete-art"><svg class="ic" aria-hidden="true"><use href="#i-clock"></use></svg></span>' +
            '<div class="autocomplete-info"><span class="autocomplete-title clamp-1">' + esc(term) + '</span></div>' +
          '</button>'
        ).join('') +
      '</div>';
      el.searchAutocomplete.innerHTML = html;
      el.searchAutocomplete.hidden = false;
      el.q.setAttribute('aria-expanded', 'true');
      return;
    }

    // Deduplicate songs for autocomplete (limit to top 4)
    const combinedSongs = [];
    const seenSongIds = new Set();
    for (const tr of (localSongs || [])) {
      seenSongIds.add(tr.id);
      combinedSongs.push(tr);
    }
    for (const tr of (remoteSongs || [])) {
      if (!seenSongIds.has(tr.id)) {
        seenSongIds.add(tr.id);
        combinedSongs.push(tr);
      }
    }
    const songsSlice = combinedSongs.slice(0, 4);
    const artistsSlice = (artists || []).slice(0, 3);
    const albumsSlice = (albums || []).slice(0, 3);

    autocompleteItems = [];
    let html = '';

    // 1. Query Item ("Search for...")
    const queryIndex = autocompleteItems.length;
    autocompleteItems.push({ type: 'query', term: q });
    html += '<div class="autocomplete-section">' +
      '<button class="autocomplete-item autocomplete-query-item" role="option" id="ac-item-' + queryIndex + '" data-autocomplete-index="' + queryIndex + '" data-type="query" data-term="' + esc(q) + '">' +
        '<span class="autocomplete-art"><svg class="ic" aria-hidden="true"><use href="#i-search"></use></svg></span>' +
        '<div class="autocomplete-info">' +
          '<span class="autocomplete-title clamp-1">' + (state.lang === 'ar' ? 'البحث عن «' + esc(q) + '»' : 'Search for "' + esc(q) + '"') + '</span>' +
        '</div>' +
        (loading ? '<span class="autocomplete-side"><svg class="ic" aria-hidden="true" style="animation:spin 1s linear infinite"><use href="#i-sparkle"></use></svg></span>' : '') +
      '</button>' +
    '</div>';

    // 2. Songs Section
    if (songsSlice.length) {
      html += '<div class="autocomplete-section">' +
        '<div class="autocomplete-header">' + esc(t('search.songs') || 'الأغاني') + '</div>';
      songsSlice.forEach(tr => {
        const itemIndex = autocompleteItems.length;
        autocompleteItems.push({ type: 'track', id: tr.id, track: tr });
        const provBadge = providerBadgeHTML(tr);
        html += '<button class="autocomplete-item" role="option" id="ac-item-' + itemIndex + '" data-autocomplete-index="' + itemIndex + '" data-type="track" data-id="' + esc(tr.id) + '">' +
          '<div class="autocomplete-art">' + trackArt(tr) + '</div>' +
          '<div class="autocomplete-info">' +
            '<span class="autocomplete-title clamp-1">' + L(tr.title) + '</span>' +
            '<span class="autocomplete-sub clamp-1">' + L(tr.artist) + ' ' + provBadge + '</span>' +
          '</div>' +
          '<span class="autocomplete-side num">' + fmt(tr.duration) + '</span>' +
        '</button>';
      });
      html += '</div>';
    }

    // 3. Artists Section
    if (artistsSlice.length) {
      html += '<div class="autocomplete-section">' +
        '<div class="autocomplete-header">' + esc(t('search.artists') || 'الفنانون') + '</div>';
      artistsSlice.forEach(a => {
        const itemIndex = autocompleteItems.length;
        const artName = a.name?.ar || a.name?.en || a.name || '';
        autocompleteItems.push({ type: 'artist', artistName: artName, artist: a });
        html += '<button class="autocomplete-item" role="option" id="ac-item-' + itemIndex + '" data-autocomplete-index="' + itemIndex + '" data-type="artist" data-artist="' + esc(artName) + '">' +
          '<div class="autocomplete-art is-avatar">' + artistAvatar(a) + '</div>' +
          '<div class="autocomplete-info">' +
            '<span class="autocomplete-title clamp-1">' + L(a.name) + '</span>' +
            '<span class="autocomplete-sub clamp-1">' + L(a.sub || t('search.artists')) + '</span>' +
          '</div>' +
        '</button>';
      });
      html += '</div>';
    }

    // 4. Albums Section
    if (albumsSlice.length) {
      html += '<div class="autocomplete-section">' +
        '<div class="autocomplete-header">' + esc(t('library.tabAlbums') || 'الألبومات') + '</div>';
      albumsSlice.forEach(alb => {
        const itemIndex = autocompleteItems.length;
        const albTitle = alb.title?.ar || alb.title?.en || alb.title || alb.name?.ar || alb.name?.en || alb.name || '';
        autocompleteItems.push({ type: 'album', albumTitle: albTitle, album: alb });
        const albArt = alb.art ? ('<img src="' + esc(alb.art) + '" alt="" loading="lazy">') : trackArt({ colors: alb.colors || ['#222','#444','#666'], motif: 'orb' });
        html += '<button class="autocomplete-item" role="option" id="ac-item-' + itemIndex + '" data-autocomplete-index="' + itemIndex + '" data-type="album" data-album="' + esc(albTitle) + '">' +
          '<div class="autocomplete-art">' + albArt + '</div>' +
          '<div class="autocomplete-info">' +
            '<span class="autocomplete-title clamp-1">' + L(alb.title || alb.name) + '</span>' +
            '<span class="autocomplete-sub clamp-1">' + L(alb.artist) + '</span>' +
          '</div>' +
        '</button>';
      });
      html += '</div>';
    }

    el.searchAutocomplete.innerHTML = html;
    el.searchAutocomplete.hidden = false;
    el.q.setAttribute('aria-expanded', 'true');
    activeSuggestionIndex = -1;
  }

  function selectAutocompleteItem(item) {
    if (!item) return;
    if (item.type === 'query') {
      const q = item.term.trim();
      if (q) {
        ui.recentSearches = [q].concat(ui.recentSearches.filter((x) => x !== q)).slice(0, 6);
        el.q.value = q;
        ui.q = q;
        closeAutocomplete();
        setView('search');
        renderSearch();
      }
    } else if (item.type === 'recent') {
      el.q.value = item.term;
      ui.q = item.term;
      closeAutocomplete();
      runUnifiedSearch(item.term);
      setView('search');
    } else if (item.type === 'track') {
      closeAutocomplete();
      playTrack(item.id, 'search');
    } else if (item.type === 'artist') {
      closeAutocomplete();
      openArtistPage(item.artistName);
    } else if (item.type === 'album') {
      closeAutocomplete();
      openAlbumPage(item.albumTitle);
    }
  }

  function runUnifiedSearch(rawQuery) {
    const q = String(rawQuery || '').trim();
    ui.q = rawQuery;
    const requestId = ++searchSequence;

    clearTimeout(searchTimer);
    if (activeSearchController) {
      try { activeSearchController.abort(); } catch (e) {}
      activeSearchController = null;
    }

    // 1. Immediate Local Search
    const localSongs = q ? NG.searchTracks(q) : [];
    const localArtists = q ? NG.searchArtists(q) : [];
    const localAlbums = q ? (NG.searchAlbums ? NG.searchAlbums(q) : []) : [];

    // Render local matches to autocomplete and search view immediately
    renderAutocomplete({
      query: q,
      localSongs,
      remoteSongs: ui.onlineSongs || [],
      artists: (localArtists.length ? localArtists : (ui.onlineArtists || [])),
      albums: (localAlbums.length ? localAlbums : (ui.onlineAlbums || [])),
      loading: q.length >= 2
    });

    if (ui.view === 'search') {
      renderSearch();
    }

    if (q.length < 2) {
      ui.isSearchingOnline = false;
      return;
    }

    // 2. Debounced Remote Search (250ms)
    ui.isSearchingOnline = true;
    searchTimer = setTimeout(async () => {
      if (requestId !== searchSequence) return;

      const controller = new AbortController();
      activeSearchController = controller;

      try {
        const response = await fetch('/api/search-multi?q=' + encodeURIComponent(q), {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });

        if (requestId !== searchSequence) return;

        if (!response.ok) {
          throw new Error('Search request failed: ' + response.status);
        }

        const payload = await response.json();
        if (requestId !== searchSequence) return;

        ui.isSearchingOnline = false;
        const remoteResults = Array.isArray(payload.results) ? payload.results : [];
        const remoteArtists = Array.isArray(payload.artists) ? payload.artists : [];
        const remoteAlbums = Array.isArray(payload.albums) ? payload.albums : [];

        // Save remote tracks to runtime TRACKS registry
        remoteResults.forEach(tr => {
          const existingIdx = NG.TRACKS.findIndex((t) => t.id === tr.id);
          if (existingIdx === -1) NG.TRACKS.push(tr);
          else NG.TRACKS[existingIdx] = Object.assign(NG.TRACKS[existingIdx], tr);
        });

        ui.onlineSongs = remoteResults;
        ui.onlineArtists = remoteArtists;
        ui.onlineAlbums = remoteAlbums;

        // Update search view and autocomplete
        if (ui.view === 'search') {
          renderSearch();
        }

        renderAutocomplete({
          query: q,
          localSongs,
          remoteSongs: remoteResults,
          artists: (localArtists.length ? localArtists : remoteArtists),
          albums: (localAlbums.length ? localAlbums : remoteAlbums),
          loading: false
        });
      } catch (error) {
        if (error.name === 'AbortError' || requestId !== searchSequence) return;
        ui.isSearchingOnline = false;
        // Keep local results intact on error
        if (ui.view === 'search') renderSearch();
        renderAutocomplete({
          query: q,
          localSongs,
          remoteSongs: ui.onlineSongs || [],
          artists: localArtists,
          albums: localAlbums,
          loading: false
        });
      }
    }, 250);
  }

  function triggerOnlineSearch(query) {
    runUnifiedSearch(query);
  }

  function renderSearch() {
    const q = ui.q.trim();
    if (!q) {
      ui.onlineSongs = [];
      ui.onlineArtists = [];
      el.search.innerHTML = searchIntro();
      return;
    }

    const localSongs = NG.searchTracks(q);
    const localArtists = NG.searchArtists(q);
    const onlineSongs = ui.onlineSongs || [];
    const onlineArtists = ui.onlineArtists || [];

    // Deduplicate songs
    const seenSongIds = new Set();
    const songs = [];
    for (const tr of localSongs) {
      seenSongIds.add(tr.id);
      songs.push(tr);
    }
    for (const tr of onlineSongs) {
      if (!seenSongIds.has(tr.id)) {
        const normTitle = norm(tr.title?.ar || tr.title?.en);
        const normArt = norm(tr.artist?.ar || tr.artist?.en);
        const isDup = songs.some(s => norm(s.title?.ar || s.title?.en) === normTitle && norm(s.artist?.ar || s.artist?.en) === normArt);
        if (!isDup) {
          seenSongIds.add(tr.id);
          songs.push(tr);
        }
      }
    }

    // Deduplicate artists
    const seenArtists = new Set();
    const artists = [];
    for (const a of localArtists) {
      const k = norm(a.name.ar || a.name.en);
      seenArtists.add(k);
      artists.push(a);
    }
    for (const a of onlineArtists) {
      const k = norm(a.name.ar || a.name.en);
      if (!seenArtists.has(k)) {
        seenArtists.add(k);
        artists.push(a);
      }
    }

    ui.ctx.search = songs.map((tr) => tr.id);

    const statusBadge = (ui.isSearchingOnline && songs.length === 0)
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
        '<div class="rows">' + songs.slice(0, 20).map((tr, i) => rowHTML(tr, i, 'search')).join('') + '</div></div></div>';
    }

    if (artists.length && songs.length) {
      html += '<section class="section">' + sectionHead(t('search.artists'), '') +
        '<div class="artist-grid">' + artists.slice(0, 8).map(artistCard).join('') + '</div></section>';
    }

    if (songs.length + artists.length < 5) {
      html += '<section class="section" style="margin-top:8px">' + sectionHead(t('search.browse'), '') + browseTiles() + '</section>';
    }

    el.search.innerHTML = html;
  }

  /* ---------- library ----------------------------------------------------- */

  function libTabs() {
    const tabs = [
      ['playlists', 'library.tabPlaylists'],
      ['liked', 'library.tabLiked'],
      ['artists', 'library.tabArtists'],
      ['albums', 'library.tabAlbums']
    ];
    return '<div class="lib-tabs" role="tablist" aria-label="' + esc(t('library.title')) + '">' + tabs.map(([id, key]) =>
      '<button class="lib-tab' + (ui.libTab === id ? ' is-active' : '') + '" role="tab" data-action="library-tab" data-tab="' + id + '" aria-selected="' + (ui.libTab === id) + '">' + esc(t(key)) + '</button>'
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
            '<span class="fab play-btn" data-action="play-playlist" data-id="' + pl.id + '" aria-hidden="true">' + ic('play') + '</span></span>' +
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
    } else if (ui.libTab === 'albums') {
      const albums = getAlbums ? getAlbums() : [];
      if (!albums.length) {
        html += emptyState('disc', 'لا توجد ألبومات', 'استكشف ألبومات الكتالوج أو أضف ملفاتك المحلية.');
      } else {
        html += '<div class="card-grid">' + albums.map((alb) =>
          '<button class="card" data-action="album" data-album="' + esc(alb.name?.ar || alb.name?.en || '') + '">' +
            '<span class="card-art">' + coverHTML(alb) +
            '<span class="fab play-btn" data-action="play-album-all" data-album="' + esc(alb.name?.ar || alb.name?.en || '') + '" aria-hidden="true">' + ic('play') + '</span></span>' +
            '<span class="card-title clamp-1">' + L(alb.name) + '</span>' +
            '<span class="card-sub clamp-1">' + L(alb.artist) + (alb.year ? ' · ' + alb.year : '') + '</span>' +
            '<span class="card-sub">' + esc(countLabel(alb.tracks.length, 'songs')) + '</span></button>'
        ).join('') + '</div>';
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

      '<section class="panel-block"><h2>' + esc(t('studio.providers')) + '</h2><p>' + esc(t('studio.providersSub')) + '</p>' +
      (function() {
        const pStatus = (providers && typeof providers.getProviderStatus === 'function')
          ? providers.getProviderStatus()
          : { spotify: { connected: false } };
        const isConn = Boolean(pStatus.spotify && pStatus.spotify.connected);
        return '<div class="engine-card" style="margin-bottom:8px">' +
          '<span class="dot" style="background:' + (isConn ? '#1ED760' : 'var(--muted)') + '"></span>' +
          '<span><b>' + (isConn ? esc(t('studio.spotifyConnected')) : esc(t('studio.spotifyDisconnected'))) + '</b>' +
          '<span style="font-size:11px;color:var(--muted);display:block;margin-top:4px">' + esc(t('studio.providerNotice')) + '</span></span></div>' +
          '<div class="btn-row">' +
          (isConn
            ? '<button class="btn btn-danger" data-action="disconnect-spotify">' + ic('trash') + esc(t('studio.disconnectSpotify')) + '</button>'
            : '<button class="btn btn-accent" data-action="connect-spotify">' + ic('plus') + esc(t('studio.connectSpotify')) + '</button>') +
          '</div>';
      })() + '</section>' +

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

  /* ---------- Media Session & Tab Title ----------------------------------- */
  function updateMediaSession() {
    const tr = getTrack(state.trackId);
    if (!tr) return;
    const title = byLang(tr.title);
    const artist = byLang(tr.artist);
    const album = byLang(tr.album);
    const playing = engine.playing;

    document.title = (playing ? '▶ ' : '') + title + ' • ' + artist + ' — 7ify';

    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork: tr.art ? [
          { src: tr.art, sizes: '96x96', type: 'image/jpeg' },
          { src: tr.art, sizes: '128x128', type: 'image/jpeg' },
          { src: tr.art, sizes: '192x192', type: 'image/jpeg' },
          { src: tr.art, sizes: '256x256', type: 'image/jpeg' },
          { src: tr.art, sizes: '512x512', type: 'image/jpeg' }
        ] : []
      });
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    } catch (e) {}
  }

  let mediaSessionInitialized = false;
  function initMediaSession() {
    if (!('mediaSession' in navigator) || mediaSessionInitialized) return;
    mediaSessionInitialized = true;
    try {
      navigator.mediaSession.setActionHandler('play', () => { if (!engine.playing) engine.toggle(); });
      navigator.mediaSession.setActionHandler('pause', () => { if (engine.playing) engine.toggle(); });
      navigator.mediaSession.setActionHandler('previoustrack', () => stepTrack(-1));
      navigator.mediaSession.setActionHandler('nexttrack', () => stepTrack(1));
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) {
          engine.seek(details.seekTime);
          syncProgress();
        }
      });
    } catch (e) {}
  }

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
    const bSources = $('#bSources');
    const prov = tr.playbackProvider || (tr.source === 'file' ? 'local' : 'apple');
    const mode = tr.playbackType || (prov === 'youtube' ? 'embed' : (prov === 'local' || prov === 'jamendo' || prov === 'archive' ? 'full' : 'preview'));

    if (mark) {
      mark.hidden = true;
      mark.style.display = 'none';
      mark.textContent = '';
    }
    if (bSources) {
      bSources.style.display = 'none';
      bSources.hidden = true;
    }
    if (bSources) {
      bSources.dataset.id = tr.id;
    }
    const playableDur = engine.getDuration();
    $('#pDur').textContent = fmt(playableDur);
    $('#shDur').textContent = fmt(playableDur);
    $('#pLike').setAttribute('aria-pressed', String(fav));
    $('#pLikeIcon').querySelector('use').setAttribute('href', fav ? '#i-heart-fill' : '#i-heart');
    $('#pLike').classList.toggle('is-liked', fav);
    const stage = document.querySelector('.stage');
    if (stage) stage.style.setProperty('--tint', tr.colors[1]);
    refreshTransport();
    syncProgress();
    updateMediaSession();
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
    if (el.vol) {
      el.vol.value = String(state.volume);
      if (el.vol.style) el.vol.style.setProperty('--vol', state.volume + '%');
    }
    const activePl = state.playlists.find((p) => p.id === ui.activePl);
    if (activePl) ui.activePl = activePl.id;
    renderMiniPlayer();
    updateMediaSession();
  }

  function syncProgress() {
    const tr = getTrack(state.trackId);
    if (!tr) return;
    const pos = engine.getPosition();
    const dur = engine.getDuration();
    paintProgress(pos, dur);
  }

  function paintProgress(pos, duration) {
    const safeDur = (Number.isFinite(duration) && duration > 0) ? duration : engine.getDuration();
    const pct = safeDur > 0 ? clamp((pos / safeDur) * 100, 0, 100) : 0;
    const pSeek = $('#pSeek');
    const shSeek = $('#shSeek');
    if (pSeek) pSeek.style.setProperty('--pct', pct + '%');
    if (shSeek) shSeek.style.setProperty('--pct', pct + '%');
    const mini = $('#miniProgress');
    if (mini && mini.firstElementChild) mini.firstElementChild.style.width = pct + '%';
    $('#pCur').textContent = fmt(pos);
    $('#shCur').textContent = fmt(pos);
    $('#pDur').textContent = fmt(safeDur);
    $('#shDur').textContent = fmt(safeDur);
    if (pSeek) {
      pSeek.setAttribute('aria-valuenow', String(Math.round(pct)));
      pSeek.setAttribute('aria-valuetext', fmt(pos));
    }
    if (shSeek) {
      shSeek.setAttribute('aria-valuenow', String(Math.round(pct)));
      shSeek.setAttribute('aria-valuetext', fmt(pos));
    }
    updateLyricHighlight(pos);
    const elPip = (currentPipWindow && currentPipWindow.document ? currentPipWindow.document.getElementById('spotifyMiniPlayer') : null) || $('#spotifyMiniPlayer');
    if (elPip) {
      const pipFill = elPip.querySelector('#pipProgressFill');
      const pipHandle = elPip.querySelector('#pipProgressHandle');
      if (pipFill) pipFill.style.width = pct + '%';
      if (pipHandle) pipHandle.style.left = pct + '%';
      const pipCur = elPip.querySelector('#pipCur');
      const pipDur = elPip.querySelector('#pipDur');
      if (pipCur) pipCur.textContent = fmt(pos);
      if (pipDur) pipDur.textContent = fmt(safeDur);
    }
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
      el.np.innerHTML = '<div class="lyrics">' + lyrics.map((line) => {
        const txt = line.text || byLang(line) || line.ar || line.en || '';
        const sub = (line.translation && line.translation !== txt) ? line.translation : (state.lang === 'ar' ? (line.en || '') : (line.ar || ''));
        return '<button class="lyric" data-action="seek-lyric" data-t="' + (typeof line.t === 'number' ? line.t : 0) + '">' + esc(txt) +
          (sub ? '<em>' + esc(sub) + '</em>' : '') + '</button>';
      }).join('') + '</div>';
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
    return (first.length ? '<div class="np-credits">' + first.map((l) => {
      const txt = l.text || byLang(l) || l.ar || l.en || '';
      return '<p style="font-size:13px;line-height:1.9">' + esc(txt) + '</p>';
    }).join('') + '</div>' : '') +
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
    if (!lyrics.length && !tr.plainLyrics) return emptyState('lyrics', t('lyrics.empty'), t('lyrics.emptyBody'));
    if (!lyrics.length && tr.plainLyrics) {
      return '<div class="sp-plain-lyrics-wrap" style="padding:16px 8px;line-height:2.2;font-size:1.15rem;color:var(--text);">' +
        esc(tr.plainLyrics).split(/\r?\n/).filter(Boolean).map((line) => '<p class="sp-plain-line" style="margin:0 0 10px 0;">' + esc(line) + '</p>').join('') +
      '</div>';
    }
    return '<div class="lyrics">' + lyrics.map((line) => {
      const txt = line.text || byLang(line) || line.ar || line.en || '';
      const sub = (line.translation && line.translation !== txt) ? line.translation : (state.lang === 'ar' ? (line.en || '') : (line.ar || ''));
      return '<button class="lyric" data-action="seek-lyric" data-t="' + (typeof line.t === 'number' ? line.t : 0) + '">' + esc(txt) +
        (sub ? '<em>' + esc(sub) + '</em>' : '') + '</button>';
    }).join('') + '</div>';
  }

  function sheetInfoPanel(tr) {
    if (!tr) return '';
    return '<div class="sheet-info-panel">' +
      '<div class="info-card">' +
        '<div class="info-row"><span class="info-label">' + esc(t('hero.album')) + '</span><span class="info-val">' + L(tr.album) + '</span></div>' +
        '<div class="info-row"><span class="info-label">' + esc(t('track.releaseYear') || 'سنة الإصدار') + '</span><span class="info-val">' + (tr.year ? String(tr.year) : (state.lang === 'ar' ? 'غير محددة' : 'Unknown')) + '</span></div>' +
        '<div class="info-row"><span class="info-label">النوع الموسيقي</span><span class="info-val">' + esc(NG.genreLabel(tr.genre)) + '</span></div>' +
        '<div class="info-row"><span class="info-label">المدة الزمنية</span><span class="info-val">' + fmt(tr.duration) + '</span></div>' +
        '<div class="info-row"><span class="info-label">جودة الصوت</span><span class="info-val badge-quality">' + (tr.source === 'file' ? 'ملف صوتي محلي عالي الدقة' : 'معاينة AAC رسمية · Apple Music') + '</span></div>' +
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

  function fmtDurationTotal(totalSec) {
    const s = Math.round(Number(totalSec) || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return state.lang === 'ar' ? (h + ' ساعة و ' + remM + ' دقيقة') : (h + ' hr ' + remM + ' min');
    }
    return state.lang === 'ar' ? (m + ' دقيقة و ' + rem + ' ثانية') : (m + ' min ' + rem + ' sec');
  }

  function openPlaylistPage(plId) {
    ui.activePlaylistId = plId;
    ui.activePl = plId;
    setView('playlist');
  }

  function renderPlaylistPage() {
    const plId = ui.activePlaylistId || ui.activePl || (state.playlists[0] && state.playlists[0].id);
    const pl = state.playlists.find((p) => p.id === plId);
    if (!pl) {
      if (el.playlist) el.playlist.innerHTML = emptyState('music', t('library.emptyPl'), t('library.emptyPlBody'));
      return;
    }
    const tracks = playlistTracks(pl);
    ui.ctx.playlist = tracks.map((tr) => tr.id);
    const totalSec = tracks.reduce((acc, tr) => acc + (tr.duration || 30), 0);
    const durationText = fmtDurationTotal(totalSec);
    const isPlaying = tracks.some((tr) => tr.id === state.trackId && engine.playing);
    const isCustom = !NG.SEED_PLAYLISTS.some((p) => p.id === pl.id);

    let html = '<div class="sp-playlist-page">' +
      '<div class="pl-hero">' +
        '<div class="pl-hero-art">' + playlistCover(pl, 'pl-hero-cover') + '</div>' +
        '<div class="pl-hero-meta">' +
          '<div class="pl-kicker">' + esc(t('page.playlist') || 'قائمة تشغيل') + '</div>' +
          '<h1 class="pl-title clamp-2">' + L(pl.name) + '</h1>' +
          (pl.sub ? ('<p class="pl-desc clamp-2">' + L(pl.sub) + '</p>') : '') +
          '<div class="pl-info">' +
            '<span class="pl-owner"><b>7ify</b></span>' +
            '<span class="pl-sep">•</span>' +
            '<span class="pl-count num">' + esc(countLabel(tracks.length, 'songs')) + '</span>' +
            (tracks.length ? ('<span class="pl-sep">•</span><span class="pl-dur num">' + esc(durationText) + '</span>') : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pl-action-bar">' +
        '<button class="sp-play-btn ' + (isPlaying ? 'is-playing' : '') + '" data-action="play-playlist" data-id="' + pl.id + '" aria-label="' + esc(t('library.playAll')) + '">' +
          '<svg class="ic" aria-hidden="true"><use href="#i-' + (isPlaying ? 'pause' : 'play') + '"></use></svg>' +
        '</button>' +
        '<button class="sp-icon-btn ' + (state.shuffle ? 'is-active' : '') + '" data-action="shuffle-playlist" data-id="' + pl.id + '" title="' + esc(t('player.shuffle')) + '">' +
          ic('shuffle') +
        '</button>' +
        (isCustom ? (
          '<button class="sp-icon-btn is-danger" data-action="delete-playlist" data-id="' + pl.id + '" title="' + esc(t('playlist.delete') || 'حذف القائمة') + '">' +
            ic('trash') +
          '</button>'
        ) : '') +
      '</div>';

    if (!tracks.length) {
      html += emptyState('music', t('toast.playlistEmpty'), 'أضف أغانٍ إلى هذه القائمة من خلال زر + بجوار أي أغنية.');
    } else {
      html += '<div class="pl-table">' +
        '<div class="pl-th">' +
          '<span class="pl-th-idx">#</span>' +
          '<span class="pl-th-title">العنوان</span>' +
          '<span class="pl-th-album">الألبوم</span>' +
          '<span class="pl-th-dur">' + ic('clock') + '</span>' +
          '<span class="pl-th-actions"></span>' +
        '</div>' +
        '<div class="pl-rows">' +
          tracks.map((tr, i) => {
            const current = state.trackId === tr.id;
            const playing = current && engine.playing;
            const fav = isFav(tr.id);
            return '<div class="pl-row' + (current ? ' is-current' : '') + '">' +
              '<button class="pl-row-hit" data-action="play" data-id="' + tr.id + '" data-ctx="playlist">' +
                '<span class="pl-row-idx">' + (playing ? eq() : (i + 1)) + '</span>' +
                '<span class="pl-row-art">' + trackArt(tr) + '</span>' +
                '<span class="pl-row-main">' +
                  '<span class="pl-row-title clamp-1">' + L(tr.title) + '</span>' +
                  '<span class="pl-row-artist clamp-1" data-action="artist" data-artist="' + esc(tr.artist?.ar || tr.artist?.en || '') + '">' + L(tr.artist) + '</span>' +
                '</span>' +
                '<span class="pl-row-album clamp-1" data-action="album" data-album="' + esc(tr.album?.ar || tr.album?.en || '') + '">' + L(tr.album) + '</span>' +
                '<span class="pl-row-dur num">' + fmt(tr.duration) + '</span>' +
              '</button>' +
              '<div class="pl-row-tools">' +
                '<button class="row-like ' + (fav ? 'is-liked' : '') + '" data-action="like" data-id="' + tr.id + '" data-like="' + tr.id + '" aria-pressed="' + fav + '">' + likeIcon(fav) + '</button>' +
                (isCustom ? ('<button class="pl-remove-btn" data-action="remove-from-playlist" data-pl="' + pl.id + '" data-id="' + tr.id + '" title="إزالة من القائمة">' + ic('trash') + '</button>') : '') +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';
    }

    html += '</div>';
    if (el.playlist) el.playlist.innerHTML = html;
  }

  function openArtistPage(artistName) {
    if (!artistName) return;
    ui.activeArtistName = artistName;
    setView('artist');
  }

  function renderArtistPage() {
    const artistName = ui.activeArtistName || (TRACKS[0] && (TRACKS[0].artist?.ar || TRACKS[0].artist?.en)) || 'عمرو دياب';
    const tracks = NG.getArtistTracks(artistName);
    const albums = NG.getArtistAlbums(artistName);
    ui.ctx.artist = tracks.map((tr) => tr.id);
    const artistKey = 'artist:' + artistName.split('&')[0].trim();
    const isFollowing = ui.following.has(artistKey);
    const t0 = tracks[0] || TRACKS[0];
    const colors = t0.colors || ['#121212', '#282828', '#1ED760'];
    const accentCol = colors[1] || colors[0] || '#1ED760';
    const bgCol = colors[0] || '#121212';
    const isPlaying = tracks.some((tr) => tr.id === state.trackId && engine.playing);

    let html = '<div class="sp-artist-page" style="--sp-accent:' + accentCol + ';--sp-bg:' + bgCol + ';">' +
      '<div class="artist-hero">' +
        '<div class="artist-hero-glow" style="background: radial-gradient(circle at 20% 40%, ' + accentCol + ' 0%, transparent 70%);" aria-hidden="true"></div>' +
        '<div class="artist-hero-wrap">' +
          '<div class="artist-avatar-wrap">' +
            artistAvatar({ name: { ar: artistName, en: artistName }, track: t0.id }) +
          '</div>' +
          '<div class="artist-hero-meta">' +
            (t0 && t0.verified === true ? (
              '<div class="sp-verified-tag">' +
                '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>' +
                '<span>' + esc(t('track.verified') || 'فنان موثق') + '</span>' +
              '</div>'
            ) : (
              '<span class="sp-artist-kicker">' + esc(t('page.artist') || 'فنان') + '</span>'
            )) +
            '<h1 class="artist-hero-name clamp-1">' + esc(artistName) + '</h1>' +
            '<div class="artist-hero-subline">' +
              '<span class="artist-count num">' + esc(countLabel(tracks.length, 'songs')) + '</span>' +
              (albums.length ? ('<span class="sp-sep">•</span><span class="num">' + esc(countLabel(albums.length, 'albums')) + '</span>') : '') +
              '<span class="sp-sep">•</span><span class="sp-artist-listeners">' + esc(t('about.sourceApple')) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="artist-action-bar">' +
        '<button class="sp-play-btn ' + (isPlaying ? 'is-playing' : '') + '" data-action="play-artist-all" aria-label="' + esc(t('library.playAll')) + '">' +
          '<svg class="ic" aria-hidden="true"><use href="#i-' + (isPlaying ? 'pause' : 'play') + '"></use></svg>' +
        '</button>' +
        '<button class="sp-follow-btn ' + (isFollowing ? 'is-following' : '') + '" data-action="follow" data-id="' + esc(artistKey) + '" aria-pressed="' + isFollowing + '">' +
          esc(t(isFollowing ? 'artist.following' : 'artist.follow')) +
        '</button>' +
      '</div>' +
      '<section class="section">' +
        sectionHead(t('sec.popular') || 'أشهر الأغاني', '') +
        '<div class="rows">' +
          tracks.slice(0, 10).map((tr, i) => rowHTML(tr, i, 'artist')).join('') +
        '</div>' +
      '</section>';

    if (albums.length) {
      html += '<section class="section">' +
        sectionHead(t('sec.albums') || 'الألبومات والإصدارات', '') +
        '<div class="card-grid">' +
          albums.map((alb) =>
            '<button class="card" data-action="album" data-album="' + esc(alb.name?.ar || alb.name?.en || '') + '">' +
              '<span class="card-art">' + coverHTML(alb) +
              '<span class="fab play-btn" aria-hidden="true">' + ic('play') + '</span></span>' +
              '<span class="card-title clamp-1">' + L(alb.name) + '</span>' +
              '<span class="card-sub clamp-1">' + (alb.year ? alb.year + ' · ' : '') + esc(countLabel(alb.tracks.length, 'songs')) + '</span>' +
            '</button>'
          ).join('') +
        '</div>' +
      '</section>';
    }

    html += '</div>';
    if (el.artist) el.artist.innerHTML = html;
  }

  function openAlbumPage(albumName) {
    if (!albumName) return;
    ui.activeAlbumName = albumName;
    setView('album');
  }

  function renderAlbumPage() {
    const albumName = ui.activeAlbumName || (TRACKS[0] && (TRACKS[0].album?.ar || TRACKS[0].album?.en)) || 'تملي معاك';
    const tracks = NG.getAlbumTracks(albumName);
    const t0 = tracks[0] || TRACKS[0];
    ui.ctx.album = tracks.map((tr) => tr.id);
    const totalSec = tracks.reduce((acc, tr) => acc + (tr.duration || 30), 0);
    const durationText = fmtDurationTotal(totalSec);
    const isPlaying = tracks.some((tr) => tr.id === state.trackId && engine.playing);
    const colors = t0.colors || ['#121212', '#282828', '#1ED760'];
    const accentCol = colors[1] || colors[0] || '#1ED760';
    const bgCol = colors[0] || '#121212';
    const artistName = t0.artist ? (t0.artist.ar || t0.artist.en) : '';

    let html = '<div class="sp-album-page" style="--sp-accent:' + accentCol + ';--sp-bg:' + bgCol + ';">' +
      '<div class="pl-hero">' +
        '<div class="pl-hero-art">' + trackArt(t0, 'pl-hero-cover', true) + '</div>' +
        '<div class="pl-hero-meta">' +
          '<div class="pl-kicker">' + esc(t('page.album') || 'ألبوم') + '</div>' +
          '<h1 class="pl-title clamp-2">' + L(t0.album) + '</h1>' +
          '<div class="pl-info">' +
            '<button class="sp-artist-chip" data-action="artist" data-artist="' + esc(artistName) + '">' +
              artistAvatar({ name: t0.artist, track: t0.id }) +
              '<span class="sp-artist-link">' + L(t0.artist) + '</span>' +
            '</button>' +
            (t0.year ? ('<span class="pl-sep">•</span><span class="num">' + t0.year + '</span>') : '') +
            '<span class="pl-sep">•</span>' +
            '<span class="pl-count num">' + esc(countLabel(tracks.length, 'songs')) + '</span>' +
            '<span class="pl-sep">•</span>' +
            '<span class="pl-dur num">' + esc(durationText) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pl-action-bar">' +
        '<button class="sp-play-btn ' + (isPlaying ? 'is-playing' : '') + '" data-action="play-album-all" aria-label="' + esc(t('library.playAll')) + '">' +
          '<svg class="ic" aria-hidden="true"><use href="#i-' + (isPlaying ? 'pause' : 'play') + '"></use></svg>' +
        '</button>' +
      '</div>' +
      '<div class="pl-table">' +
        '<div class="pl-th">' +
          '<span class="pl-th-idx">#</span>' +
          '<span class="pl-th-title">العنوان</span>' +
          '<span class="pl-th-dur">' + ic('clock') + '</span>' +
          '<span class="pl-th-actions"></span>' +
        '</div>' +
        '<div class="pl-rows">' +
          tracks.map((tr, i) => {
            const current = state.trackId === tr.id;
            const playing = current && engine.playing;
            const fav = isFav(tr.id);
            return '<div class="pl-row' + (current ? ' is-current' : '') + '">' +
              '<button class="pl-row-hit" data-action="play" data-id="' + tr.id + '" data-ctx="album">' +
                '<span class="pl-row-idx">' + (playing ? eq() : (i + 1)) + '</span>' +
                '<span class="pl-row-main" style="grid-column:2/4">' +
                  '<span class="pl-row-title clamp-1">' + L(tr.title) + '</span>' +
                  '<span class="pl-row-artist clamp-1" data-action="artist" data-artist="' + esc(tr.artist?.ar || tr.artist?.en || '') + '">' + L(tr.artist) + '</span>' +
                '</span>' +
                '<span class="pl-row-dur num">' + fmt(tr.duration) + '</span>' +
              '</button>' +
              '<div class="pl-row-tools">' +
                '<button class="row-like ' + (fav ? 'is-liked' : '') + '" data-action="like" data-id="' + tr.id + '" data-like="' + tr.id + '" aria-pressed="' + fav + '">' + likeIcon(fav) + '</button>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';

    if (el.album) el.album.innerHTML = html;
  }

  /* ---------- spotify track page ------------------------------------------ */

  const ARTIST_BIOS = {
    'عمرو دياب': {
      bio: {
        ar: 'الهضبة عمرو دياب، أسطورة البوب العربي والحائز على جوائز الموسيقى العالمية وسجل غينيس للأرقام القياسية كأكثر فنان عربي حصداً للجوائز العالمية والمبيعات.',
        en: 'Amr Diab, the "Father of Mediterranean Music", multiple World Music Award winner and Guinness World Record holder for best-selling Middle Eastern artist.'
      }
    },
    'شيرين': {
      bio: {
        ar: 'شيرين عبد الوهاب، من أهم وأعذب الأصوات النسائية في العالم العربي، تميزت بإحساسها الطربي العالي وألبوماتها الأكثر مبيعاً في الشرق الأوسط.',
        en: 'Sherine Abdel-Wahab, one of the most celebrated and beloved voices in Arabic music, acclaimed for her emotional depth and iconic chart-topping albums.'
      }
    },
    'ويجز': {
      bio: {
        ar: 'ويجز، رائد مشهد التراب والراب في مصر والعالم العربي، تصدّر قوائم الاستماع العالمية بأعماله المؤثرة مثل البخت وأسياد الصوت ودورك جاي.',
        en: 'Wegz, the pioneer of Egyptian rap and trap, dominating Arab streaming charts with landmark releases such as El Bakht and Dorak Gai.'
      }
    },
    'كايروكي': {
      bio: {
        ar: 'فرقة الروك المستقل الرائدة في مصر والوطن العربي، تميزت بكلماتها المعبرة عن قضايا الشباب وألحانها التي ألهمت أجيالاً في ألبومات روما ونقطة بيضا.',
        en: 'Cairokee, the iconic Egyptian indie rock band renowned for soulful lyrics and anthems that resonated across generations in albums like Roma and Noqta Beida.'
      }
    },
    'أم كلثوم': {
      bio: {
        ar: 'كوكب الشرق وسيدة الغناء العربي، أعظم صوت في تاريخ الموسيقى العربية الكلاسيكية، صنفتها مجلة رولينغ ستون ضمن أعظم مئة مغنٍ في التاريخ.',
        en: 'Umm Kulthum, the Star of the East, widely regarded as the greatest singer in the history of Arabic music and ranked among Rolling Stone\'s 100 greatest singers of all time.'
      }
    },
    'فيروز': {
      bio: {
        ar: 'جارة القمر وصوت الصباح العربي، قدمت مع الأخوين رحباني مكتبة موسيقية خالدة تخطت حدود الشرق لتصل إلى مسارح العالم الكبرى في الأولمبيا والرويال ألبرت هول.',
        en: 'Fairouz, the Jewel of Lebanon and Voice of the Morning, whose timeless collaborations with the Rahbani brothers defined modern Levantine music.'
      }
    },
    'مروان بابلو': {
      bio: {
        ar: 'عراب التراب المصري، أحدث ثورة في مشهد الهيب هوب المستقل ومزج الإيقاعات الإلكترونية الحديثة بالثقافة البصرية في كنترول والجميزة.',
        en: 'Marwan Pablo, widely credited as the godfather of Egyptian trap, redefining contemporary Arabic hip hop with Control and El Gemeza.'
      }
    },
    'نانسي عجرم': {
      bio: {
        ar: 'ملكة البوب العربي وسفيرة النوايا الحسنة، حققت ألبوماتها مبيعات خيالية وحازت على جائزة الموسيقى العالمية كأفضل مبيعات في الشرق الأوسط.',
        en: 'Nancy Ajram, queen of Arab pop and multi-platinum artist, celebrated across the globe for her infectious hooks and performances.'
      }
    },
    'ذا ويكند': {
      bio: {
        ar: 'أبيل تسفاي (The Weeknd)، الحائز على جوائز غرامي وعشرات الأرقام القياسية، صاحب أغنية Blinding Lights الأكثر استماعاً في تاريخ بيلبورد.',
        en: 'The Weeknd, multi-Grammy-winning Canadian visionary behind "Blinding Lights", the biggest Billboard Hot 100 song in history.'
      }
    },
    'دافت بانك': {
      bio: {
        ar: 'الثنائي الفرنسي الأسطوري لموسيقى الفرانش هاوس والإلكترونيك، أحدثوا ثورة في الموسيقى العالمية بألبوماتهم الرائدة Random Access Memories وDiscovery.',
        en: 'Daft Punk, the pioneering French electronic music duo whose synthesis of funk, house, and synthpop shaped modern music.'
      }
    },
    'جورج وسوف': {
      bio: {
        ar: 'سلطان الطرب جورج وسوف، قامة فنية استثنائية وأحد أعظم وأندر الأصوات الطربية في تاريخ الموسيقى العربية المعاصرة، اشتهر بأدائه العاطفي الخالد في روائع مثل إسمعيني بكلمة، حلف القمر، وكلام الناس.',
        en: 'George Wassouf, the "Sultan of Tarab", one of the most legendary and revered vocalists in contemporary Arab music history.'
      }
    }
  };

  function getStreamsCount(tr) {
    if (tr.streams) return Number(tr.streams).toLocaleString('en-US');
    return tr.source === 'file'
      ? (state.lang === 'ar' ? 'ملف صوتي محلي' : 'Local Audio')
      : (state.lang === 'ar' ? 'معاينة رسمية · Apple Music' : 'Official Preview · Apple Music');
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
    const colors = tr.colors || ['#4E554E', '#687168', '#1ED760'];
    const accentCol = colors[1] || colors[0] || '#4E554E';
    const bgCol = colors[0] || '#121212';
    const artistName = byLang(tr.artist);
    const artistKey = 'artist:' + (tr.source === 'file' ? artistName : artistName.split('&')[0].trim());
    const isFollowing = ui.following.has(artistKey);

    const artistData = ARTIST_BIOS[tr.artist && (tr.artist.ar || tr.artist.en)] || null;
    const bioText = (tr.bio && L(tr.bio)) || (artistData ? byLang(artistData.bio) : (
      state.lang === 'ar' ?
        ('استمع إلى عمل «' + L(tr.title) + '» للفنان ' + artistName + ' بجودة صوتية فائقة على Spotify.') :
        ('Listen to "' + L(tr.title) + '" by ' + artistName + ' on Spotify.')
    ));
    const listenersCount = tr.source === 'file'
      ? (state.lang === 'ar' ? 'ملف صوتي محلي' : 'Local Audio File')
      : (state.lang === 'ar' ? '٥,٨٩٢,١٠٤ مستمع شهرياً' : '5,892,104 monthly listeners');

    const curArt = norm(tr.artist?.ar || tr.artist?.en || '');
    const sameArtist = TRACKS.filter((t) => {
      if (t.id === tr.id) return false;
      const itemArt = norm(t.artist?.ar || t.artist?.en || '');
      return itemArt && itemArt === curArt;
    });

    // Discography releases
    const discography = TRACKS.slice(0, 5);

    const lyrics = tr.lyrics || [];

    // Online lyrics request fallback
    if ((!tr.lyrics || !tr.lyrics.length) && !tr._lyricsRequested && NG.fetchLyricsOnline) {
      tr._lyricsRequested = true;
      NG.fetchLyricsOnline(tr, tr.artist, (data) => {
        if (data && ((data.lines && data.lines.length) || data.plain)) {
          if (ui.view === 'track' && (ui.viewTrackId === tr.id || state.trackId === tr.id)) {
            renderTrackPage();
          }
          if (state.trackId === tr.id) {
            renderPlayer();
          }
        }
      });
    }

    // Dynamic more tracks by same artist
    if (sameArtist.length < 3 && !tr._moreRequested && NG.fetchArtistTracks) {
      tr._moreRequested = true;
      const qArt = tr.artist?.ar || tr.artist?.en || '';
      if (qArt) {
        NG.fetchArtistTracks(qArt, (moreTracks) => {
          if (moreTracks && moreTracks.length && ui.view === 'track') {
            renderTrackPage();
          }
        });
      }
    }

    const SVG_CHECK = '<path fill="#1ed760" d="M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11-4.925 11-11 11S1 18.075 1 12zm16.28-2.72a.75.75 0 0 0-1.06-1.06l-5.47 5.47-2.47-2.47a.75.75 0 0 0-1.06 1.06l3 3a.75.75 0 0 0 1.06 0l6-6z"></path>';
    const SVG_PLUS = '<path d="M11.999 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m-11 9c0-6.075 4.925-11 11-11s11 4.925 11 11-4.925 11-11 11-11-4.925-11-11"></path><path d="M17.999 12a1 1 0 0 1-1 1h-4v4a1 1 0 1 1-2 0v-4h-4a1 1 0 1 1 0-2h4V7a1 1 0 1 1 2 0v4h4a1 1 0 0 1 1 1"></path>';

    let html = '<div class="sp-page" style="--sp-accent: ' + accentCol + '; --sp-bg: ' + bgCol + ';">';

    // Sticky Compact Song Bar on Scroll
    html += '<div id="sticky-song-bar" class="sticky top-0 z-20 px-6 py-2.5 bg-[#181818]/95 backdrop-blur-md border-b border-white/10 flex items-center justify-between transition-opacity duration-200 opacity-0 pointer-events-none" dir="ltr">' +
      '<div class="flex items-center gap-3">' +
        '<button class="w-10 h-10 rounded-full bg-[#1ed760] hover:bg-[#3be477] hover:scale-105 text-black flex items-center justify-center shadow-lg transition sp-play-btn ' + (isPlaying ? 'is-playing' : '') + '" data-action="' + (isPlaying ? 'toggle' : 'play') + '" data-id="' + tr.id + '" data-ctx="track">' +
          '<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">' + (isPlaying ? '<path d="M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7z"></path>' : '<path d="m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"></path>') + '</svg>' +
        '</button>' +
        '<span class="text-base font-extrabold text-white truncate">' + esc(L(tr.title)) + '</span>' +
      '</div>' +
      '<span class="text-xs font-semibold text-white/75" dir="ltr">/intl-ar/track/' + tr.id + '</span>' +
    '</div>';

    // 1. Hero Song Banner
    html += '<section id="song-hero-section" class="sp-hero relative px-6 sm:px-8 pt-6 pb-8 flex flex-col md:flex-row items-center md:items-end gap-6 sm:gap-8 transition-colors duration-500" dir="ltr">' +
      '<div class="sp-hero-glow" style="background: radial-gradient(circle at 20% 40%, ' + accentCol + ' 0%, transparent 70%);" aria-hidden="true"></div>' +
      '<div class="sp-hero-wrap flex items-center md:items-end gap-6 sm:gap-8 w-full">' +
        '<div id="hero-cover-trigger" class="sp-cover-box tilt-card-3d w-48 h-48 sm:w-56 sm:h-56 lg:w-60 lg:h-60 rounded-lg overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.75)] shrink-0 relative group cursor-pointer bg-[#282828]" data-action="toggle-miniplayer" title="فتح في المشغّل المصغّر">' +
          trackArt(tr, 'sp-cover', true) +
          '<div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none">' +
            '<span class="px-3 py-1.5 rounded-full bg-black/80 text-white text-xs font-bold shadow-xl">المشغِّل المصغَّر (PiP)</span>' +
          '</div>' +
        '</div>' +
        '<div class="sp-hero-meta flex flex-col items-start text-left min-w-0 flex-1 space-y-3">' +
          '<div class="flex items-center gap-2">' +
            '<span class="sp-kicker px-2.5 py-0.5 rounded bg-black/35 text-white text-xs font-extrabold uppercase tracking-wider">' + esc(t('track.kicker') || 'أغنية') + '</span>' +
            '<span class="sp-badge-hq px-2.5 py-0.5 rounded bg-[#1ed760]/20 text-[#1ed760] text-[11px] font-bold inline-flex items-center gap-1.5">' +
              '<svg class="ic w-3 h-3 fill-current" viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 0 8 8 8 8 0 0 0-8-8zm3.5 11.5L8 9.75 4.5 11.5l.75-3.85L2.4 4.95l3.9-.55L8 1l1.7 3.4 3.9.55-2.85 2.7.75 3.85z"/></svg>' +
              esc(t('track.previewNoteShort') || 'صوت استوديو عالي الدقة · Master HQ') +
            '</span>' +
          '</div>' +
          '<h1 class="sp-title text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-none select-text clamp-2" title="' + esc(L(tr.title)) + '">' + esc(L(tr.title)) + '</h1>' +
          '<div class="sp-subline flex flex-wrap items-center gap-2 text-sm text-white/90 pt-1">' +
            '<button class="sp-artist-chip inline-flex items-center gap-1.5 font-extrabold text-white hover:underline cursor-pointer bg-transparent border-0 p-0" data-action="artist" data-artist="' + esc(tr.artist?.ar || tr.artist?.en || '') + '">' +
              artistAvatar({ name: tr.artist, track: tr.id }) +
              '<span class="sp-artist-link">' + esc(artistName) + '</span>' +
            '</button>' +
            '<span class="sp-sep text-white/60">•</span>' +
            '<button class="sp-album-text text-white/90 hover:underline font-medium bg-transparent border-0 p-0 cursor-pointer" data-action="album" data-album="' + esc(tr.album?.ar || tr.album?.en || '') + '">' + esc(L(tr.album)) + '</button>' +
            (tr.year ? ('<span class="sp-sep text-white/60">•</span><span class="sp-year-text text-white/80">' + tr.year + '</span>') : '') +
            '<span class="sp-sep text-white/60">•</span>' +
            '<span class="sp-dur-text text-white/80 font-medium num">' + fmt(tr.duration || 224) + '</span>' +
            '<span class="sp-sep text-white/60">•</span>' +
            '<span class="sp-streams-text text-white font-bold num">' + (tr.source === 'file' ? esc(t('track.localFile') || 'ملف صوتي محلي') : '٣٢,٤٥٨,١٩٠ استماع') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';

    // 2. Action Toolbar
    html += '<div class="relative px-6 sm:px-8 pt-6 pb-16 space-y-8" style="background: linear-gradient(180deg, rgba(78, 85, 78, 0.28) 0%, #121212 240px);">' +
      '<div class="sp-actions-bar flex items-center justify-between gap-4" dir="ltr">' +
        '<div class="sp-actions-left flex items-center gap-5">' +
          '<button class="sp-play-btn ' + (isPlaying ? 'is-playing' : '') + ' w-14 h-14 rounded-full bg-[#1ed760] hover:bg-[#3be477] hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition" data-action="' + (isPlaying ? 'toggle' : 'play') + '" data-id="' + tr.id + '" data-ctx="track" aria-label="' + (isPlaying ? esc(t('player.pause')) : esc(t('player.play'))) + '">' +
            '<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24">' + (isPlaying ? '<path d="M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7z"></path>' : '<path d="m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"></path>') + '</svg>' +
          '</button>' +
          '<button class="sp-icon-btn ' + (state.shuffle ? 'text-[#1ed760] border-[#1ed760]' : '') + ' w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-[#b3b3b3] hover:text-white transition" data-action="shuffle" title="التشغيل العشوائي">' +
            '<svg class="w-5 h-5 fill-current" viewBox="0 0 16 16"><path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z"></path><path d="m7.5 10.723.98-1.167.957 1.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.109 13H11.16a3.75 3.75 0 0 1-2.873-1.34l-.787-.938z"></path></svg>' +
          '</button>' +
          '<button class="sp-icon-btn ' + (fav ? 'is-liked text-[#1ed760] border-[#1ed760]' : '') + ' w-10 h-10 rounded-full hover:bg-white/10 hover:scale-110 flex items-center justify-center text-[#b3b3b3] hover:text-white transition" data-action="like" data-id="' + tr.id + '" data-like="' + tr.id + '" aria-pressed="' + fav + '" title="الإضافة إلى أغانٍ أعجبتني">' +
            '<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24">' + (fav ? SVG_CHECK : SVG_PLUS) + '</svg>' +
          '</button>' +
          '<button class="sp-icon-btn w-10 h-10 rounded-full hover:bg-white/10 hover:scale-110 flex items-center justify-center text-[#b3b3b3] hover:text-white transition" data-action="copy-song-link" data-id="' + tr.id + '" title="نسخ رابط الأغنية">' +
            '<svg class="w-5 h-5 fill-current" viewBox="0 0 16 16"><path d="M1 5.75A.75.75 0 0 1 1.75 5H4v1.5H2.5v8h11v-8H12V5h2.25a.75.75 0 0 1 .75.75v9.5a.75.75 0 0 1-.75.75H1.75a.75.75 0 0 1-.75-.75z"></path><path d="M8 9.576a.75.75 0 0 0 .75-.75V2.903l1.454 1.454a.75.75 0 0 0 1.06-1.06L8 .03 4.735 3.296a.75.75 0 0 0 1.06 1.061L7.25 2.903v5.923c0 .414.336.75.75.75"></path></svg>' +
          '</button>' +
        '</div>' +
        '<button class="px-4 py-2 rounded-full border border-white/25 hover:border-white text-xs font-bold text-white flex items-center gap-2 transition hover:scale-105" data-action="toggle-miniplayer" title="فتح نافذة المشغّل المصغّر">' +
          '<svg class="w-4 h-4 fill-current text-[#1ed760]" viewBox="0 0 24 24"><path d="M19 11h-8v6h8zm4-7v16a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2m-2 0H3v16h18z"/></svg>' +
          '<span>المشغِّل المصغَّر (PiP)</span>' +
        '</button>' +
      '</div>';

    // 2.5 Active Song Row Table (XPUI routes-album format)
    html += '<section class="space-y-1.5" dir="ltr">' +
      '<div class="grid grid-cols-[36px_1fr_auto] sm:grid-cols-[36px_1.6fr_1fr_auto] items-center gap-4 px-4 py-2 border-b border-white/10 text-xs font-bold uppercase tracking-wider text-[#b3b3b3]">' +
        '<span class="text-center">#</span>' +
        '<span>Title • العنوان</span>' +
        '<span class="hidden sm:block text-right">Plays • الاستماعات</span>' +
        '<span class="flex justify-end pr-2" title="المدة">' +
          '<svg class="w-4 h-4 fill-current" viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 0 8 8 8 8 0 0 0-8-8zm0 14.5a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13z"/><path d="M7.5 4v4.25l3.5 2.1.75-1.23-2.75-1.62V4z"/></svg>' +
        '</span>' +
      '</div>' +
      '<div class="song-row group grid grid-cols-[36px_1fr_auto] sm:grid-cols-[36px_1.6fr_1fr_auto] items-center gap-4 px-4 py-3 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] transition cursor-pointer" data-action="' + (isPlaying ? 'toggle' : 'play') + '" data-id="' + tr.id + '" data-ctx="track">' +
        '<div class="flex items-center justify-center w-6">' +
          (isPlaying ? (
            '<div class="row-index flex items-end gap-[2px] h-3.5">' +
              '<span class="w-[3px] bg-[#1ed760] eq-bar-1"></span>' +
              '<span class="w-[3px] bg-[#1ed760] eq-bar-2"></span>' +
              '<span class="w-[3px] bg-[#1ed760] eq-bar-3"></span>' +
              '<span class="w-[3px] bg-[#1ed760] eq-bar-4"></span>' +
            '</div>'
          ) : (
            '<span class="row-index text-sm font-bold text-[#1ed760]">1</span>'
          )) +
          '<button class="row-play-btn hidden items-center justify-center text-white">' +
            '<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">' + (isPlaying ? '<path d="M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7z"></path>' : '<path d="m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"></path>') + '</svg>' +
          '</button>' +
        '</div>' +
        '<div class="min-w-0">' +
          '<div class="text-base font-extrabold text-[#1ed760] truncate">' + esc(L(tr.title)) + '</div>' +
          '<div class="flex items-center gap-1.5 mt-0.5">' +
            '<span class="px-1 py-0.2 rounded bg-white/20 text-[9px] font-extrabold text-black uppercase">E</span>' +
            '<span class="text-xs font-medium text-[#b3b3b3] group-hover:text-white truncate">' + esc(artistName) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="hidden sm:block text-right text-sm font-medium text-[#b3b3b3] group-hover:text-white font-variant-numeric tabular-nums">' +
          '٣٢,٤٥٨,١٩٠' +
        '</div>' +
        '<div class="flex items-center gap-4 justify-end">' +
          '<button class="text-[#b3b3b3] hover:text-white hover:scale-110 transition" data-action="like" data-id="' + tr.id + '" title="الإضافة إلى أغانٍ أعجبتني">' +
            '<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">' + (fav ? SVG_CHECK : SVG_PLUS) + '</svg>' +
          '</button>' +
          '<span class="text-sm font-medium text-[#b3b3b3] font-variant-numeric tabular-nums w-11 text-right">' + fmt(tr.duration || 224) + '</span>' +
        '</div>' +
      '</div>' +
    '</section>';

    // 3. Two-Column Grid: Synced Lyrics (Left) + Artist & Credits (Right)
    html += '<div id="lyrics-section" class="sp-grid grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">' +
      '<div class="sp-lyrics-card lg:col-span-7 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4 transition-colors duration-500" style="background: linear-gradient(180deg, ' + accentCol + ' 0%, #181c18 100%);">' +
        '<div class="sp-card-head flex items-center justify-between border-b border-white/10 pb-3">' +
          '<div class="flex items-center gap-2.5">' +
            '<svg class="w-5 h-5 text-[#1ed760] fill-current" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3m5 7a1 1 0 0 0-2 0 3 3 0 0 1-6 0 1 1 0 0 0-2 0 5 5 0 0 0 4 4.9V16H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.1A5 5 0 0 0 17 9"/></svg>' +
            '<h2 class="text-xl font-extrabold text-white">' + esc(t('track.lyrics') || 'كلمات الأغنية') + ' • Lyrics</h2>' +
          '</div>' +
          '<span class="text-xs font-semibold text-white/70">اضغط على أي سطر للانتقال إليه</span>' +
        '</div>' +
        '<div class="sp-lyrics-content space-y-3.5 py-2 max-h-[460px] overflow-y-auto" dir="ltr">' +
          (lyrics.length ? (
            lyrics.map((line, idx) => {
              const mainText = line.text || byLang(line);
              return '<button class="lyric sp-lyric cursor-pointer transition-all duration-200 font-extrabold text-lg sm:text-2xl leading-snug w-full text-left bg-transparent border-0 p-1.5 rounded hover:text-white text-white/50" data-action="seek-lyric" data-t="' + (typeof line.t === 'number' ? line.t : 0) + '" data-lyric-idx="' + idx + '">' +
                '<span class="sp-lyric-main">' + esc(mainText) + '</span>' +
              '</button>';
            }).join('')
          ) : (tr.plainLyrics ? (
            esc(tr.plainLyrics).split(/\r?\n/).filter(Boolean).map((line, idx) =>
              '<div class="sp-lyric font-extrabold text-lg sm:text-2xl leading-snug text-white/60 py-1" data-lyric-idx="' + idx + '">' + esc(line) + '</div>'
            ).join('')
          ) : (
            '<div class="sp-lyrics-empty text-center py-8">' +
              '<div class="sp-wave-bars"><i style="--h:24px"></i><i style="--h:48px"></i><i style="--h:32px"></i><i style="--h:56px"></i><i style="--h:36px"></i></div>' +
              '<p class="sp-lyrics-empty-title text-base font-bold text-white mt-2">' + (state.lang === 'ar' ? 'استمتع بالألحان والموسيقى' : 'Enjoy the music') + '</p>' +
            '</div>'
          ))) +
        '</div>' +
      '</div>' +

      // Artist & Credits Column
      '<div id="artist-credit-card" class="sp-col-side lg:col-span-5 space-y-5">' +
        // Artist Card
        '<div class="sp-artist-card rounded-2xl bg-[#181818] hover:bg-[#222222] transition p-5 border border-white/[0.06] flex items-center justify-between gap-4">' +
          '<div class="flex items-center gap-4 min-w-0" dir="ltr">' +
            '<div class="sp-artist-avatar-wrap w-20 h-20 rounded-full overflow-hidden shadow-xl shrink-0 bg-[#282828] border-2 border-white/20">' +
              artistAvatar({ name: tr.artist, track: tr.id }) +
            '</div>' +
            '<div class="min-w-0">' +
              '<div class="sp-artist-kicker-row flex items-center gap-1.5">' +
                '<span class="sp-artist-kicker text-xs font-bold uppercase tracking-wider text-[#b3b3b3]">' + esc(t('page.artist') || 'فنان') + ' • Artist</span>' +
                '<span class="sp-verified-tag px-1.5 py-0.5 rounded bg-[#3d91f4]/20 text-[#3d91f4] text-[10px] font-bold">Verified</span>' +
              '</div>' +
              '<h3 class="sp-artist-title text-xl font-extrabold text-white truncate mt-0.5">' + esc(artistName) + '</h3>' +
              '<p class="sp-artist-listeners text-xs text-[#b3b3b3] mt-0.5 num">' + esc(listenersCount) + '</p>' +
            '</div>' +
          '</div>' +
          '<button class="sp-follow-btn ' + (isFollowing ? 'is-following' : '') + ' px-4 py-1.5 rounded-full border border-[#727272] hover:border-white text-xs font-bold text-white transition shrink-0" data-action="follow" data-id="' + esc(artistKey) + '" aria-pressed="' + isFollowing + '">' +
            esc(t(isFollowing ? 'artist.following' : 'artist.follow')) +
          '</button>' +
        '</div>' +

        // Credits Card
        '<div class="sp-credits-card rounded-2xl bg-[#181818] p-5 border border-white/[0.06] space-y-4">' +
          '<div class="flex items-center justify-between border-b border-white/10 pb-3">' +
            '<h4 class="text-base font-extrabold text-white">' + esc(t('track.credits') || 'القائمون على العمل (Credits)') + '</h4>' +
            '<span class="text-xs text-[#1ed760] font-bold">Master Audio</span>' +
          '</div>' +
          '<div class="sp-credits-table space-y-3 text-sm" dir="ltr">' +
            '<div class="sp-credit-row flex items-center justify-between border-b border-white/[0.06] pb-2.5">' +
              '<div>' +
                '<div class="font-bold text-white">' + esc(artistName) + '</div>' +
                '<div class="text-xs text-[#b3b3b3]">Main Artist, Composer, Lyricist</div>' +
              '</div>' +
              '<span class="text-[11px] font-mono text-[#b3b3b3]">/artist/' + esc(encodeURIComponent(artistName)) + '</span>' +
            '</div>' +
            '<div class="sp-credit-row flex items-center justify-between border-b border-white/[0.06] pb-2.5">' +
              '<div>' +
                '<div class="font-bold text-white">' + esc(L(tr.album)) + '</div>' +
                '<div class="text-xs text-[#b3b3b3]">Record Label & Mastering</div>' +
              '</div>' +
              '<span class="text-[11px] font-mono text-[#1ed760]">' + (tr.year || '2024') + ' Release</span>' +
            '</div>' +
            '<div class="sp-credit-row flex items-center justify-between">' +
              '<div>' +
                '<div class="font-bold text-white">Track ID</div>' +
                '<div class="text-xs text-[#b3b3b3]">Spotify URI & Palette</div>' +
              '</div>' +
              '<span class="text-[11px] font-mono text-[#939B93]">' + accentCol + ' • track:' + tr.id + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    // 4. Popular Tracks by Artist
    if (sameArtist.length) {
      html += '<section class="sp-more-section space-y-4">' +
        '<div class="flex items-end justify-between">' +
          '<div>' +
            '<span class="text-xs font-bold text-[#b3b3b3]">الأغاني الأكثر استماعاً للفنان</span>' +
            '<h2 class="text-2xl font-extrabold text-white mt-0.5" dir="ltr">Popular by ' + esc(artistName) + '</h2>' +
          '</div>' +
          '<span class="text-xs text-[#b3b3b3]">اضغط على أي أغنية لتشغيلها</span>' +
        '</div>' +
        '<div id="popular-tracks-list" class="sp-more-list space-y-1" dir="ltr">' +
          sameArtist.map((st, i) =>
            '<div class="sp-more-row song-row group grid grid-cols-[32px_1fr_auto] sm:grid-cols-[32px_1.5fr_1fr_auto] items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-white/10 transition cursor-pointer ' + (state.trackId === st.id ? 'bg-white/[0.07]' : '') + '" data-action="play" data-id="' + st.id + '" data-ctx="track">' +
              '<div class="flex items-center justify-center w-6">' +
                (state.trackId === st.id && engine.playing ? (
                  '<div class="row-index flex items-end gap-[2px] h-3.5">' +
                    '<span class="w-[3px] bg-[#1ed760] eq-bar-1"></span>' +
                    '<span class="w-[3px] bg-[#1ed760] eq-bar-2"></span>' +
                    '<span class="w-[3px] bg-[#1ed760] eq-bar-3"></span>' +
                    '<span class="w-[3px] bg-[#1ed760] eq-bar-4"></span>' +
                  '</div>'
                ) : (
                  '<span class="row-index text-sm font-semibold ' + (state.trackId === st.id ? 'text-[#1ed760]' : 'text-[#b3b3b3]') + '">' + (i + 1) + '</span>'
                )) +
                '<button class="row-play-btn hidden items-center justify-center text-white">' +
                  '<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">' + (state.trackId === st.id && engine.playing ? '<path d="M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7z"></path>' : '<path d="m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"></path>') + '</svg>' +
                '</button>' +
              '</div>' +
              '<div class="flex items-center gap-3 min-w-0">' +
                '<span class="sp-more-art w-10 h-10 rounded overflow-hidden shrink-0 shadow block">' + trackArt(st) + '</span>' +
                '<div class="min-w-0">' +
                  '<div class="sp-more-title text-sm font-bold truncate ' + (state.trackId === st.id ? 'text-[#1ed760]' : 'text-white') + '">' + esc(L(st.title)) + '</div>' +
                  '<div class="sp-more-sub text-xs text-[#b3b3b3] truncate">' + esc(L(st.album)) + '</div>' +
                '</div>' +
              '</div>' +
              '<div class="hidden sm:block text-xs text-[#b3b3b3] font-variant-numeric tabular-nums text-right">' +
                (st.source === 'file' ? 'Local' : '٢٤,١٠٥,٨٩٠') +
              '</div>' +
              '<div class="flex items-center gap-4 justify-end">' +
                '<button class="row-like text-[#b3b3b3] hover:text-white transition ' + (isFav(st.id) ? 'is-liked text-[#1ed760]' : '') + '" data-action="like" data-id="' + st.id + '" data-like="' + st.id + '">' +
                  '<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">' + (isFav(st.id) ? SVG_CHECK : SVG_PLUS) + '</svg>' +
                '</button>' +
                '<span class="sp-more-dur text-xs text-[#b3b3b3] font-variant-numeric tabular-nums w-10 text-right">' + fmt(st.duration) + '</span>' +
              '</div>' +
            '</div>'
          ).join('') +
        '</div>' +
      '</section>';
    }

    // 5. More From Discography & Releases
    html += '<section id="discography-section" class="space-y-4">' +
      '<div class="flex items-end justify-between">' +
        '<div>' +
          '<span class="text-xs font-bold text-[#b3b3b3]">الألبومات والإصدارات</span>' +
          '<h2 class="text-2xl font-extrabold text-white mt-0.5">المزيد من ' + esc(artistName) + '</h2>' +
        '</div>' +
      '</div>' +
      '<div id="discography-grid" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" dir="ltr">' +
        discography.map((dt) =>
          '<div class="discog-card p-3.5 rounded-xl bg-[#181818] hover:bg-[#282828] transition cursor-pointer flex flex-col gap-3 group relative" data-action="play" data-id="' + dt.id + '" data-ctx="track">' +
            '<div class="relative aspect-square w-full rounded-lg overflow-hidden shadow-lg bg-[#282828]">' +
              trackArt(dt, 'w-full h-full object-cover') +
              '<button class="card-play-fab absolute bottom-2 right-2 w-12 h-12 rounded-full bg-[#1ed760] hover:bg-[#3be477] hover:scale-105 text-black flex items-center justify-center shadow-2xl transition" data-action="play" data-id="' + dt.id + '">' +
                '<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">' + (state.trackId === dt.id && engine.playing ? '<path d="M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7z"></path>' : '<path d="m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"></path>') + '</svg>' +
              '</button>' +
            '</div>' +
            '<div class="min-w-0">' +
              '<div class="text-sm font-bold text-white truncate">' + esc(L(dt.title)) + '</div>' +
              '<div class="text-xs text-[#b3b3b3] mt-1">' + (dt.year || '2024') + ' • ' + esc(L(dt.album)) + '</div>' +
            '</div>' +
          '</div>'
        ).join('') +
      '</div>' +
    '</section>';

    // 6. Album Release Date & Build Metadata Footer
    html += '<footer class="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#b3b3b3]" dir="ltr">' +
      '<div class="space-y-1">' +
        '<div class="font-semibold text-white/90">March 15, ' + (tr.year || '2024') + ' • 1 Song, ' + fmt(tr.duration || 224) + '</div>' +
        '<div>℗ ' + (tr.year || '2024') + ' One Umbrella Records • © ' + (tr.year || '2024') + ' One Umbrella Records</div>' +
      '</div>' +
      '<div class="flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#939B93]">' +
        '<span class="px-2 py-1 rounded bg-[#181818] border border-white/10">Market: EG (ar-EG)</span>' +
        '<span class="px-2 py-1 rounded bg-[#181818] border border-white/10">Client: 1.3.10.542</span>' +
        '<span class="px-2 py-1 rounded bg-[#181818] border border-white/10">URI: track:' + tr.id + '</span>' +
      '</div>' +
    '</footer>';

    html += '</div></div>';

    el.track.innerHTML = html;
    updateLyricHighlight(engine.getPosition());

    // 3D Tilt Card Interaction
    const heroCard = el.track.querySelector('#hero-cover-trigger');
    if (heroCard && !heroCard.dataset.tiltBound) {
      heroCard.dataset.tiltBound = 'true';
      heroCard.addEventListener('mousemove', (e) => {
        const r = heroCard.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        heroCard.style.transform = 'perspective(600px) rotateY(' + (x * 14) + 'deg) rotateX(' + (-y * 14) + 'deg) scale(1.03)';
      });
      heroCard.addEventListener('mouseleave', () => {
        heroCard.style.transform = 'perspective(600px) rotateY(0deg) rotateX(0deg) scale(1)';
      });
    }

    // Sticky Song Bar Visibility on Scroll
    const viewport = $('#viewport');
    const stickyBar = el.track.querySelector('#sticky-song-bar');
    if (viewport && stickyBar && !viewport.dataset.stickySongBound) {
      viewport.dataset.stickySongBound = 'true';
      viewport.addEventListener('scroll', () => {
        if (ui.view !== 'track') return;
        if (viewport.scrollTop > 260) {
          stickyBar.classList.remove('opacity-0', 'pointer-events-none');
          stickyBar.classList.add('opacity-100');
        } else {
          stickyBar.classList.add('opacity-0', 'pointer-events-none');
          stickyBar.classList.remove('opacity-100');
        }
      });
    }
  }

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
    if (stageBar) stageBar.hidden = ui.view === 'track' || ui.view === 'playlist' || ui.view === 'artist' || ui.view === 'album';
    if (ui.view === 'home') renderHome();
    else if (ui.view === 'search') renderSearch();
    else if (ui.view === 'library') renderLibrary();
    else if (ui.view === 'track') renderTrackPage();
    else if (ui.view === 'playlist') renderPlaylistPage();
    else if (ui.view === 'artist') renderArtistPage();
    else if (ui.view === 'album') renderAlbumPage();
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
    if (['home', 'search', 'library', 'studio', 'track', 'playlist', 'artist', 'album'].indexOf(view) === -1) return;
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

  let pipHintShown = false;
  function showPipHintOnce() {
    if (pipHintShown || !('documentPictureInPicture' in window) || currentPipWindow) return;
    pipHintShown = true;
    setTimeout(() => {
      if (engine.playing && !currentPipWindow) {
        toast('💡 اضغط على أيقونة (⧉) في شريط التشغيل ليبقى المشغّل ظاهراً فوق باقي التبويبات والبرامج!', 6000);
      }
    }, 1500);
  }

  function playTrack(id, context, preferredProviderId) {
    const tr = getTrack(id);
    if (!tr) return;
    const same = state.trackId === id;
    if (same && !preferredProviderId && engine.playing) { engine.pause(); return; }

    if (Array.isArray(context) && context.length) {
      const ids = context.filter((x) => getTrack(x));
      if (ids.length) state.queue = ids.indexOf(id) === -1 ? [id].concat(ids) : ids.slice();
    }
    if (state.queue.indexOf(id) === -1) state.queue.push(id);

    if (!same || preferredProviderId) {
      state.trackId = id;
      if (ui.view === 'track') ui.viewTrackId = id;
      state.recent = [id].concat(state.recent.filter((x) => x !== id)).slice(0, 8);
      engine.load(tr, preferredProviderId);
    }
    engine.play();
    save();
    renderAll();
    maybePromptPipPermission();
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
      engine.pauseAtEnd();
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
      const dur = engine.getDuration();
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
      const dur = engine.getDuration();
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

  
  /* ---------- Spotify MiniPlayer (PIP & Document PiP) --------------------- */

  let currentPipWindow = null;

  function getMiniPlayerElement() {
    if (currentPipWindow && currentPipWindow.document) {
      const el = currentPipWindow.document.getElementById('spotifyMiniPlayer');
      if (el) return el;
    }
    return $('#spotifyMiniPlayer');
  }

  function renderMiniPlayer() {
    const elPip = getMiniPlayerElement();
    if (!elPip || elPip.style.display === 'none') return;
    const tr = getTrack(state.trackId) || (typeof TRACKS !== 'undefined' && TRACKS[0]) || null;
    if (!tr) return;
    const fav = isFav(tr.id);
    const titleText = byLang(tr.title);
    const artistText = byLang(tr.artist);

    // Track Title & Artist
    const tLink = elPip.querySelector('#pipTrackLink');
    if (tLink) {
      tLink.textContent = titleText;
      tLink.dataset.id = tr.id;
    }
    const aLink = elPip.querySelector('#pipArtistLink');
    if (aLink) {
      aLink.textContent = artistText;
      aLink.dataset.artist = typeof tr.artist === 'object' ? (tr.artist.ar || tr.artist.en) : tr.artist;
    }

    // Cover art & dynamic backdrop
    const coverImg = elPip.querySelector('#pipCoverImg');
    const artSrc = tr.art || (tr.colors ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="100%" height="100%" fill="' + encodeURIComponent(tr.colors[0] || '#222') + '"/><text x="50%" y="50%" fill="%23fff" font-size="64" font-family="sans-serif" text-anchor="middle" dy=".3em">' + encodeURIComponent(titleText.slice(0, 1)) + '</text></svg>' : '');
    if (coverImg && artSrc) {
      coverImg.src = artSrc;
    }
    const dominantColor = (tr.colors && tr.colors[0]) || '#4E554E';
    const stage = elPip.querySelector('#pip-artwork-stage') || elPip.querySelector('.bZbahvfcpU50g8Bgtnp7');
    if (stage) {
      stage.style.background = `radial-gradient(circle at 50% 32%, ${dominantColor} 0%, #1e221e 65%, #0a0a0a 100%)`;
      stage.style.setProperty('--background-base', dominantColor);
      stage.style.setProperty('--background-base-min-contrast', dominantColor);
    }

    // Like button
    const likeBtn = elPip.querySelector('#pipLikeBtn');
    if (likeBtn) {
      likeBtn.setAttribute('aria-checked', String(fav));
      likeBtn.dataset.id = tr.id;
      const likeIcon = elPip.querySelector('#pipLikeIcon');
      if (likeIcon) {
        likeIcon.style.color = fav ? '#1ed760' : 'inherit';
        if (fav) {
          likeIcon.innerHTML = '<path fill="#1ed760" d="M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11-4.925 11-11 11S1 18.075 1 12zm16.28-2.72a.75.75 0 0 0-1.06-1.06l-5.47 5.47-2.47-2.47a.75.75 0 0 0-1.06 1.06l3 3a.75.75 0 0 0 1.06 0l6-6z"></path>';
        } else {
          likeIcon.innerHTML = '<path d="M11.999 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m-11 9c0-6.075 4.925-11 11-11s11 4.925 11 11-4.925 11-11 11-11-4.925-11-11"></path><path d="M17.999 12a1 1 0 0 1-1 1h-4v4a1 1 0 1 1-2 0v-4h-4a1 1 0 1 1 0-2h4V7a1 1 0 1 1 2 0v4h4a1 1 0 0 1 1 1"></path>';
        }
      }
    }

    // Play / Pause Icon
    const playIcon = elPip.querySelector('#pipPlayIcon');
    if (playIcon) {
      if (engine.playing) {
        playIcon.innerHTML = '<path d="M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7z"></path>';
      } else {
        playIcon.innerHTML = '<path d="m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"></path>';
      }
    }

    // Shuffle & Repeat buttons active styles and indicator dots
    const shuffleBtn = elPip.querySelector('#pipShuffleBtn');
    const shuffleDot = elPip.querySelector('#pipShuffleDot');
    if (shuffleBtn) {
      shuffleBtn.style.color = state.shuffle ? '#1ed760' : '';
    }
    if (shuffleDot) {
      if (state.shuffle) shuffleDot.classList.remove('hidden');
      else shuffleDot.classList.add('hidden');
    }

    const repeatBtn = elPip.querySelector('#pipRepeatBtn');
    const repeatDot = elPip.querySelector('#pipRepeatDot');
    if (repeatBtn) {
      repeatBtn.style.color = state.repeat !== 'off' ? '#1ed760' : '';
    }
    if (repeatDot) {
      if (state.repeat !== 'off') repeatDot.classList.remove('hidden');
      else repeatDot.classList.add('hidden');
    }

    // Volume slider & icon
    const volInput = elPip.querySelector('#pipVolInput');
    const volFill = elPip.querySelector('#pipVolFill');
    const volThumb = elPip.querySelector('#pipVolThumb');
    const effectiveVol = state.muted ? 0 : state.volume;
    if (volInput) volInput.value = effectiveVol;
    if (volFill) volFill.style.width = effectiveVol + '%';
    if (volThumb) volThumb.style.left = effectiveVol + '%';

    const volIcon = elPip.querySelector('#pipVolumeIcon');
    if (volIcon) {
      if (state.muted || state.volume === 0) {
        volIcon.innerHTML = '<path d="M13.86 5.47a.75.75 0 0 0-1.061 0l-1.47 1.47-1.47-1.47A.75.75 0 0 0 8.8 6.53L10.269 8l-1.47 1.47a.75.75 0 1 0 1.06 1.06l1.47-1.47 1.47 1.47a.75.75 0 0 0 1.06-1.06L12.39 8l1.47-1.47a.75.75 0 0 0 0-1.06z"></path><path d="M10.116 1.5A.75.75 0 0 0 8.991.85l-6.925 4a3.642 3.642 0 0 0-1.33 4.967 3.639 3.639 0 0 0 1.33 1.332l6.925 4a.75.75 0 0 0 1.125-.649v-1.906a4.73 4.73 0 0 1-1.5-.694v1.3L2.817 9.852a2.141 2.141 0 0 1-.781-2.92c.187-.324.456-.594.78-.782l5.8-3.35v1.3c.45-.313.956-.55 1.5-.694V1.5z"></path>';
      } else {
        volIcon.innerHTML = '<path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88"></path><path d="M11.5 13.614a5.752 5.752 0 0 0 0-11.228v1.55a4.252 4.252 0 0 1 0 8.127z"></path>';
      }
    }

    // Timeline progress
    paintProgress(engine.getPosition(), engine.getDuration());
  }

  let isDraggingPip = false;
  let pipStartX = 0, pipStartY = 0;
  let pipStartLeft = 0, pipStartTop = 0;

  function initPipControls(rootDoc) {
    const doc = rootDoc || document;
    const miniEl = doc.getElementById('spotifyMiniPlayer');
    if (!miniEl) return;
    const dragBar = miniEl.querySelector('#pipDragBar');
    const seekWrap = miniEl.querySelector('#pipSeekWrap');
    const seekInput = miniEl.querySelector('#pipSeekInput');
    const volInput = miniEl.querySelector('#pipVolInput');
    const volFill = miniEl.querySelector('#pipVolFill');
    const volThumb = miniEl.querySelector('#pipVolThumb');
    const compactBtn = miniEl.querySelector('#btn-pip-compact');
    const overlay = miniEl.querySelector('.n7BS2oAfcAoFbbqZ2YkA');
    const mediaElem = miniEl.querySelector('.bZbahvfcpU50g8Bgtnp7');

    if (compactBtn && !compactBtn.dataset.bound) {
      compactBtn.dataset.bound = 'true';
      let isCompact = false;
      compactBtn.addEventListener('click', () => {
        const stage = miniEl.querySelector('#pip-artwork-stage') || miniEl.querySelector('.bZbahvfcpU50g8Bgtnp7');
        if (stage) {
          isCompact = !isCompact;
          stage.style.height = isCompact ? '170px' : '282px';
        }
      });
    }

    if (mediaElem && overlay && !mediaElem.dataset.tapBound) {
      mediaElem.dataset.tapBound = 'true';
      let tapTimer;
      mediaElem.addEventListener('click', (e) => {
        if (e.target.closest('button, input, a')) return;
        overlay.classList.toggle('is-active');
        clearTimeout(tapTimer);
        if (overlay.classList.contains('is-active')) {
          tapTimer = setTimeout(() => overlay.classList.remove('is-active'), 4000);
        }
      });
    }

    if (dragBar && !dragBar.dataset.bound) {
      dragBar.dataset.bound = 'true';
      dragBar.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        isDraggingPip = true;
        const rect = miniEl.getBoundingClientRect();
        pipStartX = e.clientX;
        pipStartY = e.clientY;
        pipStartLeft = rect.left;
        pipStartTop = rect.top;
        miniEl.style.transition = 'none';
        e.preventDefault();
      });

      doc.addEventListener('mousemove', (e) => {
        if (!isDraggingPip || !miniEl) return;
        const dx = e.clientX - pipStartX;
        const dy = e.clientY - pipStartY;
        const newLeft = Math.max(10, Math.min(window.innerWidth - miniEl.offsetWidth - 10, pipStartLeft + dx));
        const newTop = Math.max(10, Math.min(window.innerHeight - miniEl.offsetHeight - 10, pipStartTop + dy));
        miniEl.style.left = newLeft + 'px';
        miniEl.style.top = newTop + 'px';
        miniEl.style.right = 'auto';
        miniEl.style.bottom = 'auto';
      });

      doc.addEventListener('mouseup', () => {
        if (isDraggingPip) {
          isDraggingPip = false;
          if (miniEl) miniEl.style.transition = '';
        }
      });

      dragBar.addEventListener('touchstart', (e) => {
        if (e.target.closest('button')) return;
        const touch = e.touches[0];
        if (!touch) return;
        isDraggingPip = true;
        const rect = miniEl.getBoundingClientRect();
        pipStartX = touch.clientX;
        pipStartY = touch.clientY;
        pipStartLeft = rect.left;
        pipStartTop = rect.top;
        miniEl.style.transition = 'none';
      }, { passive: true });

      doc.addEventListener('touchmove', (e) => {
        if (!isDraggingPip || !miniEl) return;
        const touch = e.touches[0];
        if (!touch) return;
        const dx = touch.clientX - pipStartX;
        const dy = touch.clientY - pipStartY;
        const newLeft = Math.max(10, Math.min(window.innerWidth - miniEl.offsetWidth - 10, pipStartLeft + dx));
        const newTop = Math.max(10, Math.min(window.innerHeight - miniEl.offsetHeight - 10, pipStartTop + dy));
        miniEl.style.left = newLeft + 'px';
        miniEl.style.top = newTop + 'px';
        miniEl.style.right = 'auto';
        miniEl.style.bottom = 'auto';
      }, { passive: true });

      doc.addEventListener('touchend', () => {
        if (isDraggingPip) {
          isDraggingPip = false;
          if (miniEl) miniEl.style.transition = '';
        }
      });
    }

    const handleSeek = (pct) => {
      const dur = engine.getDuration();
      if (dur > 0) {
        engine.seek(pct * dur);
        paintProgress(pct * dur, dur);
      }
    };

    if (seekInput && !seekInput.dataset.bound) {
      seekInput.dataset.bound = 'true';
      seekInput.addEventListener('input', (e) => {
        const pct = parseFloat(e.target.value) / 100;
        handleSeek(pct);
      });
    }

    if (seekWrap && !seekWrap.dataset.bound) {
      seekWrap.dataset.bound = 'true';
      seekWrap.addEventListener('click', (e) => {
        if (e.target === seekInput) return;
        const rect = seekWrap.getBoundingClientRect();
        const pct = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        handleSeek(pct);
      });
    }

    if (volInput && !volInput.dataset.bound) {
      volInput.dataset.bound = 'true';
      volInput.addEventListener('input', () => {
        state.volume = Number(volInput.value);
        if (state.volume > 0) state.muted = false;
        engine.setVolume();
        if (volFill) volFill.style.width = state.volume + '%';
        if (volThumb) volThumb.style.left = state.volume + '%';
        if (el.vol) {
          el.vol.value = String(state.volume);
          if (el.vol.style) el.vol.style.setProperty('--vol', state.volume + '%');
        }
        refreshTransport();
        renderMiniPlayer();
      });
      volInput.addEventListener('change', () => {
        save();
        refreshTransport();
      });
    }
  }

  let userDismissedPip = false;
  function setAutoPip(enabled) {
    userDismissedPip = !enabled;
  }

    function maybePromptPipPermission() {
    if (currentPipWindow && !currentPipWindow.closed) return;
    const perm = localStorage.getItem('7ify_pip_permission');
    if (perm === 'granted') {
      if ('documentPictureInPicture' in window && window.innerWidth > 640) {
        openDocumentPip().catch(() => {});
      }
      return;
    }
    if (perm === 'dismissed') return;
    if (sessionStorage.getItem('7ify_pip_prompt_shown')) return;

    if ('documentPictureInPicture' in window && window.innerWidth > 640) {
      sessionStorage.setItem('7ify_pip_prompt_shown', 'true');
      const promptEl = $('#pipPermissionPrompt');
      if (promptEl) {
        promptEl.hidden = false;
        promptEl.style.display = 'flex';
      }
    }
  }

  async function triggerAutoPip() {
    // Disabled: playback must never auto-open any in-page popups
    return;
  }

  async function toggleMiniPlayer() {
    userDismissedPip = false;
    // 1. If Document Picture-in-Picture window is currently open, close it
    if (currentPipWindow && !currentPipWindow.closed) {
      currentPipWindow.close();
      return;
    }

    // 2. If in-page popup is currently open, close it
    const miniEl = $('#spotifyMiniPlayer');
    if (miniEl && miniEl.style.display !== 'none' && !miniEl.classList.contains('in-document-pip')) {
      closeInPageMiniPlayer();
      return;
    }

    // 3. On desktop with Document Picture-in-Picture support, open native floating window
    if ('documentPictureInPicture' in window && window.innerWidth > 640) {
      try {
        const opened = await openDocumentPip();
        if (opened) return;
      } catch (err) {
        console.warn('Document Picture-in-Picture error, falling back to in-page popup:', err);
      }
    }

    // 4. In-page fallback (mobile or unsupported browsers)
    openInPageMiniPlayer();
  }

  async function openDocumentPip() {
    const miniEl = $('#spotifyMiniPlayer');
    if (!miniEl || !('documentPictureInPicture' in window)) return false;

    // Close in-page version
    miniEl.style.display = 'none';

    // Request native floating window
    const pipWin = await window.documentPictureInPicture.requestWindow({
      width: 340, height: 382,
      disallowReturnToOpener: false
    });
    currentPipWindow = pipWin;

    // Copy all stylesheets from main document
    [...document.styleSheets].forEach((sheet) => {
      try {
        if (sheet.href) {
          const link = pipWin.document.createElement('link');
          link.rel = 'stylesheet';
          link.href = sheet.href;
          pipWin.document.head.appendChild(link);
        } else if (sheet.cssRules) {
          const style = pipWin.document.createElement('style');
          style.textContent = [...sheet.cssRules].map((r) => r.cssText).join('\n');
          pipWin.document.head.appendChild(style);
        }
      } catch (e) {
        if (sheet.href) {
          const link = pipWin.document.createElement('link');
          link.rel = 'stylesheet';
          link.href = sheet.href;
          pipWin.document.head.appendChild(link);
        }
      }
    });

    // Copy fonts & favicons
    [...document.querySelectorAll('link[rel*="font"], link[rel*="icon"]')].forEach((l) => {
      pipWin.document.head.appendChild(l.cloneNode(true));
    });

    // Pip window document configuration
    pipWin.document.documentElement.lang = 'ar';
    pipWin.document.documentElement.dir = 'ltr';
    pipWin.document.documentElement.className = 'encore-dark-theme encore-small-devices-theme ' + (document.documentElement.className || '');
    pipWin.document.title = 'Spotify MiniPlayer';
    pipWin.document.body.style.margin = '0';
    pipWin.document.body.style.padding = '0';
    pipWin.document.body.style.overflow = 'hidden';
    pipWin.document.body.style.height = '100%';
    pipWin.document.body.style.backgroundColor = '#0a0a0a';

    // Placeholder in main DOM tree
    const placeholder = document.createElement('div');
    placeholder.id = 'pipPlaceholder';
    placeholder.style.display = 'none';
    miniEl.parentNode.insertBefore(placeholder, miniEl);

    // Style for full-window PiP display
    miniEl.classList.add('in-document-pip');
    miniEl.style.display = 'flex';
    miniEl.hidden = false;
    miniEl.style.position = 'static';
    miniEl.style.width = '100vw';
    miniEl.style.height = '100vh';
    miniEl.style.maxWidth = '100vw';
    miniEl.style.borderRadius = '0';
    miniEl.style.boxShadow = 'none';

    pipWin.document.body.appendChild(miniEl);

    // Forward click actions from PiP window to application
    pipWin.document.addEventListener('click', (e) => {
      const node = e.target.closest('[data-action]');
      if (!node) return;
      const action = node.dataset.action;
      if (node.tagName === 'A' && node.getAttribute('href') === '#') e.preventDefault();
      if (action === 'close-miniplayer') {
        pipWin.close();
        return;
      }
      onAction(action, node);
    });

    // Initialize PiP seek and volume controls
    initPipControls(pipWin.document);

    // Highlight button in main document
    $$('[data-action="toggle-miniplayer"]').forEach((btn) => {
      btn.setAttribute('aria-pressed', 'true');
      btn.classList.add('is-active');
    });

    renderMiniPlayer();

    // Cleanup when PiP window is closed
    pipWin.addEventListener('pagehide', () => {
      userDismissedPip = true;
      currentPipWindow = null;
      miniEl.classList.remove('in-document-pip');
      miniEl.style.position = '';
      miniEl.style.width = '';
      miniEl.style.height = '';
      miniEl.style.maxWidth = '';
      miniEl.style.borderRadius = '';
      miniEl.style.boxShadow = '';
      miniEl.style.display = 'none';

      if (placeholder.parentNode) {
        placeholder.parentNode.insertBefore(miniEl, placeholder);
        placeholder.remove();
      }

      $$('[data-action="toggle-miniplayer"]').forEach((btn) => {
        btn.setAttribute('aria-pressed', 'false');
        btn.classList.remove('is-active');
      });
    });

    return true;
  }

  function toggleInPageMiniPlayer() {
    const miniEl = $('#spotifyMiniPlayer');
    if (!miniEl) return;
    const isHidden = miniEl.style.display === 'none' || miniEl.hidden;
    if (isHidden) {
      openInPageMiniPlayer();
    } else {
      closeInPageMiniPlayer();
    }
  }

  function openInPageMiniPlayer() {
    const miniEl = $('#spotifyMiniPlayer');
    if (!miniEl) return;
    miniEl.style.display = 'flex';
    miniEl.hidden = false;
    $$('[data-action="toggle-miniplayer"]').forEach((btn) => {
      btn.setAttribute('aria-pressed', 'true');
      btn.classList.add('is-active');
    });
    initPipControls(document);
    renderMiniPlayer();
  }

  function closeInPageMiniPlayer() {
    if (currentPipWindow && !currentPipWindow.closed) {
      currentPipWindow.close();
      return;
    }
    const miniEl = $('#spotifyMiniPlayer');
    if (!miniEl) return;
    miniEl.style.display = 'none';
    $$('[data-action="toggle-miniplayer"]').forEach((btn) => {
      btn.setAttribute('aria-pressed', 'false');
      btn.classList.remove('is-active');
    });
  }

  function openMiniPlayer() {
    toggleMiniPlayer();
  }

  function closeMiniPlayer() {
    closeInPageMiniPlayer();
  }

/* ---------- event wiring ------------------------------------------------ */

  function onAction(action, node) {
    switch (action) {
      case 'go': {
        setView(node.dataset.view);
        if (node.dataset.view === 'search' && el.q) {
          setTimeout(() => el.q.focus(), 60);
        }
        break;
      }
      case 'back':
        if (ui.histIdx > 0) { ui.histIdx -= 1; setView(ui.hist[ui.histIdx], false); }
        break;
      case 'forward':
        if (ui.histIdx < ui.hist.length - 1) { ui.histIdx += 1; setView(ui.hist[ui.histIdx], false); }
        break;
      case 'play': playTrack(node.dataset.id, ui.ctx[node.dataset.ctx]); break;
      case 'playlist': openPlaylistPage(node.dataset.id); break;
      case 'play-playlist': playPlaylist(node.dataset.id); break;
      case 'shuffle-playlist': {
        state.shuffle = true;
        refreshTransport();
        playPlaylist(node.dataset.id);
        break;
      }
      case 'artist': openArtistPage(node.dataset.artist); break;
      case 'play-artist-all': {
        const trs = NG.getArtistTracks(ui.activeArtistName);
        if (trs.length) playTrack(trs[0].id, trs.map((t) => t.id));
        break;
      }
      case 'album': openAlbumPage(node.dataset.album); break;
      case 'play-album-all': {
        const trs = NG.getAlbumTracks(ui.activeAlbumName);
        if (trs.length) playTrack(trs[0].id, trs.map((t) => t.id));
        break;
      }
      case 'delete-playlist': {
        const id = node.dataset.id;
        state.playlists = state.playlists.filter((p) => p.id !== id);
        save();
        renderRail();
        setView('library');
        toast(t('toast.resetDone'));
        break;
      }
      case 'remove-from-playlist': {
        const plId = node.dataset.pl;
        const trId = node.dataset.id;
        const pl = state.playlists.find((p) => p.id === plId);
        if (pl && pl.tracks) {
          pl.tracks = pl.tracks.filter((x) => x !== trId);
          save();
          renderPlaylistPage();
          renderRail();
        }
        break;
      }
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
      case 'connect-spotify': {
        providers.connectSpotify().catch(error => {
          console.error(error);
          toast(t('studio.spotifyConnectFailed') || 'Failed to connect to Spotify');
        });
        break;
      }
      case 'disconnect-spotify': {
        if (providers && typeof providers.disconnectSpotify === 'function') {
          providers.disconnectSpotify();
        } else if (providers && typeof providers.setSpotifyAuth === 'function') {
          providers.setSpotifyAuth(null);
        }
        toast(t('toast.spotifyDisconnected'));
        renderStudio();
        renderPlayer();
        break;
      }
      case 'open-sources': {
        const trId = node.dataset.id || state.trackId;
        const tr = getTrack(trId);
        if (tr) openSourcesDialog(tr);
        break;
      }
      case 'switch-source': {
        const trId = node.dataset.trackId || state.trackId;
        const provId = node.dataset.provider;
        if (!provId) return;
        const tr = getTrack(trId);
        if (tr && state.trackId !== tr.id) {
          playTrack(tr.id, 'sources', provId);
        } else {
          engine.switchSource(provId);
        }
        if (el.sourcesDlg) el.sourcesDlg.close();
        break;
      }
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
      case 'focus-search':
      case 'submit-search': {
        if (el.q) {
          el.q.focus();
          if (el.q.value.trim()) {
            runUnifiedSearch(el.q.value.trim());
            if (ui.view !== 'search') setView('search');
            else renderSearch();
          }
        }
        break;
      }
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
        if (ui.view === 'artist') renderArtistPage();
        break;
      }
      case 'toggle-miniplayer': toggleMiniPlayer(); break;
      case 'close-miniplayer': closeMiniPlayer(); break;
      case 'grant-pip-permission': {
        const promptEl = $('#pipPermissionPrompt');
        if (promptEl) {
          promptEl.hidden = true;
          promptEl.style.display = 'none';
        }
        localStorage.setItem('7ify_pip_permission', 'granted');
        openDocumentPip().catch((e) => {
          console.warn('PiP window open error:', e);
          openInPageMiniPlayer();
        });
        break;
      }
      case 'dismiss-pip-prompt': {
        const promptEl = $('#pipPermissionPrompt');
        if (promptEl) {
          promptEl.hidden = true;
          promptEl.style.display = 'none';
        }
        localStorage.setItem('7ify_pip_permission', 'dismissed');
        break;
      }
      case 'pip-explore-premium': {
        toast('🎉 أنت تستمتع بجميع مزايا Spotify مجاناً على 7ify!');
        const banner = $('#pipPremiumBanner');
        if (banner) banner.style.display = 'none';
        break;
      }
      case 'pip-dismiss-banner': {
        const banner = $('#pipPremiumBanner');
        if (banner) banner.style.display = 'none';
        break;
      }
      case 'pip-copy-link': {
        const tr = getTrack(state.trackId);
        const title = tr ? byLang(tr.title) : 'Song';
        const url = window.location.origin + (window.location.pathname || '') + '#track/' + (tr ? tr.id : '');
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(() => {
            toast('🔗 تم نسخ رابط «' + title + '» بنجاح');
          }).catch(() => {
            toast('🔗 ' + url);
          });
        } else {
          toast('🔗 تم نسخ الرابط');
        }
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

    function handleAutocompleteKeydown(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeSuggestionIndex >= 0 && autocompleteItems[activeSuggestionIndex]) {
          selectAutocompleteItem(autocompleteItems[activeSuggestionIndex]);
        } else {
          const v = el.q.value.trim();
          if (v) {
            ui.recentSearches = [v].concat(ui.recentSearches.filter((x) => x !== v)).slice(0, 6);
            closeAutocomplete();
            if (ui.view !== 'search') setView('search');
            else renderSearch();
            triggerOnlineSearch(v);
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        closeAutocomplete();
        return;
      }

      if (!el.searchAutocomplete || el.searchAutocomplete.hidden) {
        if (e.key === 'ArrowDown' && el.q.value.trim()) {
          e.preventDefault();
          runUnifiedSearch(el.q.value);
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestion(activeSuggestionIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestion(activeSuggestionIndex <= 0 ? autocompleteItems.length - 1 : activeSuggestionIndex - 1);
      }
    }

    if (el.q) {
      el.q.addEventListener('input', () => {
        ui.q = el.q.value;
        if (el.qClear) el.qClear.hidden = !ui.q;
        if (el.searchWrap) el.searchWrap.classList.toggle('has-value', !!ui.q);
        runUnifiedSearch(el.q.value);
      });

      el.q.addEventListener('keydown', handleAutocompleteKeydown);

      el.q.addEventListener('focus', () => {
        if (el.q.value.trim() || ui.recentSearches.length) {
          runUnifiedSearch(el.q.value);
        }
      });
    }

    if (el.searchAutocomplete) {
      el.searchAutocomplete.addEventListener('click', (e) => {
        const itemNode = e.target.closest('[data-autocomplete-index]');
        if (!itemNode) return;
        const idx = Number(itemNode.dataset.autocompleteIndex);
        if (idx >= 0 && autocompleteItems[idx]) {
          selectAutocompleteItem(autocompleteItems[idx]);
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (el.searchWrap && !el.searchWrap.contains(e.target)) {
        closeAutocomplete();
      }
    });

    if (el.newPlForm) {
      el.newPlForm.addEventListener('submit', (e) => {
        e.preventDefault();
        createPlaylist(el.newPlName.value);
      });
    }

    if (el.fileInput) {
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
    }

    if (el.vol) {
      el.vol.addEventListener('input', () => {
        state.volume = Number(el.vol.value);
        if (state.volume > 0) state.muted = false;
        engine.setVolume();
        if (el.vol.style) el.vol.style.setProperty('--vol', state.volume + '%');
        refreshTransport();
      });
      el.vol.addEventListener('change', () => { save(); refreshTransport(); });
    }

    if (el.sheet) {
      el.sheet.addEventListener('click', (e) => {
        if (e.target === el.sheet) closeSheet();
      });
      el.sheet.addEventListener('close', () => { ui.dragging = false; });
    }
    if (el.confirmDlg) el.confirmDlg.addEventListener('click', (e) => { if (e.target === el.confirmDlg) el.confirmDlg.close(); });
    if (el.shortcutsDlg) el.shortcutsDlg.addEventListener('click', (e) => { if (e.target === el.shortcutsDlg) el.shortcutsDlg.close(); });
    if (el.sourcesDlg) el.sourcesDlg.addEventListener('click', (e) => { if (e.target === el.sourcesDlg) el.sourcesDlg.close(); });
    if (el.newPlDlg) el.newPlDlg.addEventListener('click', (e) => { if (e.target === el.newPlDlg) el.newPlDlg.close(); });

    bus.addEventListener('state', () => { refreshTransport(); renderView(); renderNowPanel(); });
    bus.addEventListener('tick', (e) => {
      if (ui.dragging) return;
      paintProgress(e.detail.pos, e.detail.duration);
    });
    bus.addEventListener('ended', onEnded);
    bus.addEventListener('meta', () => { renderPlayer(); renderView(); });
    bus.addEventListener('app-toast', (e) => toast(t(e.detail.key)));
    bus.addEventListener('fallback', (e) => {
      const prov = e.detail?.to || '';
      const provName = prov === 'youtube' ? 'YouTube' :
                       prov === 'jamendo' ? 'Jamendo' :
                       prov === 'archive' ? 'Internet Archive' :
                       prov === 'apple' ? 'Apple Music' : prov;
      toast((t('sources.fallback') || 'تم الانتقال تلقائياً إلى مصدر بديل') + (provName ? ' (' + provName + ')' : ''));
      renderPlayer();
      renderView();
    });
    bus.addEventListener('error', () => toast(t('toast.importError')));

    document.addEventListener('keydown', (e) => {
      const target = e.target;
      const tag = (target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
      if (e.key === 'Escape') {
        const mini = $('#spotifyMiniPlayer');
        if (mini && mini.style.display !== 'none' && !mini.hidden) {
          closeMiniPlayer();
          return;
        }
        if (el.sheet.open) { closeSheet(); return; }
        if (el.sourcesDlg && el.sourcesDlg.open) { el.sourcesDlg.close(); return; }
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
    initPipControls();
    initMediaSession();
    bindSeek($('#pSeek'), (ratio) => { engine.seek(ratio * engine.getDuration()); syncProgress(); });
    bindSeek($('#shSeek'), (ratio) => { engine.seek(ratio * engine.getDuration()); syncProgress(); });
    engine.load(getTrack(state.trackId));
    renderShortcuts();
    renderAll();
    syncProgress();
    el.vol.value = String(state.volume);
    el.vol.style.setProperty('--vol', state.volume + '%');
    $$('[data-view-section]').forEach((s) => { s.hidden = s.dataset.viewSection !== ui.view; });

    if (providers && typeof providers.handleCallback === 'function') {
      providers.handleCallback().catch(err => {
        console.warn('Spotify callback handling error:', err);
      }).finally(() => {
        const spotifyStatus = providers.getProviderStatus().spotify;
        if (spotifyStatus.connected && spotifyStatus.isPremium && !engine._spotifyPlayer) {
          providers.getValidAccessToken().then(token => {
            if (token && typeof NG.initializeSpotifyPlayer === 'function') {
              NG.initializeSpotifyPlayer(token).catch(() => {});
            }
          });
        }
        renderStudio();
        renderPlayer();
      });
    } else {
      const spotifyStatus = providers?.getProviderStatus?.()?.spotify;
      if (spotifyStatus?.connected && spotifyStatus?.isPremium && !engine._spotifyPlayer) {
        providers.getValidAccessToken().then(token => {
          if (token && typeof NG.initializeSpotifyPlayer === 'function') {
            NG.initializeSpotifyPlayer(token).catch(() => {});
          }
        });
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.__nagham = {
    ui, state, playTrack, stepTrack, setView, openSheet, closeSheet,
    openTrackPage, renderTrackPage,
    openPlaylistPage, renderPlaylistPage,
    openArtistPage, renderArtistPage,
    openAlbumPage, renderAlbumPage,
    toggleMiniPlayer, openMiniPlayer, closeMiniPlayer, renderMiniPlayer, openInPageMiniPlayer, closeInPageMiniPlayer, openDocumentPip, setAutoPip,
    runUnifiedSearch, closeAutocomplete, setActiveSuggestion, selectAutocompleteItem, renderAutocomplete
  };
  if (window.NG) {
    Object.assign(window.NG, {
      ui, openInPageMiniPlayer, closeInPageMiniPlayer, openDocumentPip, toggleMiniPlayer, setAutoPip,
      runUnifiedSearch, closeAutocomplete, setActiveSuggestion, selectAutocompleteItem, renderAutocomplete
    });
  }
})();
