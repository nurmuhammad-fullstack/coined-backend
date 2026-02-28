# CoinEd Backend — Node.js + Express + MongoDB Atlas

## 📁 Fayl strukturasi

```
coined-backend/
├── config/
│   └── db.js                 ← MongoDB ulanish
├── middleware/
│   └── auth.js               ← JWT tekshirish
├── models/
│   ├── User.js               ← Foydalanuvchi modeli
│   ├── Transaction.js        ← Tranzaksiya modeli
│   └── ShopItem.js           ← Do'kon modeli
├── routes/
│   ├── auth.js               ← Login/Register
│   ├── students.js           ← O'quvchilar boshqaruvi
│   └── shop.js               ← Do'kon
├── frontend-service/
│   ├── api.js                ← Frontend API service (coin_final/src/services/ ga nusxa)
│   ├── AppContext.jsx        ← Yangilangan Context (real API bilan)
│   └── .env                  ← Frontend .env fayli
├── server.js                 ← Asosiy server
├── seed.js                   ← Demo ma'lumotlar
├── package.json
└── .env.example              ← .env namunasi
```

---

## 🚀 O'rnatish va ishga tushirish

### 1. MongoDB Atlas sozlash
1. [atlas.mongodb.com](https://atlas.mongodb.com) ga kiring
2. Bepul cluster yarating (M0 - Free)
3. **Database Access** → yangi user yarating (username + password)
4. **Network Access** → `0.0.0.0/0` qo'shing (hamma IP)
5. **Connect** → "Connect your application" → connection string ni nusxalang

### 2. Backend o'rnatish
```bash
cd coined-backend

# .env fayl yarating
cp .env.example .env

# .env faylni oching va to'ldiring:
# MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASS@cluster0.xxxxx.mongodb.net/coined?retryWrites=true&w=majority
# JWT_SECRET=istalgan_uzun_random_string
# PORT=5000
# CLIENT_URL=http://localhost:3000

# Packagelarni o'rnating
npm install

# Demo ma'lumotlarni qo'shing (bir martalik)
node seed.js

# Serverni ishga tushiring
npm run dev
```

✅ Muvaffaqiyatli bo'lsa: `🚀 CoinEd API running on http://localhost:5000`

### 3. Frontend sozlash
```bash
cd coined_final

# .env fayl yarating
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env

# frontend-service/api.js faylni nusxalang
mkdir -p src/services
cp ../coined-backend/frontend-service/api.js src/services/api.js

# Yangilangan AppContext ni almashtiring
cp ../coined-backend/frontend-service/AppContext.jsx src/context/AppContext.jsx

# Ishga tushiring
npm start
```

---

## 🔌 API Endpointlar

### Auth
| Method | URL | Tavsif |
|--------|-----|--------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Ro'yxatdan o'tish |
| GET | `/api/auth/me` | Joriy user |

### Students (Teacher only)
| Method | URL | Tavsif |
|--------|-----|--------|
| GET | `/api/students` | Barcha o'quvchilar |
| GET | `/api/students/:id` | Bitta o'quvchi |
| POST | `/api/students/:id/coins` | Coin qo'sh/olish |
| GET | `/api/students/:id/transactions` | Tranzaksiyalar |

### Shop
| Method | URL | Tavsif |
|--------|-----|--------|
| GET | `/api/shop` | Barcha mahsulotlar |
| POST | `/api/shop` | Mahsulot qo'shish (Teacher) |
| DELETE | `/api/shop/:id` | Mahsulot o'chirish (Teacher) |
| POST | `/api/shop/:id/buy` | Sotib olish (Student) |

---

## 🔑 Demo loginlar (seed.js dan keyin)
| Role | Email | Parol |
|------|-------|-------|
| 👨‍🏫 Teacher | teacher@school.uz | admin |
| 🎓 Student | alex@school.uz | 1234 |
| 🎓 Student | maria@school.uz | 1234 |
