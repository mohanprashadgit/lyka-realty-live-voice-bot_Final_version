import WebSocket from 'ws';
const ws=new WebSocket('ws://127.0.0.1:10000/api/live-ws');
let turns=0,audio=0,evidence=false,asked=false;
const timer=setTimeout(()=>finish(false,'Timed out waiting for grounded native-audio response'),55000);
function finish(ok,message){clearTimeout(timer);console.log((ok?'PASS: ':'FAIL: ')+message);ws.close();setTimeout(()=>process.exit(ok?0:1),250);}
ws.on('open',()=>ws.send(JSON.stringify({type:'start',sessionId:'task68-live-test-'+Date.now(),leadName:'TEST Knowledge Smoke',language:'english',mode:'agent'})));
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='audio'&&asked)audio++;
 if(m.type==='lead_update'&&String(m.lead?.knowledge_sources||'').includes('dubailand.gov.ae')) evidence=true;
 if(m.type==='error')finish(false,'Live route reported an error');
 if(m.type==='turn_complete'){turns++;if(!asked){asked=true;ws.send(JSON.stringify({type:'text',text:'Yes, I am TEST Knowledge Smoke and agree to this test discussion. How can I verify a Dubai property title deed? Please check your approved knowledge.'}));}else if(audio&&evidence){finish(true,'Actual /api/live-ws returned retrieved DLD evidence and native audio after tool response. Audio was not listened to.');}}
});
ws.on('error',()=>finish(false,'WebSocket transport error'));
