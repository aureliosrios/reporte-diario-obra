import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  console.log('Iniciando captura de pantalla del flujograma (Módulo ES)...');
  let browser;
  try {
    const htmlPath = path.resolve(__dirname, '../flujograma_valorizaciones.html');
    const outputPath = path.resolve(__dirname, '../flujograma_valorizaciones.png');
    
    console.log(`Cargando archivo HTML desde: ${htmlPath}`);
    console.log(`Guardando imagen PNG en: ${outputPath}`);

    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Configurar un viewport grande para capturar todo el flujograma vertical
    await page.setViewport({
      width: 1280,
      height: 2400,
      deviceScaleFactor: 2 // Escala 2x para obtener una imagen súper nítida y de alta calidad (Premium)
    });

    await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });

    console.log('Esperando a que termine de cargarse y dibujarse el flujograma (1.5s)...');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Tomar la captura de pantalla de la página completa
    await page.screenshot({
      path: outputPath,
      fullPage: false // Captura la ventana exacta que configuramos
    });

    console.log('¡Captura realizada con éxito y guardada como flujograma_valorizaciones.png!');
  } catch (error) {
    console.error('Error al realizar la captura de pantalla:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
