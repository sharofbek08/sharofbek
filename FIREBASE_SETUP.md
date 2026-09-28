# Umumiy yozuvlarni yoqish

Bu sahifa matnlarni barcha foydalanuvchilarga ko'rsatish uchun Firebase Realtime Database ishlatadi. `json-server` faqat sizning kompyuteringizda ishlaydi; saytingizga kirgan boshqa odamlar uchun umumiy ma'lumotlar bazasi bo'la olmaydi.

## 1. Firebase loyihasini yarating

1. [Firebase Console](https://console.firebase.google.com/)da yangi loyiha yarating.
2. **Build → Realtime Database** bo'limidan ma'lumotlar bazasini yarating. Joylashuvni tanlang va hozircha **Locked mode**ni tanlang.
3. **Build → Authentication → Sign-in method** bo'limida **Anonymous** usulini yoqing.
4. **Project settings → General → Your apps** bo'limidan Web app qo'shing va ko'rsatilgan `firebaseConfig` qiymatlarini oling.

## 2. Saytni Firebase'ga ulang

[`firebase-config.js`](./firebase-config.js) faylida ushbu saytning faol Firebase konfiguratsiyasi bor. Boshqa Firebase loyihasiga o'tsangiz, qiymatlarni Firebase Console bergan sozlamalar bilan almashtiring. Masalan:

```js
window.SATRALARIM_FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "loyiha-nomi.firebaseapp.com",
  databaseURL: "https://loyiha-nomi-default-rtdb.firebaseio.com",
  projectId: "loyiha-nomi",
  storageBucket: "loyiha-nomi.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```

Bu konfiguratsiya brauzerda ko'rinishi normal; ma'lumotlarni himoya qiladigan qism — Database Rules.

## 3. Xavfsizlik qoidalarini o'rnating

Firebase Console'da **Realtime Database → Rules**ni oching. [`database.rules.json`](./database.rules.json) tarkibini joylashtiring va **Publish**ni bosing.

Bu qoidalar bilan:

- hamma anonim tarzda kirib umumiy yozuvlarni ko'ra oladi;
- yozuvni aynan o'sha brauzerdan qo'shgan odamgina uni tahrirlashi, sevimliga qo'shishi yoki o'chirishi mumkin;
- foydalanuvchi boshqa odam nomidan yozuv saqlay olmaydi;
- kod bilan himoyalangan yozuvlarda ochiq matn, muallif va teglar bazaga yuborilmaydi.

## 4. Domenni ruxsat bering va saytni joylang

**Authentication → Settings → Authorized domains**ga `mohinur.online`ni qo'shing. Agar saytdan `www` bilan foydalansangiz, `www.mohinur.online`ni ham qo'shing. Lokal sinov uchun `localhost` ruxsat etilgan domenlar ichida bo'lishi kerak.

So'ng `firebase-config.js` bilan birga saytni hostingga joylang. Bu fayl deploy qilingan papkada bo'lishi shart.

Loyiha papkasidagi [`.firebaserc`](./.firebaserc) faylida haqiqiy Firebase loyiha IDsi bo'lishi kerak. Keyin terminalda quyidagi buyruqni ishlating:

GitHub Pages ishlatilsa, Firebase'ga faqat autentifikatsiya va qoidalarni yuboring:

```bash
firebase deploy --only auth,database
```

So'ng barcha loyiha fayllarini, jumladan `firebase-config.js`ni GitHub'ga yuboring va Pages'ni asosiy papkadan yoqing. Firebase Hosting ishlatilsa, `auth,database,hosting`ni deploy qilish mumkin.

Qoidalar barcha tashrif buyuruvchilarga anonim kirish orqali yozuvlarni o'qish imkonini beradi; yozuvni esa faqat uni yaratgan brauzer tahrirlashi yoki o'chirishi mumkin.

## Matnni kod bilan ochish

Yozuv qo'shayotganda unga alohida maxfiy kod qo'yish mumkin. Bu ixtiyoriy: kod qo'yilmagan yozuvlar odatdagidek hammaga o'qiladi. Kod qo'yilgan yozuvning matni, muallifi va teglari brauzerda shifrlanadi; Firebase'da ularning ochiq ko'rinishi o'rniga `[locked]` va shifrlangan ma'lumot saqlanadi. Boshqa odam yozuvni o'qishi uchun unga kodni o'zingiz yetkazishingiz kerak.

Kodni eslab qoling: u Firebase'da saqlanmaydi va unutilsa yozuvni ochib bo'lmaydi. Qisqa yoki taxmin qilish oson kod o'rniga uzunroq maxfiy ibora tanlang. Yozuv turi, yaratilgan sana, sevimli holati va egasining texnik identifikatori Firebase'da ko'rinadi. Boshqalar yozuvni ko'rishi uchun yuqoridagi Firebase sozlamalari baribir bajarilgan bo'lishi kerak.

## Tekshirish

1. Saytni oddiy oynada va inkognito oynada oching.
2. Birinchi oynada yangi matn saqlang.
3. Ikkinchi oynada sahifa yangilanmasdan yangi yozuv ko'rinishi kerak.
4. Kod qo'yilgan alohida yozuv saqlang. Ikkinchi oynada uning matni yopiq ko'rinishi, to'g'ri kod kiritilganda esa ochilishi kerak.

Sarlavhadagi holat `Yozuvlar barcha qurilmalarda sinxronlanmoqda` bo'lsa, ulanish ishlayapti. Agar `Bulutli sinxronlash sozlanmagan` yozuvi chiqsa, `firebase-config.js`dagi qiymatlar hali kiritilmagan.

> Eslatma: avval faqat shu brauzerda saqlangan yozuvlar avtomatik ravishda umumiy bazaga yuborilmaydi. Bu tasodifan shaxsiy matnlar oshkor bo'lmasligi uchun qilingan. Bulutli ulanish yoqilgach saqlangan yangi yozuvlar boshqalarga darhol ko'rinadi.

> Anonim kirish ishlatilgani uchun brauzer ma'lumotlari tozalansa yoki boshqa qurilmadan kirilsa, avvalgi yozuvni tahrirlash huquqi qaytmaydi. Bu huquq barcha qurilmalarda saqlanishi kerak bo'lsa, keyingi qadam sifatida Firebase Google Sign-In'ni ulash lozim.
