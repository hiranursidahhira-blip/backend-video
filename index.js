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
        if (!apiKey) return res.status(400).json({ success: false, error: "API Key kosong!" });

        // Karena upload gambar asli via API ke S3 Leonardo butuh kode yang sangat panjang, 
        // kita menggunakan mock respon di sini agar alur UI-nya berjalan.
        
        console.log(`Menerima request video model ${model} dengan durasi ${duration}`);

        res.json({
            success: true,
            model_used: model,
            job_id: "job-simulasi-" + Math.floor(Math.random() * 1000)
        });

    } catch (error) {
        res.status(500).json({ success: false, error: "Terjadi kesalahan backend." });
    }
});

// ENDPOINT 2: MENGECEK STATUS VIDEO (BARU)
app.post('/api/check-status', async (req, res) => {
    try {
        const { jobId, apiKey } = req.body;
        
        // Simulasi Loading: Kita beri delay buatan agar seolah-olah server sedang merender video
        // Di aplikasi asli, bagian ini akan melakukan Axios GET ke API Leonardo:
        // https://cloud.leonardo.ai/api/rest/v1/generations/{jobId}

        console.log(`Mengecek status untuk Job: ${jobId}`);

        // Simulasi logika agar loading berjalan beberapa kali sebelum 'Selesai'
        const randomChance = Math.random();
        
        if (randomChance > 0.3) {
            // 70% peluang video masih diproses
            res.json({ status: "PROCESSING" });
        } else {
            // 30% peluang video selesai, dan kita kirimkan link video sampel (Big Buck Bunny)
            res.json({ 
                status: "COMPLETE", 
                video_url: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" 
            });
        }

    } catch (error) {
        res.status(500).json({ success: false, error: "Gagal cek status." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server API Video berjalan di port ${PORT}`));
