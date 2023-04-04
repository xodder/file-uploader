const charset =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateRandomStr(length = 5) {
  return Array.from({ length }, () => {
    return charset[Math.round(Math.random() * charset.length)];
  }).join('');
}

export default generateRandomStr;
