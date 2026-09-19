const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const {z} = require('zod');
const {defaultAutomation,readiness,notifyTelegram,createAutomation}=require('./automation');
const {applicationDocuments}=require('./documents');
const {draftLetter}=require('./drafting.cjs');
const text = z.string().max(20000);
const profileSchema = z.object({name:z.string().min(1).max(200),email:z.string().email().max(300),phone:z.string().max(100),location:z.string().max(300),targets:z.string().max(2000),geography:z.string().max(1000),cpa:z.enum(['unconfirmed','completed','in-progress']),summary:z.string().min(1).max(5000),resumeText:z.string().max(30000).default(''),linkedin:z.string().max(500).refine(s=>!s||/^https:\/\/(www\.)?linkedin\.com\/in\//i.test(s)).default('')});
const jobSchema = z.object({id:z.string().min(1).max(100),title:z.string().min(1).max(300),company:z.string().min(1).max(300),location:z.string().max(500),url:z.string().max(2000).refine(s=>!s||/^https?:\/\//i.test(s)),description:text,salary:z.string().max(500),source:z.string().max(200),published:z.string().max(100),applicationEmail:z.string().email().or(z.literal('')).default(''),recipientConfirmed:z.boolean().default(false),eligibilityConfirmed:z.boolean().default(false),status:z.enum(['Draft','Ready','Applied','Interview','Offer','Closed','Needs review']),letter:text,notes:text,created:z.string().max(100),updated:z.string().max(100),followUp:z.string().max(30)});
const automationSchema=z.object({enabled:z.boolean(),autoApply:z.boolean(),profileConfirmed:z.boolean(),telegramEnabled:z.boolean(),intervalHours:z.number().int().min(6).max(168),dailyLimit:z.number().int().min(1).max(15),roles:z.string().min(1).max(2000),locations:z.string().min(1).max(2000),lastRun:z.string().nullable(),lastError:z.string().max(2000),runId:z.string().optional(),attempts:z.array(z.object({id:z.string(),day:z.string(),outcome:z.enum(['pending','sent','uncertain'])})).max(10000)});
const stateSchema=z.object({revision:z.number().int().nonnegative(),data:z.object({profile:profileSchema,applications:z.array(jobSchema).max(300),automation:automationSchema.default(defaultAutomation)})});
function localRequest(req){return !process.env.VERCEL && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress) && ['localhost','127.0.0.1','[::1]'].includes(req.hostname);}
function authorize(req,res,next){
  res.set('Cache-Control','no-store');
  const expected=process.env.CAREER_DESK_TOKEN;
  if(expected){const actual=(req.get('authorization')||'').replace(/^Bearer /,'');const a=Buffer.from(actual);const b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'Enter your private workspace access key.'});}
  else if(!localRequest(req))return res.status(503).json({error:'Private workspace is locked. Configure CAREER_DESK_TOKEN on the server.'});
  if(req.method!=='GET'&&req.method!=='HEAD'){
    let origin;try{origin=new URL(req.get('origin'));}catch{return res.status(403).json({error:'A same-origin browser request is required.'});}
    const allowed=process.env.CAREER_DESK_ORIGIN;
    if(allowed?origin.origin!==allowed:origin.host!==req.get('host'))return res.status(403).json({error:'Request origin is not allowed.'});
  }
  next();
}
function createStore(initial,{directory=process.env.CAREER_DESK_DATA_DIR||path.join(__dirname,'../.career-data'),request=global.fetch}={}){
  const url=process.env.UPSTASH_REDIS_REST_URL;
  const token=process.env.UPSTASH_REDIS_REST_TOKEN;
  const key='zuriel:career-desk:v1';
  // Vercel's filesystem is read-only. Keep a process-local fallback so the
  // hosted workspace can load before an Upstash store is connected; edits are
  // intentionally ephemeral until durable storage credentials are configured.
  let memory = structuredClone(initial);
  async function redis(command){const r=await request(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(10000)});const b=await r.json();if(!r.ok||b.error)throw Error('Private storage is unavailable.');return b.result;}
  function filename(){if(process.env.VERCEL)throw Error('Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for durable hosted storage.');fs.mkdirSync(directory,{recursive:true});return path.join(directory,'state.json');}
  return {
    async read(){if(url&&token){await redis(['SET',key,JSON.stringify(initial),'NX']);return JSON.parse(await redis(['GET',key]));}if(process.env.VERCEL)return structuredClone(memory);const file=filename();try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;fs.writeFileSync(file,JSON.stringify(initial),{flag:'wx',mode:0o600});return structuredClone(initial);}},
    async write(state){const next={data:state.data,revision:state.revision+1};if(url&&token){const script="local s=redis.call('GET',KEYS[1]); if not s or cjson.decode(s).revision~=tonumber(ARGV[1]) then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";return await redis(['EVAL',script,1,key,state.revision,JSON.stringify(next)])===1;}if(process.env.VERCEL){if(memory.revision!==state.revision)return false;memory=next;return true;}
      const file=filename();const lock=file+'.lock';let fd;try{fd=fs.openSync(lock,'wx');}catch(e){if(e.code==='EEXIST')return false;throw e;}
      try{const current=JSON.parse(fs.readFileSync(file,'utf8'));if(current.revision!==state.revision)return false;const tmp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(next),{mode:0o600});fs.renameSync(tmp,file);return true;}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
    }
  };
}
function plain(value){return String(value||'').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').slice(0,20000);}
function normalizeJob(j){let url='';try{const u=new URL(j.url||j.link);if(['https:','http:'].includes(u.protocol))url=u.href;}catch{}return {id:crypto.createHash('sha256').update(url||String(j.title)+String(j.company)).digest('hex').slice(0,32),title:plain(j.title).slice(0,300),company:plain(j.company||j.company_name||'See job listing').slice(0,300),description:plain(j.description),location:plain(j.location||j.candidate_required_location||'Check employer eligibility').slice(0,500),url,salary:plain(j.salary).slice(0,500),source:plain(j.source||'Zuriel job feed').slice(0,200),published:String(j.pubDate||j.publication_date||'').slice(0,100)};}
function createRouter({profile,fetchJobs,store}){
  const router=express.Router();router.use(authorize);router.use(express.json({limit:'2mb'}));
  const initial={revision:0,data:{profile:{name:profile.name,email:profile.email,phone:profile.phone,location:profile.location,targets:'Accountant, Finance Officer, Finance and Administration Manager, Payroll Accountant, ERP Finance',geography:'Kenya; remote roles open to Kenya',cpa:'unconfirmed',resumeText:'## Work experience\nAdd your roles, employers, dates and responsibilities here.\n## Education\nBachelor of Business Administration (Accounting)',linkedin:profile.linkedin||'',summary:'I am a finance and administration professional with a Bachelor of Business Administration in Accounting. My experience covers financial reporting, budgeting, payroll, statutory compliance and accounting systems.'},applications:[],automation:{...defaultAutomation}}};
  const storage=store||createStore(initial);let cached=null;let pending=null;
  async function getJobs(){if(!cached||Date.now()-cached.fetched>=21600000){if(!pending)pending=Promise.resolve().then(fetchJobs).then(jobs=>{cached={jobs:jobs.map(normalizeJob).filter(j=>j.title&&j.url),fetched:Date.now()};}).finally(()=>{pending=null;});await pending;}return cached.jobs;}
  const automation=createAutomation({storage,getJobs,makeDraft:draftLetter});
  router.automation=automation;
  router.get('/connections',(_req,res)=>res.json({...readiness(),linkedin:'Profile link and job handoff; automatic LinkedIn submissions are not connected.'}));
  router.post('/run',async(_req,res)=>{try{res.json(await automation.run({force:true}));}catch(e){res.status(503).json({error:e.message});}});
  router.post('/telegram-test',async(_req,res)=>{try{await notifyTelegram('Zuriel Career AI is connected. Job-search updates will appear here when enabled.');res.json({ok:true});}catch(e){res.status(503).json({error:e.message});}});
  router.post('/documents',async(req,res)=>{const parsed=jobSchema.safeParse(req.body.application);if(!parsed.success)return res.status(400).json({error:'Invalid application.'});try{const state=await storage.read();const docs=await applicationDocuments(state.data.profile,parsed.data);const kind=req.body.kind==='cv'?'cv':'letter';res.set({'Content-Type':'application/pdf','Content-Disposition':'attachment; filename=Zuriel-'+kind+'.pdf'}).send(docs[kind]);}catch(e){res.status(400).json({error:e.message});}});
  router.get('/state',async(req,res)=>{try{res.json(await storage.read());}catch(e){res.status(503).json({error:e.message});}});
  router.put('/state',async(req,res)=>{const parsed=stateSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Check your profile, email address and job details.'});try{const current=await storage.read();parsed.data.data.automation={...parsed.data.data.automation,attempts:current.data.automation?.attempts||[],lastRun:current.data.automation?.lastRun||null,lastError:current.data.automation?.lastError||'',runId:current.data.automation?.runId};if(parsed.data.data.automation.autoApply&&(!parsed.data.data.automation.profileConfirmed||!parsed.data.data.profile.resumeText.trim()))return res.status(400).json({error:'Confirm your profile and complete CV experience before enabling automatic applications.'});if(!await storage.write(parsed.data))return res.status(409).json({error:'The workspace changed in another tab. Copy unsaved edits and reload before saving.'});res.json({revision:parsed.data.revision+1});}catch{res.status(503).json({error:'Could not save. Your edits are still on screen; please retry.'});}});
  router.get('/jobs',async(req,res)=>{try{if(!cached||Date.now()-cached.fetched>=21600000){if(!pending)pending=Promise.resolve().then(fetchJobs).then(jobs=>{cached={jobs:jobs.map(normalizeJob).filter(j=>j.title&&j.url),fetched:Date.now()};}).finally(()=>{pending=null;});await pending;}res.json(cached);}catch{res.status(503).json({error:'Job sources are unavailable. You can still paste a job description.'});}});
  return router;
}
module.exports={createRouter,createStore,normalizeJob,stateSchema,authorize};
