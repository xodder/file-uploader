function getFileThumbnailUrl(file: File, maxSize: number) {
  return new Promise<string>((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = async function () {
        if (this.result) {
          const url = await resizeImage(this.result, maxSize, maxSize);
          resolve(url);
          URL.revokeObjectURL(url);
        }
      };
      reader.onerror = function () {
        resolve('');
      };
      reader.readAsDataURL(file);
    } catch (e) {
      resolve('');
    }
  });
}

function resizeImage(url: string | ArrayBuffer, w: number, h: number) {
  return new Promise<string>((resolve, reject) => {
    const srcImage = new Image();

    srcImage.onload = function () {
      const naturalAspectRatio = srcImage.naturalWidth / srcImage.naturalHeight;

      let resolvedWidth = w * naturalAspectRatio;
      let resolvedHeight = h / naturalAspectRatio;

      if (resolvedWidth > resolvedHeight) {
        resolvedWidth = w;
        resolvedHeight = resolvedWidth / naturalAspectRatio;
      } else {
        resolvedHeight = h;
        resolvedWidth = resolvedWidth / naturalAspectRatio;
      }

      const canvas = document.createElement('canvas');
      canvas.width = resolvedWidth;
      canvas.height = resolvedHeight;

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject('Image could not be resized. No canvas context.');
      } else {
        ctx.drawImage(srcImage, 0, 0, resolvedWidth, resolvedHeight);
        resolve(canvas.toDataURL());
      }
    };

    srcImage.src = url.toString();
  });
}

export default getFileThumbnailUrl;
