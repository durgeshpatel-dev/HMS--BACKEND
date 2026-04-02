import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response.util';
import config from '../config/env';

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.resolve(config.upload.path);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// File filter — only images
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize }, // default 5MB
});

// All upload routes require authentication
router.use(requireAuth);

router.post(
  '/',
  requireRole(['manager', 'super_admin']),
  upload.single('file'),
  (req, res) => {
    try {
      if (!req.file) {
        return sendError(res, 'No file provided', 400);
      }

      // Build a publicly-accessible URL for the file
      const fileUrl = `/uploads/${req.file.filename}`;

      return sendSuccess(res, { fileUrl, url: fileUrl }, 'File uploaded successfully', 201);
    } catch (error: any) {
      return sendError(res, error.message || 'Upload failed', 400);
    }
  }
);

/**
 * DELETE /upload — Delete an uploaded file
 */
router.delete(
  '/',
  requireRole(['manager', 'super_admin']),
  (req, res) => {
    try {
      const { fileUrl } = req.body;
      if (!fileUrl || typeof fileUrl !== 'string') {
        return sendError(res, 'fileUrl is required', 400);
      }

      // Extract filename from URL and resolve full path
      const filename = path.basename(fileUrl);
      const filePath = path.join(uploadDir, filename);

      // Security: ensure the resolved path is inside uploadDir
      if (!filePath.startsWith(uploadDir)) {
        return sendError(res, 'Invalid file path', 400);
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return sendSuccess(res, null, 'File deleted successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Delete failed', 400);
    }
  }
);

export default router;
