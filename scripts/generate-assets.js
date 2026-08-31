const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// A minimal valid 1x1 red/orange PNG base64 string
const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const buffer = Buffer.from(base64Png, 'base64');

['icon.png', 'adaptive-icon.png', 'splash-icon.png', 'favicon.png'].forEach(file => {
  fs.writeFileSync(path.join(assetsDir, file), buffer);
});

console.log('✅ Generated placeholder asset images in ./assets/');
