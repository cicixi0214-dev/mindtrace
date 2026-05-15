const sharp = require("sharp");
const fs = require("fs");

// Create SVG icon: "思" character in a rounded square
const sizes = [192, 512];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#bg)"/>
  <text x="256" y="310" font-family="'Songti SC', 'Noto Serif SC', serif" font-size="280" fill="white" text-anchor="middle" font-weight="bold">思</text>
</svg>`;

fs.writeFileSync("public/icons/icon.svg", svg);

for (const size of sizes) {
  sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`)
    .then(() => console.log(`Generated ${size}x${size} PNG`));
}
