export const config = { api: { bodyParser: false } };
import crypto from "crypto";

function buf(r){return new Promise((res,rej)=>{const c=[];r.on("data",x=>c.push(Buffer.from(x)));r.on("end",()=>res(Buffer.concat(c)));r.on("error",rej);});}
function sigOK(raw, sig, sec){return crypto.createHmac("sha256", sec).update(raw).digest("base64")===sig;}

async function callOpenAI(text){
  const r = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"gpt-4o-mini",
      messages:[
        {role:"system",content:"あなたはAI補助金先生。3〜6行で簡潔・誠実に回答。"},
        {role:"user",content:text}
      ],
      temperature:0.3,max_tokens:500
    })
  });
  if(!r.ok){ console.error("OpenAI error:", r.status, await r.text().catch(()=>'')); return "現在混み合っています。時間をおいてお試しください。"; }
  const j = await r.json();
  return j?.choices?.[0]?.message?.content?.trim() || "別の聞き方でお試しください。";
}

async function reply(token, text){
  const r = await fetch("https://api.line.me/v2/bot/message/reply",{
    method:"POST",
    headers:{Authorization:`Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,"Content-Type":"application/json"},
    body:JSON.stringify({replyToken:token,messages:[{type:"text",text}]})
  });
  const body = await r.text().catch(()=> "");
  if(!r.ok){ console.error("LINE reply error:", r.status, body); throw new Error(`LINE ${r.status}`); }
}

export default async function handler(req,res){
  try{
    if(req.method!=="POST") return res.status(405).send("Method Not Allowed");
    const raw = await buf(req);
    if(!sigOK(raw, req.headers["x-line-signature"], process.env.LINE_CHANNEL_SECRET)) return res.status(403).send("Bad signature");
    const payload = JSON.parse(raw.toString("utf-8"));
    const events = payload?.events || [];
    await Promise.all(events.map(async ev=>{
      try{
        if(ev.type==="message" && ev.message?.type==="text"){
          const text = await callOpenAI(ev.message.text||"");
          await reply(ev.replyToken, text);
        }else if(ev.type==="follow"){
          await reply(ev.replyToken,"友だち追加ありがとうございます！質問をどうぞ。");
        }
      }catch(e){
        console.error("Handler error:", e?.message||e);
        try{ await reply(ev.replyToken,"エラーが発生しました。短いキーワードで再度お試しください。"); }catch{}
      }
    }));
    return res.status(200).send("OK");
  }catch(e){ console.error("Fatal:", e?.message||e); return res.status(500).send("Internal Server Error"); }
}
