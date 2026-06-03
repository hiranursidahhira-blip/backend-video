const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// FUNGSI KHUSUS: Mengunggah gambar lokal ke server penyimpanan Leonardo
async function uploadImageToLeonardo(file, apiKey) {
    const ext = file.originalname.split('.').pop() || 'jpg';

    // 1. Minta Presigned URL dari Leonardo
    const initRes = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ extension: ext })
    });
    
    const initData = await initRes.json();
    if (!initRes.ok) throw new Error("Gagal meminta izin upload gambar ke Leonardo");

    const { id, url, fields } = initData.uploadInitImage;

    // 2. Susun form data rahasia dari Leonardo
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(file.path);
    const blob = new Blob([fileBuffer], { type: file.mimetype });

    const parsedFields = JSON.parse(fields);
    for (const key in parsedFields) {
        formData.append(key, parsedFields[key]);
    }
    formData.append('file', blob, file.originalname);

    // 3. Tembak file aslinya ke penyimpanan mereka
    const uploadRes = await fetch(url, { method: 'POST', body: formData });
    if (!uploadRes.ok) throw new Error("Gagal mengunggah file gambar ke server Leonardo");

    // Hapus file sementara di Railway agar server tidak penuh
    fs.unlinkSync(file.path); 

    return id; // Mengembalikan ID Gambar Asli
}

// ENDPOINT 1: MENGIRIM REQUEST VIDEO ASLI
app.post('/api/generate-video', upload.array('images', 2), async (req, res) => {
    try {
        const { apiKey, model, prompt, duration, resolution } = req.body;
        const files = req.files;

        if (!apiKey) return res.status(400).json({ success: false, error: "API Key kosong!" });
        if (!files || files.length === 0) return res.status(400).json({ success: false, error: "Minimal upload 1 gambar (Gambar Awal)!" });

        console.log(`Memulai proses upload gambar ke Leonardo...`);
        
        // Upload gambar awal
        const startImageId = await uploadImageToLeonardo(files[0], apiKey);
        
        // Upload gambar akhir (jika ada)
        let endImageId = null;
        if (files.length > 1) {
            endImageId = await uploadImageToLeonardo(files[1], apiKey);
        }

        let endpointUrl = "";
        let payload = {};
        const width = resolution === "RESOLUTION_1080" ? 1920 : 1280;
        const height = resolution === "RESOLUTION_1080" ? 1080 : 720;

        console.log(`Menyusun prompt untuk model: ${model}`);

        if (model === "kling-3.0") {
            endpointUrl = "https://cloud.leonardo.ai/api/rest/v2/generations";
            payload = {
                model: "kling-3.0",
                public: false,
                parameters: {
                    prompt: prompt,
                    duration: parseInt(duration),
                    width: width, height: height,
                    mode: resolution,
                    motion_has_audio: false,
                    guidances: {
                        start_frame: [{ image: { id: startImageId, type: "UPLOADED" } }]
                    }
                }
            };
        } else if (model === "seedance-2.0") {
            endpointUrl = "https://cloud.leonardo.ai/api/rest/v2/generations";
            let guidances = { start_frame: [{ image: { id: startImageId, type: "UPLOADED" } }] };
            if (endImageId) guidances.end_frame = [{ image: { id: endImageId, type: "UPLOADED" } }];
            
            payload = {
                model: "seedance-2.0",
                public: false,
                parameters: {
                    prompt: prompt,
                    duration: parseInt(duration),
                    width: width, height: height,
                    mode: resolution,
                    prompt_enhance: "OFF",
                    guidances: guidances
                }
            };
        } else if (model === "VEO3_1") {
            endpointUrl = "https://cloud.leonardo.ai/api/rest/v1/generations-image-to-video";
            payload = {
                model: "VEO3_1",
                prompt: prompt,
                imageId: startImageId,
                imageType: "UPLOADED",
                resolution: resolution,
                duration: parseInt(duration),
                width: width, height: height
            };
            if (endImageId) {
                payload.endFrameImage = { id: endImageId, type: "UPLOADED" };
            }
        }

        // Eksekusi API Leonardo Asli!
        const genRes = await fetch(endpointUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const genData = await genRes.json();

        if (!genRes.ok) {
            console.log("Error dari Leonardo:", genData);
            return res.status(400).json({ success: false, error: genData.error || "Gagal menghubungi AI Model" });
        }

        const jobId = genData.sdGenerationJob.generationId || genData.sdGenerationJob.id;

        res.json({ success: true, model_used: model, job_id: jobId });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Terjadi kesalahan di server backend." });
    }
});

// ENDPOINT 2: MENGECEK STATUS VIDEO ASLI KE LEONARDO
app.post('/api/check-status', async (req, res) => {
    try {
        const { jobId, apiKey } = req.body;
        
        const statusRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${jobId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
        });
        
        const statusData = await statusRes.json();
        const generation = statusData.generations_by_pk;

        if (generation.status === 'COMPLETE') {
            // Cari link MP4
            let videoUrl = "";
            if (generation.generated_images && generation.generated_images.length > 0) {
                videoUrl = generation.generated_images[0].motionMP4URL || generation.generated_images[0].url;
            }
            res.json({ status: "COMPLETE", video_url: videoUrl });
        } else if (generation.status === 'FAILED') {
            res.json({ status: "FAILED" });
        } else {
            res.json({ status: generation.status }); // PENDING atau PROCESSING
        }

    } catch (error) {
        res.status(500).json({ success: false, error: "Gagal cek status dari Leonardo." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server API Video (MODE ASLI) berjalan di port ${PORT}`));
