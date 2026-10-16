/**
 * Utility functions for compressing and processing screenshot images of court judgments.
 * Prevents memory blow-up, browser freezes, localStorage QuotaExceededError,
 * and Firestore 1MB document size limits while maintaining high clarity for reading Thai legal text.
 */

export interface CompressedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  mimeType?: 'image/jpeg' | 'image/webp';
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 1600,
  maxHeight: 2200,
  quality: 0.82,
  mimeType: 'image/jpeg',
};

/**
 * Compress an image File or Blob to a lightweight base64 Data URL
 */
export async function compressImageFile(
  file: File | Blob,
  customOptions?: CompressOptions
): Promise<CompressedImageResult> {
  const options = { ...DEFAULT_OPTIONS, ...customOptions };
  const originalSize = file.size;

  // Verify it is an image
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('ไฟล์ที่เลือกไม่ใช่รูปภาพ กรุณาเลือกไฟล์ภาพ (PNG, JPG, WEBP)');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('เกิดข้อผิดพลาดในการอ่านไฟล์ภาพ'));
    };

    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        reject(new Error('ไม่สามารถโหลดข้อมูลภาพได้'));
        return;
      }

      const img = new Image();
      img.onerror = () => {
        reject(new Error('เบราว์เซอร์ไม่สามารถถอดรหัสรูปภาพนี้ได้ อาจเป็นไฟล์ที่ชำรุด'));
      };

      img.onload = () => {
        try {
          let { width, height } = img;
          const maxW = options.maxWidth || 1600;
          const maxH = options.maxHeight || 2200;

          // Calculate aspect ratio preserving dimensions
          if (width > maxW || height > maxH) {
            const ratio = Math.min(maxW / width, maxH / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          // Create offscreen canvas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) {
            // Fallback to raw if canvas context is unavailable
            resolve({
              dataUrl: rawDataUrl,
              width: img.width,
              height: img.height,
              originalSize,
              compressedSize: rawDataUrl.length,
            });
            return;
          }

          // Set high quality smoothing for sharp text readability
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Fill white background in case of transparent PNG screenshots
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // Draw the image
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG/WebP
          let compressedDataUrl = canvas.toDataURL(
            options.mimeType || 'image/jpeg',
            options.quality || 0.82
          );

          // If still over 700KB, do a second-pass with slightly lower quality (0.72)
          if (compressedDataUrl.length > 700 * 1024) {
            compressedDataUrl = canvas.toDataURL('image/jpeg', 0.72);
          }

          resolve({
            dataUrl: compressedDataUrl,
            width,
            height,
            originalSize,
            compressedSize: compressedDataUrl.length,
          });
        } catch (canvasErr) {
          console.warn('Canvas compression error, falling back to original:', canvasErr);
          resolve({
            dataUrl: rawDataUrl,
            width: img.width,
            height: img.height,
            originalSize,
            compressedSize: rawDataUrl.length,
          });
        }
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Extract and compress image from clipboard items
 */
export async function getCompressedImageFromClipboard(
  items: DataTransferItemList | null | undefined,
  defaultNamePrefix = 'ภาพแคปคำพิพากษา'
): Promise<{ dataUrl: string; fileName: string; sizeKb: number } | null> {
  if (!items || items.length === 0) return null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile();
      if (file) {
        const compressed = await compressImageFile(file);
        const fileName = `${defaultNamePrefix}_${new Date().toISOString().slice(0, 10)}.jpg`;
        const sizeKb = Math.round(compressed.compressedSize / 1024);
        return {
          dataUrl: compressed.dataUrl,
          fileName,
          sizeKb,
        };
      }
    }
  }

  return null;
}
