import {readFile,writeFile,mkdir} from 'node:fs/promises';
await import('./sync-version.js');
const scripts=['extension/core/version.js','extension/core/settings.js','extension/core/composer.js','extension/core/providers.js','extension/ui/style.js','extension/ui/composer-view.js','extension/ui/captions.js','demo/demo.js'];
let js='';for(const file of scripts){let source=await readFile(file,'utf8');source=source.replace("new URL('../assets/kero-frog.png',import.meta.url).href",JSON.stringify('data:image/png;base64,'+(await readFile('extension/assets/kero-frog.png')).toString('base64')));source=source.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');js+=source+'\n';}
new Function(js); // Validate the assembled offline script without running DOM code.
let html=await readFile('demo/index.html','utf8');const css=await readFile('demo/demo.css','utf8');html=html.replace('<link rel="stylesheet" href="demo.css">',`<style>${css}</style>`).replace('<script type="module" src="demo.js"></script>',`<script type="module">${js.replaceAll('</script','<\\/script')}</script>`);
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/KeroTranslate-Preview.html',html);console.log('Standalone preview created in artifacts/.');
