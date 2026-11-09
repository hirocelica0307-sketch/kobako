// わくの いちらん（絵は assets/frames/<id>/ に ある。大きさは assets/frames/sizes.js）
// fine: 絵が こまかいので 小さい 面（12面・16面）では つぶれやすい
window.SEASONS = [
  ['all', 'ぜんぶ'],
  ['haru', 'はる'],
  ['natsu', 'なつ'],
  ['aki', 'あき'],
  ['fuyu', 'ふゆ'],
  ['kengaku', 'ぎょうじ・見学'],
  ['tsuunen', '通年'],
];

// rich: にぎやかな わく（assets/frames/rich/<src>-tate・yoko・kaku.svg を まるごと つかう）
window.FRAMES = [
  { id: 'haru-sakura-r', src: 'haru-sakura', rich: true, name: 'さくらと 小鳥', season: 'haru', fine: true },
  { id: 'natsu-asagao-r', src: 'natsu-asagao', rich: true, name: 'あさがおと じょうろ', season: 'natsu', fine: true },
  { id: 'natsu-himawari-r', src: 'natsu-himawari', rich: true, name: 'ひまわりと むぎわらぼうし', season: 'natsu', fine: true },
  { id: 'aki-momiji-r', src: 'aki-momiji', rich: true, name: 'もみじと とんぼ', season: 'aki', fine: true },
  { id: 'aki-donguri-r', src: 'aki-donguri', rich: true, name: 'どんぐりと リス', season: 'aki', fine: true },
  { id: 'fuyu-yuki-r', src: 'fuyu-yuki', rich: true, name: 'ゆきと ゆきだるま', season: 'fuyu', fine: true },
  { id: 'kengaku-norimono-r', src: 'kengaku-norimono', rich: true, name: 'のりものと しょうぼうしょ', season: 'kengaku', fine: true },
  { id: 'kengaku-hatake-r', src: 'kengaku-hatake', rich: true, name: 'やさいと かご', season: 'kengaku', fine: true },
  { id: 'haru-sakura', name: 'さくら', season: 'haru' },
  { id: 'natsu-asagao', name: 'あさがお', season: 'natsu' },
  { id: 'natsu-himawari', name: 'ひまわり', season: 'natsu', fine: true },
  { id: 'aki-momiji', name: 'もみじ', season: 'aki' },
  { id: 'aki-donguri', name: 'どんぐり', season: 'aki', fine: true },
  { id: 'fuyu-yuki', name: 'ゆき', season: 'fuyu' },
  { id: 'kengaku-norimono', name: 'のりもの', season: 'kengaku', fine: true },
  { id: 'kengaku-hatake', name: 'やさい', season: 'kengaku', fine: true },
  { id: 'tsuunen-hoshi', name: 'ほし', season: 'tsuunen' },
  { id: 'tsuunen-heart', name: 'ハート', season: 'tsuunen' },
];
