export const config = { api: { bodyParser: false } };

import crypto from "crypto";

function buffer(readable){return new Promise((res,rej)=>{const c=[];readable.on("data",x=>c.push(Buffer.from(x)));readable.on("end",()=>res(Buffer.concat(c)));readable.on("error",rej);});}
function verify(raw, sig, secret){
  const h = crypto.createHmac("sha256", secret).update(raw).digest("base64");
  return h === sig;
}
async function callOpenAI(text){
  const r = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"gpt-4o-mini",
      messages:[
        {role:"system",content:"あなたはAI補助金先生。制度は断定せず簡潔に3〜6行で回答。"},
        {role:"user",content:text}
      ],
      temperature:0.3,max_tokens:400
    })
  });
  if(!r.ok) throw new Error(`OpenAI ${r.status}`);
  const j = await r.json();
  return j?.choices?.[0]?.message?.content?.trim() || "混み合っています。少し待ってお試しください。";
}
async function lineReply(token, text){
  await fetch("https://api.line.me/v2/bot/message/reply",{
    method:"POST",
    headers:{Authorization:`Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,"Content-Type":"application/json"},
    body:JSON.stringify({replyToken:token,messages:[{type:"text",text}]})
  });
}

export default async function handler(req,res){
  try{
    if(req.method!=="POST") return res.status(405).send("Method Not Allowed");
    const raw = await buffer(req);
    const ok = verify(raw, req.headers["x-line-signature"], process.env.LINE_CHANNEL_SECRET);
    if(!ok) return res.status(403).send("Bad signature");

    const body = JSON.parse(raw.toString("utf-8"));
    const events = body.events || [];
    await Promise.all(events.map(async ev=>{
      try{
        if(ev.type==="message" && ev.message?.type==="text"){
          const reply = await callOpenAI(ev.message.text||"");
          await lineReply(ev.replyToken, reply);
        } else if(ev.type==="follow"){
          await lineReply(ev.replyToken,"友だち追加ありがとう！質問をどうぞ。");
        }
      }catch{ try{ await lineReply(ev.replyToken,"エラー。短いキーワードで再度お願いします。"); }catch{} }
    }));
    res.status(200).send("OK");
  }catch(e){ console.error(e); res.status(500).send("Internal Error"); }
}
