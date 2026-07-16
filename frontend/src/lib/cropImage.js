// Crop an uploaded image file to a square JPEG data URL — shared by the team
// logo upload (Team.jsx) and the account avatar upload (Account.jsx).
export function readCroppedImage(file, { size = 256, maxBytes = 300 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Choose an image."));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d");
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale,
        h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      const data = c.toDataURL("image/jpeg", 0.85);
      if (data.length > maxBytes) return reject(new Error("Image too large."));
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    img.src = url;
  });
}
