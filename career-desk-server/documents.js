const {PDFDocument,StandardFonts,rgb}=require('pdf-lib');
function clean(value){return String(value||'').normalize('NFKC').replace(/[–—]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[^\x20-\x7E\n]/g,' ');}
async function renderPdf({name,contact,title,paragraphs}){
 const doc=await PDFDocument.create();const regular=await doc.embedFont(StandardFonts.Helvetica);const bold=await doc.embedFont(StandardFonts.HelveticaBold);const width=595.28,height=841.89,margin=54;let page,y;
 function nextPage(){page=doc.addPage([width,height]);y=height-margin;}
 function lines(text,font,size){const out=[];let line='';for(const word of clean(text).split(/\s+/)){if(!word)continue;if(font.widthOfTextAtSize(word,size)>width-margin*2){if(line){out.push(line);line='';}let chunk='';for(const c of word){if(font.widthOfTextAtSize(chunk+c,size)>width-margin*2){out.push(chunk);chunk=c;}else chunk+=c;}line=chunk;continue;}if(line&&font.widthOfTextAtSize(line+' '+word,size)>width-margin*2){out.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)out.push(line);return out;}
 function text(value,{size=11,font=regular,after=8,heading=false}={}){const rows=lines(value,font,size);if(heading&&y<margin+65)nextPage();for(const line of rows){if(y<margin+22)nextPage();page.drawText(line,{x:margin,y,size,font,color:rgb(.08,.08,.08)});y-=size*1.4;}y-=after;}
 nextPage();text(name,{size:20,font:bold,after:5});text(contact,{size:10,after:18});if(title)text(title,{size:13,font:bold,after:14,heading:true});
 for(const p of paragraphs){if(!String(p).trim()){y-=5;continue;}if(p.startsWith('## '))text(p.slice(3),{font:bold,size:12,after:7,heading:true});else text(p);}
 const pages=doc.getPages();pages.forEach((p,i)=>p.drawText(`${i+1} / ${pages.length}`,{x:width-margin-28,y:30,size:9,font:regular,color:rgb(.4,.4,.4)}));doc.setCreator('Zuriel Career AI');doc.setTitle(title||'Curriculum Vitae');return Buffer.from(await doc.save());
}
async function applicationDocuments(profile,application){
 if(!profile.resumeText?.trim())throw Error('Add your CV experience and education before generating documents.');
 const contact=[profile.email,profile.phone,profile.location,profile.linkedin].filter(Boolean).join(' | ');
 const qualifications=profile.cpa==='completed'?'CPA qualification completed':profile.cpa==='in-progress'?'CPA studies in progress':'';
 const cv=await renderPdf({name:profile.name,contact,title:'Curriculum Vitae',paragraphs:['## Professional profile',profile.summary,...profile.resumeText.split('\n'),...(qualifications?['## Professional qualification',qualifications]:[])]});
 const letter=await renderPdf({name:profile.name,contact,title:`Application for ${application.title} at ${application.company}`,paragraphs:[...application.letter.split('\n\n')]});
 return {cv,letter};
}
module.exports={applicationDocuments,renderPdf};
