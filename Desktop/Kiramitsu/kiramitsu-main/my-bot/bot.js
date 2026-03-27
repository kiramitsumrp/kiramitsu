require('dotenv').config();

const { Client, GatewayIntentBits, Events } = require('discord.js');
const { initializeApp } = require('firebase/app');
const { getAuth, signInAnonymously } = require('firebase/auth');
const { getFirestore, doc, setDoc, getDoc, updateDoc } = require('firebase/firestore');

// --- 1. KONFIGURASI FIREBASE ---
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// --- 2. SETUP BOT & DATABASE ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APP_IDENTIFIER = "kiramitsu-rekap-v2"; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const HARGA = {
    amer: 65000,
    vodka: 85000,
    azul: 105000,
    fries: 60000,
    chips: 70000,
    rokok: 50000,
    vip_basic: 1500000, 
    vip_tema: 2500000   
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

// Helper: Inisialisasi data default
const createNewWeeklyData = () => ({
    admin: "Belum Diatur",
    rangeDate: "Belum Diatur",
    lastReportMessageId: null,
    lastReportChannelId: null,
    days: {
        senin: { amer: 0, vodka: 0, azul: 0, fries: 0, chips: 0, rokok: 0, vip_basic: 0, vip_tema: 0 },
        selasa: { amer: 0, vodka: 0, azul: 0, fries: 0, chips: 0, rokok: 0, vip_basic: 0, vip_tema: 0 },
        rabu: { amer: 0, vodka: 0, azul: 0, fries: 0, chips: 0, rokok: 0, vip_basic: 0, vip_tema: 0 },
        kamis: { amer: 0, vodka: 0, azul: 0, fries: 0, chips: 0, rokok: 0, vip_basic: 0, vip_tema: 0 },
        jumat: { amer: 0, vodka: 0, azul: 0, fries: 0, chips: 0, rokok: 0, vip_basic: 0, vip_tema: 0 },
        sabtu: { amer: 0, vodka: 0, azul: 0, fries: 0, chips: 0, rokok: 0, vip_basic: 0, vip_tema: 0 },
        minggu: { amer: 0, vodka: 0, azul: 0, fries: 0, chips: 0, rokok: 0, vip_basic: 0, vip_tema: 0 }
    }
});

const formatRupiah = (number) => "Rp " + number.toLocaleString('id-ID');

const formatTanggal = (isoString) => {
    if (!isoString) return "Belum ada update";

    const date = new Date(isoString);
    const now = new Date();

    const diff = (now - date) / 1000; // detik

    let status = "";
    if (diff < 60) status = " 🟢 LOADED";

    return date.toLocaleString('id-ID', {
        dateStyle: 'full',
        timeStyle: 'medium',
    }) + status;
};

const generateReportText = (data) => {
    let grandTotal = 0;
    let output = `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n   𝑲𝑰𝑹𝑨𝑴𝑰𝑻𝑺𝑼 𝑾𝑬𝑬𝑲𝑳𝒀 𝑹𝑬𝑲𝑨𝑷\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n`;
    output += `👤 ADMIN  : ${data.admin}\n`;
    output += `📅 TANGGAL: ${data.rangeDate}\n`;
    output += `⏱️ UPDATE : ${formatTanggal(data.lastUpdated)}\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    const hariList = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
    
    hariList.forEach(h => {
        const d = data.days[h];
        const subtotal = (d.amer * HARGA.amer) + (d.vodka * HARGA.vodka) + (d.azul * HARGA.azul) + 
                         (d.fries * HARGA.fries) + (d.chips * HARGA.chips) + (d.rokok * HARGA.rokok) +
                         (d.vip_basic * HARGA.vip_basic) + (d.vip_tema * HARGA.vip_tema);
        grandTotal += subtotal;

        output += `[ ${h.toUpperCase()} ]\n`;
        output += `Amer: ${d.amer} | Vodka: ${d.vodka} | Azul: ${d.azul} | Fries: ${d.fries}\n`;
        output += `Chips: ${d.chips} | Rokok: ${d.rokok} | VIP: ${d.vip_basic} | VVIP: ${d.vip_tema}\n`;
        output += `> Income: ${formatRupiah(subtotal)}\n\n`;
    });

    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💎 TOTAL MINGGUAN: ${formatRupiah(grandTotal)}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    return "```" + output + "```";
};

const updateLiveReport = async (data) => {
    if (!data.lastReportMessageId || !data.lastReportChannelId) return;
    try {
        const reportChannel = await client.channels.fetch(data.lastReportChannelId);
        const reportMsg = await reportChannel.messages.fetch(data.lastReportMessageId);
        if (reportMsg) {
            await reportMsg.edit(generateReportText(data));
        }
    } catch (err) {
        console.log("Pesan laporan tidak ditemukan.");
    }
};

client.once(Events.ClientReady, async () => {
    try {
        await signInAnonymously(auth);
        console.log(`✅ Firebase Terhubung!`);
        console.log(`✅ Bot Siap: ${client.user.tag}`);

         setInterval(async () => {
            const docRef = doc(db, 'kiramitsu_data', APP_IDENTIFIER);
            const snap = await getDoc(docRef);

            if (!snap.exists()) return;

            const data = snap.data();

            // simpan last update biar ga spam edit
            if (!global.lastUpdateTime) global.lastUpdateTime = null;

            if (data.lastUpdated && data.lastUpdated !== global.lastUpdateTime) {
                global.lastUpdateTime = data.lastUpdated;

                console.log("🔄 Update dari Web terdeteksi!");
                await updateLiveReport(data);
            }

        }, 5000); 
    } catch (err) {
        console.error("❌ Login Error:", err.message);
    }
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const content = message.content.trim();
    const args = content.split(/ +/);
    const command = args[0].toLowerCase();
    const docRef = doc(db, 'kiramitsu_data', APP_IDENTIFIER);

    // RELEVAN DENGAN WEEKREPORT
    // COMMAND: !newformat [namaAdmin] [Tanggal]
    if (command === '!newformat') {
        const adminName = args[1];
        const dateRange = args.slice(2).join(" ");
        if (!adminName || !dateRange) return message.reply("❌ Gunakan: `!newformat [NamaAdmin] [Tanggal]`");

        const snap = await getDoc(docRef);
        let data = snap.exists() ? snap.data() : createNewWeeklyData();
        data.admin = adminName;
        data.rangeDate = dateRange;

        await setDoc(docRef, data);
        await updateLiveReport(data);
        return message.reply(`✅ Header Diperbarui!\n👤 Admin: **${adminName}**\n📅 Periode: **${dateRange}**`);
    }

    // COMMAND: !set [hari] [item1,item2] [jumlah1,jumlah2] (Logika TAMBAH)
    if (command === '!set') {
        const day = args[1]?.toLowerCase();
        const itemsArg = args[2]?.toLowerCase();
        const qtysArg = args[3];

        const validDays = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
        const itemMap = { 
            'amer': 'amer', 'vodka': 'vodka', 'azul': 'azul', 
            'fries': 'fries', 'chips': 'chips', 'rokok': 'rokok', 
            'vip': 'vip_basic', 'vvip': 'vip_tema' 
        };

        if (!validDays.includes(day) || !itemsArg || !qtysArg) {
            return message.reply("❌ Format: `!set [hari] [item1,item2] [jumlah1,jumlah2]`\nContoh: `!set senin amer,vodka 2,1` (akan menambah stok saat ini)");
        }

        const items = itemsArg.split(',');
        const qtys = qtysArg.split(',');

        if (items.length !== qtys.length) {
            return message.reply("❌ Jumlah item dan angka harus sama!");
        }

        const snap = await getDoc(docRef);
        let data = snap.exists() ? snap.data() : createNewWeeklyData();

        let updateLog = [];
        for (let i = 0; i < items.length; i++) {
            const itemName = items[i].trim();
            const addQty = parseInt(qtys[i].trim());
            const itemKey = itemMap[itemName];
            
            if (itemKey && !isNaN(addQty)) {
                // LOGIKA TAMBAH: Ambil data lama + input baru
                const currentQty = data.days[day][itemKey] || 0;
                const newQty = currentQty + addQty;
                
                // Pastikan tidak minus di bawah nol (opsional, hapus baris bawah jika ingin bisa minus)
                data.days[day][itemKey] = Math.max(0, newQty);
                
                updateLog.push(`${itemName.toUpperCase()}(${currentQty} ➔ ${data.days[day][itemKey]})`);
            }
        }

        if (updateLog.length === 0) return message.reply("❌ Item tidak valid.");

        await setDoc(docRef, data);
        await updateLiveReport(data);
        
        return message.reply(`✅ Berhasil Menambah data **${day.toUpperCase()}**:\n${updateLog.join('\n')}`);
    }

    if (command === '!report') {
        const snap = await getDoc(docRef);
        let data = snap.exists() ? snap.data() : createNewWeeklyData();
        const sentMsg = await message.channel.send(generateReportText(data));
        data.lastReportMessageId = sentMsg.id;
        data.lastReportChannelId = message.channel.id;
        await setDoc(docRef, data);
        return; 
    }

    if (command === '!reset') {
        await setDoc(docRef, createNewWeeklyData());
        return message.reply("🧹 Data dibersihkan.");
    }
    // RELEVAN DENGAN WEEKREPORT END

    if (command === "!help") {
        let helpText = `📜 **DAFTAR PERINTAH BOT KIRAMITSU**\n\n`;
        helpText += `1️⃣ **!newformat [Admin] [Tanggal]**\n\n`;
        helpText += `2️⃣ **!set [hari] [item1,item2] [angka1,angka2]**\nMenambah jumlah item. Gunakan angka negatif untuk mengurangi.\nContoh: \`!set senin amer,rokok 2,-1\`\n\n`;
        helpText += `3️⃣ **!report**\nLaporan baru.\n\n`;
        helpText += `4️⃣ **!reset**\nHapus data.\n\n`;
        return message.reply(helpText);
    }
});

client.login(DISCORD_TOKEN);