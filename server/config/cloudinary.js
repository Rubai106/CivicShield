const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const looksLikePlaceholder = (v) =>
  !v || String(v).trim() === '' || String(v).includes('your_');

const hasRealCloudinary =
  !looksLikePlaceholder(process.env.CLOUDINARY_CLOUD_NAME) &&
  !looksLikePlaceholder(process.env.CLOUDINARY_API_KEY) &&
  !looksLikePlaceholder(process.env.CLOUDINARY_API_SECRET);

// Cloudinary is optional for Sprint-1 demos; fall back to local storage if keys are placeholders.
if (hasRealCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

let upload;

if (hasRealCloudinary) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const folder = 'civicshield/evidence';
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm'];

      if (!allowed.includes(file.mimetype)) {
        throw new Error('Invalid file type. Allowed: images, PDFs, videos.');
      }

      return {
        folder,
        resource_type: file.mimetype.startsWith('video') ? 'video' : 'auto',
        public_id: `evidence_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
        transformation: file.mimetype.startsWith('image') ? [{ quality: 'auto', fetch_format: 'auto' }] : undefined,
      };
    },
  });

  upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type'), false);
      }
    },
  });
} else {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      const name = `evidence_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
      cb(null, name);
    },
  });

  upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm'];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error('Invalid file type'), false);
    },
  });
}

module.exports = { cloudinary, upload };
