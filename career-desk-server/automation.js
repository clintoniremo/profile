const nodemailer=require('nodemailer');
const {applicationDocuments}=require('./documents');
const localDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const defaultAutomation={enabled:false,autoApply:false,profileConfirmed:false,telegramEnabled:false,intervalHours:6,dailyLimit:15,roles:'accountant,accounting,finance,payroll,bookkeeper',locations:'*',lastRun:null,lastError:'',attempts:[]};
function readiness(){return {telegram:!!(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_CHAT_ID),email:!!(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS&&!/xxxx|your-/i.test(process.env.SMTP_PASS+process.env.SMTP_USER)),hosted:!!process.env.VERCEL};}
async function notifyTelegram(message,request=global.fetch){if(!readiness().telegram)throw Error('Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID on the server.');const r=await request(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text:message.slice(0,4000)}),signal:AbortSignal.timeout(15000)});const result=await r.json();if(!r.ok||!result.ok)throw Error('Telegram could not deliver the update.');}
function canEmail(job){try{const host=new URL(job.url).hostname.replace(/^www\./,'').toLowerCase();const email=(job.applicationEmail||'').toLowerCase();const domain=email.split('@')[1];return job.recipientConfirmed===true&&job.eligibilityConfirmed===true&&!!domain&&(host===domain||host.endsWith('.'+domain))&&!/linkedin\.com$|remotive\.com$|weworkremotely\.com$/.test(host);}catch{return false;}}
function eligible(job,settings){const roles=settings.roles.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);const places=settings.locations.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);return roles.some(r=>job.title.toLowerCase().includes(r))&&places.some(p=>p==='*'||job.location.toLowerCase().includes(p));}
function createAutomation({storage,getJobs,makeDraft,sendEmail,telegram=notifyTelegram,connectionStatus=readiness}){
 let running=false;
 async function change(fn){for(let i=0;i<4;i++){const state=await storage.read();fn(state.data);if(await storage.write(state))return;}throw Error('Workspace changed during the run. Please retry.');}
 const deliver=sendEmail||async function(profile,app){const docs=await applicationDocuments(profile,app);const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},connectionTimeout:15000,socketTimeout:30000});return transport.sendMail({from:{name:profile.name,address:process.env.SMTP_USER},replyTo:profile.email,to:app.applicationEmail,subject:`Application for ${app.title} - ${profile.name}`,text:app.letter,attachments:[{filename:'CV.pdf',content:docs.cv},{filename:'Cover-Letter.pdf',content:docs.letter}]});};
 async function run({force=false}={}){
  if(running)return {skipped:'A search is already running.'};running=true;
  try{const start=await storage.read();const config={...defaultAutomation,...start.data.automation};if(!config.enabled)return {skipped:'Automatic search is paused.'};if(!force&&config.lastRun&&Date.now()-Date.parse(config.lastRun)<config.intervalHours*3600000)return {skipped:'Next search is not due yet.'};
   // Reserve the run before external work; the revision check coordinates multiple hosts.
   const runId=require('crypto').randomUUID();const reserved={...start,data:{...start.data,automation:{...config,lastRun:new Date().toISOString(),lastError:'',runId}}};if(!await storage.write(reserved))return {skipped:'Another run or editor updated the workspace.'};
   const jobs=await getJobs();let added=0,sent=0,review=0;
   for(const job of jobs.filter(j=>eligible(j,config)).slice(0,30)){
    const state=await storage.read();if(!state.data.automation?.enabled)break;if(state.data.automation.runId!==runId)break;
    if(state.data.applications.some(a=>a.id===job.id||(a.url&&a.url===job.url)))continue;
    if(state.data.applications.length>=300)break;
    const now=new Date().toISOString();const app={...job,status:'Draft',letter:makeDraft(job,state.data.profile),notes:'Prepared by Zuriel automatic search. Check work eligibility and employer requirements.',created:now,updated:now,followUp:''};
    await change(data=>{if(!data.applications.some(a=>a.id===app.id)){data.applications.unshift(app);added++;}});
   }
   // Only explicitly ready applications with employer-domain recipients can be sent.
   const queue=(await storage.read()).data.applications.filter(a=>a.status==='Ready');
   for(const app of queue){const state=await storage.read();const settings={...defaultAutomation,...state.data.automation};if(!settings.enabled||!settings.autoApply||!settings.profileConfirmed||!state.data.profile.resumeText?.trim()||!connectionStatus().email)break;
    if(!canEmail(app)){review++;continue;}const today=localDay();if(settings.attempts.filter(x=>x.day===today).length>=settings.dailyLimit)break;if(settings.attempts.some(x=>x.id===app.id))continue;
    const claim={id:app.id,day:today,outcome:'pending'};state.data.automation.attempts=[...settings.attempts,claim];const current=state.data.applications.find(a=>a.id===app.id);if(current.status!=='Ready')continue;current.status='Needs review';current.notes+='\nEmail submission reserved. If interrupted, verify delivery before any resend.';
    if(!await storage.write(state))continue;
    try{const result=await deliver(state.data.profile,app);await change(data=>{const a=data.applications.find(x=>x.id===app.id);a.status='Applied';a.updated=new Date().toISOString();a.notes+='\nEmail accepted by the mail server. Message ID: '+String(result.messageId||'not supplied');data.automation.attempts.find(x=>x.id===app.id).outcome='sent';});sent++;}
    catch{await change(data=>{data.automation.attempts.find(x=>x.id===app.id).outcome='uncertain';const a=data.applications.find(x=>x.id===app.id);a.notes+='\nDelivery not confirmed. Check sent mail before trying again.';});review++;}
   }
   if(config.telegramEnabled&&(added||sent||review))try{await telegram(`Zuriel Career AI: ${added} new drafts, ${sent} email submissions, ${review} applications need review.`);}catch(e){await change(data=>{data.automation.lastError=e.message;});}
   return {added,sent,review};
  }catch(e){try{await change(data=>{data.automation={...defaultAutomation,...data.automation,lastError:e.message};});}catch{}throw e;}finally{running=false;}
 }
 return {run};
}
module.exports={defaultAutomation,readiness,notifyTelegram,canEmail,eligible,createAutomation};

