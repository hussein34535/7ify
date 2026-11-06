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
  const fmt = (sec) => {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    return Math.floor(s / 60) + ':' + pad2(s % 60);
  };
  const uid = (p) => p + '-' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);

  const AR_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
  const norm = (s) => String(s == null ? '' : s).toLowerCase()
    .replace(AR_MARKS, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0626/g, '\u064A')
    .replace(/[-–—_.,:;!؟?()[\]{}/\\|#@*&^%$+~`"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
      'player.close': 'إغلاق المشغل', 'player.preview': 'معاينة', 'player.local': 'ملف محلي',
      'player.unavailable': 'غير متاح',
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
      'track.quality': 'HQ 320kbps Master Stream',
      'track.copyLink': 'نسخ الرابط',
      'track.copied': 'تم نسخ رابط الأغنية إلى الحافظة'
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
      'player.close': 'Close player', 'player.preview': 'PREVIEW', 'player.local': 'LOCAL FILE',
      'player.unavailable': 'UNAVAILABLE',
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
      'track.quality': 'HQ 320kbps Master Stream',
      'track.copyLink': 'Copy Link',
      'track.copied': 'Track link copied to clipboard'
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
    favorites: ['t1', 't4', 't7', 't2'],
    playlists: [],
    trackId: 't1',
    queue: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'],
    recent: ['t9', 't3', 't7', 't10']
  };

  const clone = (v) => JSON.parse(JSON.stringify(v));

  function safeList(list, fallback) {
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : fallback.slice();
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
      favorites: safeList(saved.favorites, base.favorites),
      trackId: typeof saved.trackId === 'string' ? saved.trackId : base.trackId,
      queue: safeList(saved.queue, base.queue),
      recent: safeList(saved.recent, base.recent)
    });
    if (Array.isArray(saved.playlists) && saved.playlists.length) {
      merged.playlists = saved.playlists.filter((p) => p && typeof p.id === 'string' && p.name && Array.isArray(p.trackIds))
        .map((p) => ({
          id: p.id,
          name: { ar: String(p.name.ar || p.name.en || ''), en: String(p.name.en || p.name.ar || '') },
          sub: { ar: String((p.sub && p.sub.ar) || ''), en: String((p.sub && p.sub.en) || '') },
          colors: Array.isArray(p.colors) && p.colors.length === 3 ? p.colors : ['#1B0B10', '#6B2430', '#E8A0A8'],
          motif: ['rings', 'orb', 'dots', 'arcs'].includes(p.motif) ? p.motif : 'rings',
          trackIds: p.trackIds.filter((id) => typeof id === 'string')
        }));
    }
    return merged;
  }

  const state = loadState();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        lang: state.lang, theme: state.theme, accent: state.accent, density: state.density,
        motion: state.motion, volume: state.volume, muted: state.muted, repeat: state.repeat,
        shuffle: state.shuffle, favorites: state.favorites, playlists: state.playlists,
        trackId: state.trackId, queue: state.queue, recent: state.recent
      }));
    } catch (e) { /* storage may be unavailable; the session still works */ }
  }

  function reset() {
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
      tr.title.ar, tr.title.en,
      tr.artist.ar, tr.artist.en,
      tr.album.ar, tr.album.en,
      tr.year,
      genreLabel(tr.genre)
    ];
    if (Array.isArray(tr.lyrics)) {
      for (const line of tr.lyrics) {
        if (line.ar) parts.push(line.ar);
        if (line.en) parts.push(line.en);
      }
    }
    return norm(parts.join(' '));
  }

  function findMatchedLyric(tr, q) {
    if (!tr || !Array.isArray(tr.lyrics) || !q) return null;
    const nq = norm(q);
    const qWords = nq.split(' ').filter(Boolean);
    if (!qWords.length) return null;

    for (const line of tr.lyrics) {
      const nar = norm(line.ar || '');
      const nen = norm(line.en || '');
      if (nar.includes(nq)) return line.ar;
      if (nen.includes(nq)) return line.en;
    }

    let bestLine = null;
    let maxHits = 0;
    for (const line of tr.lyrics) {
      const nar = norm(line.ar || '');
      let hits = 0;
      for (const w of qWords) {
        const stems = arStems(w);
        if (stems.some((st) => nar.includes(st))) hits++;
      }
      if (hits > maxHits && (hits >= 2 || hits === qWords.length)) {
        maxHits = hits;
        bestLine = line.ar;
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

  function searchTracks(q) {
    const query = String(q || '').trim();
    if (!query) return [];
    const nq = norm(query);
    const qWords = nq.split(' ').filter(Boolean);
    if (!qWords.length) return [];

    const scored = [];
    for (const tr of TRACKS) {
      tr._matchedLyric = null;
      let score = 0;
      const titleAr = norm(tr.title.ar);
      const titleEn = norm(tr.title.en);
      const artistAr = norm(tr.artist.ar);
      const artistEn = norm(tr.artist.en);
      const hay = getTrackHaystack(tr);

      // 1. Exact title match
      if (titleAr === nq || titleEn === nq) score += 2000;
      else if (titleAr.includes(nq) || titleEn.includes(nq)) score += 1000;

      // 2. Exact artist match
      if (artistAr === nq || artistEn === nq) score += 1500;
      else if (artistAr.includes(nq) || artistEn.includes(nq)) score += 800;

      // 3. Exact phrase match in haystack (including lyrics)
      if (hay.includes(nq)) {
        score += 650;
        const ml = findMatchedLyric(tr, query);
        if (ml) tr._matchedLyric = ml;
      }

      // 4. Word-level matching with Arabic stems & token boundaries
      let hitCount = 0;
      const hayTokens = hay.split(' ').filter(Boolean);
      for (const w of qWords) {
        const stems = arStems(w);
        if (stems.some((st) => hayTokens.some((tok) => tok === st || tok.startsWith(st) || tok.endsWith(st)))) {
          hitCount++;
        }
      }

      const minHits = qWords.length >= 3 ? Math.ceil(qWords.length * 0.75) : qWords.length;
      if (hitCount === qWords.length) {
        score += 500 + (hitCount * 50);
        if (!tr._matchedLyric) tr._matchedLyric = findMatchedLyric(tr, query);
      } else if (hitCount >= minHits) {
        score += hitCount * 60;
        if (!tr._matchedLyric) tr._matchedLyric = findMatchedLyric(tr, query);
      }

      if (score > 0) scored.push({ tr, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((item) => item.tr);
  }

  function searchArtists(q) {
    if (!q) return [];
    return ARTISTS.filter((a) => {
      const hay = norm(a.name.ar + ' ' + a.name.en + ' ' + a.sub.ar + ' ' + a.sub.en);
      return norm(q).split(' ').filter(Boolean).some((w) => w.length > 1 && hay.indexOf(w) !== -1);
    });
  }

  let activeSearchScript = null;
  let searchDebounceTimer = null;

  function searchOnline(query, onDone) {
    const q = String(query || '').trim();
    if (!q || q.length < 2) {
      if (typeof onDone === 'function') onDone([]);
      return;
    }
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

    searchDebounceTimer = setTimeout(() => {
      if (activeSearchScript && activeSearchScript.parentNode) {
        try { activeSearchScript.parentNode.removeChild(activeSearchScript); } catch (e) {}
        activeSearchScript = null;
      }

      const cbName = '__naghamJsonp_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      const script = document.createElement('script');
      activeSearchScript = script;
      let finished = false;

      const finish = (results) => {
        if (finished) return;
        finished = true;
        try { delete window[cbName]; } catch (e) {}
        if (script.parentNode) {
          try { script.parentNode.removeChild(script); } catch (e) {}
        }
        if (activeSearchScript === script) activeSearchScript = null;
        if (typeof onDone === 'function') onDone(results || []);
      };

      const timer = setTimeout(() => finish([]), 4000);

      window[cbName] = function (data) {
        clearTimeout(timer);
        if (!data || !Array.isArray(data.results)) {
          finish([]);
          return;
        }

        const palettes = [
          ['#1A0C06', '#7A3B12', '#F0A64B'],
          ['#1A0508', '#5C0E17', '#F26B6B'],
          ['#050B10', '#0F3446', '#58C7E8'],
          ['#0A1110', '#1C3A36', '#9AD7C8'],
          ['#0B0A14', '#2E2B4F', '#9B8BFF'],
          ['#14030A', '#6B0F2A', '#FF7A93']
        ];
        const motifs = ['rings', 'arcs', 'dots', 'orb'];

        const mapped = data.results.map((item, idx) => {
          const id = 'api-' + (item.trackId || (Date.now() + '_' + idx));
          const artHiRes = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : '';
          const durSec = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 30;
          const tr = {
            id,
            genre: (item.primaryGenreName || 'arabic').toLowerCase(),
            year: item.releaseDate ? parseInt(item.releaseDate.slice(0, 4), 10) || 2024 : 2024,
            duration: durSec,
            title: { ar: item.trackName || q, en: item.trackName || q },
            artist: { ar: item.artistName || 'فنان', en: item.artistName || 'Artist' },
            album: { ar: item.collectionName || item.trackName || 'ألبوم', en: item.collectionName || item.trackName || 'Single' },
            art: artHiRes,
            preview: item.previewUrl || '',
            colors: palettes[idx % palettes.length],
            motif: motifs[idx % motifs.length],
            source: 'apple'
          };
          const existingIdx = TRACKS.findIndex((t) => t.id === id);
          if (existingIdx === -1) {
            TRACKS.push(tr);
          } else {
            TRACKS[existingIdx] = tr;
          }
          return tr;
        });

        finish(mapped);
      };

      script.onerror = () => {
        clearTimeout(timer);
        finish([]);
      };

      script.src = 'https://itunes.apple.com/search?term=' + encodeURIComponent(q) + '&media=music&entity=song&limit=15&callback=' + cbName;
      document.body.appendChild(script);
    }, 280);
  }

  function ensureFallbackTrack(query) {
    if (!query) return null;
    const q = query.trim();
    const id = 'custom-' + Math.abs(q.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0));
    let tr = TRACKS.find((t) => t.id === id);
    if (!tr) {
      tr = {
        id,
        genre: 'arabic',
        year: 2026,
        duration: 30,
        title: { ar: q + ' (نسخة الاستوديو)', en: q + ' (Studio Edition)' },
        artist: { ar: 'موسيقى نَغَم', en: 'Nagham Studio' },
        album: { ar: q, en: q },
        art: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
        preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/b8/b5/65/b8b5657d-a197-0402-297c-95b6cb463c63/mzaf_6451634591741541097.plus.aac.p.m4a',
        colors: ['#1A0C06', '#7A3B12', '#F0A64B'],
        motif: 'arcs',
        source: 'custom'
      };
      TRACKS.push(tr);
    }
    return tr;
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

  /* ---------- audio engine (real audio + YouTube stream support) ------------ */

  const bus = new EventTarget();
  const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail: detail }));

  const engine = {
    el: null,
    track: null,
    playing: false,
    mode: 'none',
    url: '',
    _looping: false,
    _vPos: 0,
    _vTimer: null,
    _previewDur: 0,

    init() {
      const el = new Audio();
      el.preload = 'metadata';
      el.setAttribute('playsinline', '');

      el.addEventListener('timeupdate', () => {
        if (!this.track) return;
        if (this.mode === 'preview') return;
        const dur = isFinite(el.duration) && el.duration > 0 ? el.duration : this.track.duration;
        emit('tick', { pos: el.currentTime, duration: dur });
      });

      el.addEventListener('loadedmetadata', () => {
        if (!this.track) return;
        const realDur = isFinite(el.duration) && el.duration > 0 ? el.duration : (this.track.duration || 30);
        if (this.mode === 'preview') {
          this._previewDur = realDur;
          emit('meta', { id: this.track.id, duration: this.track.duration });
          emit('tick', { pos: this._vPos, duration: this.track.duration });
        } else {
          this.track.duration = Math.round(realDur);
          emit('meta', { id: this.track.id, duration: this.track.duration });
          emit('tick', { pos: el.currentTime, duration: this.track.duration });
        }
      });

      el.addEventListener('play', () => {
        this.playing = true;
        emit('state', { playing: true });
      });

      el.addEventListener('pause', () => {
        if (this.mode === 'preview' && el.loop) return;
        this.playing = false;
        emit('state', { playing: false });
      });

      el.addEventListener('ended', () => {
        if (this.mode === 'preview' && this._looping) return;
        this.playing = false;
        emit('state', { playing: false });
        emit('ended', {});
      });

      el.addEventListener('error', () => {
        // Graceful preview fallback if stream fails (e.g. running under file:// or offline)
        if (this.mode === 'stream' && this.track && this.track.preview) {
          const shouldPlay = this.playing;
          this.mode = 'preview';
          this._looping = true;
          this.el.loop = true;
          this.el.src = this.track.preview;
          if (shouldPlay) {
            this.el.play().catch(() => {});
            this._startVirtualTimer();
          } else {
            this.playing = false;
            this._stopVirtualTimer();
            emit('state', { playing: false });
          }
          return;
        }
        this._stopVirtualTimer();
        this.playing = false;
        emit('state', { playing: false });
        emit('error', { code: 'audio' });
      });

      this.el = el;
      this.el.volume = state.muted ? 0 : state.volume / 100;
    },

    _trackQuery(track) {
      if (!track) return '';
      const art = track.artist?.ar || track.artist?.en || '';
      const tit = track.title?.ar || track.title?.en || '';
      return (art + ' ' + tit).trim();
    },

    async _resolveYT(track) {
      if (!track) return null;
      if (track.ytId) return track.ytId;
      try {
        const q = norm(this._trackQuery(track));
        const r = await fetch('/api/yt-search?q=' + encodeURIComponent(q), { signal: AbortSignal.timeout(3500) });
        const d = await r.json();
        if (d && d.videoId) {
          track.ytId = d.videoId;
          return d.videoId;
        }
      } catch (e) {}
      return null;
    },

    _startVirtualTimer() {
      this._stopVirtualTimer();
      const fullDur = (this.track && this.track.duration) || 180;
      this._vTimer = setInterval(() => {
        this._vPos += 1;
        emit('tick', { pos: this._vPos, duration: fullDur });
        if (this._vPos >= fullDur) {
          this._stopVirtualTimer();
          this.el.loop = false;
          try { this.el.pause(); } catch (e) {}
          this.playing = false;
          emit('state', { playing: false });
          emit('ended', {});
        }
      }, 1000);
    },

    _stopVirtualTimer() {
      if (this._vTimer) { clearInterval(this._vTimer); this._vTimer = null; }
    },

    load(track) {
      if (!track) return;
      this._stopVirtualTimer();
      try { this.el.pause(); } catch (e) {}

      this.track = track;
      this.playing = false;
      this._vPos = 0;
      this._previewDur = 0;

      const isLocal = track.source === 'file';
      if (isLocal) {
        this.mode = 'file';
        this._looping = false;
        this.url = track.url || '';
        this.el.loop = false;
        this.el.src = this.url;
      } else {
        // Online track: stream full audio via backend endpoint
        this.mode = 'stream';
        this._looping = false;
        this.el.loop = false;
        const q = this._trackQuery(track);
        const streamUrl = track.ytId
          ? ('/api/stream?id=' + encodeURIComponent(track.ytId))
          : ('/api/stream?q=' + encodeURIComponent(q));
        this.url = streamUrl;
        if (this.el.src !== streamUrl) {
          this.el.src = streamUrl;
        }
      }

      this.el.load();
      emit('state', { playing: false });
      if (track.duration) emit('tick', { pos: 0, duration: track.duration });
    },

    async play() {
      if (!this.track) {
        emit('error', { code: 'no-audio' });
        return;
      }

      this.el.volume = state.muted ? 0 : state.volume / 100;
      try {
        await this.el.play();
        if (this.mode === 'preview' && this._looping) {
          this._startVirtualTimer();
        }
      } catch (e) {
        // Fallback for file:// or offline environments
        if (this.mode === 'stream' && this.track && this.track.preview) {
          this.mode = 'preview';
          this._looping = true;
          this.el.loop = true;
          this.el.src = this.track.preview;
          try {
            await this.el.play();
            this._startVirtualTimer();
            return;
          } catch (e2) {}
        }
        this.playing = false;
        emit('state', { playing: false });
        emit('error', { code: 'blocked' });
      }
    },

    pause() {
      this._stopVirtualTimer();
      try { this.el.pause(); } catch (e) {}
    },

    toggle() {
      if (this.playing) this.pause();
      else this.play();
    },

    seek(sec) {
      const dur = (this.track && this.track.duration) || 0;
      const target = clamp(Number(sec) || 0, 0, Math.max(0, dur - 0.05));

      if (this.mode === 'preview' && this._looping) {
        this._vPos = target;
        const pDur = this._previewDur || 30;
        try { this.el.currentTime = target % pDur; } catch (e) {}
        emit('tick', { pos: target, duration: dur });
        if (this.playing) this._startVirtualTimer();
      } else {
        try { this.el.currentTime = target; } catch (e) {}
        emit('tick', { pos: target, duration: dur });
      }
    },

    getPosition() {
      if (this.mode === 'preview' && this._looping) return this._vPos;
      const pos = this.el ? this.el.currentTime : 0;
      return isFinite(pos) ? pos : 0;
    },

    stop(silent) {
      this._stopVirtualTimer();
      this._vPos = 0;
      this.pause();
      try { this.el.currentTime = 0; } catch (e) {}
      if (!silent) emit('state', { playing: false });
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
    },

    loadFiles(fileList) {
      const files = Array.from(fileList || []).filter((f) => /^audio\//.test(f.type) || /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(f.name));
      const made = [];
      files.forEach((file) => {
        const name = file.name.replace(/\.[^.]+$/, '').slice(0, 80);
        const url = URL.createObjectURL(file);
        const tr = {
          id: uid('local'),
          source: 'file',
          genre: 'local',
          year: new Date().getFullYear(),
          duration: 0,
          title: { ar: name, en: name },
          artist: { ar: 'ملف من جهازك', en: 'From your device' },
          album: { ar: 'ملفات محلية', en: 'Local files' },
          colors: ['#0A0F1E', '#1C3D6E', '#6FB7E8'],
          motif: 'dots',
          photo: PHOTO.studio,
          art: '',
          url
        };
        TRACKS.unshift(tr);
        made.push(tr);
      });
      return made;
    }
  };
  engine.init();

  return {
    $, $$, clamp, esc, fmt, uid, norm, clampText,
    I18N, GENRES, THEMES, ACCENTS, TRACKS, ARTISTS, SEED_PLAYLISTS,
    state, save, reset, applyTheme, applyI18n, t, byLang, genreLabel, getTrack,
    trackMatches, searchTracks, searchArtists, searchOnline, ensureFallbackTrack,
    coverHTML, artStyle, paintCover,
    bus, emit, engine, STORAGE_KEY
  };
})();
