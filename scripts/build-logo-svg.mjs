import fs from 'node:fs'
import path from 'node:path'

const png = fs.readFileSync(path.join('public', 'logo-white.png'))
const b64 = png.toString('base64')
const size = 1254

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
  <image width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${b64}"/>
</svg>
`

fs.writeFileSync(path.join('public', 'logo-svg.svg'), svg)
console.log('logo-svg.svg bytes:', svg.length)
