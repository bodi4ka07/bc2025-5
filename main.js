const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { program } = require('commander');

// Налаштування параметрів командного рядка
program
  .requiredOption('-h, --host <host>', 'Адреса сервера')
  .requiredOption('-p, --port <port>', 'Порт сервера')
  .requiredOption('-c, --cache <path>', 'Шлях до директорії кешу');

program.parse();

const options = program.opts();
const { host, port, cache } = options;

// Створення директорії для кешу
async function ensureCacheDir() {
  try {
    await fs.access(cache);
  } catch {
    await fs.mkdir(cache, { recursive: true });
    console.log(`Створено директорію кешу: ${cache}`);
  }
}

// Отримання шляху до файлу кешу
function getCachePath(code) {
  return path.join(cache, `${code}.jpg`);
}

// Обробка GET запиту
async function handleGet(code, res) {
  const cachePath = getCachePath(code);
  
  try {
    const data = await fs.readFile(cachePath);
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    res.end(data);
    console.log(`GET ${code} - відправлено з кешу`);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    console.log(`GET ${code} - не знайдено в кеші`);
  }
}

// Створення HTTP сервера
const server = http.createServer(async (req, res) => {
  const method = req.method;
  const url = req.url;
  const code = url.slice(1);
  
  console.log(`${method} ${url}`);
  
  // Перевірка валідності коду
  if (!code || !/^\d{3}$/.test(code)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request - Invalid HTTP status code');
    return;
  }
  
  // Обробка GET
  if (method === 'GET') {
    await handleGet(code, res);
  } else {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
  }
});

// Запуск сервера
async function startServer() {
  await ensureCacheDir();
  
  server.listen(port, host, () => {
    console.log(`Проксі-сервер запущено на http://${host}:${port}`);
    console.log(`Директорія кешу: ${cache}`);
  });
}

startServer().catch(error => {
  console.error('Помилка запуску сервера:', error);
  process.exit(1);
});