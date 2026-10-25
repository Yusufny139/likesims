# LikeSims — Ferhanım & Yusuf Niyazi · Bizim Ev

Tarayıcıda çalışan, Sims benzeri 3B yaşam simülasyonu. Ferhanım ile Yusuf Niyazi'nin
küçük evinde ihtiyaçları karşılıyor, sohbet ediyor, aşkı büyütüyor ve evi
dekore ediyorsunuz. Tüm yazılım ve varlıklar yerel — CDN yok.

## Çalıştırma

```bash
npm install
npm run dev      # http://localhost:4173
npm run build    # dist/ klasörüne üretim derlemesi
```

## Oynanış

| Girdi | Ne yapar |
| --- | --- |
| Sol tık (sim) | Sim'i seçer |
| Sol tık (eşya) | Pasta menüyü açar, eylem seçilir |
| Sol tık (seçili sim + diğer sim) | Sosyal etkileşim menüsü (sohbet, sarılma, öpücük…) |
| Sol tık (zemin) | Seçili simi oraya yürütür |
| Sürükle / tekerlek | Kamerayı döndür / yakınlaştır |
| Boşluk | Duraklat / devam et |
| 1 · 2 · 3 | Normal / hızlı / çok hızlı |
| Tab | Sim değiştir |

- **İhtiyaçlar:** açlık, enerji, mesane, hijyen, eğlence, sosyal. Zamanla azalır;
  kritik seviyeye düşen ihtiyaç ruh halini (mood) aşağı çeker.
- **Serbest irade:** açıkken simler kendi başlarına karar verir (yemek, duş, uyku,
  sohbet, dans…). Üstteki 🧠 düğmesiyle kapatılıp tamamen elle yönetilebilir.
- **İlişki:** arkadaşlık ve aşk puanı. Aşk puanı arttıkça el ele tutuşma, öpücük,
  çiçek verme, birlikte film/dans/yıldız izleme gibi etkileşimler açılır.
- **Para:** bilgisayarda çalışmak (₺150), görev ödülleri ve ev işleri. Kasayla
  🛍️ dekorasyon mağazasından saksı, lamba, şövalede tablo ve halı alınır.
- **Görevler:** 7 küçük hedef (ilk yemek, duş, birlikte film, aşk puanı 70…).
  Her biri tamamlandığında kasaya ödül ekler.
- **Gün döngüsü:** 08:10'da başlar; akşam ışıkları, gün batımı, yıldızlar ve
  gece lambaları otomatik devreye girer. Simler gece yatağa gider.

## Proje yapısı

```
index.html          uygulama kabuğu (HUD, paneller, başlangıç ekranı)
src/main.js         oyun döngüsü, girişler, arayüz, kamera, ışık/gökyüzü
src/data.js         ihtiyaçlar, simler, mobilya etkileşimleri, görevler, mağaza
src/house.js        evin 3B inşası (oda, duvar, teras, bahçe, eşyalar, nav grid)
src/character.js    sim iskeleti ve animasyonları, kedi Pamuk
src/sims.js         ihtiyaç/mood, eylem kuyruğu, yol bulma, serbest irade
src/nav.js          A* yol bulma ızgarası
src/materials.js    prosedürel doku ve malzemeler
src/style.css       tasarım sistemi ve tüm arayüz
tools/screenshot.mjs  geliştirme için headless ekran görüntüsü aracı
```

## Teknik notlar

- Vite + three.js (vanilla ES modülleri), ek çatı yok.
- Yazı tipleri `@fontsource-variable/fraunces`, `@fontsource-variable/nunito` ve
  `@fontsource/noto-emoji` paketlerinden gelir; hepsi `dist/` içine kopyalanır.
- Duvarlar kamera ile evin içine girdiğinde otomatik şeffaflaşır, gölge haritası
  ve gölge yayan küçük parçalar performans için ayıklanmıştır.
- `window.__likesims` geliştirme kancası: `advance(dakika)`, `setClock(dk)`,
  `skipIntro()`, `resetView(pos, hedef)` ve dahili durumlar.
