const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

app.post('/api/generate-video', upload.array('images', 2), async (req, res) => {
    try {
        // Ambil apiKey, ratio, dan quality dari data yang dikirim frontend
        const { ratio, quality, apiKey } = req.body;
        const files = req.files;

        // Validasi input
        if (!apiKey) {
            return res.status(400).json({ success: false, error: "API Key tidak boleh kosong! Isi di halaman web terlebih dahulu." });
        }

        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, error: "Gambar karakter harus diupload" });
        }

        // Sensor sebagian API key untuk keamanan tampilan log di server
        const censoredKey = apiKey.substring(0, 6) + "**********";
        console.log(`Menerima Request dengan API Key: ${censoredKey}`);
        
        // Respon sukses sementara dari server backend
        res.json({
            success: true,
            message: "Permintaan video berhasil diteruskan ke Leonardo AI",
            api_used: censoredKey,
            data: {
                ratio: ratio,
                quality: quality,
                status: "PROCESSING"
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Terjadi kesalahan backend" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server dinamis berjalan di port ${PORT}`);
});
