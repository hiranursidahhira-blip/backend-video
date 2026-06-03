const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// ENDPOINT 1: MENGIRIM REQUEST VIDEO
app.post('/api/generate-video', upload.array('images', 2), async (req, res) => {
    try {
        const { apiKey, model, prompt, duration, resolution } = req.body;
        const files = req.files;

        if (!apiKey) return res.status(400).json({ success: false, error: "API Key kosong!" });
        if (!files || files.length === 0) return res.status(400).json({ success: false, error: "Minimal upload 1 gambar (Gambar Awal)!" });

        console.log(`Menerima request video model: ${model}`);
        console.log(`Durasi: ${duration} detik | Jumlah Foto: ${files.length}`);

        // Respon simulasi sukses
        res.json({
            success: true,
            model_used: model,
            job_id: "job-simulasi-" + Math.floor(Math.random() * 1000)
        });

    } catch (error) {
        res.status(500).json({ success: false, error: "Terjadi kesalahan backend." });
    }
});

// ENDPOINT 2: MENGECEK STATUS VIDEO
app.post('/api/check-status', async (req, res) => {
    try {
        const { jobId, apiKey } = req.body;
        console.log(`Mengecek status untuk Job: ${jobId}`);

        const randomChance = Math.random();
        
        if (randomChance > 0.4) {
            // 60% peluang video masih diproses (Simulasi Loading)
            res.json({ status: "PROCESSING" });
        } else {
            // 40% peluang selesai. 
            // LINK VIDEO SUDAH DIGANTI KE SERVER PUBLIK YANG AMAN
            res.json({ 
                status: "COMPLETE", 
                video_url: "https://www.w3schools.com/html/mov_bbb.mp4" 
            });
        }

    } catch (error) {
        res.status(500).json({ success: false, error: "Gagal cek status." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server API Video berjalan di port ${PORT}`));
