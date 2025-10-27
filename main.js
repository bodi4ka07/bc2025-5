const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { program } = require('commander');
const superagent = require('superagent');

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

// Отримання картинки з http.cat
async function fetchFromHttpCat(code) {
  try {
    const response = await superagent.get(`https://http.cat/${code}`);
    return response.body;
  } catch (error) {
    throw new Error(`Не вдалося отримати картинку з http.cat: ${error.message}`);
  }
}

// Обробка GET запиту
async function handleGet(code, res) {
  const cachePath = getCachePath(code);
  
  try {
    // Спробувати прочитати з кешу
    const data = await fs.readFile(cachePath);
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    res.end(data);
    console.log(`GET ${code} - відправлено з кешу`);
  } catch (error) {
    // Якщо в кеші немає, запитати з http.cat
    try {
      console.log(`GET ${code} - відсутній в кеші, запит до http.cat`);
      const imageData = await fetchFromHttpCat(code);
      
      // Зберегти в кеш
      await fs.writeFile(cachePath, imageData);
      console.log(`GET ${code} - збережено в кеш`);
      
      // Відправити клієнту
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(imageData);
    } catch (fetchError) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      console.log(`GET ${code} - не знайдено`);
    }
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

// Обробка DELETE запиту
async function handleDelete(code, res) {
  const cachePath = getCachePath(code);
  
  try {
    await fs.unlink(cachePath);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    console.log(`DELETE ${code} - видалено з кешу`);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    console.log(`DELETE ${code} - не знайдено в кеші`);
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
  
 // Обробка різних методів
  if (method === 'GET') {
    await handleGet(code, res);
  } else if (method === 'PUT') {
    await handlePut(code, req, res);
  } else if (method === 'DELETE') {
    await handleDelete(code, res);
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