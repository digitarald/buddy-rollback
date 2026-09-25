// Bundles src/ into a single self-contained dist/index.html (works from file://, no server needed).
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');

async function build() {
	const t0 = Date.now();
	const result = await esbuild.build({
		entryPoints: [path.join(__dirname, 'src/main.js')],
		bundle: true,
		format: 'esm',
		minify: !process.argv.includes('--dev'),
		target: 'es2020',
		write: false,
		legalComments: 'none',
	});
	const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
	const tpl = fs.readFileSync(path.join(__dirname, 'index.template.html'), 'utf8');
	const [head, tail] = tpl.split('/*__BUNDLE__*/');
	fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
	fs.writeFileSync(path.join(__dirname, 'dist/index.html'), head + js + tail);
	const kb = (fs.statSync(path.join(__dirname, 'dist/index.html')).size / 1024).toFixed(0);
	console.log(`built dist/index.html (${kb} KB) in ${Date.now() - t0}ms`);
}

build().catch((e) => { console.error(e.message); process.exit(1); });
if (watch) fs.watch(path.join(__dirname, 'src'), { recursive: true }, () => build().catch((e) => console.error(e.message)));
