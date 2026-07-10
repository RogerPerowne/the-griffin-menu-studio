(function(){
 const status=document.getElementById('status');
 const detail=document.getElementById('detail');
 const ticks=[...document.querySelectorAll('.tick')];
 let step=0;
 function setStatus(payload){
  if(!payload)return;
  if(status&&payload.label)status.textContent=payload.label;
  if(detail&&payload.phase==='complete')detail.textContent='Ready';
  if(detail&&payload.phase==='error')detail.textContent='Continuing safely';
  if(payload.phase==='start'&&ticks[step]){
   ticks.forEach((t,i)=>t.classList.toggle('on',i<=step));
   step=Math.min(step+1,ticks.length-1);
  }
 }
 if(window.griffinSplash){
  window.griffinSplash.onStatus(setStatus);
  window.griffinSplash.onFade(()=>document.body.classList.add('leaving'));
 }
})();
