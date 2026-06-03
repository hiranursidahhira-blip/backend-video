const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// FUNGSI KHUSUS: Pembersih Karakter Gaib
function cleanKey(key) {
    if (!key) return "";
    return key.replace(/[^\x20-\x7E]/g, '').trim();
}

// FUNGSI KHUSUS: Mengunggah gambar ke Leonardo 
async function uploadImageToLeonardo(file, apiKey) {
    try {
        const ext = file.originalname.split('.').pop() || 'jpg';
        
        const initRes = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ extension: ext })
        });
        
        const initData = await initRes.json();
        if (!initRes.ok) throw new Error("Ditolak Leonardo (Init): " + JSON.stringify(initData));

        const { id, url, fields } = initData.uploadInitImage;

        const formData = new FormData();
        const parsedFields = JSON.parse(fields);
        for (const key in parsedFields) {
            formData.append(key, parsedFields[key]);
        }
        
        const fileBuffer = fs.readFileSync(file.path);
        const blob = new Blob([fileBuffer], { type: file.mimetype });
        formData.append('file', blob, file.originalname);

        const uploadRes = await fetch(url, { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error("Gagal mengunggah gambar ke S3 Leonardo.");

        fs.unlinkSync(file.path); 
        return id;
    } catch (err) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw err;
    }
}

// ENDPOINT 1: MENGIRIM REQUEST VIDEO
app.post('/api/generate-video', upload.array('images', 2), async (req, res) => {
    try {
        let { apiKey, model, prompt, duration, resolution } = req.body;
        const files = req.files;
        
        apiKey = cleanKey(apiKey);

        if (!apiKey) throw new Error("API Key kosong!");
        if (!files || files.length === 0) throw new Error("Minimal upload 1 gambar!");

        const startImageId = await uploadImageToLeonardo(files[0], apiKey);
        
        let endImageId = null;
        if (files.length > 1) {
            endImageId = await uploadImageToLeonardo(files[1], apiKey);
        }

        let endpointUrl = "https://cloud.leonardo.ai/api/rest/v2/generations";
        let payload = {};
        const width = resolution === "RESOLUTION_1080" ? 1920 : 1280;
        const height = resolution === "RESOLUTION_1080" ? 1080 : 720;

        if (model === "kling-3.0") {
            payload = {
                model: "kling-3.0",
                public: false,
                parameters: {
                    prompt: prompt,
                    duration: parseInt(duration),
                    width: width, height: height,
                    mode: resolution,
                    motion_has_audio: false,
                    guidances: { start_frame: [{ image: { id: startImageId, type: "UPLOADED" } }] }
                }
            };
        } else if (model === "seedance-2.0") {
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
            if (endImageId) payload.endFrameImage = { id: endImageId, type: "UPLOADED" };
        }

        const genRes = await fetch(endpointUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const genData = await genRes.json();
        if (!genRes.ok) throw new Error("Error dari Leonardo API: " + JSON.stringify(genData));

        // PENGEMBANGAN: Server sekarang bisa membaca berbagai format "laci" dari Leonardo
        let jobId = null;
        if (genData.generate && genData.generate.generationId) {
            jobId = genData.generate.generationId; // <--- Ini laci yang baru!
        } else if (genData.sdGenerationJob) {
            jobId = genData.sdGenerationJob.generationId || genData.sdGenerationJob.id;
        } else if (genData.generationId) {
            jobId = genData.generationId;
        }

        if (!jobId) throw new Error("Gagal mendapatkan Job ID. Data: " + JSON.stringify(genData));

        res.json({ success: true, model_used: model, job_id: jobId });

    } catch (error) {
        console.error("Error Backend:", error.message);
        res.status(500).json({ success: false, error: error.message || "Terjadi kesalahan backend." });
    }
});

// ENDPOINT 2: MENGECEK STATUS VIDEO
app.post('/api/check-status', async (req, res) => {
    try {
        let { jobId, apiKey } = req.body;
        apiKey = cleanKey(apiKey);

        const statusRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${jobId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
        });
        const statusData = await statusRes.json();
        
        if (!statusData.generations_by_pk) throw new Error("Job ID tidak ditemukan di Leonardo");
        
        const generation = statusData.generations_by_pk;

        if (generation.status === 'COMPLETE') {
            let videoUrl = "";
            if (generation.generated_images && generation.generated_images.length > 0) {
                videoUrl = generation.generated_images[0].motionMP4URL || generation.generated_images[0].url;
            }
            res.json({ status: "COMPLETE", video_url: videoUrl });
        } else if (generation.status === 'FAILED') {
            res.json({ status: "FAILED" });
        } else {
            res.json({ status: generation.status }); 
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server API Video berjalan di port ${PORT}`));
