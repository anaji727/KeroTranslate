export const DEFAULTS = Object.freeze({translationProvider:'demo', sttProvider:'demo', model:'gemini-3.5-flash-lite', source:'ja', target:'en', speechLanguage:'multi', captionTarget:'en', captionMode:'both', captionPosition:'BC', captionLines:2});
export function sanitizeSettings(input={}) {
  const s = {...DEFAULTS};
  const enums = {translationProvider:['demo','gemini'],sttProvider:['demo','deepgram'],source:['ja','en'],target:['ja','en'],speechLanguage:['multi','ja','en'],captionTarget:['ja','en'],captionMode:['both','original','translation'],captionPosition:['TL','TC','TR','ML','MC','MR','BL','BC','BR']};
  for (const [key, values] of Object.entries(enums)) if(values.includes(input[key])) s[key]=input[key];
  if (/^gemini-[a-z0-9.-]{1,70}$/.test(input.model || '')) s.model=input.model;
  if([1,2].includes(Number(input.captionLines))) s.captionLines=Number(input.captionLines);
  s.target=s.source==='ja'?'en':'ja';
  return s;
}
