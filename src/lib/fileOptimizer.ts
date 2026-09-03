import { jsPDF } from "jspdf";

/**
 * Client-side file, image optimization & PDF conversion utility.
 * Resizes large smartphone camera photos and invoice scans down to crisp,
 * lightweight PDF documents before saving to localStorage or uploading to Supabase.
 */

export interface OptimizedFileResult {
  data: string; // Base64 data URL
  name: string;
  type: string;
  originalSize: number;
  optimizedSize: number;
  savingsText: string;
  isPdf: boolean;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Optimizes an uploaded document file:
 * - Resizes images to max dimensions (1600px) with high quality.
 * - Converts the resized image into a standardized, compressed single-page PDF document.
 * - If already a PDF, reads directly.
 */
export async function optimizeAndConvertToPdf(
  file: File,
  maxDimension = 1600,
  imageQuality = 0.82
): Promise<OptimizedFileResult> {
  const originalSize = file.size;

  const fileName = file.name || "document";
  const lower = fileName.toLowerCase();
  const isPdfFile = file.type === "application/pdf" || lower.endsWith(".pdf");
  const isImageFile = file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lower);

  // If already a PDF, read directly
  if (isPdfFile) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const data = reader.result as string;
        resolve({
          data,
          name: fileName,
          type: "application/pdf",
          originalSize,
          optimizedSize: originalSize,
          savingsText: `PDF (${formatFileSize(originalSize)})`,
          isPdf: true,
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  // If it's a regular image, resize and convert to PDF
  if (isImageFile) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

        // Proportional resizing
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Unable to create canvas context"));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        const compressedJpegData = canvas.toDataURL("image/jpeg", imageQuality);

        // Convert to jsPDF document matching orientation
        const orientation = width >= height ? "landscape" : "portrait";
        // Calculate page dimensions in mm (A4 baseline or custom fit)
        // A4 is 210 x 297 mm
        const pdf = new jsPDF({
          orientation,
          unit: "pt",
          format: [width, height],
          compress: true,
        });

        // Add image to full page bounds
        pdf.addImage(compressedJpegData, "JPEG", 0, 0, width, height, undefined, "FAST");

          const pdfDataUrl = pdf.output("datauristring");

          // Estimate file size
          const head = pdfDataUrl.indexOf(",") + 1;
          const optimizedSize = Math.round(((pdfDataUrl.length - head) * 3) / 4);

          // Clean filename to .pdf extension
          const baseName = fileName.replace(/\.[^/.]+$/, "");
          const pdfName = `${baseName}.pdf`;

          const savingsText =
            originalSize > optimizedSize
              ? `${formatFileSize(originalSize)} → ${formatFileSize(optimizedSize)} PDF`
              : `${formatFileSize(optimizedSize)} PDF`;

          resolve({
            data: pdfDataUrl,
            name: pdfName,
            type: "application/pdf",
            originalSize,
            optimizedSize,
            savingsText,
            isPdf: true,
          });
        };

        img.onerror = () => reject(new Error("Failed to load image for PDF conversion"));
        img.src = reader.result as string;
      };

      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  // Any other file type: preserve the original file as a generic attachment,
  // but still make it safe for storage and re-opening later.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      resolve({
        data,
        name: fileName,
        type: file.type || "application/octet-stream",
        originalSize,
        optimizedSize: originalSize,
        savingsText: `File (${formatFileSize(originalSize)})`,
        isPdf: false,
      });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Optimizes small avatar logos and category icons (keeps as lightweight JPEG/PNG).
 */
export async function optimizeLogoImage(
  file: File,
  maxDimension = 360,
  quality = 0.85
): Promise<OptimizedFileResult> {
  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({
            data: reader.result as string,
            name: file.name,
            type: file.type,
            originalSize,
            optimizedSize: originalSize,
            savingsText: formatFileSize(originalSize),
            isPdf: false,
          });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
        const compressedDataUrl = canvas.toDataURL(mime, quality);

        const head = compressedDataUrl.indexOf(",") + 1;
        const optimizedSize = Math.round(((compressedDataUrl.length - head) * 3) / 4);

        resolve({
          data: compressedDataUrl,
          name: file.name,
          type: mime,
          originalSize,
          optimizedSize,
          savingsText: `${formatFileSize(originalSize)} → ${formatFileSize(optimizedSize)}`,
          isPdf: false,
        });
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = reader.result as string;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
