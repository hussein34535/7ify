/* ==========================================================================
   NAGHAM STUDIO — core: real catalog, i18n, state, theme, audio element
   ========================================================================== */
window.NG = (function () {
  'use strict';

  /* ---------- utils -------------------------------------------------------- */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const pad2 = (n) => String(n).padStart(2, '0');
  const formatDuration = (val) => {
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) return '--:--';
    const total = Math.floor(n);
    return Math.floor(total / 60) + ':' + pad2(total % 60);
  };
  const formatPosition = (val) => {
    const n = Number(val);
    const safe = Number.isFinite(n) ? Math.max(0, n) : 0;
    const total = Math.floor(safe);
    return Math.floor(total / 60) + ':' + pad2(total % 60);
  };
  const fmt = (sec) => {
    if (sec == null) return '--:--';
    const n = Number(sec);
    if (!Number.isFinite(n) || n < 0) return '--:--';
    const s = Math.floor(n);
    return Math.floor(s / 60) + ':' + pad2(s % 60);
  };
  const uid = (p) => p + '-' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);

  const AR_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

  function normalizeSearchText(value) {
    return String(value ?? '')
      .normalize('NFKD')
      .replace(AR_MARKS, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(value) {
    return normalizeSearchText(value).split(' ').filter(Boolean);
  }

  const norm = normalizeSearchText;

  const clampText = (s, n) => {
    const t = String(s || '').trim();
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  };

  /* ---------- i18n --------------------------------------------------------- */

  const I18N = {
    ar: {
      'a11y.skip': 'تخطَّ إلى المحتوى',
      'nav.home': 'الرئيسية', 'nav.search': 'بحث', 'nav.library': 'مكتبتك', 'nav.studio': 'الاستوديو',
      'nav.back': 'رجوع', 'nav.forward': 'تقدُّم', 'nav.panel': 'إظهار لوحة التشغيل', 'nav.panelClose': 'إخفاء لوحة التشغيل',
      'search.placeholder': 'ابحث عن أغنية أو فنان', 'search.label': 'بحث', 'search.clear': 'مسح البحث',
      'top.import': 'استيراد', 'top.importAria': 'تشغيل ملف صوتي من جهازك',
      'top.customize': 'تخصيص', 'top.shortcuts': 'اختصارات لوحة المفاتيح',
      'top.lang': 'التبديل إلى الإنجليزية', 'top.profile': 'حسابك والمكتبة',
      'rail.library': 'مكتبتك', 'rail.new': 'قائمة تشغيل جديدة',
      'rail.engine': 'معاينات صوتية حقيقية', 'rail.engineSub': '٣٠ ثانية · Apple Music',
      'rail.audioSettings': 'إعدادات الصوت', 'rail.liked': 'الأغاني المعجب بها',
      'rail.playlist': 'قائمة',
      'panel.now': 'الآن', 'panel.queue': 'الانتظار', 'panel.about': 'عن الأغنية', 'panel.lyrics': 'الكلمات',
      'player.expand': 'فتح المشغل الكامل', 'player.like': 'حفظ في الأغاني المعجب بها',
      'player.shuffle': 'تشغيل عشوائي', 'player.prev': 'السابق', 'player.play': 'تشغيل',
      'player.pause': 'إيقاف مؤقت', 'player.next': 'التالي', 'player.repeat': 'تكرار',
      'player.mute': 'كتم الصوت', 'player.unmute': 'إلغاء كتم الصوت', 'player.about': 'عن الأغنية',
      'player.queue': 'قائمة الانتظار', 'player.seek': 'موضع التشغيل', 'player.volume': 'مستوى الصوت',
      'player.close': 'إغلاق المشغل', 'player.preview': 'معاينة', 'player.local': 'ملف محلي', 'player.synth': 'بث ماستر HQ',
      'player.unavailable': 'غير متاح',
      'player.miniPlayer': 'المشغِّل المصغَّر',
      'sheet.from': 'يُشغَّل من مكتبتك', 'sheet.player': 'المشغل', 'sheet.queue': 'الانتظار', 'sheet.about': 'عن الأغنية', 'sheet.lyrics': 'الكلمات',
      'common.close': 'إغلاق', 'common.cancel': 'إلغاء', 'common.create': 'إنشاء', 'common.seeAll': 'عرض الكل',
      'genre.all': 'كل الأنواع', 'genre.arabic': 'عربي', 'genre.electronic': 'إلكتروني',
      'genre.rap': 'راب', 'genre.classic': 'كلاسيكي', 'genre.local': 'ملف محلي',
      'greet.morning': 'صباح الخير', 'greet.afternoon': 'نهارك سعيد', 'greet.evening': 'مساء الخير', 'greet.night': 'سهرة هادئة',
      'greet.sub': 'ماذا تحب أن تسمع الآن؟',
      'sec.jump': 'ارجع للي كنت بتسمعه', 'sec.jumpSub': 'من حيث توقفت',
      'sec.mixes': 'مصمّم لك', 'sec.mixesSub': 'توليفات تتغير مع مزاجك',
      'sec.trending': 'الأكثر استماعًا الآن', 'sec.trendingSub': 'هذا الأسبوع',
      'sec.artists': 'فنانون يستحقون المتابعة', 'sec.artistsSub': 'أصوات جديدة وقريبة',
      'hero.badge': 'إصدار جديد', 'hero.play': 'استمع الآن', 'hero.immersive': 'المشغل الكامل',
      'hero.album': 'ألبوم',
      'about.album': 'الألبوم', 'about.year': 'السنة', 'about.genre': 'النوع',
      'about.length': 'المدة', 'about.source': 'المصدر', 'about.sourceApple': 'Apple Music',
      'about.previewNote': 'هذه معاينة صوتية قانونية مدتها ٣٠ ثانية. لتشغيل الأغنية كاملة، استورد ملفًا من جهازك من زر «استيراد».',
      'search.title': 'بحث', 'search.resultsFor': 'نتائج البحث عن «{q}»', 'search.count': '{n} نتيجة',
      'search.top': 'أفضل نتيجة', 'search.songs': 'أغانٍ', 'search.artists': 'فنانون',
      'search.emptyTitle': 'لا يوجد شيء بهذا الاسم',
      'search.emptyBody': 'جرّب اسم فنان أو كلمة أقصر. البحث يتجاهل التشكيل وأخطاء الهمزات.',
      'search.noQueryTitle': 'ابحث في كل شيء',
      'search.noQueryBody': 'اكتب اسم أغنية أو فنان، أو ابدأ من أحد هذه المقترحات.',
      'search.quickSuggestions': 'مقترحات للبحث السريع',
      'search.searchingOnline': 'جاري البحث في مكتبة Apple Music العالمية...',
      'search.recent': 'بحثت عنها مؤخرًا', 'search.clearRecent': 'مسح', 'search.browse': 'تصفّح الأنواع',
      'search.song': 'أغنية', 'search.local': 'محلي',
      'library.title': 'مكتبتك', 'library.liked': 'الأغاني المعجب بها', 'library.likedSub': 'كل ما حفظته في مكان واحد',
      'library.librarySub': 'قوائمك، أغانيك المحفوظة، والفنانون في مكان واحد.',
      'library.playAll': 'تشغيل الكل', 'library.newPlaylist': 'قائمة جديدة',
      'library.tabPlaylists': 'قوائم التشغيل', 'library.tabLiked': 'المعجب بها', 'library.tabArtists': 'الفنانون',
      'library.emptyLiked': 'لا أغاني محفوظة بعد', 'library.emptyLikedBody': 'اضغط على القلب بجوار أي أغنية لتظهر هنا.',
      'library.emptyPl': 'لا توجد قوائم بعد', 'library.emptyPlBody': 'أنشئ قائمتك الأولى من زر + في المكتبة.',
      'library.plSub': 'قائمة تشغيل',
      'studio.title': 'الاستوديو', 'studio.sub': 'المظهر، الصوت، والتفضيلات. كل شيء يُحفظ على هذا الجهاز.',
      'studio.theme': 'السمة', 'studio.themeSub': 'سطح داكن افتراضيًا، وورقي للنهار.',
      'studio.accent': 'لون التمييز', 'studio.accentSub': 'يُستخدم للأزرار الأساسية وحالة التشغيل فقط.',
      'studio.density': 'الكثافة', 'studio.densitySub': 'كم عنصرًا تريد أن ترى في الشاشة.',
      'density.comfort': 'مريحة', 'density.comfortSub': 'تباعد سبوتيفاي المعتاد',
      'density.compact': 'مضغوطة', 'density.compactSub': 'عناصر أكثر في نفس المساحة',
      'studio.motion': 'الحركة', 'studio.motionSub': 'حركات الواجهة ومؤشر التشغيل',
      'motion.on': 'مفعّلة', 'motion.off': 'مقلَّلة',
      'studio.language': 'اللغة', 'studio.languageSub': 'العربية هي اللغة الأساسية، والإنجليزية مرآة كاملة.',
      'lang.ar': 'العربية', 'lang.en': 'English',
      'studio.audio': 'الصوت', 'studio.audioSub': 'معاينات حقيقية من Apple Music. الأغاني الكاملة تُشغَّل من ملفاتك المحلية.',
      'studio.engine': 'مصدر المعاينات', 'studio.engineSub': 'Apple Music — ٣٠ ثانية لكل أغنية، بجودة عالية.',
      'studio.file': 'ملف من جهازك', 'studio.fileSub': 'MP3 أو WAV أو M4A — تشغيل كامل المدة',
      'studio.reset': 'استعادة الافتراضي', 'studio.resetSub': 'حذف المظهر والقوائم المحفوظة',
      'studio.about': 'عن هذا الإصدار',
      'studio.aboutText': 'نَغَم ستوديو — واجهة استماع عربية كاملة في ملف واحد. الأغلفة والمعاينات من Apple Music؛ والملفات المحلية تُشغَّل كاملة. لا شيء يُرسل إلى أي خادم.',
      'studio.resetTitle': 'إعادة ضبط الاستوديو',
      'studio.resetText': 'سيتم استعادة المظهر والقوائم الافتراضية وحذف التعديلات المحفوظة على هذا الجهاز.',
      'studio.resetConfirm': 'استعادة الافتراضي',
      'playlist.namePlaceholder': 'اسم القائمة', 'playlist.nameLabel': 'اختر اسمًا قصيرًا يسهل تمييزه.',
      'playlist.created': 'أُنشئت القائمة',
      'queue.empty': 'قائمة الانتظار فارغة', 'queue.emptyBody': 'شغّل أغنية أو أضف شيئًا إلى الانتظار.',
      'queue.remove': 'إزالة من الانتظار',
      'toast.liked': 'أُضيفت إلى المعجب بها', 'toast.unliked': 'أُزيلت من المعجب بها',
      'toast.resetDone': 'تمت استعادة الافتراضي', 'toast.imported': 'تم تشغيل الملف',
      'toast.importError': 'تعذّر تشغيل الملف — جرّب صيغة أخرى.', 'toast.lang': 'تم التبديل إلى العربية',
      'toast.previewError': 'تعذّر تشغيل المعاينة — تأكد من اتصال الإنترنت.',
      'toast.playlistEmpty': 'القائمة فارغة',
      'artist.follow': 'متابعة', 'artist.following': 'تتابعه',
      'shortcuts.title': 'اختصارات لوحة المفاتيح',
      'shortcuts.play': 'تشغيل / إيقاف', 'shortcuts.next': 'التالي', 'shortcuts.prev': 'السابق',
      'shortcuts.seek': 'تقديم / تأخير ٥ ثوانٍ', 'shortcuts.mute': 'كتم الصوت',
      'shortcuts.shuffle': 'عشوائي', 'shortcuts.repeat': 'تكرار', 'shortcuts.search': 'التركيز على البحث',
      'shortcuts.sheet': 'المشغل الكامل', 'shortcuts.close': 'إغلاق النوافذ', 'shortcuts.help': 'هذه القائمة',
      'track.kicker': 'أغنية',
      'track.fullPage': 'صفحة الأغنية الكاملة',
      'track.streams': 'استماع',
      'track.lyrics': 'كلمات الأغنية',
      'track.moreBy': 'المزيد من {artist}',
      'track.verified': 'فنان موثق',
      'track.monthlyListeners': 'مستمع شهرياً',
      'track.aboutArtist': 'عن الفنان',
      'track.credits': 'بيانات الأغنية والإنتاج',
      'track.quality': 'معاينة صوتية رسمية · Apple Music CDN',
      'track.copyLink': 'نسخ الرابط',
      'track.copied': 'تم نسخ رابط الأغنية إلى الحافظة',
      'track.previewTag': 'معاينة رسمية · Apple Music',
      'track.previewNoteShort': 'معاينة صوتية ٣٠ ثانية · Apple Music',
      'track.localFile': 'ملف صوتي محلي',
      'track.mainArtist': 'الفنان الرئيسي',
      'track.releaseYear': 'سنة النشر',
      'track.contentType': 'نوع المحتوى',
      'track.techSource': 'المصدر التقني',
      'track.localNotice': 'ملف صوتي مخزن محليًا على هذا الجهاز.',
      'track.appleNotice': 'المعاينات الصوتية وصور الألبومات مقدمة عبر Apple Music API للاستكشاف الموسيقي.',
      'track.catalogDuration': 'مدة الأغنية في الكتالوج',
      'track.playableDuration': 'مدة المعاينة المتاحة',
      'track.fullCatalogDuration': 'المدة الكاملة في الكتالوج',
      'player.previewBadge': 'معاينة ٣٠ ثانية',
      'player.spotifyFull': 'تشغيل كامل · Spotify',
      'player.fullTrackBadge': 'تشغيل كامل',
      'player.unavailable': 'غير متاح',
      'studio.providers': 'مصادر الموسيقى ومزودات التشغيل',
      'studio.providersSub': 'مصادر الصوت، المعاينات الرسمية، وربط الحسابات للتشغيل الكامل',
      'studio.spotifyConnected': 'Spotify Premium متصل (تشغيل كامل متاح)',
      'studio.spotifyDisconnected': 'Spotify غير متصل (تعمل المعاينات الرسمية ٣٠ ثانية)',
      'studio.connectSpotify': 'ربط حساب Spotify',
      'studio.disconnectSpotify': 'فصل حساب Spotify',
      'studio.providerNotice': 'الأغاني التجارية العالمية مرخصة رسميًا؛ توفر Apple Music معاينات مجانية ٣٠ ثانية لجميع الأغاني للاستكشاف. لتشغيل الأغاني بالكامل: اربط حساب Spotify Premium الخاص بك، أو استورد ملفات MP3 محلية مجانًا.',
      'toast.spotifyConnected': 'تم ربط حساب Spotify Premium بنجاح',
      'toast.spotifyDisconnected': 'تم فصل حساب Spotify بنجاح',
      'studio.spotifyConnectFailed': 'تعذر الاتصال بـ Spotify أو تم إلغاء العملية',
      'studio.spotifyNotPremium': 'حسابك في Spotify ليس Premium. يلزم اشتراك Premium لتشغيل الأغاني الكاملة عبر المتصفح.',
      'sources.title': 'المصادر المتاحة',
      'sources.fallback': 'تم الانتقال تلقائياً إلى مصدر بديل',
      'sources.full': 'تشغيل كامل',
      'sources.embed': 'مشغل رسمي',
      'sources.preview': 'معاينة صوتية (٣٠ ثانية)',
      'sources.switch': 'تشغيل بهذا المصدر',
      'sources.none': 'لا توجد مصادر بديلة لهذه الأغنية',
      'page.playlist': 'قائمة تشغيل', 'page.artist': 'فنان', 'page.album': 'ألبوم',
      'sec.popular': 'أشهر الأغاني', 'sec.albums': 'الألبومات والإصدارات',
      'sec.arabicMusic': 'الموسيقى العربية', 'sec.intlMusic': 'الموسيقى العالمية',
      'sec.featuredAlbums': 'أحدث الألبومات', 'library.tabAlbums': 'الألبومات',
      'library.searchPh': 'ابحث في مكتبتك...', 'playlist.delete': 'حذف القائمة',
      'playlist.totalDuration': 'إجمالي التشغيل'
    },
    en: {
      'a11y.skip': 'Skip to content',
      'nav.home': 'Home', 'nav.search': 'Search', 'nav.library': 'Your Library', 'nav.studio': 'Studio',
      'nav.back': 'Back', 'nav.forward': 'Forward', 'nav.panel': 'Show now playing panel', 'nav.panelClose': 'Hide panel',
      'search.placeholder': 'Search songs or artists', 'search.label': 'Search', 'search.clear': 'Clear search',
      'top.import': 'Import', 'top.importAria': 'Play an audio file from this device',
      'top.customize': 'Customize', 'top.shortcuts': 'Keyboard shortcuts',
      'top.lang': 'Switch to Arabic', 'top.profile': 'Your account and library',
      'rail.library': 'Your Library', 'rail.new': 'New playlist',
      'rail.engine': 'Real audio previews', 'rail.engineSub': '30 seconds · Apple Music',
      'rail.audioSettings': 'Audio settings', 'rail.liked': 'Liked Songs',
      'rail.playlist': 'Playlist',
      'panel.now': 'Now', 'panel.queue': 'Queue', 'panel.about': 'About', 'panel.lyrics': 'Lyrics',
      'player.expand': 'Open full player', 'player.like': 'Save to Liked Songs',
      'player.shuffle': 'Shuffle', 'player.prev': 'Previous', 'player.play': 'Play',
      'player.pause': 'Pause', 'player.next': 'Next', 'player.repeat': 'Repeat',
      'player.mute': 'Mute', 'player.unmute': 'Unmute', 'player.about': 'About this song',
      'player.queue': 'Queue', 'player.seek': 'Playback position', 'player.volume': 'Volume',
      'player.close': 'Close player', 'player.preview': 'PREVIEW', 'player.local': 'LOCAL FILE', 'player.synth': 'Master HQ',
      'player.unavailable': 'UNAVAILABLE',
      'player.miniPlayer': 'MiniPlayer',
      'sheet.from': 'PLAYING FROM YOUR LIBRARY', 'sheet.player': 'Player', 'sheet.queue': 'Queue', 'sheet.about': 'About', 'sheet.lyrics': 'Lyrics',
      'common.close': 'Close', 'common.cancel': 'Cancel', 'common.create': 'Create', 'common.seeAll': 'See all',
      'genre.all': 'All', 'genre.arabic': 'Arabic', 'genre.electronic': 'Electronic',
      'genre.rap': 'Rap', 'genre.classic': 'Classic', 'genre.local': 'Local file',
      'greet.morning': 'Good morning', 'greet.afternoon': 'Good afternoon', 'greet.evening': 'Good evening', 'greet.night': 'Late night',
      'greet.sub': 'What do you want to hear?',
      'sec.jump': 'Jump back in', 'sec.jumpSub': 'Pick up where you left off',
      'sec.mixes': 'Made for you', 'sec.mixesSub': 'Mixes that shift with your mood',
      'sec.trending': 'Trending now', 'sec.trendingSub': 'Most played this week',
      'sec.artists': 'Artists to follow', 'sec.artistsSub': 'New voices close by',
      'hero.badge': 'New release', 'hero.play': 'Listen now', 'hero.immersive': 'Full player',
      'hero.album': 'Album',
      'about.album': 'Album', 'about.year': 'Year', 'about.genre': 'Genre',
      'about.length': 'Length', 'about.source': 'Source', 'about.sourceApple': 'Apple Music',
      'about.previewNote': 'This is a legal 30-second audio preview. For full-length playback, import a file from your device.',
      'search.title': 'Search', 'search.resultsFor': 'Results for “{q}”', 'search.count': '{n} results',
      'search.top': 'Top result', 'search.songs': 'Songs', 'search.artists': 'Artists',
      'search.emptyTitle': 'Nothing answers to that',
      'search.emptyBody': 'Try an artist name or a shorter word. Search ignores Arabic diacritics and hamza variants.',
      'search.noQueryTitle': 'Search everything',
      'search.noQueryBody': 'Type a song or artist, or start from one of these.',
      'search.quickSuggestions': 'Quick suggestions',
      'search.searchingOnline': 'Searching Apple Music global catalog...',
      'search.recent': 'Recent searches', 'search.clearRecent': 'Clear', 'search.browse': 'Browse genres',
      'search.song': 'Song', 'search.local': 'Local',
      'library.title': 'Your Library', 'library.liked': 'Liked Songs', 'library.likedSub': 'Everything you saved, in one place',
      'library.librarySub': 'Playlists, saved songs and artists in one place.',
      'library.playAll': 'Play all', 'library.newPlaylist': 'New playlist',
      'library.tabPlaylists': 'Playlists', 'library.tabLiked': 'Liked', 'library.tabArtists': 'Artists',
      'library.emptyLiked': 'No saved songs yet', 'library.emptyLikedBody': 'Tap the heart next to any song and it lands here.',
      'library.emptyPl': 'No playlists yet', 'library.emptyPlBody': 'Create your first one with the + button in the library.',
      'library.plSub': 'Playlist',
      'studio.title': 'Studio', 'studio.sub': 'Appearance, audio and preferences. Everything is stored on this device.',
      'studio.theme': 'Theme', 'studio.themeSub': 'Dark by default, paper for daylight.',
      'studio.accent': 'Accent', 'studio.accentSub': 'Used for primary actions and playback state only.',
      'studio.density': 'Density', 'studio.densitySub': 'How much you want on screen at once.',
      'density.comfort': 'Comfortable', 'density.comfortSub': 'Familiar spacing',
      'density.compact': 'Compact', 'density.compactSub': 'More rows in the same space',
      'studio.motion': 'Motion', 'studio.motionSub': 'Interface transitions and the playing indicator',
      'motion.on': 'Full', 'motion.off': 'Reduced',
      'studio.language': 'Language', 'studio.languageSub': 'Arabic is the primary voice; English is a full mirror.',
      'lang.ar': 'العربية', 'lang.en': 'English',
      'studio.audio': 'Audio', 'studio.audioSub': 'Real previews from Apple Music. Full-length tracks play from your local files.',
      'studio.engine': 'Preview source', 'studio.engineSub': 'Apple Music — 30 seconds per track, high quality.',
      'studio.file': 'Play a local file', 'studio.fileSub': 'MP3, WAV or M4A — full length playback',
      'studio.reset': 'Reset to defaults', 'studio.resetSub': 'Clear appearance and saved playlists',
      'studio.about': 'About this build',
      'studio.aboutText': 'NAGHAM Studio — a complete Arabic-first listening interface in one file. Covers and previews come from Apple Music; local files play in full. Nothing is sent to any server.',
      'studio.resetTitle': 'Reset the studio',
      'studio.resetText': 'Appearance, playlists and preferences on this device will be restored to defaults.',
      'studio.resetConfirm': 'Reset everything',
      'playlist.namePlaceholder': 'Playlist name', 'playlist.nameLabel': 'Pick a short, recognizable name.',
      'playlist.created': 'Playlist created',
      'queue.empty': 'The queue is empty', 'queue.emptyBody': 'Play a song or add something to the queue.',
      'queue.remove': 'Remove from queue',
      'toast.liked': 'Added to Liked Songs', 'toast.unliked': 'Removed from Liked Songs',
      'toast.resetDone': 'Defaults restored', 'toast.imported': 'Now playing your file',
      'toast.importError': 'Could not play that file. Try another format.', 'toast.lang': 'Switched to English',
      'toast.previewError': 'Could not load the preview. Check your connection.',
      'toast.playlistEmpty': 'That playlist is empty',
      'artist.follow': 'Follow', 'artist.following': 'Following',
      'shortcuts.title': 'Keyboard shortcuts',
      'shortcuts.play': 'Play / pause', 'shortcuts.next': 'Next track', 'shortcuts.prev': 'Previous track',
      'shortcuts.seek': 'Seek ±5 seconds', 'shortcuts.mute': 'Mute',
      'shortcuts.shuffle': 'Shuffle', 'shortcuts.repeat': 'Repeat', 'shortcuts.search': 'Focus search',
      'shortcuts.sheet': 'Full player', 'shortcuts.close': 'Close dialogs', 'shortcuts.help': 'This list',
      'track.kicker': 'Song',
      'track.fullPage': 'Full Track Page',
      'track.streams': 'plays',
      'track.lyrics': 'Lyrics',
      'track.moreBy': 'More by {artist}',
      'track.verified': 'Verified Artist',
      'track.monthlyListeners': 'monthly listeners',
      'track.aboutArtist': 'About the Artist',
      'track.credits': 'Track Credits & Audio Specs',
      'track.quality': 'Official Audio Preview · Apple Music CDN',
      'track.copyLink': 'Copy Link',
      'track.copied': 'Track link copied to clipboard',
      'track.previewTag': 'Official Preview · Apple Music',
      'track.previewNoteShort': '30s Audio Preview · Apple Music',
      'track.localFile': 'Local Audio File',
      'track.mainArtist': 'Main Artist',
      'track.releaseYear': 'Release Year',
      'track.contentType': 'Content Type',
      'track.techSource': 'Technical Source',
      'track.localNotice': 'Local audio file stored on this device.',
      'track.appleNotice': 'Audio previews and artwork provided via Apple Music API for discovery.',
      'track.catalogDuration': 'Full Catalog Duration',
      'track.playableDuration': 'Playable Preview Duration',
      'track.fullCatalogDuration': 'Full Catalog Duration',
      'player.previewBadge': '30s Preview',
      'player.spotifyFull': 'Full Track · Spotify',
      'player.fullTrackBadge': 'Full Track',
      'player.unavailable': 'Unavailable',
      'studio.providers': 'Music Sources & Playback Providers',
      'studio.providersSub': 'Audio sources, official previews, and full playback connections',
      'studio.spotifyConnected': 'Spotify Premium Connected (Full Track Available)',
      'studio.spotifyDisconnected': 'Spotify Disconnected (30s Official Preview Mode)',
      'studio.connectSpotify': 'Connect Spotify Account',
      'studio.disconnectSpotify': 'Disconnect Spotify',
      'studio.providerNotice': 'Commercial music is strictly copyrighted; Apple Music provides free 30-second previews for discovery. For full-length playback: connect your Spotify Premium account or import local MP3 files for free.',
      'toast.spotifyConnected': 'Connected to Spotify Premium successfully',
      'toast.spotifyDisconnected': 'Disconnected from Spotify successfully',
      'studio.spotifyConnectFailed': 'Failed to connect to Spotify or operation was cancelled',
      'studio.spotifyNotPremium': 'Your Spotify account is not Premium. A Premium subscription is required for full browser streaming.',
      'sources.title': 'Available Sources',
      'sources.fallback': 'Automatically switched to alternative source',
      'sources.full': 'Full Playback',
      'sources.embed': 'Official Embed',
      'sources.preview': 'Audio Preview (30s)',
      'sources.switch': 'Play with this source',
      'sources.none': 'No alternative sources available for this track',
      'page.playlist': 'Playlist', 'page.artist': 'Artist', 'page.album': 'Album',
      'sec.popular': 'Popular Tracks', 'sec.albums': 'Albums & Releases',
      'sec.arabicMusic': 'Arabic Music', 'sec.intlMusic': 'International Music',
      'sec.featuredAlbums': 'Featured Albums', 'library.tabAlbums': 'Albums',
      'library.searchPh': 'Search in your library...', 'playlist.delete': 'Delete playlist',
      'playlist.totalDuration': 'Total duration'
    }
  };

  /* ---------- catalog ------------------------------------------------------ */

  const PHOTO = {
    stage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80&auto=format&fit=crop',
    crowd: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80&auto=format&fit=crop',
    guitar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80&auto=format&fit=crop',
    studio: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&q=80&auto=format&fit=crop',
    night: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=600&q=80&auto=format&fit=crop',
    portrait: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=600&q=80&auto=format&fit=crop',
    concert: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&q=80&auto=format&fit=crop',
    mic: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=600&q=80&auto=format&fit=crop',
    vinyl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&q=80&auto=format&fit=crop',
    festival: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80&auto=format&fit=crop',
    keys: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&q=80&auto=format&fit=crop'
  };

  const GENRES = [
    { id: 'all', key: 'genre.all' },
    { id: 'arabic', key: 'genre.arabic' },
    { id: 'rap', key: 'genre.rap' },
    { id: 'classic', key: 'genre.classic' },
    { id: 'electronic', key: 'genre.electronic' }
  ];

  const THEMES = [
    { id: 'ink', ar: 'حِبر', en: 'Ink', swatch: ['#07080A', '#0E1013', '#1ED760'] },
    { id: 'oled', ar: 'أسود تام', en: 'OLED', swatch: ['#000000', '#101214', '#1ED760'] },
    { id: 'plum', ar: 'أرجوان', en: 'Plum', swatch: ['#0A0610', '#191122', '#A78BFA'] },
    { id: 'ocean', ar: 'محيط', en: 'Ocean', swatch: ['#03080E', '#0D1A27', '#60A5FA'] },
    { id: 'dusk', ar: 'غروب', en: 'Dusk', swatch: ['#0B0806', '#1D1713', '#FBBF24'] },
    { id: 'paper', ar: 'ورقي', en: 'Paper', swatch: ['#E9EAEC', '#FFFFFF', '#0B8A4B'] }
  ];

  const ACCENTS = ['#1ED760', '#A78BFA', '#60A5FA', '#F472B6', '#FBBF24', '#FB7185', '#2DD4BF'];

  const TRACKS = [
    {
      id: 't1', genre: 'arabic', year: 2000, duration: 260, ytId: 'EgmXTmj62ic',
      title: { ar: 'تملي معاك', en: 'Tamally Maak' },
      artist: { ar: 'عمرو دياب', en: 'Amr Diab' },
      album: { ar: 'تملي معاك', en: 'Tamally Maak' },
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Music69/v4/31/4d/d4/314dd42d-3246-e7a3-107a-3d521fa9a7e2/dj.iiicnpub.jpg/600x600bb.jpg',
      preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/5e/df/09/5edf0981-ce52-4740-f0b2-f6ad0760afcb/mzaf_17144740537777531434.plus.aac.p.m4a',
      photo: PHOTO.stage, colors: ['#1B0B10', '#6B2430', '#E8A0A8'], motif: 'orb',
      lyrics: [
        { t: 0, ar: 'تملي معاك، ولو حتى بعيد عني', en: 'Always with you, even if you are far from me' },
        { t: 15, ar: 'في قلبي هواك، بتمناك ومستنيك', en: 'In my heart is your love, I wish for you and wait for you' },
        { t: 30, ar: 'تملي معاك، معاك قلبي، معاك روحي', en: 'Always with you, my heart is with you, my soul is with you' },
        { t: 45, ar: 'يا أغلى حبيب، ومهما تكون بعيد عني', en: 'Oh dearest lover, no matter how far you are' },
        { t: 60, ar: 'لقلبي قريب، يا أحلى ملاك', en: 'You are close to my heart, sweetest angel' },
        { t: 90, ar: 'تملي حبيبي بشتاقلك، تملي عينيا ندهالك', en: 'Always darling I miss you, always my eyes call you' },
        { t: 120, ar: 'ولو حوليا كل الكون، بكون يا حبيبي محتاجلك', en: 'Even if the whole universe is around me, I still need you' }
      ]
    },
    {
      id: 't2', genre: 'arabic', year: 1996, duration: 407, ytId: 'KLJA-srM_yM',
      title: { ar: 'نور العين', en: 'Noor Al Ain' },
      artist: { ar: 'عمرو دياب', en: 'Amr Diab' },
      album: { ar: 'نور العين', en: 'Noor Al Ain' },
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/ee/b0/df/eeb0df18-b02d-b836-e153-7f4aa9811f62/dj.oftobggl.jpg/600x600bb.jpg',
      preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ae/19/51/ae1951e7-fb94-f734-d68f-8a5955c8c6d9/mzaf_14930287996363580653.plus.aac.p.m4a',
      photo: PHOTO.crowd, colors: ['#1A0C06', '#7A3B12', '#F0A64B'], motif: 'arcs',
      lyrics: [
        { t: 0, ar: 'حبيبي يا نور العين، يا ساكن خيالي', en: 'Habibi, light of my eyes, you dwell in my dreams' },
        { t: 16, ar: 'عاشق بقالي سنين، ولا غيرك في بالي', en: 'I have been in love for years, no one else is in my mind' },
        { t: 32, ar: 'حبيبي، حبيبي، يا ساكن خيالي', en: 'Habibi, habibi, you live in my thoughts' },
        { t: 48, ar: 'أجمل عيون في الكون أنا شفتها، الله عليك الله على سحرها', en: 'The most beautiful eyes in the world I have seen, God bless their magic' },
        { t: 64, ar: 'عيونك معايا، عيونك كفاية، تنور ليالي', en: 'Your eyes with me are enough to light up my nights' },
        { t: 80, ar: 'قلبي خلاص ارتاح، وياك لقيت الشوق', en: 'My heart is finally at ease, with you I found longing' }
      ]
    },
    {
      id: 't3', genre: 'arabic', year: 2007, duration: 227, ytId: 'qCODlf9TFmY',
      title: { ar: 'ما شربتش من نيلها', en: 'Masherbtesh Men Nelha' },
      artist: { ar: 'شيرين', en: 'Sherine' },
      album: { ar: 'ما شربتش من نيلها', en: 'Masherbtesh Men Nelha' },
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Music71/v4/44/13/b6/4413b679-9517-4a2e-8dd0-d05332f14ef8/634493.jpg/600x600bb.jpg',
      preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a7/80/2b/a7802b8d-a5eb-755a-ffa6-cebba6aa7113/mzaf_1948264393112996426.plus.aac.p.m4a',
      photo: PHOTO.guitar, colors: ['#160610', '#5A1538', '#F08BB8'], motif: 'dots',
      lyrics: [
        { t: 0, ar: 'ما شربتش من نيلها؟ جربت تغنيلها؟', en: 'Haven\'t you drunk from its Nile? Have you tried singing to it?' },
        { t: 18, ar: 'جربت في ليل وسكون تقعد في ركابها؟', en: 'Have you tried sitting quietly in its night?' },
        { t: 38, ar: 'دي بلاد الخير والطيبين، دايماً فاتحة أبوابها', en: 'This is the land of goodness and kind souls, always opening its doors' }
      ]
    },
    {
      id: 't4', genre: 'arabic', year: 2022, duration: 270, ytId: 'Y87ZPLf-0KQ',
      title: { ar: 'روما', en: 'Roma' },
      artist: { ar: 'كايروكي', en: 'Cairokee' },
      album: { ar: 'روما', en: 'Roma' },
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/600x600bb.jpg',
      preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/af/07/8e/af078e6b-d37b-9afb-10b5-ddc7e87e0e9f/mzaf_16684328295975108671.plus.aac.p.m4a',
      photo: PHOTO.concert, colors: ['#0C0B06', '#3B3A1A', '#D9D48A'], motif: 'rings',
      lyrics: [
        { t: 0, ar: 'كل الطرق تؤدي إلى روما، وإحنا سلكنا طريق تاني', en: 'All roads lead to Rome, but we took another way' },
        { t: 16, ar: 'في كل خطوة حلم ضايع، وصوت بينده من مكاني', en: 'With every step a lost dream, and a voice calling from my place' },
        { t: 34, ar: 'مهما الزمان يعاند فينا، ثابتين على نفس الأماني', en: 'No matter how time fights us, standing firm on the same hopes' },
        { t: 52, ar: 'روما بعيدة والرحلة طويلة، بس النهاية هتستناني', en: 'Rome is far and the journey is long, but the ending will wait for me' }
      ]
    },
    {
      id: 't5', genre: 'rap', year: 2022, duration: 207, ytId: '_RHIECWv728',
      title: { ar: 'البخت', en: 'El Bakht' },
      artist: { ar: 'ويجز', en: 'Wegz' },
      album: { ar: 'البخت', en: 'El Bakht' },
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e2/07/3b/e2073b69-e9a9-0377-2a37-8eabccbc8ef5/6221216329950.jpg/600x600bb.jpg',
      preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e2/b0/1d/e2b01d30-7b5f-d520-4f3e-e1e250899b12/mzaf_2863315495467483634.plus.aac.p.m4a',
      photo: PHOTO.mic, colors: ['#1A0508', '#5C0E17', '#F26B6B'], motif: 'orb',
      lyrics: [
        { t: 0, ar: 'عيني منها بشكل جدي، وتقيلة مش خفيفة', en: 'I really have my eye on her, and she is playing hard to get' },
        { t: 12, ar: 'حاولت أتقرب منها، والفرصة مش لطيفة', en: 'I tried getting closer, but the timing was not right' },
        { t: 26, ar: 'سحرتني ولا سحرتلي؟ وعيوني مش شايفة غيرها', en: 'Did she enchant me or cast a spell? My eyes see no one else' },
        { t: 42, ar: 'سألتها ترضي بالبخت؟ قالتلي مش وقته', en: 'I asked if she accepts fate, she said not right now' }
      ]
    },
    {
      id: 't6', genre: 'rap', year: 2021, duration: 186, ytId: 'MbTM6xnl5Qc',
      title: { ar: 'كنترول', en: 'CTRL' },
      artist: { ar: 'مروان بابلو', en: 'Marwan Pablo' },
      album: { ar: 'كنترول', en: 'CTRL' },
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/25/99/06/25990612-bcc8-f286-57ea-c7cdb0aabe75/198588228821.jpg/600x600bb.jpg',
      preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/7f/7f/11/7f7f11bf-b041-b65c-42fc-ab9d815b3d81/mzaf_4774286064207966473.plus.aac.p.m4a',
      photo: PHOTO.studio, colors: ['#050B10', '#0F3446', '#58C7E8'], motif: 'dots',
      lyrics: [
        { t: 0, ar: 'كله تحت السيطرة، عيني على كل اللي فات', en: 'Everything under control, eye on everything that passed' },
        { t: 15, ar: 'ماشي في طريقي وما بهداش، ثابت على كل الخطوات', en: 'Walking my path without slowing down, steady on every step' },
        { t: 32, ar: 'كنترول في إيدي ومش هسيب، كاتب تاريخي بالكلمات', en: 'Control in my hands and I wont let go, writing my history with words' },
        { t: 48, ar: 'صوتي في الشارع وفي كل مكان، مفيش تراجع في الحسابات', en: 'My voice in the street and everywhere, no looking back' }
      ]
    },
    {
      id: 't7', genre: 'classic', year: 1964, duration: 1321, ytId: '6YjW05dqec8',
      title: { ar: 'أنت عمري', en: 'Anta Oumri' },
      artist: { ar: 'أم كلثوم', en: 'Umm Kulthum' },
      album: { ar: 'أنت عمري', en: 'Anta Oumri' },
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/38/61/f6/3861f6c5-a877-3f8c-46ae-425ebb18f750/5055373545134.png/600x600bb.jpg',
      preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/e0/6f/1a/e06f1a78-b283-5190-eba5-9caa30136019/mzaf_9876832350041264636.plus.aac.p.m4a',
      photo: PHOTO.night, colors: ['#120E02', '#463409', '#E8C86B'], motif: 'rings',
      lyrics: [
        { t: 0, ar: 'رجعوني عينيك لأيامي اللي راحوا', en: 'Your eyes took me back to the days that were gone' },
        { t: 20, ar: 'علموني أندم على الماضي وجراحه', en: 'They taught me to regret the past and its wounds' },
        { t: 45, ar: 'اللي شفته قبل ما تشوفك عنيا، عمر ضايع يحسبوه إزاي عليا', en: 'What I saw before my eyes saw you was wasted life' },
        { t: 75, ar: 'أنت عمري اللي ابتدا بنورك صباحه', en: 'You are my life whose morning began with your light' }
      ]
    },
    {
      id: 't8', genre: 'classic', year: 1973, duration: 297, ytId: 'PY1Ue0ykOrA',
      title: { ar: 'نسم علينا الهوا', en: 'Nassam Alayna El Hawa' },
      artist: { ar: 'فيروز', en: 'Fairouz' },
      album: { ar: 'نسم علينا الهوا', en: 'Nassam Alayna El Hawa' },
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/6c/b0/5b/6cb05b57-0b74-ffca-fee2-2c5696d323ad/cover.jpg/600x600bb.jpg',
      preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/3f/2e/f8/3f2ef802-d10a-7d2a-15a6-bd91c6fb3649/mzaf_16513161257104839560.plus.aac.p.m4a',
      photo: PHOTO.vinyl, colors: ['#0A1110', '#1C3A36', '#9AD7C8'], motif: 'arcs',
      lyrics: [
        { t: 0, ar: 'نسم علينا الهوا من مفرق الوادي', en: 'The breeze blew on us from the fork of the valley' },
        { t: 18, ar: 'يا هوا دخل الهوا خدني على بلادي', en: 'Oh breeze, please breeze take me back to my homeland' },
        { t: 36, ar: 'يا بلادي يا بلادي، شو بحبك يا بلادي', en: 'Oh my homeland, how much I love you my homeland' },
        { t: 55, ar: 'زورني بسنة مرة، فزعانة لا تروح وتنساني', en: 'Visit me once a year, I am scared you will leave and forget me' }
      ]
    },
    {
      id: 't9', genre: 'arabic', year: 2004, duration: 295, ytId: 'Zgz8ybG6l-U',
      title: { ar: 'آه ونص', en: 'Ah W Noss' },
      artist: { ar: 'نانسي عجرم', en: 'Nancy Ajram' },
      album: { ar: 'آه ونص', en: 'Ah W Noss' },
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/3e/b3/18/3eb318aa-42d3-ecb1-93e2-8353d9c80747/00724357665056.jpg/600x600bb.jpg',
      preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/3a/81/1e/3a811ea5-5fd4-f215-073f-a32d08a6d3bb/mzaf_6839834683079102557.plus.aac.p.m4a',
      photo: PHOTO.portrait, colors: ['#12071C', '#4B1E6B', '#E86FA8'], motif: 'dots',
      lyrics: [
        { t: 0, ar: 'إيه ده بقى، مش كفاية دلع؟', en: 'What is this now, isnt that enough teasing?' },
        { t: 14, ar: 'ما تبصليش كده، لا هتبعد كده', en: 'Do not look at me like that, you better step back' },
        { t: 28, ar: 'آه ونص، حبيب قلبي وعينيّ الاتنين', en: 'Oh yes and a half, lover of my heart and both my eyes' },
        { t: 45, ar: 'ما اقدرش أستغنى عنك ثانية ولا أبعد يومين', en: 'I cannot let go of you for a second nor be away two days' }
      ]
    },
    {
      id: 't10', genre: 'electronic', year: 2019, duration: 263, ytId: '4NRXx6U8ABQ',
      title: { ar: 'Blinding Lights', en: 'Blinding Lights' },
      artist: { ar: 'ذا ويكند', en: 'The Weeknd' },
      album: { ar: 'After Hours', en: 'After Hours' },
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/bc/e6/6fbce6c4-c38c-72d8-4fd0-66cfff32f679/20UMGIM12176.rgb.jpg/600x600bb.jpg',
      preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/19/d6/60/19d660ff-e3a9-8377-15a3-ce4b28e89cac/mzaf_18422426156481158187.plus.aac.p.m4a',
      photo: PHOTO.festival, colors: ['#14030A', '#6B0F2A', '#FF7A93'], motif: 'orb',
      lyrics: [
        { t: 0, ar: 'لقد حاولت الاتصال طويلاً', en: 'I have been tryna call, I have been on my own for long enough' },
        { t: 14, ar: 'ربما يمكنك تعليمي كيف أحب', en: 'Maybe you can show me how to love, maybe' },
        { t: 28, ar: 'أنا أتعرض للانسحاب بدون لمستك', en: 'I am going through withdrawals, you do not even have to do too much' },
        { t: 44, ar: 'أنا أعمى بسبب الأضواء الساطعة', en: 'I said, ooh, I am blinded by the lights' },
        { t: 60, ar: 'لا أستطيع النوم حتى أشعر بلمستك', en: 'No, I cannot sleep until I feel your touch' }
      ]
    },
    {
      id: 't11', genre: 'electronic', year: 2013, duration: 249, ytId: '5NV6Rdv1a3I',
      title: { ar: 'Get Lucky', en: 'Get Lucky' },
      artist: { ar: 'دافت بانك', en: 'Daft Punk' },
      album: { ar: 'Random Access Memories', en: 'Random Access Memories' },
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg',
      preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/57/a5/85/57a585aa-f1bc-7619-881b-f8a04a5541d5/mzaf_6906185026678279401.plus.aac.p.m4a',
      photo: PHOTO.keys, colors: ['#0B0A14', '#2E2B4F', '#9B8BFF'], motif: 'rings',
      lyrics: [
        { t: 0, ar: 'مثل أسطورة العنقاء، كل البدايات تنتهي بالنهايات', en: 'Like the legend of the phoenix, all ends with beginnings' },
        { t: 15, ar: 'ما يحافظ على استمرار الكوكب هو قوة البداية', en: 'What keeps the planet spinning, the force from the beginning' },
        { t: 30, ar: 'لقد قطعنا شوطاً طويلاً لنستسلم الآن', en: 'We have come too far to give up who we are' },
        { t: 45, ar: 'فارفعوا الكؤوس نحو النجوم، نحن مستيقظون طوال الليل لطلب الحظ', en: 'So let us raise the bar and our cups to the stars, we are up all night to get lucky' }
      ]
    },
    {
      id: 't12', genre: 'classic', year: 1990, duration: 450, ytId: 'uhQ0tz35Tjg',
      title: { ar: 'إسمعيني بكلمة', en: 'Ismaani Bi Kelma' },
      artist: { ar: 'جورج وسوف', en: 'George Wassouf' },
      album: { ar: 'إنت وأنا والحب سوا', en: 'Inta Wana' },
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/19/f5/32/19f532c3-26b6-66da-c250-46366d8ef54b/05099951528355.jpg/600x600bb.jpg',
      preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a9/e3/f7/a9e3f783-67bc-4a80-5f4f-8d3f52e7c0ef/mzaf_8867328973786331162.plus.aac.p.m4a',
      photo: PHOTO.concert, colors: ['#1C0E07', '#5E2B11', '#E89656'], motif: 'arcs',
      lyrics: [
        { t: 0, ar: 'لو عارفة إيه معنى الهوى، إن الحب لوحده دوا', en: 'If you knew the meaning of passion, love alone is the cure' },
        { t: 22, ar: 'إنت وأنا والحب سوا، وقلوبنا يعيش فيها الهوى', en: 'You and me and love together, and passion lives in our hearts' },
        { t: 45, ar: 'ده إنت معزتي، وحبي وجنتي', en: 'You are my dearest, my love, and my paradise' },
        { t: 68, ar: 'لقاكي فرحتي، حياتي ودنيتي', en: 'Meeting you is my joy, my life, and my world' },
        { t: 90, ar: 'وانسي يوم الحيرة، ولا نار الغيرة', en: 'Forget the days of confusion, and the fire of jealousy' },
        { t: 115, ar: 'حبك أحلى سيرة قالتها غنوتي', en: 'Your love is the sweetest story told by my song' }
      ]
    }
  ];

  const ARTISTS = [
    { id: 'a1', name: { ar: 'عمرو دياب', en: 'Amr Diab' }, sub: { ar: 'نجم البوب', en: 'Pop icon' }, track: 't1' },
    { id: 'a2', name: { ar: 'شيرين', en: 'Sherine' }, sub: { ar: 'صوت مصري', en: 'Egyptian voice' }, track: 't3' },
    { id: 'a3', name: { ar: 'كايروكي', en: 'Cairokee' }, sub: { ar: 'روك بديل', en: 'Indie rock' }, track: 't4' },
    { id: 'a4', name: { ar: 'ويجز', en: 'Wegz' }, sub: { ar: 'راب', en: 'Rap' }, track: 't5' },
    { id: 'a5', name: { ar: 'مروان بابلو', en: 'Marwan Pablo' }, sub: { ar: 'تراب', en: 'Trap' }, track: 't6' },
    { id: 'a6', name: { ar: 'أم كلثوم', en: 'Umm Kulthum' }, sub: { ar: 'كوكب الشرق', en: 'Star of the East' }, track: 't7' },
    { id: 'a7', name: { ar: 'فيروز', en: 'Fairouz' }, sub: { ar: 'جارة القمر', en: 'Voice of Lebanon' }, track: 't8' },
    { id: 'a8', name: { ar: 'ذا ويكند', en: 'The Weeknd' }, sub: { ar: 'بوب عالمي', en: 'Global pop' }, track: 't10' },
    { id: 'a9', name: { ar: 'جورج وسوف', en: 'George Wassouf' }, sub: { ar: 'سلطان الطرب', en: 'Sultan of Tarab' }, track: 't12' }
  ];

  const SEED_PLAYLISTS = [
    {
      id: 'p1', name: { ar: 'سهرة القاهرة', en: 'Cairo After Hours' }, sub: { ar: 'مزيج عربي ليلي', en: 'Late Arabic mix' },
      colors: ['#1B0B10', '#6B2430', '#E8A0A8'], motif: 'orb', trackIds: ['t1', 't2', 't9', 't4']
    },
    {
      id: 'p2', name: { ar: 'زمن الكلاسيكيات', en: 'Golden Era' }, sub: { ar: 'أصوات لا تُنسى', en: 'Voices that endure' },
      colors: ['#120E02', '#463409', '#E8C86B'], motif: 'rings', trackIds: ['t7', 't8']
    },
    {
      id: 'p3', name: { ar: 'راب مصري', en: 'Egyptian Rap' }, sub: { ar: 'أقوى التراكيب', en: 'Hardest bars' },
      colors: ['#1A0508', '#5C0E17', '#F26B6B'], motif: 'orb', trackIds: ['t5', 't6', 't4']
    },
    {
      id: 'p4', name: { ar: 'إلكتروني عالمي', en: 'Global Electronic' }, sub: { ar: 'إيقاعات ليلية', en: 'Night drive' },
      colors: ['#0B0A14', '#2E2B4F', '#9B8BFF'], motif: 'rings', trackIds: ['t10', 't11']
    },
    {
      id: 'p5', name: { ar: 'أحلى ما غنّى عمرو', en: 'Best of Amr Diab' }, sub: { ar: 'من الزمن الجميل', en: 'Timeless hits' },
      colors: ['#1A0C06', '#7A3B12', '#F0A64B'], motif: 'arcs', trackIds: ['t1', 't2']
    }
  ];

  const STORAGE_KEY = 'nagham.studio.v2';

  const DEFAULT_STATE = {
    lang: 'ar',
    theme: 'ink',
    accent: '#1ED760',
    density: 'comfortable',
    motion: true,
    volume: 70,
    muted: false,
    repeat: 'off',
    shuffle: false,
    favorites: [],
    playlists: [],
    trackId: 't1',
    queue: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'],
    recent: []
  };

  const clone = (v) => JSON.parse(JSON.stringify(v));

  function safeList(list, fallback) {
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : fallback.slice();
  }

  function cleanSavedIds(list) {
    return (list || []).filter((id) => typeof id === 'string' && !id.startsWith('local-') && !id.startsWith('file-'));
  }

  function loadState() {
    const base = clone(DEFAULT_STATE);
    base.playlists = clone(SEED_PLAYLISTS);
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (!raw) return base;
    let saved;
    try { saved = JSON.parse(raw); } catch (e) { return base; }
    if (!saved || typeof saved !== 'object') return base;
    const okLang = saved.lang === 'en' || saved.lang === 'ar';
    const okTheme = THEMES.some((th) => th.id === saved.theme);
    const okDensity = saved.density === 'compact' || saved.density === 'comfortable';
    const okAccent = typeof saved.accent === 'string' && /^#[0-9a-f]{6}$/i.test(saved.accent);
    const okRepeat = ['off', 'all', 'one'].includes(saved.repeat);
    const merged = Object.assign(base, {
      lang: okLang ? saved.lang : base.lang,
      theme: okTheme ? saved.theme : base.theme,
      accent: okAccent ? saved.accent : base.accent,
      density: okDensity ? saved.density : base.density,
      motion: typeof saved.motion === 'boolean' ? saved.motion : base.motion,
      volume: Number.isFinite(saved.volume) ? clamp(saved.volume, 0, 100) : base.volume,
      muted: typeof saved.muted === 'boolean' ? saved.muted : base.muted,
      repeat: okRepeat ? saved.repeat : base.repeat,
      shuffle: typeof saved.shuffle === 'boolean' ? saved.shuffle : base.shuffle,
      favorites: cleanSavedIds(safeList(saved.favorites, base.favorites)),
      trackId: typeof saved.trackId === 'string' && !saved.trackId.startsWith('local-') ? saved.trackId : base.trackId,
      queue: cleanSavedIds(safeList(saved.queue, base.queue)),
      recent: cleanSavedIds(safeList(saved.recent, base.recent))
    });
    if (Array.isArray(saved.playlists)) {
      merged.playlists = saved.playlists.filter((p) => p && typeof p.id === 'string' && p.name && Array.isArray(p.trackIds))
        .map((p) => ({
          id: p.id,
          name: { ar: String(p.name.ar || p.name.en || ''), en: String(p.name.en || p.name.ar || '') },
          sub: { ar: String((p.sub && p.sub.ar) || ''), en: String((p.sub && p.sub.en) || '') },
          colors: Array.isArray(p.colors) && p.colors.length === 3 ? p.colors : ['#1B0B10', '#6B2430', '#E8A0A8'],
          motif: ['rings', 'orb', 'dots', 'arcs'].includes(p.motif) ? p.motif : 'rings',
          trackIds: cleanSavedIds(p.trackIds)
        }));
    }
    if (Array.isArray(saved.savedTracks)) {
      for (const st of saved.savedTracks) {
        if (st && typeof st.id === 'string' && !st.id.startsWith('local-') && !st.id.startsWith('file-')) {
          const idx = TRACKS.findIndex((t) => t.id === st.id);
          if (idx === -1) {
            TRACKS.push(st);
          } else {
            TRACKS[idx] = Object.assign(TRACKS[idx], st);
          }
        }
      }
    }
    return merged;
  }

  const state = loadState();

  function save() {
    try {
      const referencedIds = new Set([
        ...state.favorites,
        ...state.queue,
        ...state.recent,
        ...(state.trackId ? [state.trackId] : []),
        ...state.playlists.flatMap((p) => p.trackIds || [])
      ]);
      const savedTracks = TRACKS.filter((tr) =>
        tr &&
        (referencedIds.has(tr.id) || (Array.isArray(tr.lyrics) && tr.lyrics.length > 0) || (typeof tr.plainLyrics === 'string' && tr.plainLyrics.trim().length > 0)) &&
        !tr.id.startsWith('local-') &&
        !tr.id.startsWith('file-') &&
        tr.source !== 'file' &&
        !/^t\d+$/.test(tr.id)
      ).map((tr) => ({
        id: tr.id,
        appleId: tr.appleId,
        genre: tr.genre,
        year: tr.year,
        duration: tr.duration,
        fullDuration: tr.fullDuration,
        catalogDuration: tr.fullDuration || tr.duration,
        previewDuration: tr.previewDuration,
        playbackType: tr.playbackType,
        playbackProvider: tr.playbackProvider,
        isAudioPreview: tr.isAudioPreview,
        isFullTrack: tr.isFullTrack,
        isPreview: tr.isPreview,
        requiresAuthentication: tr.requiresAuthentication,
        availability: tr.availability,
        spotifyUri: tr.spotifyUri,
        title: tr.title,
        artist: tr.artist,
        album: tr.album,
        art: tr.art,
        preview: tr.preview,
        colors: tr.colors,
        motif: tr.motif,
        source: tr.source || 'online',
        lyrics: tr.lyrics || null,
        plainLyrics: tr.plainLyrics || null,
        _lyricsSynced: tr._lyricsSynced
      }));

      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        lang: state.lang, theme: state.theme, accent: state.accent, density: state.density,
        motion: state.motion, volume: state.volume, muted: state.muted, repeat: state.repeat,
        shuffle: state.shuffle, favorites: state.favorites, playlists: state.playlists,
        trackId: state.trackId, queue: state.queue, recent: state.recent,
        savedTracks
      }));
    } catch (e) { /* storage may be unavailable; the session still works */ }
  }

  function reset() {
    if (engine && typeof engine.revokeLocalUrls === 'function') {
      try { engine.revokeLocalUrls(); } catch (e) {}
    }
    const fresh = clone(DEFAULT_STATE);
    fresh.playlists = clone(SEED_PLAYLISTS);
    Object.keys(fresh).forEach((k) => { state[k] = fresh[k]; });
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  /* ---------- theme / contrast -------------------------------------------- */

  const hexRgb = (hex) => {
    const h = String(hex || '').replace('#', '');
    if (h.length !== 6) return [30, 215, 96];
    return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
  };
  const toHex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

  const luminance = (hex) => {
    const [r, g, b] = hexRgb(hex).map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  function readableOn(hex) {
    const l = luminance(hex);
    return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#07110A' : '#FFFFFF';
  }

  function darkenForLight(hex) {
    let [r, g, b] = hexRgb(hex);
    for (let i = 0; i < 10; i++) {
      if (1.05 / (luminance(toHex(r, g, b)) + 0.05) >= 4.6) break;
      r *= 0.86; g *= 0.86; b *= 0.86;
    }
    return toHex(r, g, b);
  }

  function applyTheme() {
    const root = document.documentElement;
    root.setAttribute('lang', state.lang);
    root.setAttribute('dir', state.lang === 'ar' ? 'rtl' : 'ltr');
    root.setAttribute('data-theme', state.theme);
    root.setAttribute('data-density', state.density);
    root.setAttribute('data-motion', state.motion ? 'on' : 'off');
    root.style.setProperty('--accent', state.accent);
    root.style.setProperty('--accent-contrast', readableOn(state.accent));
    root.style.setProperty('--accent-text', state.theme === 'paper' ? darkenForLight(state.accent) : state.accent);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const canvas = getComputedStyle(root).getPropertyValue('--canvas').trim();
      if (canvas) meta.setAttribute('content', canvas);
    }
  }

  function t(key, vars) {
    const dict = I18N[state.lang] || I18N.ar;
    let out = dict[key] || I18N.ar[key] || key;
    if (vars) Object.keys(vars).forEach((k) => { out = out.split('{' + k + '}').join(String(vars[k])); });
    return out;
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    const langBtn = document.getElementById('langBtn');
    if (langBtn) {
      langBtn.textContent = state.lang === 'ar' ? 'EN' : 'ع';
      langBtn.setAttribute('aria-label', t('top.lang'));
    }
    const brand = document.getElementById('brandLabel');
    if (brand) brand.textContent = state.lang === 'ar' ? 'نَغَم' : 'NAGHAM';
    const avatar = document.getElementById('avatarBtn');
    if (avatar) avatar.textContent = state.lang === 'ar' ? 'ن' : 'N';
    document.title = state.lang === 'ar' ? 'نَغَم ستوديو — NAGHAM Studio' : 'NAGHAM Studio — نَغَم ستوديو';
  }

  const byLang = (obj) => (obj && (obj[state.lang] || obj.ar)) || '';
  const genreLabel = (id) => {
    if (id === 'local') return t('genre.local');
    const g = GENRES.find((x) => x.id === id);
    return g ? t(g.key) : id;
  };

  /* ---------- tracks ------------------------------------------------------ */

  function getTrack(id) { return TRACKS.find((tr) => tr.id === id) || null; }

  function arStems(w) {
    const list = [w];
    if (w.startsWith('ال') && w.length > 3) list.push(w.slice(2));
    if ((w.startsWith('و') || w.startsWith('ف') || w.startsWith('ب') || w.startsWith('ل')) && w.length > 2) {
      const rest = w.slice(1);
      list.push(rest);
      if (rest.startsWith('ال') && rest.length > 3) list.push(rest.slice(2));
    }
    if (w.endsWith('ي') && w.length > 3) list.push(w.slice(0, -1));
    if (w === 'وانتي') list.push('وانت', 'انت');
    if (w === 'انتي') list.push('انت');
    return Array.from(new Set(list));
  }

  function getTrackHaystack(tr) {
    const parts = [
      tr.title?.ar || '', tr.title?.en || '',
      tr.artist?.ar || '', tr.artist?.en || '',
      tr.album?.ar || '', tr.album?.en || '',
      tr.year || '',
      genreLabel(tr.genre)
    ];
    if (Array.isArray(tr.lyrics)) {
      for (const line of tr.lyrics) {
        if (line.text) parts.push(line.text);
        if (line.ar) parts.push(line.ar);
        if (line.en) parts.push(line.en);
      }
    }
    if (typeof tr.plainLyrics === 'string') {
      parts.push(tr.plainLyrics);
    }
    return norm(parts.join(' '));
  }

  function findMatchedLyric(tr, q) {
    if (!tr || !q) return null;
    const nq = norm(q);
    const qWords = nq.split(' ').filter(Boolean);
    if (!qWords.length) return null;

    const lines = [];
    if (Array.isArray(tr.lyrics)) {
      for (const l of tr.lyrics) {
        const primary = l.text || l.ar || l.en || '';
        if (primary) lines.push({ primary, alt: l.translation || l.en || l.ar || '' });
      }
    }
    if (typeof tr.plainLyrics === 'string') {
      for (const s of tr.plainLyrics.split(/\r?\n/)) {
        const trimmed = s.trim();
        if (trimmed) lines.push({ primary: trimmed, alt: '' });
      }
    }
    if (!lines.length) return null;

    for (const l of lines) {
      const np = norm(l.primary);
      const na = norm(l.alt);
      if (np.includes(nq)) return l.primary;
      if (na && na.includes(nq)) return l.primary;
    }

    let bestLine = null;
    let maxHits = 0;
    for (const l of lines) {
      const np = norm(l.primary);
      let hits = 0;
      for (const w of qWords) {
        const stems = arStems(w);
        if (stems.some((st) => np.includes(st))) hits++;
      }
      if (hits > maxHits && (hits >= 2 || hits === qWords.length)) {
        maxHits = hits;
        bestLine = l.primary;
      }
    }
    return bestLine;
  }

  function trackMatches(tr, q) {
    if (!q) return true;
    const nq = norm(q);
    if (!nq) return true;
    const hay = getTrackHaystack(tr);

    if (hay.includes(nq)) return true;

    const words = nq.split(' ').filter(Boolean);
    if (!words.length) return true;

    return words.every((w) => {
      const stems = arStems(w);
      return stems.some((st) => hay.includes(st));
    });
  }

  function includesAllTokens(queryTokens, fields) {
    const fieldTokens = new Set(fields.flatMap(tokenize));
    return queryTokens.every(token => fieldTokens.has(token));
  }

  function levenshteinDistance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let diagonal = previous[0];
      previous[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const old = previous[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        previous[j] = Math.min(
          previous[j] + 1,
          previous[j - 1] + 1,
          diagonal + cost
        );
        diagonal = old;
      }
    }
    return previous[b.length];
  }

  function fuzzyTokenMatch(queryToken, candidateTokens) {
    if (queryToken.length < 4) return false;
    return candidateTokens.some(candidate => {
      if (candidate.length < 4) return false;
      const maxDistance = queryToken.length >= 5 ? 2 : 1;
      return levenshteinDistance(queryToken, candidate) <= maxDistance;
    });
  }

  function scoreTrack(tr, query) {
    const q = normalizeSearchText(query);
    const queryTokens = tokenize(q);
    if (!q || !queryTokens.length) return 0;

    const titleAr = normalizeSearchText(tr.title?.ar || '');
    const titleEn = normalizeSearchText(tr.title?.en || '');
    const title = normalizeSearchText([tr.title?.ar, tr.title?.en, tr.title].filter(Boolean).join(' '));

    const artistAr = normalizeSearchText(tr.artist?.ar || '');
    const artistEn = normalizeSearchText(tr.artist?.en || '');
    const artist = normalizeSearchText([tr.artist?.ar, tr.artist?.en, tr.artist].filter(Boolean).join(' '));

    const albumAr = normalizeSearchText(tr.album?.ar || '');
    const albumEn = normalizeSearchText(tr.album?.en || '');
    const album = normalizeSearchText([tr.album?.ar, tr.album?.en, tr.album].filter(Boolean).join(' '));

    const titleTokens = tokenize(title);
    const artistTokens = tokenize(artist);
    const albumTokens = tokenize(album);
    const allMetadata = [title, artist, album].join(' ');
    const metadataTokens = tokenize(allMetadata);

    let score = 0;

    // Strict prefix matching for 1-2 character queries:
    if (q.length <= 2) {
      const matchPrefix = (tokens) => tokens.some((tok) => {
        if (tok.startsWith(q)) return true;
        if (tok.startsWith('ال') && tok.length > 2 && tok.slice(2).startsWith(q)) return true;
        return false;
      });

      if (titleAr.startsWith(q) || titleEn.startsWith(q)) score += 2000;
      else if (matchPrefix(titleTokens)) score += 1200;

      if (artistAr.startsWith(q) || artistEn.startsWith(q)) score += 1500;
      else if (matchPrefix(artistTokens)) score += 1000;

      return score;
    }

    // Direct exact or prefix matches
    if (title === q || titleAr === q || titleEn === q) score += 2500;
    else if (titleAr.startsWith(q) || titleEn.startsWith(q)) score += 1500;
    else if (titleAr.includes(q) || titleEn.includes(q) || title.includes(q)) score += 1000;

    if (artist === q || artistAr === q || artistEn === q) score += 2000;
    else if (artistAr.startsWith(q) || artistEn.startsWith(q)) score += 1300;
    else if (artistAr.includes(q) || artistEn.includes(q) || artist.includes(q)) score += 800;

    if (album === q || albumAr === q || albumEn === q) score += 450;
    else if (albumAr.startsWith(q) || albumEn.startsWith(q)) score += 350;
    else if (album.includes(q)) score += 300;

    // Multi-token queries (>= 2 tokens): require strict coverage
    if (queryTokens.length >= 2) {
      const hitCount = queryTokens.filter(t => metadataTokens.some(m => m === t || m.startsWith(t) || (t.length >= 4 && levenshteinDistance(t, m) <= 1))).length;
      const minHits = Math.ceil(queryTokens.length * 0.75);

      if (hitCount === queryTokens.length) {
        score += 500;
      } else if (hitCount >= minHits) {
        score += hitCount * 100;
      }
    } else {
      // Single token query: token prefix or typo match on title/artist
      if (titleTokens.some(t => t.startsWith(q))) score += 750;
      else if (artistTokens.some(a => a.startsWith(q))) score += 600;
      else if (queryTokens.some(token => fuzzyTokenMatch(token, titleTokens.concat(artistTokens)))) {
        score += 150;
      }
    }

    // Lyrics matching
    const hay = getTrackHaystack(tr);
    if (hay.includes(q)) {
      score += 180;
      const ml = findMatchedLyric(tr, query);
      if (ml) tr._matchedLyric = ml;
    } else if (includesAllTokens(queryTokens, [hay])) {
      score += 100;
      const ml = findMatchedLyric(tr, query);
      if (ml) tr._matchedLyric = ml;
    }

    return score;
  }

  function searchTracks(q) {
    const query = String(q || '').trim();
    if (!query) return [];
    const scored = [];

    for (const tr of TRACKS) {
      tr._matchedLyric = null;
      const score = scoreTrack(tr, query);
      if (score > 0) {
        scored.push({ tr, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((item) => item.tr);
  }

  function searchArtists(q) {
    if (!q) return [];
    const nq = normalizeSearchText(q);
    if (!nq) return [];
    const qTokens = tokenize(nq);
    return ARTISTS.filter((a) => {
      const nameAr = normalizeSearchText(a.name?.ar || '');
      const nameEn = normalizeSearchText(a.name?.en || '');
      const subAr = normalizeSearchText(a.sub?.ar || '');
      const subEn = normalizeSearchText(a.sub?.en || '');
      const hay = `${nameAr} ${nameEn} ${subAr} ${subEn}`;
      if (nameAr === nq || nameEn === nq) return true;
      if (nameAr.startsWith(nq) || nameEn.startsWith(nq)) return true;
      if (hay.includes(nq)) return true;
      return qTokens.length > 0 && qTokens.every(tok => hay.includes(tok));
    });
  }

  function searchAlbums(q) {
    if (!q) return [];
    const nq = normalizeSearchText(q);
    if (!nq) return [];
    const allAlbums = getAlbums();
    const qTokens = tokenize(nq);
    return allAlbums.filter(a => {
      const nameAr = normalizeSearchText(a.name?.ar || '');
      const nameEn = normalizeSearchText(a.name?.en || '');
      const artAr = normalizeSearchText(a.artist?.ar || '');
      const artEn = normalizeSearchText(a.artist?.en || '');
      const hay = `${nameAr} ${nameEn} ${artAr} ${artEn}`;
      if (nameAr === nq || nameEn === nq) return true;
      if (nameAr.startsWith(nq) || nameEn.startsWith(nq)) return true;
      if (hay.includes(nq)) return true;
      return qTokens.length > 0 && qTokens.every(tok => hay.includes(tok));
    });
  }

  let searchRequestId = 0;
  let activeSearchScript = null;
  let searchDebounceTimer = null;
  let activeSearchAbort = null;
  let activeSearchCleanup = null;

  function cancelActiveSearch() {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    if (activeSearchAbort) {
      try { activeSearchAbort.abort(); } catch (e) {}
      activeSearchAbort = null;
    }
    if (activeSearchCleanup) {
      try { activeSearchCleanup(); } catch (e) {}
      activeSearchCleanup = null;
    }
    if (activeSearchScript && activeSearchScript.parentNode) {
      try { activeSearchScript.parentNode.removeChild(activeSearchScript); } catch (e) {}
      activeSearchScript = null;
    }
  }

  function searchOnline(query, onDone) {
    const requestId = ++searchRequestId;
    cancelActiveSearch();

    const q = String(query || '').trim();
    if (q.length < 2) {
      if (requestId === searchRequestId && typeof onDone === 'function') {
        onDone([], []);
      }
      return;
    }

    searchDebounceTimer = setTimeout(async () => {
      if (requestId !== searchRequestId) return;

      const abortCtrl = new AbortController();
      activeSearchAbort = abortCtrl;

      // 1. Try multi-source search endpoint first (Apple, YouTube, Jamendo, Archive)
      try {
        const res = await fetch('/api/search-multi?q=' + encodeURIComponent(q), {
          signal: abortCtrl.signal,
          headers: { 'Accept': 'application/json' }
        });

        if (requestId !== searchRequestId) return;

        if (res.ok) {
          const data = await res.json();
          if (requestId !== searchRequestId) return;

          if (Array.isArray(data.results) && data.results.length > 0) {
            const mapped = data.results.map((tr) => {
              const existingIdx = TRACKS.findIndex((t) => t.id === tr.id);
              if (existingIdx === -1) TRACKS.push(tr);
              else TRACKS[existingIdx] = Object.assign(TRACKS[existingIdx], tr);
              return tr;
            });
            if (typeof onDone === 'function') onDone(mapped, data.artists || []);
            return;
          }
        }
      } catch (err) {
        if (err.name === 'AbortError' || requestId !== searchRequestId) return;
      }

      // 2. Fallback to classic search endpoint (Apple Music)
      try {
        const res = await fetch('/api/search?q=' + encodeURIComponent(q), {
          signal: abortCtrl.signal,
          headers: { 'Accept': 'application/json' }
        });

        if (requestId !== searchRequestId) return;

        if (res.ok) {
          const data = await res.json();
          if (requestId !== searchRequestId) return;

          if (Array.isArray(data.results)) {
            const mapped = data.results.map((tr) => {
              const existingIdx = TRACKS.findIndex((t) => t.id === tr.id);
              if (existingIdx === -1) TRACKS.push(tr);
              else TRACKS[existingIdx] = Object.assign(TRACKS[existingIdx], tr);
              return tr;
            });
            if (typeof onDone === 'function') onDone(mapped, data.artists || []);
            return;
          }
        }
      } catch (err2) {
        if (err2.name === 'AbortError' || requestId !== searchRequestId) return;
      }

      // 3. Fallback to iTunes JSONP for offline or local file:// mode
      if (requestId !== searchRequestId) return;

      const cbName = '__naghamJsonp_' + requestId + '_' + Math.floor(Math.random() * 10000);
      const script = document.createElement('script');
      activeSearchScript = script;
      let finished = false;

      const cleanup = () => {
        try { delete window[cbName]; } catch (e) {}
        if (script.parentNode) {
          try { script.parentNode.removeChild(script); } catch (e) {}
        }
        if (activeSearchScript === script) activeSearchScript = null;
      };
      activeSearchCleanup = cleanup;

      const finish = (results, artists) => {
        if (finished) return;
        finished = true;
        cleanup();
        if (requestId !== searchRequestId) return;
        if (typeof onDone === 'function') onDone(results || [], artists || []);
      };

      const timer = setTimeout(() => finish([], []), 4000);

      window[cbName] = (data) => {
        clearTimeout(timer);
        if (requestId !== searchRequestId) { cleanup(); return; }
        const rawList = Array.isArray(data?.results) ? data.results : [];
        const artistMap = new Map();
        const results = rawList.map((item, idx) => {
          const id = 'sp-' + (item.trackId || (Date.now() + '_' + idx));
          const artHiRes = item.artworkUrl100
            ? item.artworkUrl100.replace(/100x100bb\.(jpg|png|webp)/, '600x600bb.$1')
            : '';
          const durationMs = Number(item.trackTimeMillis);
          const fullDuration = Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs / 1000) : null;
          const releaseYear = item.releaseDate ? Number.parseInt(String(item.releaseDate).slice(0, 4), 10) : null;
          const year = Number.isInteger(releaseYear) && releaseYear >= 1900 && releaseYear <= (new Date().getFullYear() + 1)
            ? releaseYear
            : null;
          const palettes = [
            ['#1A0C06', '#7A3B12', '#F0A64B'],
            ['#1A0508', '#5C0E17', '#F26B6B'],
            ['#050B10', '#0F3446', '#58C7E8']
          ];
          const palette = palettes[idx % palettes.length];
          const artistName = item.artistName || 'فنان';
          if (!artistMap.has(artistName)) {
            artistMap.set(artistName, {
              name: { ar: artistName, en: artistName },
              sub: { ar: item.primaryGenreName || 'موسيقى', en: item.primaryGenreName || 'Music' },
              track: id,
              colors: palette,
              source: 'apple-music'
            });
          }

          const tr = {
            id,
            appleId: item.trackId,
            title: { ar: item.trackName || q, en: item.trackName || q },
            artist: { ar: artistName, en: artistName },
            album: { ar: item.collectionName || item.trackName || 'ألبوم', en: item.collectionName || item.trackName || 'Single' },
            art: artHiRes,
            preview: item.previewUrl || '',
            duration: fullDuration,
            fullDuration,
            catalogDuration: fullDuration,
            previewDuration: item.previewUrl ? 30 : null,
            playableDuration: item.previewUrl ? 30 : 0,
            playbackType: item.previewUrl ? 'preview' : 'unavailable',
            playbackMode: item.previewUrl ? 'PREVIEW' : 'UNAVAILABLE',
            playbackProvider: item.previewUrl ? 'apple-preview' : 'none',
            activeSource: item.previewUrl ? 'apple-preview' : 'none',
            isAudioPreview: Boolean(item.previewUrl),
            isFullTrack: false,
            isPreview: Boolean(item.previewUrl),
            availability: item.previewUrl ? 'preview_only' : 'unavailable',
            year,
            genre: (item.primaryGenreName || 'arabic').toLowerCase(),
            colors: palette,
            motif: 'rings',
            source: 'online',
            sources: item.previewUrl ? [
              {
                provider: 'apple-preview',
                providerName: 'Apple Music',
                playbackMode: 'PREVIEW',
                isFullTrack: false,
                duration: 30,
                url: item.previewUrl
              }
            ] : []
          };
          const existingIdx = TRACKS.findIndex((t) => t.id === tr.id);
          if (existingIdx === -1) TRACKS.push(tr);
          else TRACKS[existingIdx] = Object.assign(TRACKS[existingIdx], tr);
          return tr;
        });
        finish(results, Array.from(artistMap.values()).slice(0, 8));
      };

      script.onerror = () => finish([], []);
      script.src = 'https://itunes.apple.com/search?term=' + encodeURIComponent(q) + '&media=music&entity=song&limit=25&callback=' + cbName;
      document.head.appendChild(script);
    }, 280);
  }

  function fetchArtistTracks(artistName, onDone) {
    const art = String(artistName || '').trim();
    if (!art) {
      if (typeof onDone === 'function') onDone([]);
      return;
    }
    const abortCtrl = new AbortController();
    fetch('/api/search?q=' + encodeURIComponent(art), {
      signal: abortCtrl.signal,
      headers: { 'Accept': 'application/json' }
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.results)) {
          if (typeof onDone === 'function') onDone([]);
          return;
        }
        const normArt = norm(art);
        const filtered = data.results.filter((tr) => {
          const itemArt = norm(tr.artist?.ar + ' ' + tr.artist?.en);
          return itemArt.includes(normArt) || normArt.includes(itemArt);
        });
        filtered.forEach((tr) => {
          const existingIdx = TRACKS.findIndex((t) => t.id === tr.id);
          if (existingIdx === -1) TRACKS.push(tr);
          else TRACKS[existingIdx] = Object.assign(TRACKS[existingIdx], tr);
        });
        if (typeof onDone === 'function') onDone(filtered);
      })
      .catch(() => {
        if (typeof onDone === 'function') onDone([]);
      });
  }

  function fetchLyricsOnline(track, artist, onDone) {
    if (!track || typeof track !== 'object') {
      if (typeof onDone === 'function') onDone(null);
      return;
    }
    // Safety check: local files must never fetch or persist online lyrics
    if (track.source === 'file' || (track.id && (track.id.startsWith('local-') || track.id.startsWith('file-')))) {
      if (typeof onDone === 'function') onDone(null);
      return;
    }

    const tit = (track.title?.ar || track.title?.en || (typeof track.title === 'string' ? track.title : ''));
    const art = typeof artist === 'object' ? (artist.name?.ar || artist.name?.en || '') : String(artist || (track.artist?.ar || track.artist?.en || ''));
    if (!tit) {
      if (typeof onDone === 'function') onDone(null);
      return;
    }

    const trackId = track.id;
    track._lyricsReqSeq = (track._lyricsReqSeq || 0) + 1;
    const currentSeq = track._lyricsReqSeq;

    const url = '/api/lyrics?track=' + encodeURIComponent(tit) + (art ? ('&artist=' + encodeURIComponent(art)) : '');
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('lyrics_network_error');
        return r.json();
      })
      .then((d) => {
        // Prevent stale async response from overwriting newer track state
        if (track.id !== trackId || track._lyricsReqSeq !== currentSeq) {
          return;
        }

        const validLines = Array.isArray(d && d.lines) && d.lines.length > 0;
        const validPlain = typeof (d && d.plain) === 'string' && d.plain.trim().length > 0;

        if (validLines || validPlain) {
          const newLines = validLines ? d.lines : [];
          const newPlain = validPlain ? d.plain.trim() : null;
          const newSynced = Boolean(d.synced && validLines);

          // Change-detection guard: avoid unnecessary writes to localStorage if identical
          const oldLinesStr = JSON.stringify(track.lyrics || []);
          const newLinesStr = JSON.stringify(newLines);
          const changed = (oldLinesStr !== newLinesStr) || (track.plainLyrics !== newPlain) || (track._lyricsSynced !== newSynced);

          track.lyrics = newLines;
          track.plainLyrics = newPlain;
          track._lyricsSynced = newSynced;

          if (changed) {
            save();
            emit('meta', { id: track.id, lyrics: track.lyrics, plainLyrics: track.plainLyrics, synced: track._lyricsSynced });
          }

          if (typeof onDone === 'function') onDone(d);
        } else {
          // Do NOT corrupt or overwrite existing lyrics on empty/falsy responses
          if (typeof onDone === 'function') onDone(null);
        }
      })
      .catch(() => {
        // Network/API error: do NOT corrupt existing lyrics, do NOT call save
        if (typeof onDone === 'function') onDone(null);
      });
  }

  function artStyle(colors) {
    const c = Array.isArray(colors) && colors.length === 3 ? colors : ['#1B1F26', '#2A2F3A', '#6C7683'];
    return '--c1:' + c[0] + ';--c2:' + c[1] + ';--c3:' + c[2];
  }

  function coverImages(item, eager) {
    const src = (item && (item.art || item.photo)) || '';
    if (!src) return '';
    const load = eager ? 'eager' : 'lazy';
    const onerr = ' onerror="this.remove();if(this.parentNode)this.parentNode.classList.remove(\'has-photo\')"';
    return '<img class="cover-img cover-img-front" src="' + src + '" alt="" loading="' + load + '" decoding="async"' + onerr + '>';
  }

  const coverKey = (item) => (item && (item.art || item.photo)) || '';

  function coverHTML(item, extraClass, eager) {
    const colors = (item && item.colors) || ['#1B1F26', '#2A2F3A', '#6C7683'];
    const motif = (item && item.motif) || 'rings';
    const has = !!coverKey(item);
    return '<span class="cover art-' + motif + (has ? ' has-photo' : '') + ' ' + (extraClass || '') + '" style="' + artStyle(colors) + '" aria-hidden="true">' +
      coverImages(item || {}, eager) + '</span>';
  }

  function paintCover(el, item, eager) {
    if (!el) return;
    const colors = (item && item.colors) || ['#1B1F26', '#2A2F3A', '#6C7683'];
    const motif = (item && item.motif) || 'rings';
    const has = !!coverKey(item);
    el.className = 'cover art-' + motif + (has ? ' has-photo' : '');
    el.setAttribute('style', artStyle(colors));
    el.innerHTML = coverImages(item || {}, eager);
  }

  /* ---------- audio providers & engine (multi-source architecture) ---------- */

  const SPOTIFY_SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

  function loadSpotifySDK() {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && window.Spotify?.Player) {
        resolve(window.Spotify);
        return;
      }

      if (typeof document === 'undefined') {
        reject(new Error('no_document'));
        return;
      }

      const existing = document.querySelector(`script[src="${SPOTIFY_SDK_URL}"]`);

      const timeout = setTimeout(() => {
        reject(new Error('spotify_sdk_timeout'));
      }, 15000);

      window.onSpotifyWebPlaybackSDKReady = () => {
        clearTimeout(timeout);
        resolve(window.Spotify);
      };

      if (!existing) {
        const script = document.createElement('script');
        script.src = SPOTIFY_SDK_URL;
        script.async = true;
        script.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('spotify_sdk_load_failed'));
        };
        document.head.appendChild(script);
      }
    });
  }

  async function initializeSpotifyPlayer(accessToken) {
    const Spotify = await loadSpotifySDK();

    const player = new Spotify.Player({
      name: '7ify Web Player',
      getOAuthToken: (callback) => callback(accessToken),
      volume: clamp(state.volume / 100, 0, 1)
    });

    player.addListener('ready', ({ device_id }) => {
      providers.spotify.deviceId = device_id;
      emit('provider-changed', providers.getProviderStatus());
    });

    player.addListener('not_ready', ({ device_id }) => {
      if (providers.spotify.deviceId === device_id) {
        providers.spotify.deviceId = null;
      }
    });

    player.addListener('player_state_changed', (s) => {
      if (!s) return;

      engine._spotifyPos = s.position / 1000;
      if (Number.isFinite(s.duration) && s.duration > 0) {
        engine._spotifyDur = s.duration / 1000;
      }
      engine.playing = !s.paused;
      engine.status = s.paused ? 'paused' : 'playing';

      emit('tick', {
        pos: s.position / 1000,
        duration: (s.duration / 1000) || engine.getDuration()
      });

      emit('state', { playing: !s.paused });
      emit('status', { status: engine.status });

      if (s.position > 0 && s.duration > 0 && (s.duration - s.position < 300 || s.position >= s.duration) && s.paused) {
        engine.pauseAtEnd();
        emit('ended', {});
      }
    });

    for (const event of [
      'initialization_error',
      'authentication_error',
      'account_error',
      'playback_error'
    ]) {
      player.addListener(event, (error) => {
        console.error('Spotify SDK error:', event, error);
        emit('spotify-error', { event, error });
      });
    }

    const connected = await player.connect();
    if (!connected) {
      throw new Error('spotify_player_connection_failed');
    }

    engine._spotifyPlayer = player;
    return player;
  }

  async function playSpotifyTrack(track) {
    const auth = providers.getProviderStatus().spotify;

    if (!auth.connected) {
      throw new Error('spotify_not_authenticated');
    }

    if (!auth.isPremium) {
      throw new Error('spotify_premium_required');
    }

    const player = engine._spotifyPlayer;
    const deviceId = providers.spotify.deviceId;

    if (!player || !deviceId) {
      throw new Error('spotify_device_not_ready');
    }

    if (!track || !track.spotifyUri || !track.spotifyUri.startsWith('spotify:track:')) {
      throw new Error('spotify_track_uri_missing');
    }

    const token = await providers.getValidAccessToken();
    if (!token) {
      throw new Error('spotify_token_invalid');
    }

    const response = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: [track.spotifyUri]
        })
      }
    );

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`spotify_play_failed_${response.status}: ${details}`);
    }

    const s = await player.getCurrentState().catch(() => null);
    if (s) {
      engine._spotifyPos = s.position / 1000;
      if (Number.isFinite(s.duration) && s.duration > 0) {
        engine._spotifyDur = s.duration / 1000;
      }
      engine.playing = !s.paused;
      engine.status = s.paused ? 'paused' : 'playing';
    }

    return true;
  }

  async function spotifySeek(seconds) {
    const player = engine._spotifyPlayer;
    if (!player) throw new Error('spotify_player_not_ready');
    const ms = Math.max(0, Math.round(seconds * 1000));
    await player.seek(ms);
  }

  async function spotifyPause() {
    if (!engine._spotifyPlayer) return;
    await engine._spotifyPlayer.pause();
  }

  async function spotifyResume() {
    if (!engine._spotifyPlayer) {
      throw new Error('spotify_player_not_ready');
    }
    await engine._spotifyPlayer.resume();
  }

  const PLAYBACK_MODES = {
    FULL: 'FULL',
    OFFICIAL_EMBED: 'OFFICIAL_EMBED',
    PREVIEW: 'PREVIEW',
    METADATA_ONLY: 'METADATA_ONLY',
    UNAVAILABLE: 'UNAVAILABLE'
  };

  const ENGINE_STATES = {
    IDLE: 'idle',
    SEARCHING: 'searching',
    RESOLVING: 'resolving',
    READY_FULL: 'ready_full',
    READY_PREVIEW: 'ready_preview',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LOADING: 'loading',
    FALLBACK: 'fallback',
    ENDED: 'ended',
    UNAVAILABLE: 'unavailable',
    ERROR: 'error'
  };

  let activeYtTicker = null;
  const ytDriver = {
    player: null,
    ready: false,
    _loadingPromise: null,

    loadAPI() {
      if (this._loadingPromise) return this._loadingPromise;
      this._loadingPromise = new Promise((resolve) => {
        if (typeof window !== 'undefined' && window.YT && window.YT.Player) {
          return resolve(window.YT);
        }
        if (typeof window === 'undefined') return resolve(null);

        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (typeof prev === 'function') {
            try { prev(); } catch (e) {}
          }
          resolve(window.YT);
        };

        if (typeof document !== 'undefined' && document.head) {
          const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
          if (!existing) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.async = true;
            document.head.appendChild(tag);
          }
        } else {
          resolve(null);
        }
      });
      return this._loadingPromise;
    },

    async init() {
      if (this.player && this.ready) return this.player;
      const YT = await this.loadAPI();
      if (!YT || !YT.Player) {
        throw new Error('yt_api_unavailable');
      }

      return new Promise((resolve) => {
        let container = typeof document !== 'undefined' ? document.getElementById('yt-player-host') : null;
        if (!container && typeof document !== 'undefined' && document.body) {
          container = document.createElement('div');
          container.id = 'yt-player-host';
          container.style.cssText = 'position:fixed;bottom:-9999px;left:-9999px;width:240px;height:160px;opacity:0.001;pointer-events:none;z-index:-10;';
          document.body.appendChild(container);
        }

        this.player = new YT.Player('yt-player-host', {
          height: '160',
          width: '240',
          playerVars: {
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0
          },
          events: {
            onReady: (e) => {
              this.ready = true;
              resolve(this.player);
            },
            onStateChange: (e) => {
              if (engine.mode !== 'youtube') return;
              if (e.data === 1) { // PLAYING
                engine.playing = true;
                engine.status = 'playing';
                emit('state', { playing: true });
                emit('status', { status: 'playing' });
                engine._startYTTicker();
              } else if (e.data === 2) { // PAUSED
                engine.playing = false;
                if (engine.status !== 'ended' && engine.status !== 'error') {
                  engine.status = 'paused';
                }
                emit('state', { playing: false });
                emit('status', { status: engine.status });
                engine._stopYTTicker();
              } else if (e.data === 0) { // ENDED
                engine._stopYTTicker();
                engine.pauseAtEnd();
                emit('ended', {});
              } else if (e.data === 3) { // BUFFERING
                engine.status = 'loading';
                emit('status', { status: 'loading' });
              }
            },
            onError: (e) => {
              console.warn('YouTube Player error:', e?.data);
              if (engine.mode === 'youtube') {
                engine.handlePlaybackFallback('youtube', new Error('yt_error_' + (e?.data || 'unknown')));
              }
            }
          }
        });
      });
    },

    async play(videoId) {
      if (!this.player || !this.ready) {
        await this.init();
      }
      if (this.player && typeof this.player.loadVideoById === 'function') {
        this.player.loadVideoById(videoId);
        if (typeof this.player.playVideo === 'function') {
          this.player.playVideo();
        }
      }
      return true;
    },

    pause() {
      if (this.player && typeof this.player.pauseVideo === 'function') {
        try { this.player.pauseVideo(); } catch (e) {}
      }
    },

    resume() {
      if (this.player && typeof this.player.playVideo === 'function') {
        try { this.player.playVideo(); } catch (e) {}
      }
    },

    seek(seconds) {
      if (this.player && typeof this.player.seekTo === 'function') {
        try { this.player.seekTo(seconds, true); } catch (e) {}
      }
    },

    setVolume(vol) {
      if (this.player && typeof this.player.setVolume === 'function') {
        try { this.player.setVolume(clamp(vol, 0, 100)); } catch (e) {}
      }
    },

    getTime() {
      if (this.player && typeof this.player.getCurrentTime === 'function') {
        const t = this.player.getCurrentTime();
        return (Number.isFinite(t) && t >= 0) ? t : 0;
      }
      return 0;
    },

    getDuration() {
      if (this.player && typeof this.player.getDuration === 'function') {
        const d = this.player.getDuration();
        return (Number.isFinite(d) && d > 0) ? d : 0;
      }
      return 0;
    }
  };

  async function resolvePlaybackSource(track) {
    if (!track) return null;

    // 1. Local file
    if (track.source === 'file' || track.playbackType === 'local') {
      return {
        type: 'local',
        provider: 'local',
        playbackMode: PLAYBACK_MODES.FULL,
        url: track.url,
        duration: track.duration || 0,
        isFullTrack: true,
        isPreview: false
      };
    }

    // 2. Spotify Premium (if user is authenticated and is premium)
    const spotifyAuth = providers.getProviderStatus().spotify;
    if (spotifyAuth.connected && spotifyAuth.isPremium) {
      try {
        const matched = (track.spotifyUri && track.spotifyUri.startsWith('spotify:track:'))
          ? { uri: track.spotifyUri, duration: track.duration }
          : await providers.matchTrack(track);

        if (matched?.uri && typeof matched.uri === 'string' && matched.uri.startsWith('spotify:track:')) {
          return {
            type: 'full',
            provider: 'spotify',
            playbackMode: PLAYBACK_MODES.FULL,
            uri: matched.uri,
            duration: matched.duration || track.duration || track.fullDuration || 0,
            isFullTrack: true,
            isPreview: false
          };
        }
      } catch (error) {
        console.warn('Spotify matching failed:', error);
      }
    }

    // 3. YouTube (Official Embed)
    let ytVideoId = track.youtubeVideoId || (track.sources?.find(s => s.provider === 'youtube')?.videoId);
    if (!ytVideoId && track.source !== 'file') {
      try {
        const titleStr = typeof track.title === 'object' ? (track.title.ar || track.title.en || '') : String(track.title || '');
        const artistStr = typeof track.artist === 'object' ? (track.artist.ar || track.artist.en || '') : String(track.artist || '');
        if (titleStr || artistStr) {
          const query = `${artistStr} - ${titleStr} audio`.trim();
          const ytRes = await fetch('/api/yt-search?q=' + encodeURIComponent(query));
          if (ytRes && ytRes.ok) {
            const ytData = await ytRes.json();
            if (ytData?.videoId) {
              ytVideoId = ytData.videoId;
              track.youtubeVideoId = ytData.videoId;
              track.youtubeId = ytData.videoId;
              if (ytData.duration) {
                const parts = String(ytData.duration).split(':').map(Number);
                let sec = 0;
                if (parts.length === 2) sec = (parts[0] * 60) + parts[1];
                else if (parts.length === 3) sec = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
                if (sec > 0) {
                  track.duration = track.duration || sec;
                  track.fullDuration = track.fullDuration || sec;
                }
              }
              if (!Array.isArray(track.sources)) track.sources = [];
              const exists = track.sources.some(s => s.provider === 'youtube');
              if (!exists) {
                track.sources.unshift({
                  provider: 'youtube',
                  providerName: 'YouTube',
                  label: 'YouTube (مشغل رسمي)',
                  playbackMode: PLAYBACK_MODES.OFFICIAL_EMBED,
                  videoId: ytData.videoId,
                  isFullTrack: true,
                  duration: track.duration || track.fullDuration || 210
                });
              }
            }
          }
        }
      } catch (err) {
        // Fallback gracefully if network fails
      }
    }

    if (ytVideoId) {
      return {
        type: 'official_embed',
        provider: 'youtube',
        playbackMode: PLAYBACK_MODES.OFFICIAL_EMBED,
        videoId: ytVideoId,
        duration: track.duration || track.fullDuration || 210,
        isFullTrack: true,
        isPreview: false
      };
    }

    // 4. Jamendo (CC Full MP3 stream)
    if (track.activeSource === 'jamendo' || (track.playbackProvider === 'jamendo' && track.url)) {
      return {
        type: 'full',
        provider: 'jamendo',
        playbackMode: PLAYBACK_MODES.FULL,
        url: track.url,
        duration: track.duration || track.fullDuration || 180,
        isFullTrack: true,
        isPreview: false
      };
    }

    // 5. Internet Archive (Audio Stream / Embed)
    if (track.activeSource === 'archive' || (track.playbackProvider === 'archive' && track.url)) {
      return {
        type: 'full',
        provider: 'archive',
        playbackMode: PLAYBACK_MODES.FULL,
        url: track.url,
        duration: track.duration || track.fullDuration || 190,
        isFullTrack: true,
        isPreview: false
      };
    }

    // 6. Apple Music Preview (30 seconds)
    if (track.preview) {
      return {
        type: 'preview',
        provider: 'apple-preview',
        playbackMode: PLAYBACK_MODES.PREVIEW,
        url: track.preview,
        duration: track.previewDuration || 30,
        isFullTrack: false,
        isPreview: true
      };
    }

    return {
      type: 'unavailable',
      provider: 'none',
      playbackMode: PLAYBACK_MODES.UNAVAILABLE,
      duration: 0,
      isFullTrack: false,
      isPreview: false
    };
  }

  const musicProviders = {
    list() {
      return [
        { id: 'local', name: { ar: 'ملف محلي', en: 'Local File' }, mode: PLAYBACK_MODES.FULL, enabled: true },
        { id: 'youtube', name: { ar: 'YouTube', en: 'YouTube' }, mode: PLAYBACK_MODES.OFFICIAL_EMBED, enabled: true },
        { id: 'spotify', name: { ar: 'Spotify', en: 'Spotify' }, mode: PLAYBACK_MODES.FULL, enabled: providers.getProviderStatus().spotify.connected },
        { id: 'jamendo', name: { ar: 'Jamendo', en: 'Jamendo' }, mode: PLAYBACK_MODES.FULL, enabled: true },
        { id: 'archive', name: { ar: 'أرشيف الإنترنت', en: 'Internet Archive' }, mode: PLAYBACK_MODES.FULL, enabled: true },
        { id: 'apple-preview', name: { ar: 'Apple Music', en: 'Apple Music' }, mode: PLAYBACK_MODES.PREVIEW, enabled: true }
      ];
    },
    get(id) {
      return this.list().find(p => p.id === id) || null;
    }
  };

  const providers = {
    spotify: {
      deviceId: null
    },

    getProviderStatus() {
      let auth = null;
      try {
        const stored = localStorage.getItem('nagham_spotify_auth');
        auth = stored ? JSON.parse(stored) : null;
      } catch (e) {}
      const isConn = Boolean(auth && auth.accessToken && (Date.now() < (auth.expiresAt || 0)));
      const isPremium = Boolean(isConn && auth?.user?.product === 'premium');
      return {
        spotify: {
          connected: isConn,
          user: auth?.user || null,
          isPremium,
          deviceId: providers.spotify.deviceId || null,
          requiresAuth: !isConn
        },
        youtube: { available: true, mode: 'OFFICIAL_EMBED' },
        local: { available: true, mode: 'FULL' },
        jamendo: { available: true, mode: 'FULL' },
        archive: { available: true, mode: 'FULL' },
        applePreview: { available: true, mode: 'PREVIEW' }
      };
    },

    setSpotifyAuth(data) {
      if (!data) {
        try { localStorage.removeItem('nagham_spotify_auth'); } catch (e) {}
        this.spotify.deviceId = null;
      } else {
        try { localStorage.setItem('nagham_spotify_auth', JSON.stringify(data)); } catch (e) {}
      }
      emit('provider-changed', this.getProviderStatus());
    },

    async getValidAccessToken() {
      let auth = null;
      try {
        const stored = localStorage.getItem('nagham_spotify_auth');
        auth = stored ? JSON.parse(stored) : null;
      } catch (e) {}

      if (!auth || !auth.accessToken) return null;

      if (Date.now() < (auth.expiresAt || 0) - 60000) {
        return auth.accessToken;
      }

      const refreshToken = auth.refreshToken;
      const clientId = localStorage.getItem('nagham_spotify_client_id');
      if (refreshToken && clientId) {
        try {
          const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              grant_type: 'refresh_token',
              refresh_token: refreshToken
            })
          });
          if (res.ok) {
            const d = await res.json();
            auth.accessToken = d.access_token;
            if (d.refresh_token) auth.refreshToken = d.refresh_token;
            auth.expiresAt = Date.now() + ((d.expires_in || 3600) * 1000);
            localStorage.setItem('nagham_spotify_auth', JSON.stringify(auth));
            return auth.accessToken;
          }
        } catch (e) {}
      }

      if (Date.now() >= (auth.expiresAt || 0)) {
        return null;
      }
      return auth.accessToken;
    },

    async matchTrack(track) {
      if (!track || track.source === 'file') return null;
      const tit = track.title?.ar || track.title?.en || (typeof track.title === 'string' ? track.title : '');
      const art = track.artist?.ar || track.artist?.en || (typeof track.artist === 'string' ? track.artist : '');
      const dur = track.duration || track.fullDuration || 0;
      if (!tit) return null;

      try {
        const url = `/api/provider-match?title=${encodeURIComponent(tit)}&artist=${encodeURIComponent(art)}&duration=${dur}&provider=spotify`;
        const r = await fetch(url);
        if (r.ok) {
          const d = await r.json();
          if (d.matched && d.track && typeof d.track.uri === 'string' && d.track.uri.startsWith('spotify:track:')) {
            track.spotifyUri = d.track.uri;
            return d.track;
          }
        }
      } catch (e) {}
      return null;
    },

    async connectSpotify(customClientId) {
      let clientId = customClientId || localStorage.getItem('nagham_spotify_client_id');
      if (!clientId) {
        const enteredId = prompt(
          state.lang === 'ar'
            ? 'يرجى إدخال Spotify Client ID الخاص بتطبيقك في Spotify Developer Dashboard:'
            : 'Please enter your Spotify Client ID from Spotify Developer Dashboard:'
        );
        if (!enteredId || !enteredId.trim()) {
          throw new Error('client_id_required');
        }
        clientId = enteredId.trim();
        localStorage.setItem('nagham_spotify_client_id', clientId);
      }

      const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
      const array = new Uint8Array(64);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(array);
      } else {
        for (let i = 0; i < 64; i++) array[i] = Math.floor(Math.random() * 256);
      }
      let verifier = '';
      for (let i = 0; i < array.length; i++) verifier += possible[array[i] % possible.length];

      let challenge = verifier;
      if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
        const data = new TextEncoder().encode(verifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
          .replace(/=/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_');
      }

      const oauthState = Math.random().toString(36).slice(2) + Date.now().toString(36);
      try {
        sessionStorage.setItem('spotify_pkce_verifier', verifier);
        sessionStorage.setItem('spotify_pkce_state', oauthState);
      } catch (e) {}

      const redirectUri = window.location.origin + window.location.pathname;
      const scope = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';

      const authUrl = new URL('https://accounts.spotify.com/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('state', oauthState);

      window.location.href = authUrl.toString();
    },

    disconnectSpotify() {
      if (engine._spotifyPlayer) {
        try { engine._spotifyPlayer.disconnect(); } catch (e) {}
        engine._spotifyPlayer = null;
      }
      this.spotify.deviceId = null;
      this.setSpotifyAuth(null);
    },

    async handleCallback() {
      if (typeof window === 'undefined' || !window.location || !window.location.search) return;
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const stateParam = params.get('state');
      const error = params.get('error');

      if (error) {
        console.error('Spotify authorization error:', error);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      if (!code || !stateParam) return;

      let savedState = null;
      let verifier = null;
      try {
        savedState = sessionStorage.getItem('spotify_pkce_state');
        verifier = sessionStorage.getItem('spotify_pkce_verifier');
        sessionStorage.removeItem('spotify_pkce_state');
        sessionStorage.removeItem('spotify_pkce_verifier');
      } catch (e) {}

      if (stateParam !== savedState || !verifier) {
        console.error('Spotify PKCE state mismatch or missing verifier');
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      const clientId = localStorage.getItem('nagham_spotify_client_id');
      const redirectUri = window.location.origin + window.location.pathname;

      try {
        const res = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            code_verifier: verifier
          })
        });

        if (!res.ok) throw new Error('token_exchange_failed');

        const tokenData = await res.json();
        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;
        const expiresAt = Date.now() + ((tokenData.expires_in || 3600) * 1000);

        const profileRes = await fetch('https://api.spotify.com/v1/me', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!profileRes.ok) throw new Error('spotify_profile_verification_failed');

        const user = await profileRes.json();
        const isPremium = user.product === 'premium';

        providers.setSpotifyAuth({
          accessToken,
          refreshToken,
          expiresAt,
          user: {
            id: user.id,
            display_name: user.display_name,
            product: user.product,
            email: user.email
          },
          isPremium
        });

        if (isPremium) {
          try {
            await initializeSpotifyPlayer(accessToken);
          } catch (sdkErr) {
            console.warn('Spotify SDK init on callback failed:', sdkErr);
          }
        }
      } catch (err) {
        console.error('Failed Spotify OAuth PKCE callback:', err);
      } finally {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  };

  function getPlayableDuration(track) {
    if (!track) return 0;

    if (track.playbackType === 'unavailable' || track.playbackMode === 'UNAVAILABLE') return 0;

    if (track.source === 'file' || track.playbackType === 'local' || track.playbackProvider === 'local') {
      const duration = Number(engine?.el?.duration || track.duration);
      return Number.isFinite(duration) && duration > 0 ? duration : 0;
    }

    if (track.playbackProvider === 'youtube' || track.activeSource === 'youtube' || track.playbackType === 'embed' || track.playbackMode === 'OFFICIAL_EMBED') {
      const ytDur = ytDriver.getDuration();
      if (Number.isFinite(ytDur) && ytDur > 0) return ytDur;
      const d = Number(track.duration || track.fullDuration || track.catalogDuration);
      return Number.isFinite(d) && d > 0 ? d : 0;
    }

    if (track.playbackProvider === 'spotify' && (track.playbackType === 'full' || track.playbackMode === 'FULL')) {
      const duration = Number(engine?._spotifyDur || track.duration || track.fullDuration);
      return Number.isFinite(duration) && duration > 0 ? duration : 0;
    }

    if (track.playbackMode === 'FULL' || track.playbackType === 'full' || track.playbackProvider === 'jamendo' || track.playbackProvider === 'archive' || track.activeSource === 'jamendo' || track.activeSource === 'archive') {
      const duration = Number(engine?.el?.duration || track.duration || track.fullDuration);
      return Number.isFinite(duration) && duration > 0 ? duration : 0;
    }

    if (engine?.track?.id === track.id) {
      if (engine.mode === 'youtube') {
        const d = ytDriver.getDuration();
        if (Number.isFinite(d) && d > 0) return d;
      }
      const actualDuration = Number(engine.el?.duration);
      if (Number.isFinite(actualDuration) && actualDuration > 0) {
        return actualDuration;
      }
    }

    const previewDuration = Number(track.previewDuration);
    if (Number.isFinite(previewDuration) && previewDuration > 0) {
      return previewDuration;
    }

    if (track.isAudioPreview || track.preview || track.playbackType === 'preview' || track.playbackMode === 'PREVIEW') {
      return 30;
    }

    return 0;
  }

  const bus = new EventTarget();
  const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail: detail }));

  const engine = {
    el: null,
    track: null,
    playing: false,
    status: 'idle',
    mode: 'none',
    url: '',
    _reqId: 0,
    _looping: false,
    _vPos: 0,
    _vTimer: null,
    _previewDur: 0,
    _spotifyPlayer: null,
    _spotifyPos: 0,
    _spotifyDur: 0,
    _failedSources: new Set(),

    init() {
      const el = new Audio();
      el.preload = 'metadata';
      el.setAttribute('playsinline', '');

      el.addEventListener('timeupdate', () => {
        if (!this.track || this.mode === 'youtube' || this.mode === 'spotify') return;
        const dur = this.getDuration();
        emit('tick', { pos: el.currentTime, duration: dur });
      });

      el.addEventListener('loadedmetadata', () => {
        if (!this.track || this.mode === 'youtube' || this.mode === 'spotify') return;
        const dur = this.getDuration();
        if (this.track.source === 'file' && Number.isFinite(dur) && dur > 0 && (!this.track.duration || this.track.duration === 0)) {
          this.track.duration = Math.round(dur);
        }
        emit('meta', { id: this.track.id, duration: dur });
        emit('tick', { pos: el.currentTime, duration: dur });
      });

      el.addEventListener('play', () => {
        if (this.mode === 'youtube' || this.mode === 'spotify') return;
        this.playing = true;
        this.status = 'playing';
        emit('state', { playing: true });
        emit('status', { status: 'playing' });
      });

      el.addEventListener('pause', () => {
        if (this.mode === 'youtube' || this.mode === 'spotify') return;
        this.playing = false;
        if (this.status !== 'ended' && this.status !== 'error') {
          this.status = 'paused';
        }
        emit('state', { playing: false });
        emit('status', { status: this.status });
      });

      el.addEventListener('ended', () => {
        if (this.mode === 'youtube' || this.mode === 'spotify') return;
        this.playing = false;
        this.status = 'ended';
        emit('state', { playing: false });
        emit('status', { status: 'ended' });
        emit('ended', {});
      });

      el.addEventListener('error', () => {
        if (this.mode === 'youtube' || this.mode === 'spotify') return;
        console.warn('Audio element error, checking fallback for:', this.track?.id);
        this.handlePlaybackFallback(this.mode, new Error('audio_element_error'));
      });

      this.el = el;
      this.el.volume = state.muted ? 0 : state.volume / 100;
    },

    stopDrivers(activeMode) {
      if (activeMode !== 'audio' && this.el) {
        try { this.el.pause(); this.el.removeAttribute('src'); } catch (e) {}
      }
      if (activeMode !== 'spotify' && this._spotifyPlayer) {
        try { this._spotifyPlayer.pause(); } catch (e) {}
      }
      if (activeMode !== 'youtube') {
        try { ytDriver.pause(); } catch (e) {}
      }
      this._stopVirtualTimer();
      this._stopYTTicker();
    },

    _startYTTicker() {
      this._stopYTTicker();
      activeYtTicker = setInterval(() => {
        if (this.mode !== 'youtube' || !this.playing) {
          this._stopYTTicker();
          return;
        }
        const pos = ytDriver.getTime();
        const dur = this.getDuration();
        emit('tick', { pos, duration: dur });
      }, 250);
    },

    _stopYTTicker() {
      if (activeYtTicker) {
        clearInterval(activeYtTicker);
        activeYtTicker = null;
      }
    },

    load(track, preferredProviderId) {
      if (!track) return;
      this._reqId++;
      this.stopDrivers();
      this._failedSources = new Set();

      this.track = track;
      this.playing = false;
      this.status = 'idle';
      this._spotifyPos = 0;

      if (preferredProviderId) {
        track.activeSource = preferredProviderId;
      }

      const isLocal = track.source === 'file' || track.playbackType === 'local';
      const spotifyAuth = providers.getProviderStatus().spotify;
      const canSpotify = Boolean(spotifyAuth.connected && spotifyAuth.isPremium);

      // 1. Local audio file
      if (isLocal) {
        this.mode = 'file';
        this.url = track.url || '';
        this.el.loop = false;
        this.el.src = this.url;
        this.el.load();
        this.status = 'ready_full';
      }
      // 2. YouTube Official Embed
      else if (track.activeSource === 'youtube' || (track.youtubeVideoId && (!track.activeSource || track.activeSource === 'youtube'))) {
        this.mode = 'youtube';
        this.url = '';
        this.status = 'ready_full';
      }
      // 3. Spotify SDK (if authorized Premium or explicit spotify mode)
      else if ((track.playbackType === 'full' && (track.playbackProvider === 'spotify' || track.spotifyUri)) || (canSpotify && (track.spotifyUri || track.activeSource === 'spotify'))) {
        this.mode = 'spotify';
        this.url = '';
        this.status = 'ready_full';
      }
      // 4. Jamendo full stream
      else if (track.activeSource === 'jamendo' || (track.playbackProvider === 'jamendo' && (track.url || track.preview))) {
        this.mode = 'jamendo';
        this.url = track.url || track.preview;
        this.el.loop = false;
        if (this.el.src !== this.url) this.el.src = this.url;
        this.el.load();
        this.status = 'ready_full';
      }
      // 5. Internet Archive stream
      else if (track.activeSource === 'archive' || (track.playbackProvider === 'archive' && (track.url || track.preview))) {
        this.mode = 'archive';
        this.url = track.url || track.preview;
        this.el.loop = false;
        if (this.el.src !== this.url) this.el.src = this.url;
        this.el.load();
        this.status = 'ready_full';
      }
      // 6. Apple Music 30s preview
      else if (track.preview) {
        this.mode = 'stream';
        this.url = track.preview;
        this.el.loop = false;
        if (this.el.src !== this.url) this.el.src = this.url;
        this.el.load();
        this.status = 'ready_preview';
      }
      else if (track.url) {
        this.mode = 'stream';
        this.url = track.url;
        this.el.loop = false;
        if (this.el.src !== this.url) this.el.src = this.url;
        this.el.load();
        this.status = 'ready_full';
      }
      else {
        this.mode = 'unavailable';
        this.url = '';
        this.status = 'unavailable';
        emit('state', { playing: false });
        emit('status', { status: 'unavailable' });
        emit('error', { code: 'unavailable' });
        return;
      }

      emit('state', { playing: false });
      emit('status', { status: this.status });
      const initDur = this.getDuration();
      emit('tick', { pos: 0, duration: initDur });
    },

    async play() {
      if (!this.track) {
        emit('error', { code: 'no-audio' });
        return;
      }

      const spotifyAuth = providers.getProviderStatus().spotify;
      const canSpotify = Boolean(spotifyAuth.connected && spotifyAuth.isPremium);

      if (this.mode === 'unavailable' || this.track.playbackType === 'unavailable' ||
        (!this.track.preview && !this.track.url && this.track.source !== 'file' && !this.track.spotifyUri && !this.track.youtubeVideoId && !canSpotify)) {
        this.status = 'unavailable';
        this.playing = false;
        emit('state', { playing: false });
        emit('status', { status: 'unavailable' });
        emit('error', { code: 'unavailable' });
        return;
      }

      // If at end of track or status was ended, restart cleanly from beginning
      if (this.status === 'ended' || this.getPosition() >= this.getDuration() - 0.05) {
        this.seek(0);
      }

      const reqId = this._reqId;
      this.status = 'loading';
      emit('status', { status: 'loading' });

      // If Spotify is authenticated and premium, resolve track if not already resolved and no other full source active
      if (canSpotify && this.track.source !== 'file' && !this.track.youtubeVideoId && !this.track.spotifyUri && this.track.activeSource !== 'youtube') {
        try {
          const resolved = await resolvePlaybackSource(this.track);
          if (this._reqId !== reqId) return;
          if (resolved?.type === 'spotify' && resolved.uri) {
            this.track.spotifyUri = resolved.uri;
            this.track.playbackType = 'full';
            this.track.playbackProvider = 'spotify';
            this.mode = 'spotify';
          }
        } catch (e) {
          console.warn('Spotify resolve on play failed:', e);
        }
      }

      // Auto-resolve full playback on YouTube before falling back to short preview
      if (this.track.source !== 'file' && !this.track.youtubeVideoId && this.mode !== 'spotify') {
        try {
          const resolved = await resolvePlaybackSource(this.track);
          if (this._reqId !== reqId) return;
          if (resolved?.videoId) {
            this.track.youtubeVideoId = resolved.videoId;
            this.track.youtubeId = resolved.videoId;
            this.track.playbackMode = PLAYBACK_MODES.OFFICIAL_EMBED;
            this.track.playbackType = 'embed';
            this.track.playbackProvider = 'youtube';
            this.track.isAudioPreview = false;
            this.track.playableDuration = this.track.duration || this.track.fullDuration || resolved.duration || 210;
            this.mode = 'youtube';
            emit('meta', { track: this.track });
          }
        } catch (e) {
          console.warn('Auto YouTube resolve on play failed:', e);
        }
      }

      // 1. YouTube Mode
      if (this.mode === 'youtube') {
        this.stopDrivers('youtube');
        const videoId = this.track.youtubeVideoId
          || (this.track.sources?.find(s => s.provider === 'youtube')?.videoId);

        if (!videoId) {
          return this.handlePlaybackFallback('youtube', new Error('youtube_video_id_missing'));
        }

        try {
          await ytDriver.play(videoId);
          if (this._reqId !== reqId || this.mode !== 'youtube') return;
          this.playing = true;
          this.status = 'playing';
          emit('state', { playing: true });
          emit('status', { status: 'playing' });
          this._startYTTicker();
          return;
        } catch (error) {
          console.warn('YouTube playback failed, attempting fallback:', error);
          if (this._reqId !== reqId) return;
          return this.handlePlaybackFallback('youtube', error);
        }
      }

      // 2. Spotify Mode
      if (this.mode === 'spotify') {
        this.stopDrivers('spotify');
        try {
          await playSpotifyTrack(this.track);
          if (this._reqId !== reqId || this.mode !== 'spotify') return;
          this.status = 'loading';
          emit('status', { status: 'loading' });
          return;
        } catch (error) {
          console.error('Spotify playback failed, attempting fallback:', error);
          if (this._reqId !== reqId) return;
          return this.handlePlaybackFallback('spotify', error);
        }
      }

      // 3. Audio Element Modes (file, jamendo, archive, stream preview)
      this.stopDrivers('audio');
      this.el.volume = state.muted ? 0 : state.volume / 100;
      try {
        await this.el.play();
        if (this._reqId !== reqId) return;
        this.playing = true;
        this.status = 'playing';
        emit('state', { playing: true });
        emit('status', { status: 'playing' });
      } catch (e) {
        if (this._reqId !== reqId) return;
        return this.handlePlaybackFallback(this.mode, e);
      }
    },

    async handlePlaybackFallback(failedProvider, error) {
      if (!this.track) return;
      this._failedSources = this._failedSources || new Set();
      this._failedSources.add(failedProvider);

      const sources = Array.isArray(this.track.sources) ? this.track.sources : [];
      // Find the next available untried source
      const nextSource = sources.find(s => !this._failedSources.has(s.provider) && s.provider !== failedProvider);

      if (nextSource) {
        console.log(`[Playback Coordinator] Falling back from ${failedProvider} to ${nextSource.provider} (${nextSource.playbackMode})`);
        this.status = 'fallback';
        emit('status', { status: 'fallback' });
        emit('fallback', {
          track: this.track,
          from: failedProvider,
          to: nextSource.provider,
          playbackMode: nextSource.playbackMode,
          reason: error?.message || 'playback_error'
        });

        // Switch to next source
        this.track.activeSource = nextSource.provider;
        this.track.playbackProvider = nextSource.provider;
        this.track.playbackMode = nextSource.playbackMode || (nextSource.mode === 'embed' ? 'OFFICIAL_EMBED' : (nextSource.mode === 'preview' ? 'PREVIEW' : 'FULL'));
        this.track.playbackType = nextSource.mode || (nextSource.provider === 'youtube' ? 'embed' : (nextSource.provider === 'apple' ? 'preview' : 'full'));
        if (nextSource.provider === 'youtube') {
          this.track.youtubeVideoId = nextSource.videoId || nextSource.id;
          this.track.youtubeId = nextSource.videoId || nextSource.id;
        } else if (nextSource.url || nextSource.audioUrl || nextSource.previewUrl) {
          const streamUrl = nextSource.url || nextSource.audioUrl || nextSource.previewUrl;
          this.track.src = streamUrl;
          this.track.preview = streamUrl;
          this.track.previewUrl = streamUrl;
        }

        this.load(this.track);
        return this.play();
      }

      // If no alternative in sources, but track.preview exists and wasn't tried yet:
      if (failedProvider !== 'apple-preview' && this.track.preview && !this._failedSources.has('apple-preview')) {
        this._failedSources.add('apple-preview');
        this.status = 'fallback';
        emit('status', { status: 'fallback' });
        emit('fallback', {
          track: this.track,
          from: failedProvider,
          to: 'apple-preview',
          playbackMode: 'PREVIEW',
          reason: error?.message || 'fallback_preview'
        });
        this.mode = 'stream';
        this.url = this.track.preview;
        this.el.src = this.url;
        this.el.load();
        try {
          await this.el.play();
          this.playing = true;
          this.status = 'playing';
          emit('state', { playing: true });
          emit('status', { status: 'playing' });
          return;
        } catch (e2) {}
      }

      // All options exhausted
      this.playing = false;
      this.status = 'error';
      emit('state', { playing: false });
      emit('status', { status: 'error' });
      const errCode = failedProvider === 'spotify' ? 'spotify_playback_failed' : 'all_sources_failed';
      emit('error', { code: errCode, provider: failedProvider });
    },

    switchSource(targetProviderId) {
      if (!this.track) return false;
      const sources = Array.isArray(this.track.sources) ? this.track.sources : [];
      const chosen = sources.find(s => s.provider === targetProviderId);
      if (!chosen) return false;
      this.track.activeSource = chosen.provider;
      this.track.playbackMode = chosen.playbackMode || (chosen.mode === 'embed' ? 'OFFICIAL_EMBED' : (chosen.mode === 'preview' ? 'PREVIEW' : 'FULL'));
      this.track.playbackType = chosen.mode || (chosen.provider === 'youtube' ? 'embed' : (chosen.provider === 'apple' ? 'preview' : 'full'));
      this.track.playbackProvider = chosen.provider;
      this.track.isFullTrack = chosen.isFullTrack !== false && chosen.mode !== 'preview';
      this.track.playableDuration = chosen.duration;
      if (chosen.provider === 'youtube') {
        this.track.youtubeVideoId = chosen.videoId || chosen.id;
        this.track.youtubeId = chosen.videoId || chosen.id;
      } else if (chosen.url || chosen.audioUrl || chosen.previewUrl) {
        const streamUrl = chosen.url || chosen.audioUrl || chosen.previewUrl;
        this.track.src = streamUrl;
        this.track.preview = streamUrl;
        this.track.previewUrl = streamUrl;
      }
      const wasPlaying = this.playing;
      this.load(this.track);
      if (wasPlaying) {
        this.play().catch(() => {});
      }
      emit('source-changed', { track: this.track, activeSource: chosen.provider });
      return true;
    },

    _stopVirtualTimer() {},
    _startVirtualTimer() {},

    pause() {
      if (this.mode === 'youtube') {
        ytDriver.pause();
      } else if (this.mode === 'spotify') {
        try { spotifyPause(); } catch (e) {}
      } else {
        try { this.el.pause(); } catch (e) {}
      }
      this.playing = false;
      this.status = 'paused';
      emit('state', { playing: false });
      emit('status', { status: 'paused' });
    },

    pauseAtEnd() {
      this._reqId++;
      if (this.mode === 'youtube') {
        ytDriver.pause();
      } else if (this.mode === 'spotify') {
        try { spotifyPause(); } catch (e) {}
      } else {
        try { this.el.pause(); } catch (e) {}
      }
      this.playing = false;
      this.status = 'ended';
      const dur = this.getDuration();
      emit('state', { playing: false });
      emit('status', { status: 'ended' });
      emit('tick', { pos: dur, duration: dur });
    },

    toggle() {
      if (this.playing) {
        this.pause();
      } else {
        if (this.mode === 'youtube') {
          ytDriver.resume();
        } else if (this.mode === 'spotify' && this.status === 'paused' && this._spotifyPlayer) {
          spotifyResume().catch(() => {
            this.play();
          });
        } else {
          this.play();
        }
      }
    },

    seek(sec) {
      const dur = this.getDuration();
      if (!dur || dur <= 0) return;
      const target = clamp(Number(sec) || 0, 0, Math.max(0, dur - 0.05));

      if (this.status === 'ended') {
        this.status = 'paused';
      }

      if (this.mode === 'youtube') {
        ytDriver.seek(target);
      } else if (this.mode === 'spotify') {
        this._spotifyPos = target;
        try {
          spotifySeek(target).catch(() => {});
        } catch (e) {}
      } else {
        try { this.el.currentTime = target; } catch (e) {}
      }
      emit('tick', { pos: target, duration: dur });
    },

    getPosition() {
      if (this.status === 'ended') {
        return this.getDuration();
      }
      if (this.mode === 'youtube') {
        return ytDriver.getTime();
      }
      if (this.mode === 'spotify') {
        return this._spotifyPos || 0;
      }
      const pos = this.el ? this.el.currentTime : 0;
      return Number.isFinite(pos) ? pos : 0;
    },

    getDuration() {
      if (!this.track) return 0;
      if (this.mode === 'unavailable' || this.track.playbackType === 'unavailable' || this.track.playbackMode === 'UNAVAILABLE') {
        return 0;
      }

      // If YouTube mode
      if (this.mode === 'youtube') {
        const ytDur = ytDriver.getDuration();
        if (Number.isFinite(ytDur) && ytDur > 0) return ytDur;
        const d = Number(this.track.duration || this.track.fullDuration || this.track.catalogDuration);
        return (Number.isFinite(d) && d > 0) ? d : 0;
      }

      // If Spotify mode
      if (this.mode === 'spotify' || (this.track.playbackProvider === 'spotify' && this.track.playbackType === 'full')) {
        if (this._spotifyDur && Number.isFinite(this._spotifyDur) && this._spotifyDur > 0) {
          return this._spotifyDur;
        }
        const d = Number(this.track.duration || this.track.fullDuration);
        return Number.isFinite(d) && d > 0 ? d : 0;
      }

      // If local file
      if (this.track.source === 'file' || this.track.playbackType === 'local') {
        if (this.el && Number.isFinite(this.el.duration) && this.el.duration > 0) {
          return this.el.duration;
        }
        const d = Number(this.track.duration);
        return Number.isFinite(d) && d > 0 ? d : 0;
      }

      // If Jamendo or Archive full stream
      if (this.mode === 'jamendo' || this.mode === 'archive' || this.track.playbackMode === 'FULL') {
        if (this.el && Number.isFinite(this.el.duration) && this.el.duration > 0) {
          return this.el.duration;
        }
        const d = Number(this.track.duration || this.track.fullDuration);
        return Number.isFinite(d) && d > 0 ? d : 0;
      }

      // If preview mode (Apple Music)
      if (this.track.playbackMode === 'PREVIEW' || this.track.playbackType === 'preview' || this.track.isAudioPreview || this.track.preview) {
        if (this.el && Number.isFinite(this.el.duration) && this.el.duration > 0) {
          return this.el.duration;
        }
        if (this.track.previewDuration && Number.isFinite(Number(this.track.previewDuration))) {
          return Number(this.track.previewDuration);
        }
        return 30;
      }

      const d = Number(this.track.duration);
      return Number.isFinite(d) && d > 0 ? d : 0;
    },

    getFullDuration() {
      const d = Number(this.track?.fullDuration || this.track?.duration);
      return Number.isFinite(d) && d > 0 ? d : (this.isAudioPreview() ? 30 : 0);
    },

    isAudioPreview() {
      return Boolean(this.track && (this.track.source !== 'file' && (this.track.playbackMode === 'PREVIEW' || this.track.preview || this.track.playbackType === 'preview')) && !this.track.isFullTrack);
    },

    isFullTrack() {
      return Boolean(this.track && (this.track.source === 'file' || this.track.playbackType === 'full' || this.track.playbackMode === 'FULL' || this.track.playbackMode === 'OFFICIAL_EMBED' || this.track.isFullTrack));
    },

    stop(silent) {
      this._reqId++;
      this.stopDrivers();
      this._vPos = 0;
      this.pause();
      try { this.el.currentTime = 0; } catch (e) {}
      this._spotifyPos = 0;
      this.status = 'idle';
      if (!silent) {
        emit('state', { playing: false });
        emit('status', { status: 'idle' });
        emit('tick', { pos: 0, duration: this.getDuration() });
      }
    },

    ensure() {
      if (!this.el) this.init();
    },

    levels() {
      return new Float32Array(24).fill(0.5);
    },

    setVolume() {
      const vol = clamp(state.volume, 0, 100);
      if (this.el) {
        this.el.volume = state.muted ? 0 : vol / 100;
      }
      ytDriver.setVolume(state.muted ? 0 : vol);
    },

    activeBlobUrls: new Set(),

    revokeLocalUrls() {
      this.activeBlobUrls.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch (e) {}
      });
      this.activeBlobUrls.clear();
    },

    loadFiles(fileList) {
      const files = Array.from(fileList || []).filter((f) => /^audio\//.test(f.type) || /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(f.name));
      const made = [];
      files.forEach((file) => {
        const name = file.name.replace(/\.[^.]+$/, '').slice(0, 80);
        const url = URL.createObjectURL(file);
        this.activeBlobUrls.add(url);
        const tr = {
          id: uid('local'),
          source: 'file',
          playbackType: 'local',
          playbackMode: 'FULL',
          playbackProvider: 'local',
          activeSource: 'local',
          isFullTrack: true,
          isPreview: false,
          requiresAuthentication: false,
          availability: 'available',
          genre: 'local',
          year: new Date().getFullYear(),
          duration: 0,
          fullDuration: 0,
          catalogDuration: 0,
          previewDuration: null,
          playableDuration: 0,
          title: { ar: name, en: name },
          artist: { ar: 'ملف من جهازك', en: 'From your device' },
          album: { ar: 'ملفات محلية', en: 'Local files' },
          colors: ['#0A0F1E', '#1C3D6E', '#6FB7E8'],
          motif: 'dots',
          photo: PHOTO.studio,
          art: '',
          url,
          sources: [
            {
              provider: 'local',
              providerName: 'ملف محلي',
              label: 'ملف من جهازك (تشغيل كامل)',
              playbackMode: 'FULL',
              isFullTrack: true,
              duration: 0,
              url
            }
          ]
        };
        TRACKS.unshift(tr);
        made.push(tr);
      });
      return made;
    }
  };
  engine.init();

  function getAlbums() {
    const map = new Map();
    TRACKS.forEach((tr) => {
      const name = tr.album ? (tr.album.ar || tr.album.en) : null;
      if (!name) return;
      const key = norm(name);
      if (!map.has(key)) {
        map.set(key, {
          id: 'alb_' + key.replace(/[^a-z0-9]/gi, '_'),
          name: tr.album,
          artist: tr.artist,
          year: tr.year || null,
          art: tr.art,
          colors: tr.colors || ['#1B1F26', '#2A2F3A', '#6C7683'],
          motif: tr.motif || 'rings',
          tracks: []
        });
      }
      map.get(key).tracks.push(tr);
    });
    return Array.from(map.values());
  }

  function getArtistTracks(artistName) {
    if (!artistName) return [];
    const n = norm(artistName);
    return TRACKS.filter((tr) => {
      const ar = norm(tr.artist?.ar || '');
      const en = norm(tr.artist?.en || '');
      return ar.includes(n) || en.includes(n) || n.includes(ar) || n.includes(en);
    });
  }

  function getArtistAlbums(artistName) {
    const tracks = getArtistTracks(artistName);
    const map = new Map();
    tracks.forEach((tr) => {
      const name = tr.album ? (tr.album.ar || tr.album.en) : null;
      if (!name) return;
      const key = norm(name);
      if (!map.has(key)) {
        map.set(key, {
          id: 'alb_' + key.replace(/[^a-z0-9]/gi, '_'),
          name: tr.album,
          artist: tr.artist,
          year: tr.year || null,
          art: tr.art,
          colors: tr.colors || ['#1B1F26', '#2A2F3A', '#6C7683'],
          motif: tr.motif || 'rings',
          tracks: []
        });
      }
      map.get(key).tracks.push(tr);
    });
    return Array.from(map.values());
  }

  function getAlbumTracks(albumName) {
    if (!albumName) return [];
    const n = norm(albumName);
    return TRACKS.filter((tr) => {
      const ar = norm(tr.album?.ar || '');
      const en = norm(tr.album?.en || '');
      return ar.includes(n) || en.includes(n) || n.includes(ar) || n.includes(en);
    });
  }

  return {
    $, $$, clamp, esc, fmt, formatDuration, formatPosition, uid, norm, clampText,
    I18N, GENRES, THEMES, ACCENTS, TRACKS, ARTISTS, SEED_PLAYLISTS,
    state, save, reset, loadState, cleanSavedIds, applyTheme, applyI18n, t, byLang, genreLabel, getTrack, getPlayableDuration,
    getAlbums, getArtistTracks, getArtistAlbums, getAlbumTracks,
    normalizeSearchText, tokenize, levenshteinDistance, scoreTrack, trackMatches, findMatchedLyric, searchTracks, searchArtists, searchAlbums, searchOnline, fetchArtistTracks, fetchLyricsOnline,
    coverHTML, artStyle, paintCover,
    PLAYBACK_MODES, ENGINE_STATES, musicProviders, ytDriver, loadYouTubeIframeAPI: () => ytDriver.loadAPI(),
    loadSpotifySDK, initializeSpotifyPlayer, playSpotifyTrack, spotifySeek, spotifyPause, spotifyResume, resolvePlaybackSource,
    bus, emit, engine, providers, STORAGE_KEY
  };
})();
