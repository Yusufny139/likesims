// ---------------------------------------------------------------------------
// LikeSims — oyun verisi
// ---------------------------------------------------------------------------

export const NEEDS = {
  hunger:  { label: 'Açlık',   icon: '🍽️', color: '#e97b48', decay: 0.100 },
  energy:  { label: 'Enerji',  icon: '⚡',  color: '#f2c14e', decay: 0.085 },
  bladder: { label: 'Mesane',  icon: '🚽',  color: '#6fa8dc', decay: 0.110 },
  hygiene: { label: 'Hijyen',  icon: '🚿',  color: '#64b5c8', decay: 0.050 },
  fun:     { label: 'Eğlence', icon: '🎈',  color: '#a97bd6', decay: 0.070 },
  social:  { label: 'Sosyal',  icon: '💬',  color: '#e879a6', decay: 0.060 },
};

export const NEED_KEYS = Object.keys(NEEDS);

export const SIMS = [
  {
    id: 'ferhanim',
    name: 'Ferhanım',
    short: 'F',
    color: '#e58a6f',
    skin: '#f2c9a8',
    hair: '#4a2c22',
    hairStyle: 'long',
    top: '#7fa892',
    topAccent: '#f3e7d3',
    bottom: '#c9775a',
    shoes: '#e8dcc7',
    traits: ['Gurme', 'Neşeli', 'Düzenli'],
    traitsIcon: ['🍳', '😄', '🧹'],
    voice: 392,
    likes: 'Yemek yapmak ve düzenli bir ev',
    intro: 'Mutfağın hakimi. Kahvesini içmeden konuşmaz.',
  },
  {
    id: 'yusuf',
    name: 'Yusuf Niyazi',
    short: 'Y',
    color: '#6d9bbf',
    skin: '#e8b98f',
    hair: '#2a211d',
    hairStyle: 'short',
    top: '#41657f',
    topAccent: '#c9d6dd',
    bottom: '#4c4e58',
    shoes: '#d9cdb8',
    traits: ['Romantik', 'Espri sever', 'Tembel'],
    traitsIcon: ['💘', '😆', '😴'],
    voice: 294,
    likes: 'Yıldızlar, eski plaklar ve uzun uyku',
    intro: 'Kalbi yumuşak, kahveyi Ferhanım yapar.',
  },
];

// --- Mobilya kataloğu ------------------------------------------------------
// Her mobilya türü: etiket, ikon ve etkileşim listesi.
export const FURNITURE = {
  sofa: {
    label: 'Kanepe', icon: '🛋️',
    interactions: [
      { id: 'sofa_relax', label: 'Uzanıp dinlen', icon: '😌', dur: 40, anim: 'sit', pose: 'sit',
        effects: { energy: 14, fun: 16, social: 4 } },
      { id: 'sofa_nap', label: 'Şekerleme yap', icon: '💤', dur: 100, anim: 'sleep', pose: 'sit',
        effects: { energy: 34, fun: 4 }, moodlet: { label: 'Güzel bir şekerleme', icon: '💤', mood: 8, dur: 180 } },
      { id: 'sofa_tv', label: 'Televizyon izle', icon: '📺', dur: 70, anim: 'watch', pose: 'sit',
        effects: { fun: 42, energy: 6 }, tags: ['tv'] },
      { id: 'sofa_cuddle', label: 'Sarılarak film izle', icon: '💞', dur: 90, anim: 'watch', pose: 'sit',
        partner: true, requireRomance: 20, effects: { fun: 45, social: 30, romance: 12, friendship: 6 },
        bothEffects: true, tags: ['romanticMovie'] },
      { id: 'sofa_chat', label: 'Sohbet et', icon: '🗯️', dur: 45, anim: 'chat', pose: 'sit',
        partner: true, effects: { social: 35, fun: 15, friendship: 7 }, bothEffects: true },
    ],
  },
  tv: {
    label: 'Televizyon', icon: '📺',
    interactions: [
      { id: 'tv_watch', label: 'Bir şeyler izle', icon: '🍿', dur: 60, anim: 'watch', pose: 'stand',
        effects: { fun: 38, energy: 4 }, tags: ['tv'] },
      { id: 'tv_news', label: 'Haberleri izle', icon: '🌍', dur: 30, anim: 'watch', pose: 'stand',
        effects: { fun: 12, social: 6 } },
    ],
  },
  bed: {
    label: 'Yatak', icon: '🛏️',
    interactions: [
      { id: 'bed_sleep', label: 'Uyu', icon: '😴', dur: 480, anim: 'sleep', pose: 'lie', sleep: true,
        effects: { energy: 100, fun: 2 } },
      { id: 'bed_nap', label: 'Kestir', icon: '💤', dur: 110, anim: 'sleep', pose: 'lie',
        effects: { energy: 40 } },
      { id: 'bed_read', label: 'Yatakta kitap oku', icon: '📖', dur: 55, anim: 'read', pose: 'lie',
        effects: { fun: 28, energy: 8 }, moodlet: { label: 'Kitap kurdu', icon: '📚', mood: 8, dur: 240 } },
      { id: 'bed_cuddle', label: 'Sarılarak uyukla', icon: '🫶', dur: 80, anim: 'sleep', pose: 'lie',
        partner: true, requireRomance: 45, effects: { energy: 22, social: 25, romance: 10, friendship: 5 },
        bothEffects: true },
    ],
  },
  fridge: {
    label: 'Buzdolabı', icon: '🧊',
    interactions: [
      { id: 'fridge_snack', label: 'Atıştırmalık al', icon: '🥪', dur: 20, anim: 'eat', pose: 'stand',
        effects: { hunger: 26, fun: 6 } },
      { id: 'fridge_juice', label: 'Meyve suyu iç', icon: '🧃', dur: 14, anim: 'eat', pose: 'stand',
        effects: { hunger: 12, energy: 6 } },
    ],
  },
  counter: {
    label: 'Mutfak Tezgahı', icon: '🍳',
    interactions: [
      { id: 'counter_cook', label: 'Yemek pişir', icon: '🍲', dur: 50, anim: 'cook', pose: 'stand',
        effects: { hunger: 62, fun: 20, social: 6 }, cost: 15, tags: ['cook'],
        moodlet: { label: 'Ev yemeği kokusu', icon: '🍲', mood: 10, dur: 240 } },
      { id: 'counter_kettle', label: 'Çay demle', icon: '🫖', dur: 25, anim: 'cook', pose: 'stand',
        effects: { energy: 14, fun: 10 },
        moodlet: { label: 'Sıcak çay', icon: '🫖', mood: 8, dur: 180 } },
      { id: 'counter_wash', label: 'Ellerini yıka', icon: '💧', dur: 10, anim: 'wash', pose: 'stand',
        effects: { hygiene: 14 } },
      { id: 'counter_dishes', label: 'Bulaşık yıka', icon: '🫧', dur: 30, anim: 'wash', pose: 'stand',
        effects: { hygiene: 10, fun: 6, social: 4 } },
    ],
  },
  stove: {
    label: 'Ocak', icon: '🍳',
    interactions: [
      { id: 'stove_cook', label: 'Yemek pişir', icon: '🍲', dur: 50, anim: 'cook', pose: 'stand',
        effects: { hunger: 62, fun: 20, social: 6 }, cost: 15, tags: ['cook'],
        moodlet: { label: 'Ev yemeği kokusu', icon: '🍲', mood: 10, dur: 240 } },
      { id: 'stove_kettle', label: 'Çay demle', icon: '🫖', dur: 25, anim: 'cook', pose: 'stand',
        effects: { energy: 14, fun: 10 },
        moodlet: { label: 'Sıcak çay', icon: '🫖', mood: 8, dur: 180 } },
    ],
  },
  sink: {
    label: 'Lavabo', icon: '🧼',
    interactions: [
      { id: 'sink_wash', label: 'Ellerini yıka', icon: '💧', dur: 10, anim: 'wash', pose: 'stand',
        effects: { hygiene: 14 } },
      { id: 'sink_dishes', label: 'Bulaşık yıka', icon: '🫧', dur: 30, anim: 'wash', pose: 'stand',
        effects: { hygiene: 10, fun: 6, social: 4 }, cost: 0 },
    ],
  },
  table: {
    label: 'Mutfak Masası', icon: '🍽️',
    interactions: [
      { id: 'table_eat', label: 'Yemek ye', icon: '🍽️', dur: 35, anim: 'eat', pose: 'sit',
        effects: { hunger: 55, fun: 10 }, tags: ['eat'],
        moodlet: { label: 'Karnım tok, gönlüm hoş', icon: '😋', mood: 8, dur: 240 } },
      { id: 'table_breakfast', label: 'Birlikte kahvaltı', icon: '🥐', dur: 55, anim: 'eat', pose: 'sit',
        partner: true, requireRomance: 10, effects: { hunger: 58, social: 30, fun: 20, friendship: 10, romance: 4 },
        bothEffects: true, tags: ['eat', 'together'],
        moodlet: { label: 'Bereketli kahvaltı', icon: '🥐', mood: 10, dur: 300 } },
      { id: 'table_chat', label: 'Kahve eşliğinde sohbet', icon: '☕', dur: 40, anim: 'chat', pose: 'sit',
        partner: true, effects: { social: 32, fun: 16, friendship: 8 }, bothEffects: true },
    ],
  },
  chair: {
    label: 'Sandalye', icon: '🪑',
    interactions: [
      { id: 'chair_sit', label: 'Otur', icon: '🪑', dur: 40, anim: 'sit', pose: 'sit',
        effects: { energy: 10, fun: 6 } },
    ],
  },
  desk: {
    label: 'Çalışma Masası', icon: '💻',
    interactions: [
      { id: 'desk_work', label: 'Bilgisayarda çalış', icon: '💼', dur: 80, anim: 'type', pose: 'sit',
        effects: { energy: -10, fun: -4, social: -2 }, money: 150, tags: ['work'],
        moodlet: { label: 'Üretken bir gün', icon: '💼', mood: 8, dur: 240 } },
      { id: 'desk_browse', label: 'İnternette gezin', icon: '🌐', dur: 40, anim: 'type', pose: 'sit',
        effects: { fun: 28 } },
      { id: 'desk_letter', label: 'Aşk mektubu yaz', icon: '💌', dur: 45, anim: 'type', pose: 'sit',
        effects: { fun: 14, social: 8, romance: 10, friendship: 4 }, tags: ['letter'],
        moodlet: { label: 'Kalbim pır pır', icon: '💌', mood: 12, dur: 300 } },
    ],
  },
  bookshelf: {
    label: 'Kitaplık', icon: '📚',
    interactions: [
      { id: 'books_read', label: 'Kitap oku', icon: '📖', dur: 50, anim: 'read', pose: 'stand',
        effects: { fun: 32, energy: -4 }, moodlet: { label: 'Kitap kurdu', icon: '📚', mood: 8, dur: 240 } },
      { id: 'books_poetry', label: 'Şiir kitabı karıştır', icon: '🌹', dur: 30, anim: 'read', pose: 'stand',
        effects: { fun: 16, romance: 4 } },
    ],
  },
  plant: {
    label: 'Saksı', icon: '🪴',
    interactions: [
      { id: 'plant_water', label: 'Sula', icon: '💧', dur: 15, anim: 'water', pose: 'stand',
        effects: { fun: 12, hygiene: 2 }, tags: ['plant'] },
      { id: 'plant_talk', label: 'Bitkiyle konuş', icon: '🌱', dur: 20, anim: 'chat', pose: 'stand',
        effects: { fun: 14, social: 8 } },
    ],
  },
  shower: {
    label: 'Duş', icon: '🚿',
    interactions: [
      { id: 'shower_shower', label: 'Duş al', icon: '🚿', dur: 32, anim: 'shower', pose: 'stand',
        effects: { hygiene: 82, fun: 10, energy: 6 }, tags: ['shower'],
        moodlet: { label: 'Tertemiz', icon: '✨', mood: 8, dur: 240 } },
      { id: 'shower_sing', label: 'Şarkı söyle', icon: '🎵', dur: 30, anim: 'shower', pose: 'stand',
        effects: { hygiene: 40, fun: 25 } },
    ],
  },
  toilet: {
    label: 'Tuvalet', icon: '🚽',
    interactions: [
      { id: 'toilet_use', label: 'Kullan', icon: '🚽', dur: 15, anim: 'toilet', pose: 'sit',
        effects: { bladder: 92, hygiene: -4 }, tags: ['toilet'] },
    ],
  },
  bathroom_sink: {
    label: 'Banyo Lavabosu', icon: '🪥',
    interactions: [
      { id: 'bsink_teeth', label: 'Dişlerini fırçala', icon: '🪥', dur: 14, anim: 'wash', pose: 'stand',
        effects: { hygiene: 24 } },
      { id: 'bsink_face', label: 'Yüzünü yıka', icon: '💦', dur: 10, anim: 'wash', pose: 'stand',
        effects: { hygiene: 16, energy: 4 } },
    ],
  },
  wardrobe: {
    label: 'Gardırop', icon: '🚪',
    interactions: [
      { id: 'wardrobe_plan', label: 'Kıyafet seç', icon: '👗', dur: 25, anim: 'admire', pose: 'stand',
        effects: { fun: 14, hygiene: 4 } },
      { id: 'wardrobe_tidy', label: 'Dolabı düzenle', icon: '🧺', dur: 35, anim: 'wash', pose: 'stand',
        effects: { fun: 8, hygiene: 6 } },
    ],
  },
  dresser: {
    label: 'Şifonyer', icon: '🪞',
    interactions: [
      { id: 'dresser_look', label: 'Aynaya bak', icon: '🪞', dur: 18, anim: 'admire', pose: 'stand',
        effects: { fun: 12, social: 4 } },
    ],
  },
  guitar: {
    label: 'Gitar', icon: '🎸',
    interactions: [
      { id: 'guitar_play', label: 'Gitar çal', icon: '🎸', dur: 45, anim: 'guitar', pose: 'stand',
        effects: { fun: 36, social: 14, energy: -4 }, tags: ['music'],
        moodlet: { label: 'Müzik ruhun gıdası', icon: '🎵', mood: 10, dur: 240 } },
      { id: 'guitar_song', label: 'Ferhanım için şarkı çal', icon: '💕', dur: 55, anim: 'guitar', pose: 'stand',
        partner: true, requireRomance: 25, effects: { fun: 35, romance: 14, social: 30, friendship: 6 },
        bothEffects: true, tags: ['romance', 'music'] },
    ],
  },
  radio: {
    label: 'Radyo', icon: '📻',
    interactions: [
      { id: 'radio_dance', label: 'Tek başına dans et', icon: '💃', dur: 30, anim: 'dance', pose: 'stand',
        effects: { fun: 32, energy: -6, hygiene: -4 } },
      { id: 'radio_dance2', label: 'Birlikte dans et', icon: '👫', dur: 60, anim: 'dance', pose: 'stand',
        partner: true, requireRomance: 15, effects: { fun: 45, social: 30, romance: 12, friendship: 8 },
        bothEffects: true, tags: ['dance'] },
    ],
  },
  yoga: {
    label: 'Yoga Matı', icon: '🧘',
    interactions: [
      { id: 'yoga_stretch', label: 'Esne ve nefes al', icon: '🧘', dur: 35, anim: 'yoga', pose: 'stand',
        effects: { energy: 18, fun: 14, hygiene: -6 }, moodlet: { label: 'Zihin berrak', icon: '🧘', mood: 8, dur: 180 } },
    ],
  },
  bench: {
    label: 'Bahçe Bankı', icon: '🌿',
    interactions: [
      { id: 'bench_sit', label: 'Otur ve dinlen', icon: '🌤️', dur: 40, anim: 'sit', pose: 'sit',
        effects: { fun: 20, energy: 10, social: 4 } },
      { id: 'bench_stars', label: 'Yıldızları izle', icon: '🌌', dur: 65, anim: 'watch', pose: 'sit',
        partner: true, requireRomance: 10, effects: { fun: 32, social: 30, romance: 16, friendship: 8 },
        bothEffects: true, night: true, tags: ['stargaze'],
        moodlet: { label: 'Yıldızlı gece', icon: '✨', mood: 14, dur: 360 } },
    ],
  },
  cat: {
    label: 'Pamuk', icon: '🐈',
    interactions: [
      { id: 'cat_pet', label: 'Pamuk’u sev', icon: '🐈', dur: 25, anim: 'pet', pose: 'stand',
        effects: { fun: 26, social: 18, hygiene: -2 }, tags: ['cat'],
        moodlet: { label: 'Kedi terapi', icon: '🐾', mood: 10, dur: 240 } },
      { id: 'cat_play', label: 'Oyuncağıyla oyna', icon: '🧶', dur: 30, anim: 'pet', pose: 'stand',
        effects: { fun: 30, social: 10, energy: -4 } },
    ],
  },
  painting: {
    label: 'Tablo', icon: '🖼️',
    interactions: [
      { id: 'painting_admire', label: 'Hayranlıkla izle', icon: '🎨', dur: 20, anim: 'admire', pose: 'stand',
        effects: { fun: 18 } },
    ],
  },
  lamp: {
    label: 'Lamba', icon: '💡',
    interactions: [
      { id: 'lamp_light', label: 'Işığı aç/kapat', icon: '💡', dur: 5, anim: 'admire', pose: 'stand',
        effects: { fun: 4 } },
    ],
  },
  desk_chair: {
    label: 'Çalışma Sandalyesi', icon: '🪑',
    interactions: [
      { id: 'deskchair_sit', label: 'Otur', icon: '😌', dur: 30, anim: 'sit', pose: 'sit',
        effects: { energy: 8, fun: 6 } },
    ],
  },
};

// Simler arası etkileşimler
export const SIM_INTERACTIONS = [
  { id: 'sim_chat', label: 'Sohbet et', icon: '💬', dur: 35, anim: 'chat', pose: 'stand',
    effects: { social: 30, fun: 12, friendship: 7 }, bothEffects: true, tags: ['chat'] },
  { id: 'sim_joke', label: 'Şaka yap', icon: '😄', dur: 22, anim: 'chat', pose: 'stand',
    effects: { fun: 22, social: 18, friendship: 6 }, bothEffects: true },
  { id: 'sim_compliment', label: 'İltifat et', icon: '✨', dur: 16, anim: 'chat', pose: 'stand',
    effects: { social: 14, romance: 5, friendship: 4 }, bothEffects: true },
  { id: 'sim_hug', label: 'Sarılıver', icon: '🤗', dur: 14, anim: 'hug', pose: 'stand',
    effects: { social: 18, fun: 8, romance: 6, friendship: 5 }, bothEffects: true, tags: ['hug'] },
  { id: 'sim_hands', label: 'El ele tutuş', icon: '🫱🫲', dur: 25, anim: 'hands', pose: 'stand',
    effects: { social: 22, romance: 7, friendship: 3 }, bothEffects: true, requireRomance: 15 },
  { id: 'sim_kiss', label: 'Öpücük kondur', icon: '😘', dur: 12, anim: 'kiss', pose: 'stand',
    effects: { social: 20, romance: 10, fun: 10, friendship: 3 }, bothEffects: true, requireRomance: 45,
    moodlet: { label: 'Kelebekler uçuşuyor', icon: '🦋', mood: 12, dur: 300 } },
  { id: 'sim_dance', label: 'Dans et', icon: '💃', dur: 55, anim: 'dance', pose: 'stand',
    effects: { fun: 40, social: 26, romance: 10, friendship: 6 }, bothEffects: true, requireRomance: 30 },
  { id: 'sim_flowers', label: 'Çiçek ver', icon: '💐', dur: 18, anim: 'admire', pose: 'stand',
    effects: { social: 14, romance: 13, friendship: 5 }, bothEffects: true, cost: 35, requireRomance: 20 },
  { id: 'sim_play', label: 'Birlikte oyun oyna', icon: '🎲', dur: 40, anim: 'chat', pose: 'sit',
    effects: { fun: 32, social: 24, friendship: 9 }, bothEffects: true },
];

export const GOALS = [
  { id: 'goal_eat', title: 'İlk lokma', desc: 'Mutfakta bir şeyler ye.', icon: '🍽️', reward: 50,
    test: (ctx) => ctx.flags.eat >= 1 },
  { id: 'goal_shower', title: 'Temiz başlangıç', desc: 'Güne duş alarak başla.', icon: '🚿', reward: 40,
    test: (ctx) => ctx.flags.shower >= 1 },
  { id: 'goal_movie', title: 'Birlikte film', desc: 'Kanepede sarılarak film izleyin.', icon: '🎬', reward: 90,
    test: (ctx) => ctx.flags.romanticMovie >= 1 },
  { id: 'goal_feed', title: 'İki tabak, iki kalp', desc: 'İki simin de açlığı 85 üstüne çıksın.', icon: '🍲', reward: 80,
    test: (ctx) => ctx.sims.every((s) => s.needs.hunger >= 85) },
  { id: 'goal_letter', title: 'Kalpten kalbe', desc: 'Masada bir aşk mektubu yaz.', icon: '💌', reward: 100,
    test: (ctx) => ctx.flags.letter >= 1 },
  { id: 'goal_stars', title: 'Yıldızlı gece', desc: 'Bahçe bankında birlikte yıldızları izleyin.', icon: '🌌', reward: 120,
    test: (ctx) => ctx.flags.stargaze >= 1 },
  { id: 'goal_romance', title: 'Aşk büyüsün', desc: 'Aşk puanı 70’e ulaşsın.', icon: '❤️', reward: 200,
    test: (ctx) => ctx.state.romance >= 70 },
];

export const SHOP_ITEMS = [
  { id: 'shop_plant', name: 'Monstera saksısı', icon: '🪴', price: 90, desc: 'Terasa yeşil bir köşe.', spot: 'plant2' },
  { id: 'shop_lamp', name: 'Sıcak ışıklı lamba', icon: '💡', price: 70, desc: 'Akşamları yumuşak bir ışık.', spot: 'lamp2' },
  { id: 'shop_art', name: 'Şövalede tablo', icon: '🖼️', price: 140, desc: 'Salona sanat katar.', spot: 'art2' },
  { id: 'shop_rug', name: 'Yumuşak halı', icon: '🧶', price: 120, desc: 'Çıplak ayaklara bayram.', spot: 'rug2' },
];

export const MOOD_LEVELS = [
  { min: 78, label: 'Harika', icon: '😄', color: '#5fae7a' },
  { min: 58, label: 'İyi', icon: '🙂', color: '#8bbf6b' },
  { min: 40, label: 'Eh', icon: '😐', color: '#d8b34a' },
  { min: 22, label: 'Kötü', icon: '😟', color: '#dd8a4d' },
  { min: -1, label: 'Berbat', icon: '😫', color: '#cd5c5c' },
];

export const GAME = {
  minutesPerSecond: 3,
  startMinute: 8 * 60 + 10,
  dayStart: 6 * 60,
  dayEnd: 24 * 60,
  nightStart: 20 * 60,
  nightEnd: 6 * 60,
  startMoney: 750,
  friendships: { friendship: 45, romance: 28 },
};
