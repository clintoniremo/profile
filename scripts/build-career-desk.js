const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
async function build() {
  const root = path.resolve(__dirname, '..');
  await esbuild.build({entryPoints:[path.join(root,'career-desk/src/main.tsx')],bundle:true,minify:true,jsx:'automatic',outfile:path.join(root,'assets/career-desk/app.js'),alias:{'@':path.join(root,'career-desk/src')},define:{'process.env.NODE_ENV':'"production"'},target:['es2020']});
  await esbuild.build({entryPoints:[path.join(root,'career-desk/src/lib/career.ts')],bundle:true,platform:'node',format:'cjs',outfile:path.join(root,'career-desk-server/drafting.cjs')});
  const from = path.join(root,'career-desk/src/style.css');
  const result = await postcss([tailwind({base:path.join(root,'career-desk')})]).process(fs.readFileSync(from,'utf8'),{from});
  fs.writeFileSync(path.join(root,'assets/career-desk/app.css'),result.css);
}
build().catch(error=>{console.error(error);process.exitCode=1;});
