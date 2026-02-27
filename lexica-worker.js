// LEXICA V0 — SLM Web Worker
// Runs SmolLM2 / Flan-T5 inference off the main thread
const TRANSFORMERS_URLS=[
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.0',
];
const MODEL_CASCADE=[
  {id:'HuggingFaceTB/SmolLM2-360M-Instruct',type:'text-generation',isDecoder:true},
  {id:'HuggingFaceTB/SmolLM2-135M-Instruct',type:'text-generation',isDecoder:true},
  {id:'Xenova/flan-t5-base',type:'text2text-generation',isDecoder:false},
  {id:'Xenova/flan-t5-small',type:'text2text-generation',isDecoder:false},
];
let _pipe=null,_isDecoder=false,_ready=false;

function clean(raw){
  return(raw||'')
    .replace(/^(I'm sorry[^.!?]*[.!?]\s*)+/gi,'')
    .replace(/^(As an AI[^.!?]*[.!?]\s*)+/gi,'')
    .replace(/^(Sure[,!]\s*[^.!?]*[.!?]\s*)/i,'')
    .replace(/^Lexica:\s*/i,'')
    .split('\n').filter(l=>!/^\s*[\*\-•]|^\s*\d+\./.test(l)).join(' ')
    .replace(/\s{2,}/g,' ').split(/\n\n/)[0].slice(0,500).trim();
}

async function initModel(){
  let pipelineFn=null;
  for(const url of TRANSFORMERS_URLS){
    try{
      const mod=await import(url);
      pipelineFn=mod.pipeline??mod.default?.pipeline??null;
      const env=mod.env??mod.default?.env??null;
      if(env){try{env.allowLocalModels=false;env.useBrowserCache=true;}catch(_){}}
      if(typeof pipelineFn==='function'){self.postMessage({type:'progress',status:'transformers_ok',url});break;}
    }catch(e){self.postMessage({type:'progress',status:'cdn_fail',url,error:e.message});}
  }
  if(!pipelineFn){self.postMessage({type:'progress',status:'failed',error:'Transformers.js unavailable'});return;}
  for(const{id,type,isDecoder}of MODEL_CASCADE){
    try{
      self.postMessage({type:'progress',status:'loading',model:id});
      _pipe=await pipelineFn(type,id,{
        progress_callback(info){
          if(info.status==='downloading'||info.status==='progress')
            self.postMessage({type:'progress',status:'download',model:id,loaded:info.loaded||0,total:info.total||1});
        }
      });
      _isDecoder=isDecoder;_ready=true;
      self.postMessage({type:'ready',model:id,isDecoder});
      return;
    }catch(e){self.postMessage({type:'progress',status:'model_fail',model:id,error:e.message});}
  }
  self.postMessage({type:'progress',status:'failed',error:'All models failed'});
}

async function generate(taskPrefix,contentPrompt,maxTokens,history){
  if(!_ready)throw new Error('not ready');
  let raw='';
  if(_isDecoder){
    const sys='You are Lexica, a concise knowledge assistant. Answer only from the given facts. Be direct and specific. No lists, no markdown, no disclaimers.';
    const hist=(history||[]).slice(-4).flatMap(t=>[
      {role:'user',content:t.q.slice(0,120)},
      {role:'assistant',content:t.a.slice(0,150)},
    ]);
    const userMsg=(taskPrefix?taskPrefix+'\n\n':'')+contentPrompt;
    const msgs=[{role:'system',content:sys},...hist,{role:'user',content:userMsg.slice(0,600)}];
    const res=await _pipe(msgs,{max_new_tokens:Math.min(maxTokens,250),do_sample:false,temperature:1.0,repetition_penalty:1.15,return_full_text:false});
    const g=res?.[0]?.generated_text;
    if(Array.isArray(g))raw=(g[g.length-1]?.content??'').trim();
    else{raw=(g??'').trim();const ai=raw.lastIndexOf('<|im_start|>assistant');if(ai!==-1)raw=raw.slice(ai+21).replace(/<\|im_end\|>[\s\S]*$/,'').trim();}
  }else{
    const input=(taskPrefix?taskPrefix+'\n\n':'')+contentPrompt;
    const res=await _pipe(input.slice(0,480),{max_new_tokens:Math.min(maxTokens,120),do_sample:false,num_beams:1,repetition_penalty:1.3});
    raw=(res?.[0]?.generated_text??'').trim();
  }
  return clean(raw);
}

async function generateMessages(messages,maxTokens){
  if(!_ready||!_isDecoder)throw new Error('decoder not ready');
  const res=await _pipe(messages,{max_new_tokens:Math.min(maxTokens||120,250),do_sample:false,temperature:1.0,repetition_penalty:1.15,return_full_text:false});
  const g=res?.[0]?.generated_text;
  let raw='';
  if(Array.isArray(g))raw=(g[g.length-1]?.content??'').trim();
  else{raw=(g??'').trim();const ai=raw.lastIndexOf('<|im_start|>assistant');if(ai!==-1)raw=raw.slice(ai+21).replace(/<\|im_end\|>[\s\S]*$/,'').trim();}
  return clean(raw);
}

self.onmessage=async function(e){
  const{type,id}=e.data;
  if(type==='init'){await initModel();return;}
  try{
    let result='';
    if(type==='generate') result=await generate(e.data.taskPrefix,e.data.contentPrompt,e.data.maxTokens||80,e.data.conversationHistory);
    else if(type==='messages') result=await generateMessages(e.data.messages,e.data.maxTokens||120);
    self.postMessage({type:'result',id,text:result});
  }catch(err){
    self.postMessage({type:'error',id,error:err.message||String(err)});
  }
};