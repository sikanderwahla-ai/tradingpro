const cors = { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };
const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {status,headers:{...cors,...headers}});
const enc = new TextEncoder();
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const hash = async s => b64(await crypto.subtle.digest('SHA-256',enc.encode(s)));
async function passwordHash(password,salt) {
  const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  return b64(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:210000,hash:'SHA-256'},key,256));
}
const cookie = token => `htp_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`;
const clearCookie = 'htp_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
async function body(req){try{return await req.json()}catch{return {}}}
async function session(req,env){
  const token=(req.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('htp_session='))?.slice(12);
  if(!token)return null;
  const row=await env.DB.prepare('SELECT s.user_id,u.email,u.name,u.role,u.status FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(token),Date.now()).first();
  return row||null;
}
export default {
 async fetch(req,env){
  const url=new URL(req.url), path=url.pathname.replace(/^\/api/,'');
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'}});
  try{
   if(path==='/signup'&&req.method==='POST'){
    const b=await body(req), name=String(b.name||'').trim(), email=String(b.email||'').trim().toLowerCase(), password=String(b.password||'');
    if(name.length<2||name.length>80||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<10)return json({error:'Enter a valid name/email and password (10+ characters).'},400);
    const id=crypto.randomUUID(),salt=b64(crypto.getRandomValues(new Uint8Array(16))),ph=await passwordHash(password,salt);
    try{await env.DB.prepare("INSERT INTO users(id,name,email,password_hash,password_salt,role,status,created_at) VALUES(?,?,?,?,?,'user','pending',?)").bind(id,name,email,ph,salt,Date.now()).run();}
    catch{return json({error:'This email is already registered.'},409)}
    return json({message:'Signup received. Your account will be available after owner approval.'},201);
   }
   if(path==='/login'&&req.method==='POST'){
    const b=await body(req),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
    const u=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
    if(!u||await passwordHash(password,u.password_salt)!==u.password_hash)return json({error:'Incorrect email or password.'},401);
    if(u.status!=='approved')return json({pending:u.status==='pending',rejected:u.status==='rejected',error:u.status==='rejected'?'This account was not approved. Contact the owner.':'Waiting for owner approval.'},403);
    const token=b64(crypto.getRandomValues(new Uint8Array(32))),expires=Date.now()+7*86400000;
    await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await hash(token),u.id,expires).run();
    return json({user:{id:u.id,name:u.name,email:u.email,role:u.role} },200,{'set-cookie':cookie(token)});
   }
   if(path==='/logout'&&req.method==='POST'){
    const s=await session(req,env);if(s){const token=(req.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('htp_session='))?.slice(12);if(token)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token)).run();}
    return json({ok:true},200,{'set-cookie':clearCookie});
   }
   if(path==='/me'){
    const s=await session(req,env);if(!s||s.status!=='approved')return json({user:null},401);
    return json({user:{id:s.user_id,name:s.name,email:s.email,role:s.role}});
   }
   if(path==='/owner/users'){
    const s=await session(req,env);if(!s||s.role!=='owner')return json({error:'Owner access required.'},403);
    const r=await env.DB.prepare("SELECT id,name,email,status,created_at FROM users WHERE role='user' ORDER BY created_at DESC").all();
    return json({users:r.results||[]});
   }
   if(path==='/owner/approve'&&req.method==='POST'){
    const s=await session(req,env);if(!s||s.role!=='owner')return json({error:'Owner access required.'},403);
    const b=await body(req);if(!b.userId)return json({error:'Missing user id.'},400);
    await env.DB.prepare("UPDATE users SET status='approved' WHERE id=? AND role='user'").bind(String(b.userId)).run();
    return json({ok:true});
   }
   if(path==='/owner/reject'&&req.method==='POST'){
    const s=await session(req,env);if(!s||s.role!=='owner')return json({error:'Owner access required.'},403);
    const b=await body(req);if(!b.userId)return json({error:'Missing user id.'},400);
    await env.DB.prepare("UPDATE users SET status='rejected' WHERE id=? AND role='user'").bind(String(b.userId)).run();
    return json({ok:true});
   }
   if(path==='/owner/bootstrap'&&req.method==='POST'){
    const b=await body(req);
    if(!env.OWNER_BOOTSTRAP_SECRET||b.secret!==env.OWNER_BOOTSTRAP_SECRET)return json({error:'Invalid bootstrap secret.'},403);
    const email=String(b.email||'').trim().toLowerCase();
    if(email!==String(env.OWNER_EMAIL||'').trim().toLowerCase())return json({error:'Email does not match configured owner email.'},403);
    const name=String(b.name||'Owner').trim(),password=String(b.password||'');
    if(password.length<12)return json({error:'Owner password must be at least 12 characters.'},400);
    const existing=await env.DB.prepare("SELECT id FROM users WHERE role='owner' LIMIT 1").first();
    if(existing)return json({error:'Owner has already been initialized.'},409);
    const id=crypto.randomUUID(),salt=b64(crypto.getRandomValues(new Uint8Array(16))),ph=await passwordHash(password,salt);
    await env.DB.prepare("INSERT INTO users(id,name,email,password_hash,password_salt,role,status,created_at) VALUES(?,?,?,?,?,'owner','approved',?)").bind(id,name,email,ph,salt,Date.now()).run();
    return json({ok:true,message:'Owner account created. Log in now.'},201);
   }
   return json({error:'Not found.'},404);
  }catch(e){return json({error:'Server error.'},500)}
 }
};
