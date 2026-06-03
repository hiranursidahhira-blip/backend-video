const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

app.post('/api/generate-video', upload.array('images', 2), async (req, res) => {
    try {
        const { apiKey, model, prompt, duration, resolution } = req.body;
        const files = req.files;

        if (!apiKey) return res.status(400).json({ success: false, error: "API Key tidak boleh kosong!" });
        if (!files || files.length === 0) return res.status(400).json({ success: false, error: "Minimal upload 1 gambar awal!" });

        /* =============================================================================
        CATATAN PENTING UNTUK PRODUKSI:
        Di sistem aslinya, gambar dari `req.files` harus di-upload dulu ke endpoint 
        https://cloud.leonardo.ai/api/rest/v1/init-image milik Leonardo untuk 
        mendapatkan "id". 
        
        Karena kode untuk presigned S3 upload sangat panjang, di bawah ini saya 
        gunakan ID statis (MOCK) agar kamu bisa melihat struktur logikanya berjalan.
        =============================================================================
        */
        const startImageId = "id-gambar-awal-dummy"; 
        const endImageId = "id-gambar-akhir-dummy";

        let endpointUrl = "";
        let payload = {};

        // 1. LOGIKA UNTUK KLING 3.0 (Berdasarkan curl kamu)
        if (model === "kling-3.0") {
            endpointUrl = "https://cloud.leonardo.ai/api/rest/v2/generations";
            payload = {
                model: "kling-3.0",
                public: false,
                parameters: {
                    prompt: prompt,
                    duration: parseInt(duration),
                    width: 1920,
                    height: 1080,
                    mode: resolution,
                    motion_has_audio: true,
                    guidances: {
                        start_frame: [{ image: { id: startImageId, type: "GENERATED" } }]
                    }
                }
            };
        } 
        
        // 2. LOGIKA UNTUK SEEDANCE 2.0 (Berdasarkan curl kamu)
        else if (model === "seedance-2.0") {
            endpointUrl = "https://cloud.leonardo.ai/api/rest/v2/generations";
            payload = {
                model: "seedance-2.0",
                public: false,
                parameters: {
                    prompt: prompt,
                    duration: parseInt(duration),
                    width: 1280,
                    height: 720,
                    mode: resolution,
                    prompt_enhance: "OFF",
                    guidances: {
                        start_frame: [{ image: { id: startImageId, type: "UPLOADED" } }],
                        end_frame: [{ image: { id: endImageId, type: "GENERATED" } }]
                    }
                }
            };
        }

        // 3. LOGIKA UNTUK VEO 3.1 (Berdasarkan curl kamu)
        else if (model === "VEO3_1") {
            endpointUrl = "https://cloud.leonardo.ai/api/rest/v1/generations-image-to-video";
            payload = {
                model: "VEO3_1",
                prompt: prompt,
                imageId: startImageId,
                imageType: "UPLOADED",
                endFrameImage: { id: endImageId, type: "UPLOADED" },
                resolution: resolution,
                duration: parseInt(duration),
                width: 1920,
                height: 1080
            };
        }

        // Tampilkan bentuk JSON di Console Railway (agar kamu bisa cek)
        console.log(`Mengirim Request ke ${endpointUrl} dengan payload:`, JSON.stringify(payload, null, 2));

        /*
        // UNTUK MENJALANKAN API ASLINYA, HAPUS KOMENTAR DI BAWAH INI:
        
        const apiResponse = await axios.post(endpointUrl, payload, {
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'authorization': `Bearer ${apiKey}`
            }
        });
        
        return res.json({ success: true, model_used: model, job_id: apiResponse.data.sdGenerationJob.generationId });
        */

        // Respon simulasi (Mock) sebelum integrasi upload gambar selesai
        res.json({
            success: true,
            message: "Payload berhasil dibentuk. Cek console log di Railway!",
            model_used: model,
            job_id: "test-job-id-12345"
        });

    } catch (error) {
        console.error("Terjadi error:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "Terjadi kesalahan backend. Cek log server." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server API Video berjalan di port ${PORT}`);
});
