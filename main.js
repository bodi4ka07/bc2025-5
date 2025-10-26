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

// Обробка PUT запиту
async function handlePut(code, req, res) {
  const cachePath = getCachePath(code);
  const chunks = [];
  
  req.on('data', chunk => {
    chunks.push(chunk);
  });
  
  req.on('end', async () => {
    try {
      const imageData = Buffer.concat(chunks);
      await fs.writeFile(cachePath, imageData);
      res.writeHead(201, { 'Content-Type': 'text/plain' });
      res.end('Created');
      console.log(`PUT ${code} - збережено в кеш`);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      console.error(`PUT ${code} - помилка: ${error.message}`);
    }
  });
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
  
  // Обробка різних методів
  if (method === 'GET') {
    await handleGet(code, res);
  } else if (method === 'PUT') {
    await handlePut(code, req, res);
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