type FileReaderResult = FileReader['result'];

export function getFileThumbnailUrl(file: File, maxSize: number) {
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

function resizeImage(url: FileReaderResult, w: number, h: number) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();

    image.onload = function () {
      const naturalAspectRatio = image.naturalWidth / image.naturalHeight;

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
        ctx.drawImage(image, 0, 0, resolvedWidth, resolvedHeight);
        resolve(canvas.toDataURL());
      }
    };

    image.src = urlToSrc(url);
  });
}

function urlToSrc(url: FileReaderResult) {
  if (!url) return '';

  return typeof url === 'string' ? url : new TextDecoder().decode(url);
}
