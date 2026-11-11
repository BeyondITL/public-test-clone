/* Creator Publishing Kit: dependency-free source parser and campaign validator.
   Copyright 2026. Original implementation. No network, cookies, analytics or storage. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CPKCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const MAX_SOURCE = 120000, MAX_CUES = 500;
  const norm = s => String(s == null ? '' : s).normalize('NFC').replace(/\r\n?/g,'\n').trim();
  // WebVTT cue text may carry tags and a small fixed set of character references.
  // Tags are removed first, then references are decoded once, so "&lt;b&gt;" stays literal text.
  const ENT={'&amp;':'&','&lt;':'<','&gt;':'>','&nbsp;':' ','&lrm;':'','&rlm;':'','&quot;':'"','&#39;':"'"};
  const cueText = s => String(s).replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|nbsp|lrm|rlm|quot|#39);/g,m=>ENT[m]).replace(/\s+/g,' ').trim();
  const TIME_HELP=' Timecodes need hours or minutes, seconds and three millisecond digits, for example 00:01:05,000 (SRT) or 01:05.000 (VTT).';
  function srtTime(n){return [Math.floor(n/3600000),Math.floor(n%3600000/60000),Math.floor(n%60000/1000)].map(x=>String(x).padStart(2,'0')).join(':')+','+String(n%1000).padStart(3,'0');}
  // Serialise cues back to the text the workbench shows. Timecoded packs round-trip to the same source_id.
  function toTranscript(cues){
    return cues.map((c,i)=>c.start_ms===null?c.text:(i+1)+'\n'+srtTime(c.start_ms)+' --> '+srtTime(c.end_ms)+'\n'+c.text).join('\n\n');
  }
  function parseTime(v) {
    const m = String(v).trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})$/);
    if (!m) return null;
    const h = +(m[1]||0), min=+m[2], sec=+m[3], millis=+m[4];
    if (min > 59 || sec > 59) return null;
    return ((h*3600+min*60+sec)*1000+millis);
  }
  function displayTime(ms) {
    if (!Number.isInteger(ms) || ms < 0) return 'NO TIMECODE';
    const h=Math.floor(ms/3600000), m=Math.floor(ms%3600000/60000), s=Math.floor(ms%60000/1000);
    return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }
  function checksum(s) { // Non-security fingerprint to detect accidental cross-source mixing.
    let h=2166136261;
    for (let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return (h>>>0).toString(16).padStart(8,'0');
  }
  function parseTranscript(text) {
    const raw=norm(text);
    if (!raw) throw Error('Provide a transcript first.');
    if (raw.length>MAX_SOURCE) throw Error('Transcript exceeds the 120,000-character local limit.');
    const isVTT=/^\uFEFF?WEBVTT(?:\s|$)/i.test(raw);
    const blocks=raw.replace(/^\uFEFF?WEBVTT[^\n]*\n?/i,'').split(/\n\s*\n/);
    const hasTiming=blocks.some(block=>block.includes('-->'));
    const cues=[];
    for (const block of blocks) {
      const lines=block.split('\n').map(s=>s.trim()).filter(Boolean);
      const ix=lines.findIndex(x=>x.includes('-->'));
      if(ix<0){
        // Never silently discard user text in a mixed timed/untimed transcript.
        // WebVTT NOTE/STYLE/REGION blocks are legitimate metadata exceptions.
        if(hasTiming && lines.length && !(isVTT && /^(NOTE(?:\s|$)|STYLE$|REGION$)/i.test(lines[0])))
          throw Error('Untimed content mixed into timecoded transcript. Correct or remove the block beginning: '+lines[0].slice(0,80));
        continue;
      }
      const match=lines[ix].match(/^([^\s]+)\s+-->\s+([^\s]+)/);
      if(!match) throw Error('Malformed timed cue: '+lines[ix]);
      const start=parseTime(match[1]),end=parseTime(match[2]);
      if(start===null||end===null||end<=start) throw Error('Invalid transcript time range: '+lines[ix].slice(0,80)+'.'+TIME_HELP);
      const txt=cueText(lines.slice(ix+1).join(' '));
      if(!txt)continue;
      cues.push({id:'C'+String(cues.length+1).padStart(3,'0'),start_ms:start,end_ms:end,text:txt});
      if(cues.length>MAX_CUES) throw Error('Transcript exceeds 500 cues.');
    }
    if(!cues.length) {
      if(raw.includes('-->')) throw Error('Timed transcript contained no usable cues. Correct the timecode syntax.');
      const parts=raw.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
      if(parts.length>MAX_CUES)throw Error('Too many untimed paragraphs.');
      parts.forEach((txt,i)=>cues.push({id:'C'+String(i+1).padStart(3,'0'),start_ms:null,end_ms:null,text:txt}));
    }
    for(let i=1;i<cues.length;i++) {
      if(cues[i].start_ms!==null&&cues[i-1].start_ms!==null&&cues[i].start_ms<cues[i-1].start_ms) throw Error('Transcript cues are not in chronological order.');
    }
    if(raw.includes('-->') && blocks.filter(b=>b.includes('-->')).length!==cues.length) throw Error('One or more timecoded transcript entries could not be parsed.');
    return cues;
  }
  function makePack(transcript,meta={}) {
    const text=norm(transcript), cues=parseTranscript(text);
    const source_id='local-'+checksum(text);
    return {schema_version:1,source_id,source_label:norm(meta.source_label||'Creator-supplied transcript').slice(0,120),permission_confirmed:meta.permission_confirmed===true,kind:cues.every(c=>c.start_ms!==null)?'timecoded':'untimed',brand:{name:norm(meta.brand_name||'Your brand').slice(0,90),audience:norm(meta.audience||'Your audience').slice(0,160),voice:norm(meta.voice||'Clear, specific and useful').slice(0,180),cta:norm(meta.cta||'Learn more').slice(0,160)},cues};
  }
  // One plain sentence per field, so a person editing in the form knows exactly what to fix.
  function fieldError(value,min,max,label,name){
    if(typeof value!=='string')return label+': the '+name+' is missing.';
    const n=value.trim().length;
    if(n<min)return label+': the '+name+' is too short. It needs at least '+min+' characters'+(n?' and has '+n+'.':'.');
    if(value.length>max)return label+': the '+name+' is too long. It can have at most '+max+' characters and has '+value.length+'.';
    return null;
  }
  // The source time a reel may claim is fixed by the cues it cites: earliest start to latest end.
  // Returns null when no cited cue is known, and {timed:false} when any cited cue has no timecode.
  function citedBounds(ids,pack){
    if(!Array.isArray(ids)||!pack||!Array.isArray(pack.cues))return null;
    const known=new Map(pack.cues.map(c=>[c.id,c]));
    const cs=ids.map(id=>known.get(id)).filter(Boolean);
    if(!cs.length)return null;
    if(cs.some(c=>c.start_ms===null||c.end_ms===null))return {timed:false,start_ms:null,end_ms:null,ids:cs.map(c=>c.id)};
    return {timed:true,start_ms:Math.min(...cs.map(c=>c.start_ms)),end_ms:Math.max(...cs.map(c=>c.end_ms)),ids:cs.map(c=>c.id)};
  }
  // Compares two pieces of copy as a reader would: case, punctuation and spacing do not count.
  const words=s=>String(s==null?'':s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  function sameWords(a,b){const x=words(a);return x.length>0&&x===words(b);}
  // The text a person takes away with a Copy button: what they will say or post, nothing else.
  function reelCopyText(r){return [r.hook,r.script,r.cta].map(x=>String(x==null?'':x).trim()).filter(Boolean).join('\n\n');}
  function postCopyText(p){return String(p.copy==null?'':p.copy).trim();}
  function validateCampaign(doc,pack){
    const errors=[], warnings=[];
    if(!doc||typeof doc!=='object'||Array.isArray(doc))return {ok:false,errors:['Expected a JSON campaign object.'],warnings};
    if(!pack||!Array.isArray(pack.cues))return {ok:false,errors:['Load a source pack before validating an output.'],warnings};
    if(doc.schema_version!==1)errors.push('schema_version must be 1.');
    if(doc.source_id!==pack.source_id)errors.push('source_id mismatch: this campaign is not attached to the loaded transcript.');
    const strictKeys=(obj,allowed,label)=>{
      if(!obj||typeof obj!=='object'||Array.isArray(obj)){errors.push(label+' must be an object.');return false;}
      const extras=Object.keys(obj).filter(k=>!allowed.includes(k));
      if(extras.length)errors.push(label+' contains unsupported fields: '+extras.join(', '));
      return true;
    };
    strictKeys(doc,['schema_version','source_id','title','audience','slides','reels','posts','review_notes'],'Campaign');
    for(const e of [fieldError(doc.title,3,100,'Campaign','title'),fieldError(doc.audience,3,200,'Campaign','audience')])if(e)errors.push(e);
    const known=new Map(pack.cues.map(c=>[c.id,c]));
    const evidence=(item,label)=>{
      if(!item||typeof item!=='object')return;
      if(!Array.isArray(item.evidence_ids)||!item.evidence_ids.length) errors.push(label+' requires at least one source cue ID.');
      else {if(new Set(item.evidence_ids).size!==item.evidence_ids.length)errors.push(label+' contains duplicate source references.');for(const id of item.evidence_ids)if(typeof id!=='string'||!/^C[0-9]{3}$/.test(id)||!known.has(id))errors.push(label+' cites unknown or invalid ID '+String(id));}
    };
    if(!Array.isArray(doc.slides)||doc.slides.length<5||doc.slides.length>10) errors.push('slides must contain 5 to 10 entries.');
    else doc.slides.forEach((s,i)=>{const label='Slide '+(i+1);
      if(!strictKeys(s,['eyebrow','headline','body','evidence_ids'],label))return;
      for(const e of [fieldError(s.eyebrow,1,45,label,'label'),fieldError(s.headline,3,100,label,'headline'),fieldError(s.body,10,360,label,'body')])if(e)errors.push(e);
      evidence(s,label);
    });
    if(!Array.isArray(doc.reels)||doc.reels.length<1||doc.reels.length>8)errors.push('reels must contain 1 to 8 entries.');
    else doc.reels.forEach((r,i)=>{const label='Reel '+(i+1);
      if(!strictKeys(r,['hook','script','cta','start_ms','end_ms','evidence_ids'],label))return;
      for(const e of [fieldError(r.hook,3,180,label,'hook'),fieldError(r.script,15,1200,label,'script'),fieldError(r.cta,2,160,label,'call to action')])if(e)errors.push(e);
      evidence(r,label);
      if(!Array.isArray(r.evidence_ids)||!r.evidence_ids.length)return;
      const cs=r.evidence_ids.map(id=>known.get(id)).filter(Boolean);
      const times=cs.map(c=>[c.start_ms,c.end_ms]);
      if(times.some(t=>t[0]===null||t[1]===null)) {
        if(r.start_ms!==null||r.end_ms!==null)errors.push(label+' invents timecodes for untimed evidence.');
        else warnings.push(label+' is untimed; location requires manual review.');
      } else if(cs.length){
        const min=Math.min(...times.map(t=>t[0])),max=Math.max(...times.map(t=>t[1]));
        if(r.start_ms!==min||r.end_ms!==max)errors.push(label+' timecodes must equal cited cue bounds ('+displayTime(min)+' to '+displayTime(max)+').');
        if(max-min>120000)warnings.push(label+' spans over two minutes of source footage; check clip usefulness and disjoint citations manually.');
        const ordered=cs.slice().sort((a,b)=>a.start_ms-b.start_ms);
        if(ordered.some((c,j)=>j>0 && c.start_ms-ordered[j-1].end_ms>20000))warnings.push(label+' cites separated transcript passages; source range includes uncited material.');
      }
    });
    if(!Array.isArray(doc.posts)||doc.posts.length<2||doc.posts.length>12)errors.push('posts must contain 2 to 12 entries.');
    else doc.posts.forEach((p,i)=>{const label='Post '+(i+1);
      if(!strictKeys(p,['platform','copy','evidence_ids'],label))return;
      for(const e of [fieldError(p.platform,1,50,label,'platform'),fieldError(p.copy,30,1500,label,'copy')])if(e)errors.push(e);evidence(p,label);
    });
    if(!Array.isArray(doc.review_notes)||doc.review_notes.some(x=>typeof x!=='string'||x.length>500))errors.push('review_notes must be an array of strings, each at most 500 characters.');
    if(doc.slides?.length && doc.posts?.length)warnings.push('Machine checks validate cited cue IDs and timing, NOT semantic truth, copyright, visual claims or policy compliance. Human approval required.');
    return {ok:errors.length===0,errors,warnings};
  }
  // Claude's reply may wrap the draft in a code fence or a sentence or two. Find the one object in it.
  // Not part of validation: whatever this returns still goes through validateCampaign unchanged.
  function extractDraft(text){
    const src=String(text==null?'':text);
    const found=[];let depth=0,start=-1,inString=false,escaped=false,cutOff=false;
    for(let i=0;i<src.length;i++){
      const ch=src[i];
      if(depth>0&&inString){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')inString=false;continue;}
      if(depth>0&&ch==='"'){inString=true;continue;}
      if(ch==='{'){if(depth===0)start=i;depth++;}
      else if(ch==='}'&&depth>0){depth--;if(depth===0){try{const v=JSON.parse(src.slice(start,i+1));if(v&&typeof v==='object'&&!Array.isArray(v))found.push(v);}catch(e){/* braces in prose */}}}
    }
    if(depth>0)cutOff=true;
    const drafts=found.filter(v=>'slides' in v||'schema_version' in v);
    const pick=drafts.length?drafts:found;
    if(pick.length===1)return {ok:true,value:pick[0],extra:src.trim()!==JSON.stringify(pick[0])&&!/^\s*\{[\s\S]*\}\s*$/.test(src)};
    if(pick.length>1)return {ok:false,count:pick.length,error:'The reply contains '+pick.length+' separate drafts. Paste only the one you want to use.'};
    if(cutOff)return {ok:false,count:0,error:'The draft in the reply looks cut off. Ask Claude to send the whole reply again.'};
    return {ok:false,count:0,error:'No draft was found in the reply. Copy Claude\'s whole answer and paste it here again.'};
  }
  function campaignAsMarkdown(doc,pack){
    const cueById=new Map(pack.cues.map(c=>[c.id,c]));
    const ref=ids=>ids.map(id=>{const c=cueById.get(id);return c?id+(c.start_ms!==null?' ('+displayTime(c.start_ms)+')':''):'UNKNOWN';}).join(', ');
    const out=['# '+doc.title,'','Check every claim, the rights to the source and any visual reference before publishing.','',`Audience: ${doc.audience}`,'','## Carousel'];
    doc.slides.forEach((s,i)=>out.push('',`### Slide ${i+1}: ${s.headline}`,s.eyebrow,s.body,'Sources: '+ref(s.evidence_ids)));
    out.push('','## Reel scripts');doc.reels.forEach((r,i)=>out.push('',`### Reel ${i+1}: ${r.hook}`,`Source: ${ref(r.evidence_ids)}`,`Source time: ${displayTime(r.start_ms)} to ${displayTime(r.end_ms)}`,r.script,'CTA: '+r.cta));
    out.push('','## Posts');doc.posts.forEach((p,i)=>out.push('',`### ${p.platform} ${i+1}`,p.copy,'Sources: '+ref(p.evidence_ids)));
    out.push('','## Human review required',...(doc.review_notes||[]).map(n=>'- '+n));
    return out.join('\n');
  }
  return {parseTime,displayTime,parseTranscript,makePack,validateCampaign,campaignAsMarkdown,checksum,toTranscript,srtTime,citedBounds,sameWords,reelCopyText,postCopyText,extractDraft};
});
