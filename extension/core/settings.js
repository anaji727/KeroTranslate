export const DEFAULTS = Object.freeze({translationProvider:'demo', sttProvider:'demo', model:'gemini-3.5-flash-lite',openaiModel:'gpt-4.1-mini',deepseekModel:'deepseek-flash',deeplPlan:'free', source:'ja', target:'en', speechLanguage:'multi', captionTarget:'en', captionMode:'both', captionPosition:'BC', captionLines:2,captionSize:100,captionDuration:10});
export function sanitizeSettings(input={}) {
  const s = {...DEFAULTS};
  const enums = {translationProvider:['demo','gemini','openai','deepl','deepseek'],sttProvider:['demo','deepgram','openai','deepl'],deeplPlan:['free','pro'],source:['ja','en'],target:['ja','en'],speechLanguage:['multi','ja','en'],captionTarget:['ja','en'],captionMode:['both','original','translation'],captionPosition:['TL','TC','TR','ML','MC','MR','BL','BC','BR']};
  for (const [key, values] of Object.entries(enums)) if(values.includes(input[key])) s[key]=input[key];
  if (/^gemini-[a-z0-9.-]{1,70}$/.test(input.model || '')) s.model=input.model;
  if (/^gpt-[a-z0-9.-]{1,70}$/.test(input.openaiModel || '')) s.openaiModel=input.openaiModel;
  if (/^deepseek-[a-z0-9.-]{1,70}$/.test(input.deepseekModel || '')) s.deepseekModel=input.deepseekModel;
  if([1,2].includes(Number(input.captionLines))) s.captionLines=Number(input.captionLines);
  if([75,100,125,150,200].includes(Number(input.captionSize)))s.captionSize=Number(input.captionSize);
  if([5,7,10,15,20].includes(Number(input.captionDuration)))s.captionDuration=Number(input.captionDuration);
  s.target=s.source==='ja'?'en':'ja';
  return s;
}
