import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('extension/manifest.json',root),'utf8'));
const label=`Beta ${manifest.version_name || manifest.version}`;
await writeFile(new URL('extension/core/version.js',root),`// Generated from manifest.json by tools/sync-version.js.\nexport const RELEASE_LABEL=${JSON.stringify(label)};\n`);
for(const name of ['popup','options']){
  const path=new URL(`extension/${name}.html`,root);
  const html=await readFile(path,'utf8');
  await writeFile(path,html.replace(/<span class="pill">[^<]*<\/span>/,`<span class="pill">${label}${name==='options'?' / SETTINGS':''}</span>`));
}
