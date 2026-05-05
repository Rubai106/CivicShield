const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const looksLikePlaceholder = (v) =>
  !v || String(v).trim() === '' || String(v).includes('your_');

const hasRealCloudinary =
  !looksLikePlaceholder(process.env.CLOUDINARY_CLOUD_NAME) &&
  !looksLikePlaceholder(process.env.CLOUDINARY_API_KEY) &&
  !looksLikePlaceholder(process.env.CLOUDINARY_API_SECRET);

if (hasRealCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm'];

// Always use memoryStorage so the buffer is available for SHA-256 hashing.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Allowed: images, PDFs, videos.'), false);
  },
});

const uploadsDir = path.join(__dirname, '..', 'uploads');

function uploadStreamToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });
}

// Middleware: computes SHA-256 for each uploaded file from the in-memory buffer,
// then persists it (Cloudinary stream or local disk write).
// Attaches .sha256, .path (Cloudinary URL) or .filename (disk), and .public_id
// so existing route code continues to work without changes.
async function processUploadedFiles(req, res, next) {
  if (!req.files || req.files.length === 0) return next();
  try {
    for (const file of req.files) {
      file.sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');

      if (hasRealCloudinary) {
        const publicId = `evidence_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
        const result = await uploadStreamToCloudinary(file.buffer, {
          folder: 'civicshield/evidence',
          public_id: publicId,
          resource_type: file.mimetype.startsWith('video') ? 'video' : 'auto',
          transformation: file.mimetype.startsWith('image')
            ? [{ quality: 'auto', fetch_format: 'auto' }]
            : undefined,
        });
        // Set properties expected by existing route code
        file.path = result.secure_url;   // routes check: file.path.startsWith('http')
        file.public_id = result.public_id;
      } else {
        fs.mkdirSync(uploadsDir, { recursive: true });
        const ext = path.extname(file.originalname) || '';
        const filename = `evidence_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
        fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
        file.filename = filename;        // routes use: file.filename
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { cloudinary, upload, processUploadedFiles };
