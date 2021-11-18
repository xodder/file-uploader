
export function generateRandomStr(length: number = 5) {
  return '';
}

const extensionToFileTypeMap = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
};

export function getFileTypeFromExtension(file: File) {
  const extension = file.name.substr(file.name.lastIndexOf('.') + 1);
  return (extensionToFileTypeMap as any)[extension];
}

// -------------------------------------------
// ....
// -------------------------------------------

export function getFileThumbnailUrl(file: File, maxSize: number) {
  return new Promise<string>((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = async function () {
        if (this.result) {
          getResizedImageData(this.result, maxSize, maxSize).then((url) => {
            resolve(url);
            URL.revokeObjectURL(url);
          }, () => {});
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

function getResizedImageData(url: string | ArrayBuffer, preferredWidth: number, preferredHeight: number) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();

    image.onload = function () {
      const aspectRatio = image.naturalWidth / image.naturalHeight;

      let resolvedWidth = preferredWidth * aspectRatio;
      let resolvedHeight = preferredHeight / aspectRatio;

      if (resolvedWidth > resolvedHeight) {
        resolvedWidth = preferredWidth;
        resolvedHeight = resolvedWidth / aspectRatio;
      } else {
        resolvedHeight = preferredHeight;
        resolvedWidth = resolvedHeight * aspectRatio;
      }

      var canvas = document.createElement('canvas');
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

    image.src = url.toString();
  });
}


