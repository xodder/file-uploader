const extensionToFileTypeMap: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
};

function getFileTypeFromExtension(file: File) {
  const extension = file.name.substring(file.name.lastIndexOf('.') + 1);

  return extensionToFileTypeMap[extension];
}

export default getFileTypeFromExtension;
