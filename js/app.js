(() => {
  const domCache={};
  const $=id=>domCache[id] || (domCache[id]=document.getElementById(id));
  let toastTimer=0,isResetting=false;
  const STORE_KEY = 'neon-brew-save-v1';
  const BACKUP_SAVE_KEY = 'neon-brew-backup-v1';
  const OFFLINE_CAP = 8 * 60 * 60;
  const UI_SETTINGS_KEY = 'neon-brew-ui-v1';
  function loadUiSettings(){try{const settings=JSON.parse(localStorage.getItem(UI_SETTINGS_KEY)||'{}');return {theme:['neon','blood','fog'].includes(settings.theme)?settings.theme:'neon',language:settings.language==='en'?'en':'vi'}}catch{return {theme:'neon',language:'vi'}}}
  const uiSettings=loadUiSettings();
  const idleRate = () => Date.now()<(state.stalledUntil||0)?0:state.bots*1.25*(1+(state.prestiges||0)*.05)*(state.robotUnion?1.15:1)*(factionBonus('cyborgs')>=10?1.2:1)*Math.pow(1.35,Math.max(0,state.branches-1));
  const format = n => Math.floor(n).toLocaleString(uiSettings.language==='en'?'en-US':'vi-VN');
  const {recipes,ingredients,factions,weathers,decorItems,tracks,storyEvents}=window.NEON_BREW_CATALOG;
  const eventRules=window.NEON_BREW_EVENT_RULES;
  const ingredientPalette = {
    meteor:['espresso','plasma'],
    matcha:['espresso','plasma','boba'],
    mocha:['espresso','plasma','syrup'],
    ramen:['espresso'],
    overclock:['espresso','plasma','syrup'],
    bionic:['espresso','boba']
  };
  function recipeIngredientIds(recipeId){
    const recipe = recipeById(recipeId);
    if (recipe && ingredientPalette[recipe.id]) return ingredientPalette[recipe.id];
    const fallback = [...new Set((recipe?.tags || []).map(tag => ({
      caffeine:'espresso',
      bold:'plasma',
      energy:'boba',
      premium:'syrup'
    }[tag])).filter(Boolean))];
    return fallback.length ? fallback : ['espresso'];
  }
  const initialState = () => ({modernCafeVersion:6,money:250000,reputation:0,served:0,xp:0,level:1,bots:0,branches:1,inventory:Object.fromEntries(ingredients.map(item=>[item.id,item.start])),cyberWaste:0,unlockedRecipes:[],researchTrials:0,researchSuccesses:0,researchFailures:0,tutorialStep:0,tutorialDone:false,factionRep:{hackers:0,samurai:0,corporate:0,cyborgs:0},orderFaction:'hackers',orderId:'meteor',orderNumber:1,orderStarted:Date.now(),orderExpires:Date.now()+45000,orderVip:false,orderShuffleAt:Date.now()+30000,weatherId:'neon',weatherChangedAt:Date.now()+90000,decorations:{},drone:0,bouncer:0,firewall:0,deliveryDrone:0,deliveryActive:false,robotUnion:false,maintenanceDueAt:Date.now()+3600000,matrixCyclesLeft:0,matrixCycleEnds:0,matrixNextAt:Date.now()+180000,yakuzaProtectionUntil:0,bulkOrder:null,arenaBuffUntil:0,stalledUntil:0,securityNextAt:Date.now()+25000,securityEvictions:0,ransomwareIncidents:0,tracks:['afterglow'],trackId:'afterglow',audio:false,crt:false,daily:{date:new Date().toISOString().slice(0,10),espresso:0,hackers:0,seconds:0,rewarded:false},chips:0,prestiges:0,badges:{millionaire:false,recipes:false,rebirth:false},lastSeen:Date.now(),log:[],badOrders:0,reviewScore:100,starRating:5,inspectionProgress:0,inspectionActive:false,gameOver:false,paranoia:0,ghostOrder:null,loreFragments:[],lastHorrorAt:Date.now(),hallucinationUntil:0,robotWhisper:'',horrorPhase:0});
  function withShiftDefaults(value){const normalized={...value,shift:Math.max(1,Math.floor(Number(value.shift)||1)),shiftOrders:Math.max(0,Math.floor(Number(value.shiftOrders)||0)),shiftServed:Math.max(0,Math.floor(Number(value.shiftServed)||0)),shiftRevenue:Math.max(0,Number(value.shiftRevenue)||0),shiftClosed:!!value.shiftClosed,dealIngredient:ingredients.some(item=>item.id===value.dealIngredient)?value.dealIngredient:'espresso',orderSpec:{size:'M',sugar:50,ice:50,topping:'none',...(value.orderSpec||{})}};normalized.inventoryLots=Object.fromEntries(ingredients.map(item=>{const saved=Array.isArray(value.inventoryLots?.[item.id])?value.inventoryLots[item.id]:null,lots=saved?saved.map(lot=>({quantity:Math.max(0,Math.floor(Number(lot.quantity)||0)),purchasedShift:Math.max(1,Math.floor(Number(lot.purchasedShift)||normalized.shift))})).filter(lot=>lot.quantity>0):Number(value.inventory?.[item.id])>0?[{quantity:Math.max(0,Math.floor(Number(value.inventory[item.id])||0)),purchasedShift:normalized.shift}]:[];return [item.id,lots]}));normalized.inventory=Object.fromEntries(ingredients.map(item=>[item.id,normalized.inventoryLots[item.id].reduce((sum,lot)=>sum+lot.quantity,0)]));return normalized}
  function loadState(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORE_KEY));
      if(!parsed||typeof parsed!=='object')return withShiftDefaults(initialState());
      const oldCafeVersion=Number(parsed.modernCafeVersion)||0;
      if(oldCafeVersion===0){parsed.money=Math.max(0,Number(parsed.money)||0)*1000;parsed.unlockedRecipes=[]}
      if(oldCafeVersion<6){parsed.shiftOrders=0;parsed.shiftServed=0;parsed.shiftRevenue=0;parsed.shiftClosed=false;parsed.orderId='meteor';parsed.orderNumber=1;parsed.orderSpec={size:'M',sugar:50,ice:50,topping:'none'};parsed.orderStarted=Date.now();parsed.orderExpires=Date.now()+45000;parsed.orderShuffleAt=Date.now()+30000;parsed.orderVip=false;parsed.reviewScore=100;parsed.starRating=5;parsed.badOrders=0;parsed.inspectionProgress=0;parsed.inspectionActive=false;parsed.gameOver=false;parsed.log=[]}
      parsed.modernCafeVersion=6;
      const base=withShiftDefaults(initialState());
      const state=withShiftDefaults({...base,...parsed,inventoryLots:parsed.inventoryLots,inventory:{...base.inventory,...parsed.inventory},factionRep:{...base.factionRep,...parsed.factionRep},decorations:{...base.decorations,...parsed.decorations},daily:{...base.daily,...parsed.daily},badges:{...base.badges,...parsed.badges},tracks:Array.isArray(parsed.tracks)?parsed.tracks:['afterglow'],unlockedRecipes:Array.isArray(parsed.unlockedRecipes)?parsed.unlockedRecipes:[],log:Array.isArray(parsed.log)?parsed.log.slice(0,5):[]});
      for(const key of ['money','reputation','served','xp','level','bots','branches','orderNumber','chips','prestiges','cyberWaste','researchTrials','researchSuccesses','researchFailures','tutorialStep','drone','bouncer','firewall','deliveryDrone','matrixCyclesLeft','matrixCycleEnds','matrixNextAt','securityEvictions','ransomwareIncidents','yakuzaProtectionUntil','arenaBuffUntil','stalledUntil','maintenanceDueAt','weatherChangedAt','orderStarted','orderExpires','orderShuffleAt','lastSeen','reviewScore','shift','shiftOrders','shiftServed','shiftRevenue'])if(!Number.isFinite(state[key]))state[key]=base[key];
      for(const key of ['money','reputation','served','xp','bots','chips','prestiges','cyberWaste','researchTrials','researchSuccesses','researchFailures','drone','bouncer','firewall','deliveryDrone','securityEvictions','ransomwareIncidents'])state[key]=Math.max(0,Math.floor(state[key]));
      state.level=Math.max(1,Math.floor(state.level));state.orderNumber=Math.max(1,Math.floor(state.orderNumber));state.branches=Math.max(1,Math.min(100,Math.floor(state.branches)));
      state.shift=Math.max(1,Math.floor(state.shift));state.shiftOrders=Math.max(0,Math.floor(state.shiftOrders));state.shiftServed=Math.max(0,Math.floor(state.shiftServed));state.shiftRevenue=Math.max(0,state.shiftRevenue);state.shiftClosed=!!state.shiftClosed;
      if(!['M','L'].includes(state.orderSpec.size))state.orderSpec.size='M';if(![0,50,100].includes(state.orderSpec.sugar))state.orderSpec.sugar=50;if(![0,50,100].includes(state.orderSpec.ice))state.orderSpec.ice=50;if(!['none','boba'].includes(state.orderSpec.topping))state.orderSpec.topping='none';
      state.matrixCyclesLeft=Math.max(0,Math.min(eventRules.matrixCycles,Math.floor(state.matrixCyclesLeft)));state.deliveryActive=!!state.deliveryActive;state.robotUnion=!!state.robotUnion;
      state.researchTrials=Math.max(state.researchTrials,state.researchSuccesses+state.researchFailures);state.tutorialStep=Math.max(0,Math.min(2,state.tutorialStep));state.tutorialDone=!!state.tutorialDone;
      state.daily={...base.daily,...state.daily};for(const key of ['espresso','hackers','seconds'])state.daily[key]=Math.max(0,Number(state.daily[key])||0);state.daily.rewarded=!!state.daily.rewarded;
      for(const key of Object.keys(base.inventory))state.inventory[key]=Math.max(0,Math.floor(Number(state.inventory[key])||0));
      for(const key of Object.keys(base.factionRep))state.factionRep[key]=Math.max(0,Number(state.factionRep[key])||0);
      if(!Array.isArray(state.log))state.log=[];
      return state;
    }catch{return initialState()}
  }
  let activeBrew=false, brewTimer=0, savingTimer=0, timerNotice='', audioContext=null,audioLoop=null,audioStep=0,activeThreat=null,activeStoryEvent=null,sessionStarted=false,tutorialActive=false,guidedOutside=false,tickTimer=null,interactiveBrew=null,tutorialAutoFinishTimer=0,visitorActors=[],visitorSequence=0,serveAnimationStarted=0,tutorialLine=0,neoReaction='😄',neoMessage='Chào! Mình là NEO 👋',neoCompanionHideTimer=0;
  let state=loadState();
  delete state.upgrades;
  if(state.securityScheduleVersion!==1){state.securityNextAt=Date.now()+securityDelay();state.securityScheduleVersion=1}
  if(!Number.isFinite(state.securityNextAt))state.securityNextAt=Date.now()+securityDelay();
  state.audio=false;
  const now=Date.now();
  const awaySeconds=Math.min(OFFLINE_CAP,Math.max(0,(now-(Number(state.lastSeen)||now))/1000));
  const previousRate=idleRate(),lastSeen=Number(state.lastSeen)||now,matrixRemaining=state.matrixCyclesLeft>0?Math.max(0,state.matrixCycleEnds-lastSeen)+Math.max(0,state.matrixCyclesLeft-1)*eventRules.matrixDuration:0,matrixOffline=Math.min(awaySeconds,matrixRemaining/1000),deliveryOffline=state.weatherId==='acid'?Math.min(awaySeconds,Math.max(0,(state.weatherChangedAt-lastSeen)/1000)):0;
  const offlineGain=Math.floor(awaySeconds*previousRate+matrixOffline*previousRate*2+deliveryOffline*deliveryRate());
  const maintenancePeriods=state.robotUnion&&now>=state.maintenanceDueAt?Math.floor((now-state.maintenanceDueAt)/3600000)+1:0,offlineMaintenance=maintenancePeriods*Math.ceil(state.bots*.5);
  if(maintenancePeriods)state.maintenanceDueAt+=maintenancePeriods*3600000;
  while(state.matrixCyclesLeft>0&&state.matrixCycleEnds<=now){state.matrixCyclesLeft--;if(state.matrixCyclesLeft>0)state.matrixCycleEnds+=eventRules.matrixDuration;else{state.matrixCycleEnds=0;state.matrixNextAt=Math.max(state.matrixNextAt,now+180000)}}
  if(offlineGain>0||offlineMaintenance>0){state.money=Math.max(0,state.money+offlineGain-offlineMaintenance);addLog(`Robot kiếm ₫${format(offlineGain)} và tốn ₫${format(offlineMaintenance)} bảo trì khi bạn vắng mặt.`,'OFFLINE');if(offlineGain>0)window.setTimeout(()=>toast(`Trong lúc bạn vắng mặt, robot đã kiếm ₫${format(offlineGain)}.`),500)}
  if(!state.orderId||!allRecipes().some(recipe=>recipe.id===state.orderId)||!Number.isFinite(state.orderExpires)||state.orderExpires<now){if(Number.isFinite(state.orderExpires)&&state.orderExpires<now){state.badOrders++;state.reputation=Math.max(0,state.reputation-1);state.reviewScore=Math.max(0,state.reviewScore-20);state.starRating=Math.max(0,state.starRating-1);if(state.starRating<1){state.inspectionActive=true;state.inspectionProgress=Math.max(state.inspectionProgress,15000);if(!state.gameOver){triggerGameOver('Dưới 1 sao. Kiểm tra thực phẩm và quán bị đóng cửa.');}}}newOrder(false)}
  function saveUiSettings(){localStorage.setItem(UI_SETTINGS_KEY,JSON.stringify(uiSettings))}
  function vibrate(pattern){if('vibrate' in navigator){navigator.vibrate(pattern)}}
  function updateResponsiveMode(){
    const isPhoneLayout = window.matchMedia('(max-width: 820px)').matches || window.innerWidth <= 820;
    document.body.classList.toggle('phone-mode', isPhoneLayout);
  }
  const responsiveMedia = window.matchMedia('(max-width: 820px)');
  if (responsiveMedia.addEventListener) responsiveMedia.addEventListener('change', updateResponsiveMode);
  else if (responsiveMedia.addListener) responsiveMedia.addListener(updateResponsiveMode);
  window.addEventListener('resize', updateResponsiveMode);
  window.addEventListener('orientationchange', updateResponsiveMode);
  updateResponsiveMode();
  function updateConnectionStatus(){const offline=!navigator.onLine;document.body.classList.toggle('offline',offline);document.body.classList.toggle('online',!offline);const status=$('saveStatus');if(status){status.textContent=offline?'OFFLINE · CACHE LOCAL':`ĐÃ LƯU · ${clockText()}`;}} 
  function applyUiSettings(){document.body.dataset.theme=uiSettings.theme;$('themeSelect').value=uiSettings.theme;$('languageSelect').value=uiSettings.language;if($('introLanguageSelect'))$('introLanguageSelect').value=uiSettings.language;$('creatorCopyVi').hidden=uiSettings.language==='en';$('creatorCopyEn').hidden=uiSettings.language!=='en';$('creatorProjectVi').hidden=uiSettings.language==='en';$('creatorProjectEn').hidden=uiSettings.language!=='en';window.NEON_BREW_I18N.apply(uiSettings.language)}
  function addCreatorProjectCard(){const card=document.createElement('section');card.className='creator-project-card';card.setAttribute('aria-label','Logo và giới thiệu game NEON BREW');card.innerHTML='<div class="creator-project-logo" aria-hidden="true"><span class="creator-project-mark">☕</span><span class="creator-project-word"><b>NEON</b><strong>BREW</strong></span></div><div class="creator-project-copy"><span class="creator-project-label">DỰ ÁN GAME · NEO-SAIGON 2089</span><p id="creatorProjectVi" lang="vi">NEON BREW là game quản lý quán cà phê tương lai: nhận đơn, tự tay pha chế, khám phá công thức, thuê robot và mở rộng cửa hàng.</p><p id="creatorProjectEn" lang="en" hidden>NEON BREW is a futuristic café management game: serve orders, craft drinks, discover recipes, hire robots, and grow your shop.</p></div>';$('creatorCopyVi').before(card)}
  function toggleFullscreen(){const target=document.documentElement;if(!document.fullscreenElement){if(target.requestFullscreen)target.requestFullscreen().catch(()=>{});return}if(document.exitFullscreen)document.exitFullscreen();}
  $('confirmReset').addEventListener('click',()=>{isResetting=true});
  function orderBonus(){return 1200}
  function allRecipes(){return [...recipes,...state.unlockedRecipes]}
  function recipeById(id){return allRecipes().find(recipe=>recipe.id===id)||recipes[0]}
  function customerLikes(recipe,factionId=state.orderFaction){const faction=factions.find(item=>item.id===factionId);if(!faction)return false;if(faction.want==='premium')return recipe.price>=40000||recipe.legendary;return (recipe.tags||[]).includes(faction.want)}
  function factionBonus(id=state.orderFaction){return Number(state.factionRep[id])||0}
  function shopMultiplier(){return 1+state.prestiges*.05}
  function researchChance(){return Math.min(.9,.65+(factionBonus('hackers')>=25?.15:0))}
  function orderReward(){const recipe=recipeById(state.orderId),liked=customerLikes(recipe);let value=recipe.price;if(state.orderSpec.size==='L')value*=1.25;if(state.orderSpec.topping==='boba')value+=4000;if(state.orderVip)value*=1.15;if(liked)value*=1.08;return Math.round(value*shopMultiplier()+orderBonus())}
  function botCost(){return Math.ceil(90*Math.pow(1.82,state.bots))}
  function branchCost(){return Math.ceil(650*Math.pow(2.25,state.branches-1))}
  function firewallCost(){return Math.ceil(350*Math.pow(1.8,state.firewall))}
  function deliveryDroneCost(){return Math.ceil(320*Math.pow(1.8,state.deliveryDrone))}
  function deliveryRate(){return 0}
  function securityDelay(){return 120000}
  function moneyMultiplier(){return 1}
  function addLog(message,label='Pha chế'){state.log.unshift({message,label,time:clockText()});state.log=state.log.slice(0,5)}
  function addLoreFragment(fragment){
    if(!fragment)return;
    state.loreFragments = [...new Set([...(state.loreFragments||[]), fragment])].slice(-5);
    addLog(fragment,'Bí mật quán');
  }
  function applyParanoia(delta){
    state.paranoia = Math.max(0, Math.min(100, Number(state.paranoia || 0) + delta));
    if(state.paranoia >= 100 && !state.gameOver){
      state.gameOver = true;
      state.inspectionActive = false;
      $('gameOverTitle').textContent = 'CỬA QUÁN ĐÃ MỞ';
      $('gameOverText').textContent = 'Đêm đã quá sâu. Những cái tên không tên đã ở quá gần. Quán bị khóa lại bởi thứ không bao giờ dậy sớm.';
      $('gameOverDialog').hidden = false;
      $('gameOverDialog').classList.add('show');
      toast('Ám ảnh đã tràn ngập quán.');
      save();
    }
  }
  function triggerMysteriousCustomer(){
    const names=['Khách áo trùm đầu','Bóng người ở kính cửa','Cái tên đã bị xóa','Người ở cuối quầy'];
    const requests=['"Sương Đêm Không Tên"','"Nước Ảo Ảnh"','"Cốc Chưa Từng Có"','"Món Vô Danh"'];
    state.ghostOrder={
      name:names[Math.floor(Math.random()*names.length)],
      request:requests[Math.floor(Math.random()*requests.length)],
      expires:Date.now()+22000,
      reward:35
    };
    state.lastHorrorAt=Date.now();
    state.horrorPhase=1;
    applyParanoia(8);
    addLoreFragment('Bạn thấy vết bẩn trên gương: ai đó đã viết lại tên của quán bằng mực cũ.');
    toast('Một bóng người lạ xuất hiện ở cửa kính.');
    addLog('Khách áo trùm đầu xuất hiện lúc nửa đêm, gọi một món không có trong menu.','Khách bí ẩn');
    triggerHallucination();
  }
  function triggerHallucination(){
    state.hallucinationUntil = Date.now() + 22000;
    state.lastHorrorAt = Date.now();
    applyParanoia(14 + Math.min(12, Math.max(0, state.served - 5) * 2));
    addLoreFragment('Một chiếc đồng hồ trên tường đang chạy ngược. Dưới quầy, có dấu vết đã bị phớt lờ suốt thời gian dài.');
    toast('Ánh đèn chớp, bóng người đi qua cửa kính.');
    addLog('Đèn tắt trong nháy mắt. Bóng người thoáng qua cửa kính rồi biến mất.','Ảo giác');
  }
  function triggerRobotWhisper(){
    const whispers=['"Tôi biết tên bạn..."','"Đừng để hắn đứng ở sau quầy."','"Có người đang gọi món trong cái tủ lạnh."','"Mẹ quán đã từng ở đây."'];
    const whisper = whispers[Math.floor(Math.random()*whispers.length)];
    state.robotWhisper = whisper;
    state.lastHorrorAt = Date.now();
    applyParanoia(6);
    addLoreFragment('Robot phục vụ lặp lại một câu không ai từng dạy nó. Nó biết một cái tên mà chưa ai từng nói trước đó.');
    toast('Robot nói vọng lên một câu kỳ lạ.');
    addLog(`Robot nói: “${whisper}”`,'Robot lỗi');
  }
  function starTrustLevel(){const customers=Math.max(1,state.served);const tolerance=Math.max(1,Math.ceil(customers/8));return Math.max(0,5-Math.floor(state.badOrders/tolerance))}
  function updateStarRating(){
    const score = Math.max(0, Math.min(100, Number(state.reviewScore) || 100));
    state.starRating = Math.max(0, Math.min(5, Math.floor(score / 20)));
    if(state.starRating < 1){
      if(!state.inspectionActive){state.inspectionActive=true;toast('Dưới 1 sao — kiểm tra thực phẩm đang tới!');addLog('Danh tiếng thấp dưới 1 sao. Quán chuẩn bị bị kiểm tra.','Kiểm tra');}
      state.inspectionProgress=Math.max(state.inspectionProgress,15000);
      if(!state.gameOver){triggerGameOver('Dưới 1 sao. Kiểm tra thực phẩm và quán bị đóng cửa.');}
    }else{state.inspectionActive=false;state.inspectionProgress=0}
  }
  function triggerGameOver(reason='Kiểm tra thực phẩm thất bại. Quán bị đóng cửa.'){if(state.gameOver)return;state.gameOver=true;state.inspectionActive=false;$('gameOverTitle').textContent='GAME OVER';$('gameOverText').textContent=reason;$('gameOverDialog').hidden=false;$('gameOverDialog').classList.add('show');toast('GAME OVER — kiểm tra thực phẩm thất bại!');save()}
  function startMatrixLoop(){state.matrixCyclesLeft=eventRules.matrixCycles;state.matrixCycleEnds=Date.now()+eventRules.matrixDuration;state.matrixNextAt=Date.now()+180000;document.body.classList.add('matrix-glitch');addLog('Thời gian lặp lại 10 giây · thu nhập nhân 3 trong ba vòng.','Matrix');renderLive();save();toast('Glitch in the Matrix · x3 Credits trong 30 giây!')}
  function showIncident(kind,title,copy,note,timeout,buttons,prompt=''){
    activeThreat={kind,expires:Date.now()+timeout,pay:eventRules.ransom(state.money)};activeStoryEvent=kind.startsWith('story:')?kind.slice(6):null;const box=$('threatDialog'),panel=box.querySelector('.threat-box');$('threatTitle').textContent=title;$('threatCopy').textContent=copy;$('threatNote').textContent=note||'';$('threatNote').hidden=!note;$('threatPrompt').hidden=!prompt;$('threatPrompt').textContent=prompt;$('threatAnswer').hidden=!prompt;$('threatAnswer').value='';panel.classList.toggle('event-story',!prompt);for(const id of ['payThreat','reinstallThreat','hackThreat','acceptUnion','formatRobots','solveThreat','acceptStory','declineStory'])$(id).hidden=!buttons.includes(id);$('threatTimer').textContent=String(Math.ceil(timeout/1000));$('threatDialog').hidden=false;const first=buttons.map(id=>$(id)).find(button=>button&&!button.disabled);if(first)first.focus()
  }
  function closeIncident(){activeThreat=null;activeStoryEvent=null;$('threatDialog').hidden=true;$('threatDialog').querySelector('.threat-box').classList.remove('event-story')}
  function finishIncident(message,label='An ninh'){closeIncident();if(message)$('securityStatus').textContent=message;addLog(message||'Sự cố đã kết thúc.',''+label);render();save()}
  function showStoryEvent(id){if(activeThreat)return;const event=storyEvents[id];if(!event)return;const choices=id==='yakuza'?['acceptStory','declineStory']:['acceptStory','declineStory'];showIncident(`story:${id}`,event.title,event.copy,id==='bulk'?'Hoàn thành 5 món trong 60 giây để nhận ₫500.':id==='arena'?'Buff Cyborg kéo dài 2 phút, đơn Bionic được ưu tiên.':id==='yakuza'?'Yakuza sẽ bảo kê tiệm trong 3 phút.':'',25000,choices)}
  function resolveStoryEvent(accept){const id=activeStoryEvent;if(!id)return;if(accept&&id==='yakuza'){state.yakuzaProtectionUntil=Date.now()+180000;addLog('Yakuza nhận bảo kê khu phố trong 3 phút.','Yakuza');toast('Băng đảng đối thủ sẽ bị Yakuza chặn lại.')}else if(accept&&id==='bulk'){state.bulkOrder={remaining:5,total:5,expires:Date.now()+60000};addLog('Nhận đơn Corporate: phục vụ 5 món trong 60 giây.','Đơn lớn');toast('Đơn hàng lớn đang chạy!')}else if(accept&&id==='arena'){state.arenaBuffUntil=Date.now()+120000;state.orderId='bionic';state.orderFaction='cyborgs';state.orderVip=true;state.orderStarted=Date.now();state.orderExpires=Date.now()+30000;addLog('Đấu sĩ Cyborg gọi Bít Tết Bionic.','Đấu trường');toast('Đơn Cyborg VIP đang chờ!')}else addLog(`Bỏ qua lời mời ${storyEvents[id].title}.`,'Sự kiện');closeIncident();render();save()}
  function advanceBulkOrder(){if(!state.bulkOrder)return;state.bulkOrder.remaining--;if(state.bulkOrder.remaining<=0){const reward=500*moneyMultiplier();state.money+=reward;state.reputation+=5;state.bulkOrder=null;addLog(`Hoàn tất đơn Corporate số lượng lớn · +₫${format(reward)}.`,'Đơn lớn');toast(`Đơn hoàn tất! +₫${format(reward)}.`)}}
  function clockText(){const date=new Date();return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`}
  function dayKey(){return new Date().toISOString().slice(0,10)}
  function save(){if(isResetting)return;state.lastSeen=Date.now();try{const snapshot=JSON.stringify(state);localStorage.setItem(STORE_KEY,snapshot);localStorage.setItem(BACKUP_SAVE_KEY,snapshot);$('saveStatus').textContent=navigator.onLine?'ĐÃ LƯU · '+clockText():'OFFLINE · CACHE LOCAL';}catch{$('saveStatus').textContent='KHÔNG THỂ LƯU TRÊN THIẾT BỊ'}}
  function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2500)}
  function closeShift(){if(activeBrew || interactiveBrew){toast('Đợi pha xong rồi mới tổng kết ca.');return}state.shiftClosed=true;$('shiftSummaryTitle').textContent=`Tổng kết ngày ${state.shift}`;$('shiftSummaryCopy').textContent=`Đã xử lý ${state.shiftOrders} đơn, phục vụ ${state.shiftServed} ly, doanh thu ₫${format(state.shiftRevenue)}. Điểm hài lòng hiện tại: ${Math.round(state.reviewScore)}/100. Kiểm tra kho và chuẩn bị cho ngày tiếp theo.`;$('shiftSummary').hidden=false;$('shiftSummary').classList.add('show');renderRecipes();save()}
  function recordShiftOrder(){state.shiftOrders = Math.max(0, state.shiftOrders + 1);}
  function orderSpecMatchesPrep(prep){const spec=state.orderSpec||{};return prep && spec && String(prep.size)===String(spec.size) && Number(prep.sugar)===Number(spec.sugar) && Number(prep.ice)===Number(spec.ice) && String(prep.topping)===String(spec.topping)}
  function ingredientPrice(item){return Math.ceil(item.cost*(state.dealIngredient===item.id ? .8 : 1))}
  function consumeIngredients(counts){for(const [id,count] of Object.entries(counts)){let remaining=count;const lots=state.inventoryLots[id]||[];for(const lot of lots){const used=Math.min(remaining,lot.quantity);lot.quantity-=used;remaining-=used;if(!remaining)break}state.inventoryLots[id]=lots.filter(lot=>lot.quantity>0);state.inventory[id]=state.inventoryLots[id].reduce((sum,lot)=>sum+lot.quantity,0)}}
  function expireStock(){const spoiled=[];for(const item of ingredients){const lots=state.inventoryLots[item.id]||[],fresh=lots.filter(lot=>state.shift-lot.purchasedShift<item.shelfLife),lost=lots.reduce((sum,lot)=>sum+lot.quantity,0)-fresh.reduce((sum,lot)=>sum+lot.quantity,0);if(lost>0)spoiled.push(`${item.name} ×${lost}`);state.inventoryLots[item.id]=fresh;state.inventory[item.id]=fresh.reduce((sum,lot)=>sum+lot.quantity,0)}if(spoiled.length){addLog(`Đã huỷ nguyên liệu quá hạn: ${spoiled.join(', ')}.`,'Kho');toast(`Đã bỏ nguyên liệu hết hạn: ${spoiled.join(', ')}.`)}}
  function openNextShift(){if(!state.shiftClosed)return;state.shift++;expireStock();state.dealIngredient=ingredients[Math.floor(Math.random()*ingredients.length)].id;state.shiftOrders=0;state.shiftServed=0;state.shiftRevenue=0;state.shiftClosed=false;$('shiftSummary').hidden=true;$('shiftSummary').classList.remove('show');state.lastSeen=Date.now();newOrder(false,true);render();save();toast(`Ngày ${state.shift} bắt đầu. ${ingredients.find(item=>item.id===state.dealIngredient).name} đang giảm 20%.`)}
  function renderOrderPreferences(){const spec=state.orderSpec;$('orderPreferences').textContent=`SIZE ${spec.size} · ĐƯỜNG ${spec.sugar}% · ĐÁ ${spec.ice}% · ${spec.topping==='boba'?'THÊM KEM':'KHÔNG KEM'}`;$('dayNumber').textContent=String(state.shift).padStart(2,'0');$('shiftClock').textContent=`CA SÁNG · ${clockText()}`;for(const button of document.querySelectorAll('[data-buy-ingredient]')){const item=ingredients.find(entry=>entry.id===button.dataset.buyIngredient);if(!item)continue;const cost=ingredientPrice(item),lots=state.inventoryLots[item.id]||[],expiry=lots.length?Math.min(...lots.map(lot=>lot.purchasedShift+item.shelfLife)):null;button.dataset.cost=cost;button.disabled=state.money<cost;button.textContent=`${state.dealIngredient===item.id?'ƯU ĐÃI · ':''}MUA 1 · ₫${format(cost)}`;button.closest('.stock-item').querySelector('.stock-cost').textContent=`₫${format(cost)} / đơn vị${expiry?` · HSD NGÀY ${expiry}`:''}`}}
  function createVisitor(){
    const now=Date.now(),factionId=state.orderFaction||'hackers';
    for(const visitor of visitorActors){if(visitor.phase!=='leaving'){visitor.phase='leaving';visitor.phaseAt=now}}
    const shirts=['#6d9b83','#df9b70','#7398b5','#bd7891','#d0b85e','#8278b7'];
    const hairs=['#49372f','#252b32','#b16e42','#d6bd8a','#593c68','#343f36'];
    const skins=['#f1c9a5','#dca77f','#f4d7bf','#bd8060','#e5b995'];
    visitorActors.push({id:++visitorSequence,factionId,shirt:shirts[Math.floor(Math.random()*shirts.length)],hair:hairs[Math.floor(Math.random()*hairs.length)],skin:skins[Math.floor(Math.random()*skins.length)],bag:Math.random()<.45,cap:Math.random()<.3,fromLeft:Math.random()<.5,target:.48+Math.random()*.1,phase:'arriving',phaseAt:now});
  }
  function newOrder(log=true, forceDifferent=false){
    if(interactiveBrew){interactiveBrew=null;const seq=$('brewSequence');if(seq)seq.hidden=true;}
    const pool=allRecipes();
    let nextRecipeId=pool[Math.floor(Math.random()*pool.length)].id;
    if(forceDifferent || state.orderId){
      const alternatives=pool.filter(recipe=>recipe.id!==state.orderId && (!forceDifferent || recipe.id!==nextRecipeId));
      if(alternatives.length)nextRecipeId=alternatives[Math.floor(Math.random()*alternatives.length)].id;
    }
    state.orderId=nextRecipeId;
    const factionPool=factions.map(item=>item.id);state.orderFaction=factionPool[Math.floor(Math.random()*factionPool.length)];state.orderVip=Math.random()<.03;state.orderSpec={size:Math.random()<.42?'L':'M',sugar:[0,50,100][Math.floor(Math.random()*3)],ice:[0,50,100][Math.floor(Math.random()*3)],topping:Math.random()<.24?'boba':'none'};const now=Date.now();state.orderStarted=now;state.orderExpires=now+45000;state.orderShuffleAt=now+15000+Math.random()*20000;state.orderNumber++;createVisitor();renderOrderPreferences();if(sessionStarted&&!tutorialActive)setNeoMessage('😮','Có khách mới tới! Cùng xem bạn ấy muốn gọi món gì nhé.');if(log)addLog('Có khách mới ghé quầy.','Khách mới')
  }
  function renderRecipes(){const grid=$('recipeGrid');grid.innerHTML='';for(const recipe of allRecipes()){const button=document.createElement('button');const shouldHighlight=Boolean(tutorialActive && recipe.id===state.orderId);button.className='recipe-btn'+(shouldHighlight?' match':'');button.type='button';button.disabled=!!interactiveBrew||activeBrew||state.shiftClosed||Date.now()<state.orderStarted;button.setAttribute('aria-label',`Pha ${recipe.name}, giá cơ bản ${recipe.price} đồng`);button.innerHTML=`<div class="recipe-top"><span class="recipe-illustration" data-drink="${escapeHtml(recipe.id)}" role="img" aria-label="${escapeHtml(recipe.name)}"><span class="drink-vessel"><span class="drink-foam"></span></span><span class="drink-steam"></span><span class="drink-garnish"></span></span><span class="recipe-price">${recipe.legendary?'×5 ':''}₫${format(recipe.price)}</span></div><div class="recipe-name">${escapeHtml(recipe.name)}</div><div class="recipe-note">${escapeHtml(recipe.details)}</div>`;button.addEventListener('click',()=>beginInteractiveBrew(recipe.id));grid.appendChild(button)}renderOrderPreferences()}
  function dailyProgress(){return {espresso:Math.min(200,state.daily.espresso),hackers:Math.min(3,state.daily.hackers),seconds:Math.min(900,Math.floor(state.daily.seconds))}}
  function checkBadges(){const goals=[['millionaire',state.money>=1000000],['recipes',state.unlockedRecipes.length>=3],['rebirth',state.prestiges>0]];for(const [id,earned] of goals){if(earned&&!state.badges[id]){state.badges[id]=true;state.chips++;addLog(`Mở khóa huy hiệu ${id==='millionaire'?'Triệu phú Cyber':id==='recipes'?'Bậc thầy công thức':'Chuyển sinh lần đầu'} · +1 Quantum Chip.`,'Thành tựu')}}}
  function renderFeatureViewsLegacy(){
    $('chipValue').textContent=`◇ ${format(state.chips)} QC`;$('chipBalance').textContent=`◇ ${format(state.chips)} QC`;$('prestigeCount').textContent=`${state.prestiges} LẦN TÁI SINH`;
    const requested=recipeById(state.orderId),faction=factions.find(item=>item.id===state.orderFaction)||factions[0];$('factionGuestIcon').textContent=faction.icon;$('factionGuestType').textContent=state.orderVip?'KHÁCH VIP · '+faction.name.toUpperCase():faction.name.toUpperCase();$('factionGuestName').textContent=state.orderVip?'Khách VIP · '+requested.name:requested.name;$('factionGuestMood').textContent=`${customerLikes(requested)?'HỢP GU':'ĐANG CHỜ'} · ${faction.want==='premium'?'hạng sang':faction.want}`;
    $('factionList').innerHTML=factions.map(item=>{const score=Math.max(0,state.factionRep[item.id]||0),level=score>=25?'ĐẶC QUYỀN II':score>=10?'ĐẶC QUYỀN I':'ĐANG GÂY DỰNG';return `<div class="faction-row"><span class="faction-icon">${item.icon}</span><div><div class="faction-name">${item.name}</div><div class="faction-perk">${item.perk}</div><div class="faction-meter"><i style="width:${Math.min(100,score/25*100)}%"></i></div></div><span class="faction-score">${format(score)}<br>${level}</span></div>`}).join('');
    const weather=weathers.find(item=>item.id===state.weatherId)||weathers[2];$('weatherIcon').textContent=weather.icon;$('weatherName').textContent=weather.name;$('weatherEffect').textContent=state.ghostOrder?`Bí ẩn quanh quán · ${state.ghostOrder.request}`:state.paranoia>60?`Ám ảnh tứ phía · sợ hãi ${state.paranoia}%`:weather.effect;$('weatherClock').textContent=`ĐỔI SAU ${Math.max(0,Math.ceil((state.weatherChangedAt-Date.now())/1000))}S`;
    $('ingredientStock').innerHTML=ingredients.map(item=>`<div class="stock-item"><div class="stock-top"><span class="stock-name">${item.icon} ${item.name}</span><span class="stock-amount">×${format(state.inventory[item.id]||0)}</span></div><div class="stock-cost">₫${item.cost} / đơn vị</div><button class="action-btn" data-cost="${item.cost}" data-buy-ingredient="${item.id}" ${state.money<item.cost?'disabled':''}>MUA 1 · ₫${item.cost}</button></div>`).join('')+(state.cyberWaste?`<div class="stock-item"><div class="stock-top"><span class="stock-name">☣ Rác thải Cyber</span><span class="stock-amount">×${format(state.cyberWaste)}</span></div><div class="stock-cost">Phế liệu có thể tái chế.</div><button class="action-btn" data-recycle-waste>TÁI CHẾ · +₫${format(state.cyberWaste*5)}</button></div>`:'');
    const selects=[$('ingredientA'),$('ingredientB'),$('ingredientC')],chosen=selects.map(select=>select.value);for(let index=0;index<selects.length;index++){selects[index].innerHTML=ingredients.map(item=>`<option value="${item.id}">${item.name} · ×${state.inventory[item.id]||0}</option>`).join('');if(chosen[index])selects[index].value=chosen[index]}
    const selected=selects.map(select=>select.value),needed=Object.fromEntries(ingredients.map(item=>[item.id,selected.filter(id=>id===item.id).length]));const canMix=Object.entries(needed).every(([id,count])=>(state.inventory[id]||0)>=count)&&state.money>=18,researchProgress=state.researchTrials%5;$('researchButton').disabled=!canMix;$('researchOdds').textContent=`${Math.round(researchChance()*100)}% THÀNH CÔNG`;$('researchSuccessCount').textContent=String(state.researchSuccesses);$('researchFailureCount').textContent=String(state.researchFailures);$('researchTrialCount').textContent=String(state.researchTrials);$('researchProgressMeter').style.width=`${researchProgress/5*100}%`;$('researchProgressText').textContent=`Còn ${5-researchProgress} lần thử tới mốc tổng kết tiếp theo. Huyền thoại: 8% trong lần thành công.`;
    $('formulaCount').textContent=`${recipes.length+state.unlockedRecipes.length} CÔNG THỨC`;$('formulaList').innerHTML=[...recipes,...state.unlockedRecipes].map(recipe=>`<div class="formula-entry"><span>${escapeHtml(recipe.icon)} ${escapeHtml(recipe.name)}<small>${escapeHtml(recipe.details)}</small></span><span class="tag-chip">${recipe.legendary?'HUYỀN THOẠI ×5':'₫'+format(recipe.price)}</span></div>`).join('');
    $('decorGrid').innerHTML=decorItems.map(item=>`<div class="decor-item"><div class="decor-top"><span class="decor-name">${item.icon} ${item.name}</span><span class="tag-chip">${state.decorations[item.id]?'ĐÃ LẮP':'₫'+format(item.cost)}</span></div><div class="decor-desc">${item.description}</div><button class="action-btn" data-cost="${item.cost}" data-owned="${!!state.decorations[item.id]}" data-buy-decor="${item.id}" ${state.decorations[item.id]||state.money<item.cost?'disabled':''}>${state.decorations[item.id]?'ĐANG HOẠT ĐỘNG':'MUA · ₫'+format(item.cost)}</button></div>`).join('');
    $('buyDrone').textContent=state.drone?`DRONE CẤP ${state.drone} · ₫${format(Math.ceil(220*Math.pow(1.7,state.drone)))}`:'MUA DRONE · ₫220';$('buyDrone').dataset.cost=Math.ceil(220*Math.pow(1.7,state.drone));$('buyDrone').disabled=state.money<Number($('buyDrone').dataset.cost);$('buyBouncer').textContent=state.bouncer?`BOUNCER CẤP ${state.bouncer} · ₫${format(Math.ceil(280*Math.pow(1.7,state.bouncer)))}`:'THUÊ BOUNCER · ₫280';$('buyBouncer').dataset.cost=Math.ceil(280*Math.pow(1.7,state.bouncer));$('buyBouncer').disabled=state.money<Number($('buyBouncer').dataset.cost);$('buyFirewall').textContent=state.firewall?`FIREWALL CẤP ${state.firewall} · ₫${format(firewallCost())}`:`MUA FIREWALL · ₫${format(firewallCost())}`;$('buyFirewall').dataset.cost=firewallCost();$('buyFirewall').disabled=state.money<firewallCost();$('securityLevel').textContent=`Drone ${state.drone} · Bouncer ${state.bouncer} · Firewall ${state.firewall} · Đã chặn ${state.securityEvictions} cuộc ghé thăm.`;
    $('buyDeliveryDrone').textContent=state.deliveryDrone?`NÂNG DRONE ${state.deliveryDrone} · ₫${format(deliveryDroneCost())}`:`MUA DRONE · ₫${format(deliveryDroneCost())}`;$('buyDeliveryDrone').dataset.cost=deliveryDroneCost();$('buyDeliveryDrone').disabled=state.money<deliveryDroneCost();$('toggleDelivery').disabled=state.deliveryDrone<1;$('toggleDelivery').textContent=state.deliveryActive?'TẮT ĐỘI BAY':'KÍCH HOẠT ĐỘI BAY';$('deliveryRate').textContent=`+₫${format(deliveryRate())} / GIÂY`;$('deliveryStatus').textContent=state.deliveryDrone?state.weatherId==='acid'?(state.deliveryActive?'Bão axit: đội bay hoạt động, thu nhập +200%.':'Bão axit: bật đội bay để tăng thu nhập 200%.'):`Đội bay sẵn sàng · chỉ tạo doanh thu khi có Bão Mưa Axit.`:'Mua drone để mở đội giao hàng tận nơi.';
    const track=tracks.find(item=>item.id===state.trackId)||tracks[0];$('jukeboxTrackName').textContent=track.name;$('jukeboxTrackDesc').textContent=`${track.style} · NEO-SAIGON`;$('waveBars').classList.toggle('playing',state.audio);$('trackList').innerHTML=tracks.map(item=>{const owned=state.tracks.includes(item.id),playing=state.trackId===item.id;return `<div class="track-item"><div class="track-top"><span class="track-name">♫ ${item.name}</span><span class="tag-chip">${playing?'ĐANG CHỌN':owned?'ĐÃ MUA':'₫'+format(item.cost)}</span></div><div class="track-desc">${item.style}</div><button class="action-btn" ${owned?'':`data-cost="${item.cost}"`} data-track="${item.id}" ${!owned&&state.money<item.cost?'disabled':''}>${!owned?'MUA ĐĨA · ₫'+format(item.cost):playing&&state.audio?'ĐANG PHÁT':'PHÁT ĐĨA'}</button></div>`}).join('');
    const progress=dailyProgress(),allDone=progress.espresso>=200&&progress.hackers>=3&&progress.seconds>=900;$('dailyDate').textContent=dayKey();$('questList').innerHTML=[{id:'espresso',title:'Thợ chiết xuất',label:'Pha 200 ly cà phê',value:progress.espresso,target:200},{id:'hackers',title:'Tường lửa sống',label:'Đuổi 3 Hacker',value:progress.hackers,target:3},{id:'seconds',title:'Ca đêm bền bỉ',label:'Chơi 15 phút',value:progress.seconds,target:900}].map(item=>`<div class="quest-item" data-quest="${item.id}"><div class="quest-title">${item.title}</div><div class="quest-meta"><span>${item.label}</span><span>${format(item.value)} / ${format(item.target)}</span></div><div class="quest-meter"><i style="width:${Math.min(100,item.value/item.target*100)}%"></i></div></div>`).join('')+(allDone&&!state.daily.rewarded?'<button class="action-btn primary" data-action="claim-quest">NHẬN THƯỞNG · 1 QUANTUM CHIP</button>':'');
    const badgeData=[{id:'millionaire',title:'Triệu phú Cyber',desc:'Tích lũy ₫1.000.000.',earned:state.badges.millionaire||state.money>=1000000},{id:'recipes',title:'Bậc thầy công thức',desc:'Khám phá 3 công thức trong phòng lab.',earned:state.badges.recipes||state.unlockedRecipes.length>=3},{id:'rebirth',title:'Chuyển sinh lần đầu',desc:'Tái khởi động tiệm lần đầu.',earned:state.badges.rebirth||state.prestiges>0}];$('badgeCount').textContent=`${badgeData.filter(item=>item.earned).length} / ${badgeData.length}`;$('badgeGrid').innerHTML=badgeData.map(item=>`<div class="badge-item ${item.earned?'':'locked'}"><span class="badge-mark">${item.earned?'✦':'◇'}</span><div class="badge-title">${item.title}</div><div class="badge-desc">${item.desc}</div></div>`).join('');
    const canPrestige=state.served>=200&&state.chips>=1;$('prestigeButton').disabled=!canPrestige;$('prestigeInfo').textContent=canPrestige?'Đủ điều kiện! Dùng 1 QC để chuyển sinh, giữ huy hiệu và tăng doanh thu vĩnh viễn 5%.':'Cần 200 ly đã phục vụ và 1 Quantum Chip. Nhiệm vụ ngày và thành tựu có thể thưởng QC.';
    $('crtToggle').setAttribute('aria-pressed',String(!!state.crt));$('crtToggle').textContent=`CRT: ${state.crt?'BẬT':'TẮT'}`;document.body.classList.toggle('crt',!!state.crt);
  }
  function renderFeatureViews(){
    $('ingredientStock').innerHTML=ingredients.map(item=>{const cost=ingredientPrice(item),stock=state.inventory[item.id]||0;return `<div class="stock-item"><div class="stock-top"><span class="stock-name">${item.icon} ${item.name}</span><span class="stock-amount">×${format(stock)}</span></div><div class="stock-cost">₫${format(cost)} / đơn vị · dùng trong ${item.shelfLife} ngày</div><button class="action-btn" data-cost="${cost}" data-buy-ingredient="${item.id}" ${state.money<cost?'disabled':''}>MUA 1 · ₫${format(cost)}</button></div>`}).join('');
  }
  function updateCafeStatus(){
    const status=$('sceneStatus');
    if(!status)return;
    const now=Date.now();
    let label='QUẦY PHA CHẾ · ĐANG MỞ';
    if(state.shiftClosed){label='QUẦY PHA CHẾ · ĐÃ ĐÓNG CA';}
    else if(activeBrew){label='QUẦY PHA CHẾ · ĐANG PHA';}
    else if(now>=state.orderExpires){label='QUẦY PHA CHẾ · KHÁCH HẾT GIỜ';}
    else if(now-state.orderStarted<3000){label='QUẦY PHA CHẾ · KHÁCH MỚI';}
    status.innerHTML=`<i class="live-dot"></i>${label}`;
  }
  function render(){
    updateConnectionStatus();
    $('moneyValue').textContent='₫ '+format(state.money);$('servedValue').textContent=format(state.served);const stars=window.NEON_BREW_RENDER.stars(state.starRating);$('repValue').innerHTML=`${Math.round(state.reviewScore)} <small>/ 100</small><div class="star-row">${stars}</div>`;$('repTrend').textContent='MỨC HÀI LÒNG';$('shiftOrderValue').textContent=`${state.shiftOrders}`;$('shiftServedValue').textContent=`${state.shiftServed} ly`;$('shiftProgressValue').textContent=`${state.shiftOrders}`;$('shiftRevenueValue').textContent=`₫${format(state.shiftRevenue)}`;$('shiftStatus').textContent=state.shiftClosed?'ĐÃ ĐÓNG':'ĐANG MỞ';
    const requested=recipeById(state.orderId),visitor=factions.find(item=>item.id===state.orderFaction)||factions[0];$('orderIcon').textContent=visitor.icon;$('orderName').textContent=requested.name;$('orderRecipe').textContent=`${visitor.name} · ${requested.recipe}`;$('orderPay').innerHTML=`+₫${format(orderReward())}<small>${customerLikes(requested)?'đúng gu · giá dự kiến':'giá dự kiến'}</small>`;$('orderNumber').textContent=`ĐƠN #${String(state.orderNumber).padStart(3,'0')}`;const brewHint=$('brewHint');if(brewHint){const spec=state.orderSpec||{};const targetPrefix=customerLikes(requested)?'HỢP GU':'MỤC TIÊU';brewHint.innerHTML=`<span>${targetPrefix}</span><strong>${visitor.name.toUpperCase()} · ${requested.name.toUpperCase()} · SIZE ${spec.size || 'M'} · ĐƯỜNG ${Number(spec.sugar ?? 50)}% · ĐÁ ${Number(spec.ice ?? 50)}%</strong>`;}
    updateCafeStatus();
    $('logList').innerHTML = window.NEON_BREW_RENDER.logHtml(state.log);
    $('levelBadge').textContent=`${Math.round(state.reviewScore)} / 100`;$('nextLevel').textContent='MỨC HÀI LÒNG';$('repCurrent').textContent=`${Math.round(state.reviewScore)} điểm hài lòng`;$('repTarget').textContent='100 điểm';$('repMeter').style.width=`${Math.max(0,Math.min(100,state.reviewScore))}%`;$('progressText').textContent=state.reviewScore>=80?'Khách đang hài lòng với quán':state.reviewScore>=50?'Cần chăm chút từng đơn':'Hãy pha đúng món khách gọi';
    $('dayNumber').textContent=String(state.shift).padStart(2,'0');$('timeLabel').textContent='· '+clockText();$('sceneClock').textContent=clockText();$('shiftClock').textContent=`CA SÁNG · ${clockText()}`;$('soundLabel').textContent=`NHẠC: ${state.audio?'BẬT':'TẮT'}`;$('soundIcon').textContent=state.audio?'◖':'♫';
    renderRecipes();renderFeatureViews();renderLive();
  }
  function renderLive(){
    $('moneyValue').textContent='₫ '+format(state.money);$('servedValue').textContent=format(state.served);const stars=window.NEON_BREW_RENDER.stars(state.starRating);$('repValue').innerHTML=`${Math.round(state.reviewScore)} <small>/ 100</small><div class="star-row">${stars}</div>`;$('repTrend').textContent='MỨC HÀI LÒNG';$('shiftOrderValue').textContent=`${state.shiftOrders}`;$('shiftServedValue').textContent=`${state.shiftServed} ly`;$('shiftProgressValue').textContent=`${state.shiftOrders}`;$('shiftRevenueValue').textContent=`₫${format(state.shiftRevenue)}`;$('shiftStatus').textContent=state.shiftClosed?'ĐÃ ĐÓNG':'ĐANG MỞ';
    $('dayNumber').textContent=String(state.shift).padStart(2,'0');$('timeLabel').textContent='· '+clockText();$('sceneClock').textContent=clockText();$('shiftClock').textContent=`CA SÁNG · ${clockText()}`;
    updateCafeStatus();
    $('levelBadge').textContent=`${Math.round(state.reviewScore)} / 100`;$('repCurrent').textContent=`${Math.round(state.reviewScore)} điểm hài lòng`;$('repMeter').style.width=`${Math.max(0,Math.min(100,state.reviewScore))}%`;$('progressText').textContent=state.reviewScore>=80?'Khách đang hài lòng với quán':state.reviewScore>=50?'Cần chăm chút từng đơn':'Hãy pha đúng món khách gọi';
    const duration=Math.max(1,state.orderExpires-state.orderStarted),left=Math.min(100,Math.max(0,(state.orderExpires-Date.now())/duration*100));$('orderTimer').style.width=left+'%';$('orderTimer').style.background=left<25?'var(--pink)':'var(--amber)';$('weatherClock').textContent=`ĐỔI SAU ${Math.max(0,Math.ceil((state.weatherChangedAt-Date.now())/1000))}S`;
    const secondsQuest=document.querySelector('[data-quest="seconds"]');if(secondsQuest){const seconds=Math.min(900,Math.floor(state.daily.seconds));secondsQuest.querySelector('.quest-meta span:last-child').textContent=`${format(seconds)} / 900` ;secondsQuest.querySelector('.quest-meter i').style.width=`${seconds/900*100}%`}
    for(const button of document.querySelectorAll('[data-cost]'))button.disabled=button.dataset.owned==='true'||state.money<Number(button.dataset.cost);
    const selects=[$('ingredientA'),$('ingredientB'),$('ingredientC')],needed=Object.fromEntries(ingredients.map(item=>[item.id,selects.filter(select=>select.value===item.id).length]));$('researchButton').disabled=state.money<18||Object.entries(needed).some(([id,count])=>(state.inventory[id]||0)<count);
    $('matrixAlert').classList.toggle('active',state.matrixCyclesLeft>0);if(state.matrixCyclesLeft>0){$('matrixTime').textContent=String(Math.max(0,Math.ceil((state.matrixCycleEnds-Date.now())/1000)));$('matrixCycle').textContent=String(eventRules.matrixCycles-state.matrixCyclesLeft+1)}document.body.classList.toggle('matrix-glitch',state.matrixCyclesLeft>0);
    if(activeThreat)$('threatTimer').textContent=String(Math.max(0,Math.ceil((activeThreat.expires-Date.now())/1000)));if(state.bulkOrder){$('bulkOrderAlert').classList.add('active');$('bulkOrderText').textContent=`ĐƠN CORPORATE · ${state.bulkOrder.remaining}/${state.bulkOrder.total} MÓN · CÒN ${Math.max(0,Math.ceil((state.bulkOrder.expires-Date.now())/1000))}S`}else $('bulkOrderAlert').classList.remove('active');
  }
  function normalizeTutorialStep(){state.tutorialStep=Math.max(0,Math.min(2,state.tutorialStep||0))}
  function syncTutorialLock(){
    window.NEON_BREW_TUTORIAL.syncTutorialLock({ tutorialActive, guidedOutside, sessionStarted });
  }
  function tutorialDialogues(){
    const recipe=recipeById(state.orderId);
    return [
      {title:'NEO · LÀM QUEN',reaction:'😄',lines:['Chào! Mình là NEO 👋','Đây là quán cà phê của bạn.','Mình sẽ đồng hành cùng bạn.','Mua một nguyên liệu để mở quầy nhé.'],waiting:'Mình chờ bạn mua một nguyên liệu nhé.',action:'NEO ĐANG CHỜ NGUYÊN LIỆU'},
      {title:'NEO · ĐƠN ĐẦU TIÊN',reaction:'😮',lines:['Có khách đầu tiên tới rồi!','Khách gọi '+recipe.name+'.','Chọn đúng món và tùy chọn rồi pha nhé.'],waiting:'Mình chờ bạn hoàn tất đơn đầu tiên.',action:'NEO ĐANG CHỜ BẠN PHA'},
      {title:'NEO · BẠN ĐỒNG HÀNH',reaction:'🎉',lines:['Tuyệt! Đơn đầu tiên đã hoàn tất.','Mình sẽ ở đây đồng hành cùng bạn.','Cùng mở quán và đón thêm khách nhé!'],waiting:'',action:'MỞ QUÁN'}
    ];
  }
  function renderCompanion(){
    if(!sessionStarted||tutorialActive)return;
    $('tutorialDockCounter').textContent='NEO · ĐỒNG HÀNH';$('tutorialDockHeading').textContent='NEO';$('tutorialDockText').textContent=neoMessage;$('tutorialDockHint').textContent='';$('tutorialDockExpand').textContent='XEM LẠI';$('tutorialDockExpand').disabled=false;$('tutorialDockSkip').hidden=true;$('tutorialMiniCharacter').dataset.expression=neoReaction;$('tutorialDock').hidden=false;
    window.clearTimeout(neoCompanionHideTimer);if(state.tutorialDone)neoCompanionHideTimer=window.setTimeout(()=>{if(state.tutorialDone&&!tutorialActive)$('tutorialDock').hidden=true},4200);
  }
  function setNeoMessage(reaction,message){neoReaction=reaction;neoMessage=message;if(sessionStarted&&!tutorialActive)renderCompanion()}
  function renderTutorial(){
    const step=Math.min(2,state.tutorialStep),item=tutorialDialogues()[step],line=Math.min(tutorialLine,item.lines.length-1),waiting=step<2&&line===item.lines.length-1,finished=step===2&&line===item.lines.length-1,counter=`${String(step+1).padStart(2,'0')} / 03`,message=item.lines[line];
    neoReaction=item.reaction;$('tutorialMiniCharacter').dataset.expression=neoReaction;document.querySelector('.tutorial-guide').innerHTML='NEO <span>· BẠN ĐỒNG HÀNH</span>';$('tutorialHeading').textContent=item.title;$('tutorialText').textContent=message;$('tutorialHint').textContent=waiting?item.waiting:'';$('tutorialContinue').textContent=waiting?'ĐANG CHỜ':finished?'MỞ QUÁN':'TIẾP TỤC';$('tutorialContinue').disabled=waiting;$('tutorialCounter').textContent=counter;$('tutorialProgress').style.width=`${step/2*100}%`;$('tutorialDockCounter').textContent=counter;$('tutorialDockHeading').textContent='NEO';$('tutorialDockText').textContent=message;$('tutorialDockHint').textContent='';$('tutorialDockExpand').textContent=waiting?'CHỜ':finished?'MỞ QUÁN':'TIẾP TỤC';$('tutorialDockExpand').disabled=waiting;$('tutorialDockSkip').hidden=false;$('tutorialScreen').hidden=true;$('tutorialDock').hidden=false;updateTutorialTarget()
  }
  function updateTutorialTarget(){
    document.querySelectorAll('.tutorial-target').forEach(element=>element.classList.remove('tutorial-target'));
    return;
  }
  function enableOutsideTutorial(){if(!tutorialActive)return;guidedOutside=true;$('tutorialScreen').hidden=true;$('gameShell').inert=false;$('tutorialDock').hidden=false;document.body.classList.add('tutorial-guided');syncTutorialLock();renderTutorial();save()}
  function reopenTutorial(){if(!tutorialActive)return;guidedOutside=false;$('gameShell').inert=false;$('tutorialDock').hidden=false;document.body.classList.remove('tutorial-guided');syncTutorialLock();renderTutorial()}
  function setTutorialOrder(){state.orderId='meteor';state.orderFaction='hackers';state.orderVip=false;state.orderSpec={size:'M',sugar:50,ice:50,topping:'none'};$('cupSize').value='M';$('sugarLevel').value='50';$('iceLevel').value='50';$('toppingChoice').value='none';state.orderStarted=Date.now();state.orderExpires=Date.now()+45000;renderOrderPreferences()}
  function startTutorial(){if(state.tutorialDone)return;window.clearTimeout(tutorialAutoFinishTimer);window.clearTimeout(neoCompanionHideTimer);tutorialAutoFinishTimer=0;tutorialLine=0;tutorialActive=true;guidedOutside=false;$('gameShell').inert=false;$('tutorialScreen').hidden=true;$('tutorialDock').hidden=false;document.body.classList.remove('tutorial-guided');normalizeTutorialStep();if(state.tutorialStep<2)setTutorialOrder();render();syncTutorialLock();renderTutorial();save()}
  function startGameSession(){if(sessionStarted)return;sessionStarted=true;document.body.classList.remove('intro-open');$('introScreen').classList.add('leaving');$('gameShell').inert=false;$('gameShell').removeAttribute('aria-hidden');window.scrollTo(0,0);state.lastSeen=Date.now();tickTimer=setInterval(tick,1000);syncTutorialLock();renderCompanion();save();window.setTimeout(()=>$('introScreen').remove(),300)}
  function advanceTutorial(){if(!tutorialActive)return;state.tutorialStep=Math.min(2,state.tutorialStep+1);tutorialLine=0;if(state.tutorialStep===1)setTutorialOrder();render();syncTutorialLock();renderTutorial();save()}
  function finishTutorial(){if(!tutorialActive)return;window.clearTimeout(tutorialAutoFinishTimer);tutorialAutoFinishTimer=0;state.tutorialDone=true;state.tutorialStep=2;tutorialActive=false;guidedOutside=false;$('tutorialScreen').hidden=true;$('gameShell').inert=false;document.body.classList.remove('tutorial-guided');syncTutorialLock();document.querySelectorAll('.tutorial-target').forEach(element=>element.classList.remove('tutorial-target'));setNeoMessage('🎉','Chúc bạn chơi vui nhé! NEO luôn ở đây.');renderCompanion();save();toast('Chúc bạn chơi game vui vẻ!')}
  function doTutorialAction(){if(!tutorialActive)return;const item=tutorialDialogues()[state.tutorialStep];if(tutorialLine<item.lines.length-1){tutorialLine++;renderTutorial();return}if(state.tutorialStep<2){toast(item.waiting);return}finishTutorial()}
  function skipTutorial(){if(!tutorialActive)return;window.clearTimeout(tutorialAutoFinishTimer);tutorialAutoFinishTimer=0;state.tutorialDone=true;state.tutorialStep=2;tutorialActive=false;guidedOutside=false;$('tutorialScreen').hidden=true;$('gameShell').inert=false;document.body.classList.remove('tutorial-guided');syncTutorialLock();document.querySelectorAll('.tutorial-target').forEach(element=>element.classList.remove('tutorial-target'));setNeoMessage('🎉','Chúc bạn chơi vui nhé! NEO luôn ở đây.');renderCompanion();save()}
  function replayTutorial(){if(!sessionStarted){window.clearTimeout(tutorialAutoFinishTimer);tutorialAutoFinishTimer=0;state.tutorialDone=false;state.tutorialStep=0;save();return}window.clearTimeout(tutorialAutoFinishTimer);tutorialAutoFinishTimer=0;state.tutorialDone=false;state.tutorialStep=0;setTutorialOrder();startTutorial()}
  const escapeHtml = window.NEON_BREW_HELPERS.escapeHtml;
  function updateBrewSequenceUI(){
    const seq=$('brewSequence');
    if(!seq)return;
    if(!interactiveBrew){seq.hidden=true;return;}
    const { prep, stage }=interactiveBrew;
    const needsTopping = prep.topping === 'boba';
    const targetStage = needsTopping ? 2 : 1;
    $('pourWaterBtn').disabled = stage >= 1;
    $('addToppingBtn').disabled = !needsTopping || stage >= 2;
    $('finishBrewBtn').disabled = stage < targetStage;
    const status = !needsTopping
      ? (stage >= 1 ? 'NƯỚC ĐÃ GỌT · SẴN SÀNG HOÀN THÀNH' : 'GỌT NƯỚC ĐỂ BẮT ĐẦU')
      : (stage === 0 ? 'GỌT NƯỚC ĐỂ BẮT ĐẦU' : stage === 1 ? 'THÊM TOPPING VÀO LY' : 'SẴN SÀNG HOÀN THÀNH');
    $('brewSequenceStatus').textContent = status;
    seq.hidden=false;
  }
  function completeInteractiveBrew(){
    if(!interactiveBrew)return;
    const { recipeId, prep, ingredientCounts } = interactiveBrew;
    interactiveBrew = null;
    $('brewSequence').hidden = true;
    const recipe = recipeById(recipeId);
    if(!recipe)return;
    activeBrew=true;$('brewShade').classList.add('show');renderRecipes();if(tutorialActive)renderTutorial();
    const duration=1250;
    brewTimer=setTimeout(()=>{
      const optionsCorrect=orderSpecMatchesPrep(prep),correct=recipe.id===state.orderId&&optionsCorrect,liked=customerLikes(recipe);let earned=0;
      const reviewPercent=orderReviewPercent(correct,liked,state.orderVip),repDelta=orderReputationDelta(correct,liked,state.orderVip);if(correct)serveAnimationStarted=Date.now();
      state.reviewScore=Math.max(0,Math.min(100,(state.reviewScore*.7)+(reviewPercent*.3)));
      vibrate(correct ? [30,40,30] : [60,50,60]);
      consumeIngredients(ingredientCounts);
      if(correct){earned=orderReward();state.money+=earned;state.lifetimeEarned=(state.lifetimeEarned||0)+earned;state.served++;state.shiftServed++;state.shiftRevenue+=earned;state.lifetimeServed=(state.lifetimeServed||0)+1;state.xp+=3;}else{state.badOrders++;state.starRating=Math.max(0,state.starRating-1);toast('Sai món hoặc tuỳ chọn — khách đánh giá thấp, bạn mất 1 sao!');addLog(`Sai đơn ${recipe.name}. Khách phàn nàn về món hoặc tuỳ chọn.`,'Đánh giá')}
      state.reputation=Math.max(0,state.reputation+repDelta);if(liked)state.factionRep[state.orderFaction]+=correct?2:1;if(recipe.id==='meteor'||(recipe.tags||[]).includes('caffeine'))state.daily.espresso++;
      updateStarRating();while(state.reputation>=state.level*10)state.level++;advanceBulkOrder();checkBadges();addLog(`${correct?'Đúng đơn':'Sai đơn '+recipe.short}${liked&&correct?' · hợp gu '+state.orderFaction:''} · ${correct?`KPI ${reviewPercent}% · nhận ₫${format(earned)}`:`KPI ${reviewPercent}% · mất ${Math.abs(repDelta)} danh tiếng`}.`,correct?'Đơn hoàn tất':'Đánh giá');
      activeBrew=false;$('brewShade').classList.remove('show');setTimeout(()=>document.body.classList.remove('glitch'),180);recordShiftOrder();if(!state.shiftClosed)newOrder(false);
      const resultMessage=correct?`Đúng món ${recipe.name}! Khách vui rồi 🎉`:`Chưa đúng đơn ${recipe.name}. Mình thử lại nhé.`;
      if(tutorialActive&&state.tutorialStep===1){
        if(correct){neoReaction='🎉';render();save();$('tutorialMiniCharacter').dataset.expression=neoReaction;$('tutorialDockText').textContent=resultMessage;$('tutorialDockHint').textContent='';window.setTimeout(()=>{if(tutorialActive&&state.tutorialStep===1)advanceTutorial()},650)}
        else{setTutorialOrder();tutorialLine=tutorialDialogues()[1].lines.length-1;render();syncTutorialLock();renderTutorial();neoReaction='⚠️';$('tutorialMiniCharacter').dataset.expression=neoReaction;$('tutorialDockText').textContent='⚠️ Đơn chưa đúng. Mình thử lại món khách gọi nhé.';save()}
        toast(correct?`Đúng món và tuỳ chọn! KPI ${reviewPercent}% · +₫${format(earned)} · danh tiếng +${repDelta}${liked?' · khách hài lòng':''}.`:`Sai món hoặc tuỳ chọn! KPI ${reviewPercent}% · mất ${Math.abs(repDelta)} danh tiếng và 1 sao.`);return;
      }
      if(sessionStarted)setNeoMessage(correct?'🎉':'⚠️',resultMessage);render();save();toast(correct?`Đúng món và tuỳ chọn! KPI ${reviewPercent}% · +₫${format(earned)} · danh tiếng +${repDelta}${liked?' · khách hài lòng':''}.`:`Sai món hoặc tuỳ chọn! KPI ${reviewPercent}% · mất ${Math.abs(repDelta)} danh tiếng và 1 sao.`);
    },duration)
  }
  function craftResearch(){
    if(state.money<18)return;const selected=[$('ingredientA').value,$('ingredientB').value,$('ingredientC').value],counts=Object.fromEntries(ingredients.map(item=>[item.id,selected.filter(id=>id===item.id).length]));
    if(Object.entries(counts).some(([id,count])=>(state.inventory[id]||0)<count)){toast('Không đủ nguyên liệu cho công thức này.');return}
    state.money-=18;state.researchTrials++;consumeIngredients(counts);const success=Math.random()<researchChance(),key=[...selected].sort().join('_');
    if(!success){state.researchFailures++;state.cyberWaste++;$('researchResult').textContent='☣ Thất bại! Mẻ pha biến thành Rác thải Cyber.';addLog('Thử nghiệm lỗi, thu được Rác thải Cyber.','Phòng lab')}
    else{const existing=state.unlockedRecipes.find(recipe=>recipe.comboKey===key),legendary=Math.random()<.08;if(existing){const salvage=(legendary?50:20)*moneyMultiplier();state.money+=salvage;$('researchResult').textContent=`✦ Công thức trùng lặp, tái chế thành ₫${format(salvage)}.`;addLog(`Tái chế mẻ pha trùng · +₫${format(salvage)}.`,'Phòng lab')}
      else{const parts=selected.map(id=>ingredients.find(item=>item.id===id)),tags=[...new Set(parts.map(item=>item.tag))],basePrice=30+parts.reduce((sum,item)=>sum+item.cost,0),recipe={id:`lab_${key}`,comboKey:key,name:legendary?'Aurora Huyền Thoại':`${parts[0].name.split(' ')[0]} ${parts[1].name.split(' ')[0]} ${parts[2].name.split(' ')[0]}`,icon:legendary?'✨':'🧪',short:'Lab',details:parts.map(item=>item.name).join(' · '),recipe:parts.map(item=>item.name).join(' · '),price:basePrice,tags:legendary?[...tags,'premium']:tags,legendary};state.unlockedRecipes.push(recipe);state.factionRep.hackers++;$('researchResult').textContent=legendary?`✧ Thành công xuất sắc! ${recipe.name} bán với giá trị x5.`:`✦ Khám phá thành công: ${recipe.name}. Công thức mới đã mở khóa.`;addLog(`Mở khóa ${recipe.name}${legendary?' · HUYỀN THOẠI ×5':''}.`,'Phòng lab')}}
    if(success&&state.unlockedRecipes.some(recipe=>recipe.comboKey===key))state.researchSuccesses++;
    document.body.classList.add('glitch');setTimeout(()=>document.body.classList.remove('glitch'),220);checkBadges();render();save()
  }
  function buyIngredient(id){const item=ingredients.find(entry=>entry.id===id);if(!item)return;const cost=ingredientPrice(item);if(state.money<cost)return;state.money-=cost;state.inventoryLots[id].push({quantity:1,purchasedShift:state.shift});state.inventory[id]=(state.inventory[id]||0)+1;render();save();toast(`${item.name} đã nhập kho${state.dealIngredient===id?' · giảm 20%':''}.`);if(!tutorialActive&&sessionStarted)setNeoMessage('😄','Kho đã có thêm nguyên liệu. Quầy sẵn sàng rồi!');if(tutorialActive && state.tutorialStep===0 && (state.inventory[id]||0)>0){window.setTimeout(()=>{if(!tutorialActive || state.tutorialStep!==0)return;state.tutorialStep=1;tutorialLine=0;setTutorialOrder();render();syncTutorialLock();renderTutorial();save();toast('Đã mua nguyên liệu. Bây giờ bạn có thể pha đơn đầu tiên.');},200)}}
  function recycleWaste(){if(state.cyberWaste<1)return;const recovered=state.cyberWaste*5*moneyMultiplier();state.cyberWaste=0;state.money+=recovered;render();save();toast(`Tái chế rác thải Cyber · +₫${format(recovered)}.`)}
  function buyDecor(id){const item=decorItems.find(entry=>entry.id===id);if(!item||state.decorations[id]||state.money<item.cost)return;state.money-=item.cost;state.decorations[id]=true;addLog(`Đã lắp ${item.name}.`,'Trang trí');render();save();toast(`${item.name} đã lắp đặt.`)}
  function buyFirewall(){const cost=firewallCost();if(state.money<cost)return;state.money-=cost;state.firewall++;addLog(`Nâng Firewall lên cấp ${state.firewall}.`,'An ninh');render();save();toast('Firewall đã bật. Kỹ năng hack ngược được mở khóa.')}
  function buyDeliveryDrone(){const cost=deliveryDroneCost();if(state.money<cost)return;state.money-=cost;state.deliveryDrone++;addLog('Mua thêm drone Cyber-Delivery.','Giao hàng');render();save();toast('Đội bay giao hàng đã mở rộng.')}
  function toggleDelivery(){if(!state.deliveryDrone)return;state.deliveryActive=!state.deliveryActive;render();save();toast(state.deliveryActive?'Đội drone sẵn sàng giao hàng trong Bão Axit.':'Đã cho đội drone nghỉ.')}
  function buyTrack(id){const track=tracks.find(entry=>entry.id===id);if(!track)return;if(!state.tracks.includes(id)){if(state.money<track.cost)return;state.money-=track.cost;state.tracks.push(id);addLog(`Mua đĩa ${track.name}.`,'Jukebox')}state.trackId=id;render();save();toast(`${track.name} đã được chọn trong Jukebox.`)}
  function claimDaily(){if(state.daily.rewarded)return;const progress=dailyProgress();if(progress.espresso<200||progress.hackers<3||progress.seconds<900)return;state.daily.rewarded=true;state.chips++;addLog('Hoàn tất nhiệm vụ ngày · nhận 1 Quantum Chip.','Nhiệm vụ');render();save();toast('Nhận 1 Quantum Chip!')}
  function doPrestige(){if(state.served<200||state.chips<1||!window.confirm('Chuyển sinh sẽ đặt lại cửa hàng, công thức và tiến độ nhiệm vụ; giữ Quantum Chips, huy hiệu và nhiệm vụ đã nhận hôm nay. Tiếp tục?'))return;const firstRebirth=!state.badges.rebirth,chips=state.chips-1+(firstRebirth?1:0),prestiges=state.prestiges+1,badges={...state.badges,rebirth:true},daily={...state.daily};state=withShiftDefaults(initialState());state.chips=chips;state.prestiges=prestiges;state.badges=badges;state.daily=daily;addLog('Chuyển sinh · tiêu thụ 1 QC, hệ số doanh thu tăng 5%.','Chuyển sinh');render();save();toast('Tái khởi động thành công. Hệ số doanh thu tăng vĩnh viễn.')}
  function startThreat(){if(activeThreat)return;const kind=eventRules.securityKind(()=>Math.random());if(kind==='ransomware'){state.ransomwareIncidents++;showIncident(kind,storyEvents.ransomware.title,storyEvents.ransomware.copy,'Chọn cách xử lý trong 25 giây.',25000,['payThreat','reinstallThreat','hackThreat']);$('payThreat').textContent=`TRẢ CHUỘC · −10% (₫${format(eventRules.ransom(state.money))})`;$('reinstallThreat').textContent='CÀI LẠI FIRMWARE · 2 PHÚT';$('hackThreat').textContent=state.firewall?'HACK NGƯỢC · LẤY ₫'+format(eventRules.ransom(state.money)*2):'HACK NGƯỢC · CẦN FIREWALL';$('hackThreat').disabled=state.firewall<1;return}if(kind==='union'){showIncident(kind,storyEvents.union.title,storyEvents.union.copy,'Đồng ý tốn thêm 5% bảo trì mỗi giờ, robot nhanh hơn 15%. Format có rủi ro.',25000,['acceptUnion','formatRobots']);return}const {left,right,answer}=eventRules.challenge(()=>Math.random(),kind),defense=kind==='hacker'?state.drone:state.bouncer,yakuza=kind==='gang'&&state.yakuzaProtectionUntil>Date.now();if(yakuza||(defense&&Math.random()<Math.min(.92,.5+defense*.15))){state.securityEvictions++;if(kind==='hacker')state.daily.hackers++;state.factionRep[kind==='hacker'?'hackers':'samurai']+=1;$('securityStatus').textContent=yakuza?'Yakuza chặn băng đảng đối thủ theo thỏa thuận bảo kê.':`${kind==='hacker'?'Drone':'Bouncer'} tự động đẩy lùi khách không mời.`;addLog('Đội an ninh tự động đẩy lùi khách không mời.','An ninh');render();save();return}const pay=Math.ceil(55+Math.random()*45);activeThreat={kind,answer,expires:Date.now()+15000,pay};showIncident(kind,kind==='hacker'?'Hacker đòi tiền chuộc':'Băng đảng đòi bảo kê',kind==='hacker'?'Một hacker khóa hệ thống bán hàng. Giải mã nhanh hoặc mất tiền.':'Băng đảng chặn cửa. Giải câu đố bảo mật để đuổi chúng đi.','',15000,['payThreat','solveThreat'],`Xác minh: ${left} ${kind==='hacker'?'×':'+'} ${right} = ?`);$('payThreat').textContent=`TRẢ ₫${format(pay)}`}
  function resolveThreat(success,paid=false){
    if(!activeThreat)return;const kind=activeThreat.kind,now=Date.now();
    if(kind==='ransomware'){const ransom=eventRules.ransom(state.money);if(paid){state.money=Math.max(0,state.money-ransom);state.stalledUntil=0;$('securityStatus').textContent='Đã trả 10% tiền chuộc. Robot hoạt động lại ngay.'}else{state.stalledUntil=now+120000;$('securityStatus').textContent='Đang cài lại firmware. Robot sẽ trở lại sau 2 phút.'}addLog(paid?'Trả 10% quỹ chuộc robot.':'Cài lại firmware, robot tạm dừng 2 phút.','Ransomware')}
    else if(kind==='union'){if(paid){state.robotUnion=true;state.maintenanceDueAt=now+3600000;$('securityStatus').textContent='Chấp nhận yêu cầu Liên đoàn. Robot nhanh hơn 15% vĩnh viễn.';addLog('Chấp nhận thỏa thuận dầu nhớt và sạc pin.','Liên đoàn Robot')}else if(eventRules.formatSucceeds(()=>Math.random())){$('securityStatus').textContent='Đe dọa format thành công. Robot quay lại làm việc.';addLog('Robot chấp nhận quay lại làm việc.','Liên đoàn Robot')}else{state.bots=Math.max(0,state.bots-1);$('securityStatus').textContent='Format thất bại. Một robot đã nổ tung.';addLog('Mất một robot sau khi đe dọa format.','Liên đoàn Robot')}}
    else if(paid){state.money=Math.max(0,state.money-activeThreat.pay);$('securityStatus').textContent='Đã trả tiền để kết thúc vụ việc.'}
    else if(success){const reward=35*moneyMultiplier();state.money+=reward;state.reputation+=1;state.securityEvictions++;state.factionRep[kind==='hacker'?'hackers':'samurai']+=2;if(kind==='hacker')state.daily.hackers++;$('securityStatus').textContent=`Xác minh thành công. +₫${format(reward)}.`}
    else{const fine=activeThreat.pay;state.money=Math.max(0,state.money-fine);if(kind==='hacker'&&!state.decorations.airFilter&&state.bots>0)state.stalledUntil=now+30000;$('securityStatus').textContent=`Quá thời gian. Mất ₫${format(fine)}${state.stalledUntil?' · robot tạm ngưng 30 giây':''}.`}
    finishIncident($('securityStatus').textContent,'An ninh')
  }
  function hackRansomware(){if(!activeThreat||activeThreat.kind!=='ransomware'||state.firewall<1)return;const reward=eventRules.ransom(state.money)*2*moneyMultiplier();if(eventRules.hackSucceeds(()=>Math.random(),state.firewall)){state.money+=reward;state.stalledUntil=0;finishIncident(`Firewall diệt virus và hack ngược · +₫${format(reward)}.`,'Firewall')}else{state.stalledUntil=Date.now()+120000;finishIncident('Hack ngược thất bại. Robot đang cài lại firmware 2 phút.','Firewall')}}
  function resolveUnion(accept){if(!activeThreat||activeThreat.kind!=='union')return;resolveThreat(false,accept)}
  function parseThreatAnswer(raw){
    const value = String(raw ?? '').trim();
    if (!value) return NaN;
    const normalized = value.toLowerCase().replace(/×/g, 'x').replace(/\s+/g, '');
    if (/^\d+$/.test(normalized)) return Number(normalized);
    const match = normalized.match(/^(\d+)x(\d+)$/);
    if (!match) return NaN;
    return Number(match[1]) * Number(match[2]);
  }
  function orderReviewPercent(correct, liked, vip){
    let score = correct ? 78 : 8;
    if(correct && liked) score += 12;
    if(correct && vip) score += 10;
    if(correct && Date.now() < state.orderExpires) score += 6;
    if(!correct) score = Math.max(0, score - 35);
    return Math.max(0, Math.min(100, score));
  }
  function orderReputationDelta(correct, liked, vip){
    const percent = orderReviewPercent(correct, liked, vip);
    if(correct) return 2;
    return -2;
  }
  function expireOrderPenalty(){
    state.badOrders++;
    state.reputation = Math.max(0, state.reputation - 1);
    state.reviewScore = Math.max(0, state.reviewScore - 20);
    updateStarRating();
    if(sessionStarted&&!tutorialActive)setNeoMessage('⚠️','Đơn vừa hết giờ. Mình cùng chú ý khách tiếp theo nhé.');
    toast('Khách hết giờ — khách bực, danh tiếng giảm 1!');
    addLog('Khách hết giờ và rời quán. Danh tiếng giảm 1.','Hết giờ');
  }
  function autoCompleteOrderByBot(){
    const recipe = recipeById(state.orderId);
    if(!recipe)return false;
    const base = recipe.price * (recipe.legendary ? 5 : 1) * (0.85 + state.bots * 0.12);
    const earned = Math.max(12, Math.round(base * moneyMultiplier()));
    state.money += earned;
    state.served++;
    state.shiftServed++;
    state.shiftRevenue+=earned;
    state.reputation = Math.max(0, state.reputation + 1);
    state.reviewScore = Math.min(100, Math.max(0, state.reviewScore + 10));
    updateStarRating();
    addLog(`Robot hoàn tất đơn ${recipe.name} · +₫${format(earned)} · không trừ sao.`,'Robot');
    toast(`Robot hoàn tất đơn! +₫${format(earned)} · không mất sao.`);
    return true;
  }
  function beginInteractiveBrew(recipeId){
    if(activeBrew||interactiveBrew||state.shiftClosed)return;if(Date.now()<state.orderStarted){toast('Khách đang xem menu.');return}
    if(Date.now() >= state.orderExpires){
      expireOrderPenalty();
      recordShiftOrder();
      if(!state.shiftClosed)newOrder(false,true);
      render();
      save();
      toast('Khách đã rời quán vì hết giờ — danh tiếng giảm 1 sao.');
      return;
    }
    const recipe=recipeById(recipeId);if(!recipe)return;
    const prep={size:$('cupSize').value,sugar:Number($('sugarLevel').value),ice:Number($('iceLevel').value),topping:$('toppingChoice').value};
    if(!orderSpecMatchesPrep(prep)){const spec=state.orderSpec||{};toast(`Sai tùy chọn đơn: cần SIZE ${spec.size || 'M'} · ĐƯỜNG ${Number(spec.sugar ?? 50)}% · ĐÁ ${Number(spec.ice ?? 50)}% · ${spec.topping==='boba'?'THÊM TOPPING':'KHÔNG TOPPING'}.`);return}
    const baseIngredients=recipeIngredientIds(recipe.id),usedIngredients=[...baseIngredients.flatMap(id=>Array(prep.size==='L'?2:1).fill(id)),...(prep.topping==='boba'?['boba']:[])],ingredientCounts=usedIngredients.reduce((counts,id)=>{counts[id]=(counts[id]||0)+1;return counts},{});
    const missingIngredient=Object.keys(ingredientCounts).find(id=>(state.inventory[id]||0)<ingredientCounts[id]);
    if(missingIngredient){const item=ingredients.find(entry=>entry.id===missingIngredient);toast(`Thiếu nguyên liệu ${item?item.name:missingIngredient}.`);return}
    interactiveBrew={recipeId: recipe.id, prep, stage:0, ingredientCounts};
    updateBrewSequenceUI();
  }

  function brew(recipeId){
    beginInteractiveBrew(recipeId);
  }
  document.querySelectorAll('.game-tab').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.game-tab').forEach(tab=>{tab.classList.toggle('active',tab===button);tab.setAttribute('aria-selected',String(tab===button))});document.querySelectorAll('.view-page').forEach(view=>view.classList.toggle('active',view.id===`view-${button.dataset.view}`));if(guidedOutside)updateTutorialTarget();document.body.classList.add('glitch');setTimeout(()=>document.body.classList.remove('glitch'),180)}));$('settingsShortcut').addEventListener('click',()=>{document.querySelector('.game-tab[data-view="settings"]').click();$('view-settings').scrollIntoView({block:'start',behavior:'smooth'})});$('settingsReturn').addEventListener('click',()=>{document.querySelector('.game-tab[data-view="shop"]').click();$('view-shop').scrollIntoView({block:'start',behavior:'smooth'})});
  $('researchButton').addEventListener('click',craftResearch);['ingredientA','ingredientB','ingredientC'].forEach(id=>$(id).addEventListener('change',renderFeatureViews));$('ingredientStock').addEventListener('click',event=>{const buy=event.target.closest('[data-buy-ingredient]'),recycle=event.target.closest('[data-recycle-waste]');if(buy)buyIngredient(buy.dataset.buyIngredient);if(recycle)recycleWaste()});$('decorGrid').addEventListener('click',event=>{const button=event.target.closest('[data-buy-decor]');if(button)buyDecor(button.dataset.buyDecor)});$('trackList').addEventListener('click',event=>{const button=event.target.closest('[data-track]');if(button)buyTrack(button.dataset.track)});$('questList').addEventListener('click',event=>{if(event.target.closest('[data-action="claim-quest"]'))claimDaily()});
  $('pourWaterBtn').addEventListener('click',()=>{if(!interactiveBrew)return;interactiveBrew.stage=Math.max(1,interactiveBrew.stage || 1);toast('Đã gọt nước xong.');updateBrewSequenceUI();});
  $('addToppingBtn').addEventListener('click',()=>{if(!interactiveBrew)return;if(interactiveBrew.prep.topping!=='boba'){toast('Món này không cần topping.');return;}interactiveBrew.stage=2;toast('Đã thêm topping vào ly.');updateBrewSequenceUI();});
  $('finishBrewBtn').addEventListener('click',()=>{if(!interactiveBrew)return;const target = interactiveBrew.prep.topping === 'boba' ? 2 : 1;if(interactiveBrew.stage < target){toast('Bạn cần hoàn tất bước trước đó trước khi giao ly.');return;}completeInteractiveBrew();});
  $('buyDrone').addEventListener('click',()=>{const cost=Math.ceil(220*Math.pow(1.7,state.drone));if(state.money<cost)return;state.money-=cost;state.drone++;addLog('Nâng cấp drone an ninh.','An ninh');render();save();toast('Drone an ninh đã nâng cấp.')});$('buyBouncer').addEventListener('click',()=>{const cost=Math.ceil(280*Math.pow(1.7,state.bouncer));if(state.money<cost)return;state.money-=cost;state.bouncer++;addLog('Thuê thêm robot bouncer.','An ninh');render();save();toast('Robot Bouncer đã vào ca.')});$('buyFirewall').addEventListener('click',buyFirewall);$('buyDeliveryDrone').addEventListener('click',buyDeliveryDrone);$('toggleDelivery').addEventListener('click',toggleDelivery);
  $('payThreat').addEventListener('click',()=>resolveThreat(false,true));$('reinstallThreat').addEventListener('click',()=>resolveThreat(false));$('hackThreat').addEventListener('click',hackRansomware);$('acceptUnion').addEventListener('click',()=>resolveUnion(true));$('formatRobots').addEventListener('click',()=>resolveUnion(false));$('acceptStory').addEventListener('click',()=>resolveStoryEvent(true));$('declineStory').addEventListener('click',()=>resolveStoryEvent(false));$('solveThreat').addEventListener('click',()=>{if(!activeThreat||activeStoryEvent)return;const typed=parseThreatAnswer($('threatAnswer').value);if(typed===activeThreat.answer)resolveThreat(true);else{$('threatAnswer').value='';$('threatAnswer').placeholder='Sai mã · thử lại nhanh';$('threatAnswer').focus()}});$('threatAnswer').addEventListener('keydown',event=>{if(event.key==='Enter')$('solveThreat').click()});
  $('crtToggle').addEventListener('click',()=>{state.crt=!state.crt;renderFeatureViews();save()});$('prestigeButton').addEventListener('click',doPrestige);
  $('themeSelect').addEventListener('change',()=>{uiSettings.theme=$('themeSelect').value;saveUiSettings();applyUiSettings()});$('languageSelect').addEventListener('change',()=>{uiSettings.language=$('languageSelect').value;saveUiSettings();render();applyUiSettings()});$('introLanguageSelect').addEventListener('change',()=>{uiSettings.language=$('introLanguageSelect').value;saveUiSettings();render();applyUiSettings()});
  $('exportSave').addEventListener('click',()=>{const bytes=new TextEncoder().encode(JSON.stringify({game:'neon-brew',version:1,state}));const binary=Array.from(bytes,byte=>String.fromCharCode(byte)).join('');$('saveText').value=btoa(binary);$('saveMessage').textContent='Đã tạo mã lưu. Hãy sao chép để chuyển sang thiết bị khác.'});$('copySave').addEventListener('click',async()=>{if(!$('saveText').value){$('exportSave').click()}try{await navigator.clipboard.writeText($('saveText').value);$('saveMessage').textContent='Đã sao chép mã lưu vào clipboard.'}catch{$('saveText').focus();$('saveText').select();document.execCommand('copy');$('saveMessage').textContent='Đã chọn mã lưu để sao chép.'}});
  $('importSave').addEventListener('click',()=>{try{const raw=$('saveText').value.trim(),bytes=Uint8Array.from(atob(raw),char=>char.charCodeAt(0)),bundle=JSON.parse(new TextDecoder().decode(bytes));if(bundle.game!=='neon-brew'||bundle.version!==1||!bundle.state||typeof bundle.state!=='object'||!Number.isFinite(bundle.state.money)||!Number.isFinite(bundle.state.served)||!Array.isArray(bundle.state.unlockedRecipes))throw new Error('Mã lưu không hợp lệ.');for(const recipe of bundle.state.unlockedRecipes){if(!recipe||typeof recipe.id!=='string'||typeof recipe.name!=='string'||typeof recipe.price!=='number')throw new Error('Công thức trong mã lưu không hợp lệ.');recipe.name=recipe.name.slice(0,48);recipe.short=String(recipe.short||'Lab').slice(0,20);recipe.details=String(recipe.details||'').slice(0,100);recipe.recipe=String(recipe.recipe||recipe.details).slice(0,120);recipe.icon=String(recipe.icon||'🧪').slice(0,4);recipe.tags=Array.isArray(recipe.tags)?recipe.tags.filter(tag=>['caffeine','bold','energy','legend','premium','hot'].includes(tag)):[]}localStorage.setItem(STORE_KEY,JSON.stringify(bundle.state));$('saveMessage').textContent='Đã nhập save. Đang mở lại tiệm...';setTimeout(()=>location.reload(),250)}catch(error){$('saveMessage').textContent=error.message||'Không thể đọc mã lưu.'}});
  $('importSave').addEventListener('click',()=>{if($('saveMessage').textContent.startsWith('Đã nhập save'))isResetting=true});
  function ensureDaily(){if(state.daily.date===dayKey())return false;state.daily={date:dayKey(),espresso:0,hackers:0,seconds:0,rewarded:false};return true}
  function tick(){
    if(!sessionStarted||tutorialActive||state.shiftClosed)return;
    const current=Date.now(),visible=document.visibilityState==='visible',delta=Math.min(1.5,Math.max(0,(current-(Number(state.lastSeen)||current))/1000));if(ensureDaily())renderFeatureViews();
    if(visible)state.daily.seconds+=delta;state.lastSeen=current;
    if(state.gameOver)return;
    if(state.starRating<2){state.inspectionProgress+=delta*1000;if(!state.inspectionActive){state.inspectionActive=true;toast('Kiểm tra thực phẩm bắt đầu: uy tín dưới 2 sao!');addLog('Uy tín dưới 2 sao. Bắt đầu kiểm tra thực phẩm.','Kiểm tra');}if(state.inspectionProgress>=30000)triggerGameOver('Uy tín dưới 2 sao quá lâu. Kiểm tra thực phẩm vào cuộc và quán bị đóng cửa.');}
    else{state.inspectionProgress=0;state.inspectionActive=false}
    if(current>=state.orderExpires&&!activeBrew&&!state.shiftClosed){
      if(timerNotice!==state.orderNumber){
        timerNotice=state.orderNumber;
        expireOrderPenalty();
        addLog('Khách hết kiên nhẫn và rời quầy.','Hết giờ');
      }
      recordShiftOrder();if(!state.shiftClosed){newOrder(false,true);render()}
    }
    const duration=Math.max(1,state.orderExpires-state.orderStarted),left=Math.min(100,Math.max(0,(state.orderExpires-current)/duration*100));$('orderTimer').style.width=left+'%';$('orderTimer').style.background=left<25?'var(--pink)':'var(--amber)';
    renderLive();
    if(current%5000<1000)save();
  }
  $('endShiftButton').addEventListener('click',closeShift);$('nextShiftButton').addEventListener('click',openNextShift);
  $('resetButton').addEventListener('click',()=>$('resetDialog').classList.add('show'));$('cancelReset').addEventListener('click',()=>$('resetDialog').classList.remove('show'));$('confirmReset').addEventListener('click',()=>{localStorage.removeItem(STORE_KEY);location.reload()});$('gameOverReset').addEventListener('click',()=>{localStorage.removeItem(STORE_KEY);location.reload()});$('resetDialog').addEventListener('click',event=>{if(event.target===$('resetDialog'))$('resetDialog').classList.remove('show')});document.addEventListener('keydown',event=>{if(event.key==='Escape')$('resetDialog').classList.remove('show')});
  function playAudioStep(){if(!audioContext)return;const notes=(tracks.find(item=>item.id===state.trackId)||tracks[0]).notes,time=audioContext.currentTime;const osc=audioContext.createOscillator(),gain=audioContext.createGain(),filter=audioContext.createBiquadFilter();osc.type='sine';osc.frequency.value=notes[audioStep%notes.length];filter.type='lowpass';filter.frequency.value=900;gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.022,time+.08);gain.gain.exponentialRampToValueAtTime(.0001,time+.72);osc.connect(filter);filter.connect(gain);gain.connect(audioContext.destination);osc.start(time);osc.stop(time+.75);if(audioStep%4===0){const bass=audioContext.createOscillator(),bassGain=audioContext.createGain();bass.type='sine';bass.frequency.value=notes[audioStep%notes.length]/2;bassGain.gain.setValueAtTime(.0001,time);bassGain.gain.exponentialRampToValueAtTime(.018,time+.08);bassGain.gain.exponentialRampToValueAtTime(.0001,time+.62);bass.connect(bassGain);bassGain.connect(audioContext.destination);bass.start(time);bass.stop(time+.65)}audioStep++}
  function toggleAudio(){if(state.audio){state.audio=false;clearInterval(audioLoop);if(audioContext){audioContext.close();audioContext=null}render();save();return}const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){toast('Trình duyệt này chưa hỗ trợ phát nhạc.');return}audioContext=new Audio();audioContext.resume();audioStep=0;state.audio=true;playAudioStep();audioLoop=setInterval(playAudioStep,850);render();save();vibrate([15])}
  $('soundToggle').addEventListener('click',toggleAudio);$('fullscreenToggle').addEventListener('click',toggleFullscreen);window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save()});window.addEventListener('online',updateConnectionStatus);window.addEventListener('offline',updateConnectionStatus);window.addEventListener('beforeunload',event=>{if(sessionStarted && !state.gameOver && !isResetting){event.preventDefault();event.returnValue='';}});if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
  function drawScene(){const canvas=$('cafeScene'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,t=Date.now()/1000;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,w,h);const rect=(x,y,rw,rh,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,rw,rh)};const poly=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fill()};
    const orderDuration=Math.max(15000,state.orderExpires-state.orderStarted||15000),moveRatio=Math.min(1,Math.max(0,(Date.now()-state.orderStarted)/orderDuration));const playerX=activeBrew?740:155+moveRatio*470;const playerBob=Math.sin(t*8)*2;const playerY=343+playerBob;
    const hallucinating=state.hallucinationUntil>Date.now();
    const horrorIntensity=hallucinating?Math.min(1,.4+(state.paranoia||0)*.003+Math.max(0,state.served-5)*.035):0;
    document.documentElement.classList.toggle('horror-overload',hallucinating);
    document.body.style.setProperty('--horror-level',horrorIntensity.toFixed(2));
    document.body.style.setProperty('--horror-saturation',(1+horrorIntensity*1.5).toFixed(2));
    document.body.style.setProperty('--horror-contrast',(1+horrorIntensity*.2).toFixed(2));
    document.body.style.setProperty('--horror-jolt',(horrorIntensity*3).toFixed(1)+'px');
    document.body.style.setProperty('--horror-jolt-negative',(-horrorIntensity*3).toFixed(1)+'px');
    document.body.style.setProperty('--horror-overlay-opacity',(.25+horrorIntensity*.45).toFixed(2));
    document.body.style.setProperty('--horror-overlay-flash',(.4+horrorIntensity*.5).toFixed(2));

    rect(0,0,w,h,'#040d1b');
    rect(0,0,w,220,'#071d36');
    rect(0,220,w,170,'#0b1f36');
    rect(0,280,w,140,'#0d1d2f');

    const moonX=714, moonY=102, moonR=48;
    ctx.fillStyle='rgba(255,245,205,0.98)';ctx.beginPath();ctx.arc(moonX,moonY,moonR,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,247,222,0.15)';ctx.beginPath();ctx.arc(moonX-12,moonY-10,60,0,Math.PI*2);ctx.fill();

    for(let i=0;i<80;i++){const x=(i*29+17)%w, y=(i*19+13)%150; if(i%2===0) rect(x,y,3,3,'rgba(255,255,255,0.9)');}
    for(let i=0;i<16;i++){const cloudX=(i*58+Math.sin(t*0.45+i)*16)%(w+60);const cloudY=18+(i*10)%70;rect(cloudX,cloudY,30,8,'rgba(112,146,208,0.28)');rect(cloudX+8,cloudY-7,18,8,'rgba(112,146,208,0.34)');rect(cloudX+20,cloudY-3,16,7,'rgba(112,146,208,0.22)');}

    for(let i=0;i<22;i++){const bx=20+i*33;const bh=52+((i*17)%130);rect(bx,176-bh,26,bh,'#091a2a');
      for(let yy=0;yy<bh;yy+=8){const wx=bx+3+(yy%2)*7; const ww=(yy/8)%2===0?4:5; rect(wx,180-bh+yy,ww,4,(i%4===0?'#ffbf54':i%4===1?'#7de6ff':i%4===2?'#ff66d8':'#7ee9d5'));}}
    for(let i=0;i<9;i++){const bx=90+i*104;const h=38+(i*9)%64;rect(bx,170-h,36,h,'#0b1a2f'); rect(bx+8,170-h+8,7,7,'#ffd27d'); rect(bx+21,170-h+8,7,7,'#78deff'); rect(bx+11,170-h+22,14,8,'#f16be1');}

    rect(0,212,w,26,'#0c1a2d');
    rect(0,238,w,120,'#031b31');
    rect(0,238,w,16,'#145bb7');
    rect(0,254,w,8,'#081a2b');

    const riverY=260;
    rect(0,riverY,w,94,'#0a2a69');
    rect(0,riverY+20,w,5,'rgba(153,207,255,0.62)');
    for(let i=0;i<42;i++){const x=i*24;rect(x,riverY+42,15,6,'rgba(255,218,129,0.30)');}
    for(let i=0;i<15;i++){const x=38+i*55;rect(x,riverY+60,10,10,'#ff9c7f');}

    rect(270,198,360,26,'#101924');
    rect(286,170,330,36,'#081a2b');
    for(let i=0;i<18;i++){const x=302+i*18;rect(x,180,7,16,'#f7d58d');rect(x+2,196,3,8,'#f0c566');}
    rect(255,192,390,14,'#f7d58d');
    rect(250,206,400,12,'#f2d087');
    rect(300,188,14,42,'#d36a4d');rect(586,188,14,42,'#d36a4d');
    for(let i=0;i<11;i++){const x=332+i*24;rect(x,188,10,8,'rgba(255,255,255,0.7)');}

    rect(0,312,w,18,'#101c2b');
    rect(0,330,w,90,'#1b1b1c');

    const menuX=28, menuY=210, menuW=138, menuH=138;
    rect(menuX,menuY,menuW,menuH,'#1a160d');rect(menuX+6,menuY+6,menuW-12,menuH-12,'#3d261b');
    rect(menuX+10,menuY+8,menuW-20,8,'#d7b26e');rect(menuX+10,menuY+16,menuW-20,2,'#ffe9b7');
    ctx.fillStyle='#ffe8b8';ctx.font='bold 18px monospace';ctx.fillText('MENU',menuX+28,menuY+30);
    ctx.fillStyle='#ffd577';ctx.font='bold 11px monospace';
    ctx.fillText('Latte 22k',menuX+18,menuY+58);ctx.fillText('Matcha 25k',menuX+18,menuY+74);ctx.fillText('Mocha 28k',menuX+18,menuY+90);ctx.fillText('Ramen 42k',menuX+18,menuY+106);ctx.fillText('Overclock 46k',menuX+18,menuY+122);ctx.fillText('Bionic 70k',menuX+18,menuY+138);
    ctx.fillStyle='#ffe5a8';ctx.fillRect(menuX+10,menuY+128,menuW-20,2);

    for(let i=0;i<5;i++){const sx=155+i*175;rect(sx,358,58,46,'#4a2d1a');rect(sx+8,349,42,16,'#7a4b2d');rect(sx+12,370,6,20,'#f7d76d');rect(sx+25,370,6,20,'#f7d76d');rect(sx+38,370,6,20,'#f7d76d');}
    for(let i=0;i<11;i++){const x=190+i*52;rect(x,290,38,40,'#3d2d1c');rect(x+8,278,20,16,'#f7d27c');rect(x+7,256,22,18,'#d19a63');rect(x+11,250,14,7,'#f6ce7a');}

    rect(0,370,w,60,'#181d1e');
    rect(0,440,w,14,'#d4ab62');

    const floorGradient=ctx.createLinearGradient(0,326,0,h);floorGradient.addColorStop(0,'#27343d');floorGradient.addColorStop(.45,'#302d38');floorGradient.addColorStop(1,'#12191f');
    poly([[0,326],[w,326],[w,h],[0,h]],floorGradient);
    const vanishingX=w*.5,vanishingY=326;
    ctx.lineWidth=1;
    for(let i=1;i<8;i++){const depth=i/8,y=vanishingY+(h-vanishingY)*depth*depth;ctx.strokeStyle=`rgba(118,195,214,${.04+depth*.13})`;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    for(let i=0;i<=8;i++){const floorX=i*w/8;ctx.strokeStyle='rgba(123,207,224,0.12)';ctx.beginPath();ctx.moveTo(vanishingX,vanishingY);ctx.lineTo(floorX,h);ctx.stroke()}
    const floorGlow=ctx.createRadialGradient(vanishingX,vanishingY,4,vanishingX,vanishingY,360);floorGlow.addColorStop(0,'rgba(78,209,221,0.2)');floorGlow.addColorStop(1,'rgba(78,209,221,0)');ctx.fillStyle=floorGlow;ctx.fillRect(0,vanishingY,w,h-vanishingY);

    ctx.save();ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=18;ctx.shadowOffsetY=8;poly([[266,280],[620,280],[680,300],[302,300]],'#472c31');ctx.restore();
    poly([[302,296],[650,296],[650,333],[302,333]],'#75463e');
    poly([[650,296],[680,280],[680,317],[650,333]],'#382530');
    poly([[266,280],[620,280],[680,300],[302,300]],'#e1a76e');
    poly([[281,282],[614,282],[653,295],[302,295]],'#56434b');
    poly([[302,296],[650,296],[650,302],[302,302]],'#ffd18a');
    rect(328,310,142,14,'#4c3035');rect(328,310,142,3,'#c47962');
    rect(507,310,102,14,'#4c3035');rect(507,310,102,3,'#c47962');
    poly([[650,296],[680,280],[680,286],[650,302]],'#f3bd7b');

    const playerXRound=Math.round(playerX), playerYRound=Math.round(playerY);
    rect(playerXRound,playerYRound,22,16,'#0f1218');rect(playerXRound+4,playerYRound-12,14,12,'#232d39');rect(playerXRound+6,playerYRound-15,8,5,'#e8d8c4');rect(playerXRound+4,playerYRound-13,3,3,'#1a1d22');rect(playerXRound+15,playerYRound-13,3,3,'#1a1d22');rect(playerXRound+5,playerYRound+16,5,12,'#1a1d22');rect(playerXRound+14,playerYRound+16,5,12,'#1a1d22');rect(playerXRound+3,playerYRound+2,3,10,'#1a1d22');rect(playerXRound+16,playerYRound+2,3,10,'#1a1d22');rect(playerXRound+6,playerYRound+18,3,8,'#1a1d22');rect(playerXRound+13,playerYRound+18,3,8,'#1a1d22');rect(playerXRound+20,playerYRound+2,22,6,'#d7ae73');rect(playerXRound+22,playerYRound+8,18,4,'#f0c27e');if(activeBrew){rect(playerXRound+30,playerYRound-8,8,8,'#f7b85a');rect(playerXRound+33,playerYRound-15,3,8,'#8de6d8');}

    ctx.fillStyle='rgba(0,0,0,0.18)';ctx.fillRect(0,350,w,10);ctx.fillStyle='rgba(255,255,255,0.05)';ctx.fillRect(0,0,w,h);
    if(state.weatherId==='acid'){ctx.strokeStyle='rgba(144,231,187,.35)';ctx.lineWidth=2;for(let i=0;i<26;i++){const x=(i*37+t*90)%w,y=(i*61+t*175)%h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-5,y+12);ctx.stroke();}}else if(state.weatherId==='fog'){rect(0,120,w,170,'rgba(200,220,215,.12)');rect(0,280,w,85,'rgba(200,220,215,.08)');}else{ctx.fillStyle=`rgba(142,176,255,${0.10+Math.sin(t*1.8)*0.04})`;ctx.fillRect(0,0,w,h);}
    if(state.ghostOrder && state.ghostOrder.expires>Date.now()){
      ctx.fillStyle='rgba(123,20,95,0.22)';ctx.fillRect(560,90,120,180);
      ctx.fillStyle='rgba(230,215,255,0.24)';ctx.fillRect(590,120,50,80);
      ctx.fillStyle='rgba(255,35,90,0.65)';ctx.fillRect(601,143,6,5);ctx.fillRect(625,143,6,5);
    }
    if(hallucinating){
      const pulse=.12+Math.abs(Math.sin(t*9))*.1+horrorIntensity*.13;
      ctx.fillStyle=`rgba(255,20,72,${pulse})`;ctx.fillRect(0,0,w,h);
      ctx.fillStyle=`rgba(130,20,255,${pulse*.7})`;ctx.fillRect(0,0,w,h);
      ctx.globalCompositeOperation='screen';
      for(let i=0;i<9;i++){const y=(i*53+t*(90+i*8))%h;ctx.fillStyle=`rgba(${i%2?255:20},${i%2?24:210},${i%2?110:255},${.12+horrorIntensity*.14})`;ctx.fillRect(0,y,w,3+Math.floor(horrorIntensity*8));}
      ctx.globalCompositeOperation='source-over';
      ctx.strokeStyle=`rgba(255,220,250,${.22+horrorIntensity*.28})`;ctx.lineWidth=2;
      for(let i=0;i<12;i++){const x=(i*79+Math.sin(t*8+i)*35)%w;ctx.beginPath();ctx.moveTo(x,210);ctx.lineTo(x+24,255+i*3);ctx.stroke();}
    }
    const introCanvas=$('introScene');
    if(introCanvas&&!sessionStarted)introCanvas.getContext('2d').drawImage(canvas,0,0);
  }
  function drawCafeScene(){const sceneNow=Date.now();visitorActors=visitorActors.filter(visitor=>{const elapsed=sceneNow-visitor.phaseAt;if(visitor.phase==='arriving'&&elapsed>=2200){visitor.phase='waiting';visitor.phaseAt=sceneNow}if(visitor.phase==='leaving'&&elapsed>=2300)return false;return true});const paint=(canvas)=>{if(!canvas)return;const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,t=Date.now()/1000;ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=true;const rect=(x,y,width,height,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,width,height)};const round=(x,y,width,height,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,width,height,r);ctx.fill()};const line=(x1,y1,x2,y2,color,width=3)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()};const polygon=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fill()};
      rect(0,0,w,h,'#edf2e8');rect(0,0,w,h*.64,'#e6efe7');
      round(w*.06,h*.08,w*.43,h*.43,12,'#ffffff');round(w*.075,h*.105,w*.4,h*.375,5,'#b9d9d2');
      rect(w*.08,h*.13,w*.39,h*.3,'#c8e4df');rect(w*.08,h*.34,w*.39,h*.09,'#a9c5b5');
      for(let index=0;index<5;index++){const bx=w*(.1+index*.073),bh=h*(.09+(index%3)*.035);rect(bx,h*.34-bh,w*.045,bh,'#8ea99b');rect(bx+w*.012,h*.34-bh+h*.02,w*.01,h*.025,'#f8e5ad');rect(bx+w*.03,h*.34-bh+h*.055,w*.01,h*.025,'#f8e5ad')}
      line(w*.275,h*.105,w*.275,h*.48,'#fffaf1',5);line(w*.08,h*.295,w*.47,h*.295,'#fffaf1',5);
      round(w*.62,h*.08,w*.31,h*.3,8,'#36574c');round(w*.635,h*.1,w*.28,h*.26,4,'#f3eedf');
      ctx.fillStyle='#456455';ctx.font=`700 ${Math.max(14,w*.024)}px sans-serif`;ctx.fillText('MENU',w*.66,h*.16);ctx.fillStyle='#617568';ctx.font=`600 ${Math.max(10,w*.014)}px sans-serif`;ctx.fillText('LATTE     36.000',w*.66,h*.21);ctx.fillText('MOCHA    42.000',w*.66,h*.26);ctx.fillText('COLD BREW 39.000',w*.66,h*.31);
      rect(0,h*.61,w,h*.39,'#dce7dc');rect(0,h*.72,w,h*.28,'#d2dfd4');
      const workerBob=Math.sin(t*2.2)*h*.004,workerX=w*.5,workerFaceY=h*.3+workerBob,working=Boolean(interactiveBrew||activeBrew);
      round(workerX-w*.085,h*.36+workerBob,w*.17,h*.31,18,'#557c69');round(workerX-w*.045,h*.39+workerBob,w*.09,h*.25,12,'#d7b98c');
      ctx.fillStyle='#e8bd98';ctx.beginPath();ctx.arc(workerX,workerFaceY,w*.042,0,Math.PI*2);ctx.fill();
      round(workerX-w*.047,workerFaceY-w*.045,w*.094,w*.04,14,'#3d443f');round(workerX-w*.052,workerFaceY-w*.022,w*.025,w*.06,10,'#3d443f');
      ctx.fillStyle='#35483d';ctx.beginPath();ctx.arc(workerX-w*.014,workerFaceY,3,0,Math.PI*2);ctx.arc(workerX+w*.014,workerFaceY,3,0,Math.PI*2);ctx.fill();
      line(workerX-w*.065,h*.43+workerBob,working?w*.37:w*.44,h*.51,'#557c69',w*.022);line(workerX+w*.065,h*.43+workerBob,working?w*.62:w*.56,h*.51,'#557c69',w*.022);
      round(workerX-w*.018,h*.52,w*.036,h*.045,7,'#e8bd98');round(workerX-w*.085,h*.51,w*.17,h*.025,8,'#cfaa7c');
      polygon([[w*.14,h*.54],[w*.88,h*.54],[w*.91,h*.6],[w*.11,h*.6]],'#d8a77d');round(w*.15,h*.59,w*.72,h*.14,8,'#b57e57');rect(w*.2,h*.72,w*.035,h*.22,'#97694e');rect(w*.79,h*.72,w*.035,h*.22,'#97694e');
      round(w*.24,h*.32,w*.22,h*.23,11,'#536e61');round(w*.265,h*.34,w*.17,h*.13,5,'#c5d5c5');rect(w*.27,h*.455,w*.16,h*.075,'#405b50');round(w*.29,h*.4,w*.04,h*.05,4,'#e9d7b1');round(w*.365,h*.4,w*.04,h*.05,4,'#e9d7b1');line(w*.35,h*.32,w*.35,h*.27,'#435e53',5);line(w*.35,h*.27,w*.4,h*.27,'#435e53',5);
      round(w*.52,h*.49,w*.06,h*.07,5,'#fff9ec');line(w*.54,h*.49,w*.54,h*.46,'#f39b87',4);line(w*.56,h*.49,w*.56,h*.45+Math.sin(t*2)*2,'#f39b87',3);line(w*.58,h*.49,w*.58,h*.46,'#f39b87',4);
      round(w*.68,h*.48,w*.065,h*.07,7,'#fffaf0');round(w*.739,h*.5,w*.022,h*.035,8,'#fffaf0');rect(w*.682,h*.474,w*.06,h*.012,'#536e61');
      for(const [index,color] of ['#d59b59','#b7d2c3','#986c56'].entries()){const jarX=w*(.64+index*.044);round(jarX,h*.485,w*.032,h*.065,5,color);round(jarX+w*.008,h*.468,w*.016,h*.025,4,'#f0d3a2');rect(jarX+w*.009,h*.51,w*.014,h*.012,'rgba(255,250,235,.72)')}
      round(w*.79,h*.475,w*.065,h*.065,6,'#607d6e');polygon([[w*.795,h*.475],[w*.805,h*.43],[w*.845,h*.43],[w*.855,h*.475]],'#adcabd');round(w*.805,h*.515,w*.035,h*.025,4,'#d6b57d');rect(w*.815,h*.452,w*.02,h*.013,'#edf2e8');
      rect(w*.92,h*.45,w*.035,h*.1,'#bc7a5b');for(let leaf=0;leaf<5;leaf++){ctx.fillStyle=leaf%2?'#719978':'#5e886a';ctx.beginPath();ctx.ellipse(w*(.91+leaf*.018),h*(.38+(leaf%3)*.025),w*.018,h*.07,leaf*.4,0,Math.PI*2);ctx.fill()}
      for(let seat=0;seat<2;seat++){const sx=w*(.08+seat*.82);rect(sx,h*.78,w*.12,h*.025,'#b9805a');rect(sx+w*.015,h*.805,w*.012,h*.12,'#9b7054');rect(sx+w*.09,h*.805,w*.012,h*.12,'#9b7054');}
      rect(0,h*.95,w,h*.05,'#b8cbbb');
      const servingVisitor=visitorActors.find(visitor=>visitor.phase==='leaving'),serveElapsed=Date.now()-serveAnimationStarted,serveProgress=serveAnimationStarted?Math.min(1,serveElapsed/950):1,serveEase=serveProgress*serveProgress*(3-2*serveProgress),serveTargetX=servingVisitor?w*(servingVisitor.target+.055):w*.68;
      const reachX=serveProgress<1&&serveAnimationStarted?w*(.52+(.58*(serveTargetX/w-.52))*serveEase):working?w*.38:w*.52,reachY=serveProgress<1&&serveAnimationStarted?h*(.52+.13*serveEase):working?h*(.49+Math.sin(t*12)*.008):h*.52;
      line(workerX-w*.035,h*.43+workerBob,reachX,reachY,'#557c69',w*.02);round(reachX-w*.012,reachY-w*.012,w*.024,w*.024,8,'#e8bd98');
      if(working){for(let puff=0;puff<3;puff++){const steamY=h*.455-puff*h*.025-Math.sin(t*5+puff)*h*.008;line(w*.35+puff*w*.018,steamY,w*.35+puff*w*.018+Math.sin(t*3+puff)*w*.008,steamY-h*.025,'rgba(255,255,255,.65)',Math.max(2,w*.002))}}
      if(serveAnimationStarted&&serveProgress<1){const cupX=w*(.58+(serveTargetX/w-.58)*serveEase),cupY=h*(.48+.16*serveEase-Math.sin(serveProgress*Math.PI)*.08);round(cupX-w*.018,cupY,w*.036,h*.045,5,'#fff8e9');round(cupX-w*.022,cupY-h*.008,w*.044,h*.012,4,'#e0b07b');line(cupX,cupY-h*.01,cupX,cupY-h*.035,'#9a654d',3)}
      for(const visitor of visitorActors){
        const elapsed=Date.now()-visitor.phaseAt,duration=visitor.phase==='leaving'?2300:2200,progress=Math.max(0,Math.min(1,elapsed/duration)),ease=progress*progress*(3-2*progress),avatarWidth=w*.11,avatarHeight=h*.58,targetX=w*visitor.target;
        const moving=visitor.phase!=='waiting';
        const x=visitor.phase==='arriving'?(visitor.fromLeft?-avatarWidth+(targetX+avatarWidth)*ease:w+avatarWidth-(w+avatarWidth-targetX)*ease):visitor.phase==='leaving'?(visitor.fromLeft?targetX+(-avatarWidth-targetX)*ease:targetX+(w+avatarWidth-targetX)*ease):targetX;
        const bob=moving?Math.abs(Math.sin(t*11+visitor.id))*h*.012:Math.sin(t*2+visitor.id)*h*.004,baseY=h*.99-bob,headSize=avatarWidth*.36,centerX=x+avatarWidth*.5,headY=baseY-avatarHeight*.82;
        ctx.fillStyle='rgba(38,54,45,.18)';ctx.beginPath();ctx.ellipse(centerX,baseY,avatarWidth*.48,h*.018,0,0,Math.PI*2);ctx.fill();
        rect(x+avatarWidth*.28,baseY-avatarHeight*.3,avatarWidth*.16,avatarHeight*.28,'#68786c');rect(x+avatarWidth*.58,baseY-avatarHeight*.3+Math.sin(t*12+visitor.id)*avatarWidth*.05,avatarWidth*.16,avatarHeight*.28,'#68786c');
        round(x+avatarWidth*.18,baseY-avatarHeight*.58,avatarWidth*.64,avatarHeight*.34,avatarWidth*.12,visitor.shirt);
        const accepting=visitor.phase==='leaving'&&serveAnimationStarted&&serveProgress<1,swing=moving?Math.sin(t*11+visitor.id)*.045:Math.sin(t*2+visitor.id)*.018,shoulderY=baseY-avatarHeight*.5,elbowY=baseY-avatarHeight*(accepting?.42:.32),leftShoulder=centerX-avatarWidth*.27,rightShoulder=centerX+avatarWidth*.27,leftHandX=accepting?centerX-avatarWidth*.04:centerX-avatarWidth*(.43+swing),rightHandX=accepting?centerX+avatarWidth*.04:centerX+avatarWidth*(.43-swing),handY=accepting?baseY-avatarHeight*.47:baseY-avatarHeight*(.17+Math.abs(swing));
        ctx.save();ctx.lineCap='round';line(leftShoulder,shoulderY,leftHandX-avatarWidth*.06,elbowY,visitor.shirt,avatarWidth*.085);line(leftHandX-avatarWidth*.06,elbowY,leftHandX,handY,visitor.skin,avatarWidth*.06);line(rightShoulder,shoulderY,rightHandX+avatarWidth*.06,elbowY,visitor.shirt,avatarWidth*.085);line(rightHandX+avatarWidth*.06,elbowY,rightHandX,handY,visitor.skin,avatarWidth*.06);ctx.restore();
        ctx.fillStyle=visitor.skin;ctx.beginPath();ctx.arc(leftHandX,handY,avatarWidth*.045,0,Math.PI*2);ctx.arc(rightHandX,handY,avatarWidth*.045,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=visitor.skin;ctx.beginPath();ctx.arc(centerX,headY,headSize,0,Math.PI*2);ctx.fill();
        round(centerX-headSize*1.05,headY-headSize*.92,headSize*2.1,headSize*.72,headSize*.35,visitor.hair);
        if(visitor.cap){round(centerX-headSize*1.1,headY-headSize*1.18,headSize*2.2,headSize*.42,headSize*.2,'#526d5d');round(centerX-headSize*.95,headY-headSize*.84,headSize*1.9,headSize*.16,headSize*.08,'#526d5d')}
        ctx.fillStyle='#34463b';ctx.beginPath();ctx.arc(centerX-headSize*.35,headY+headSize*.08,headSize*.07,0,Math.PI*2);ctx.arc(centerX+headSize*.3,headY+headSize*.08,headSize*.07,0,Math.PI*2);ctx.fill();
        const factionAccent={hackers:'#63b89a',samurai:'#d98270',corporate:'#7194bd',cyborgs:'#a481bc'}[visitor.factionId]||'#f0ca7c';
        round(centerX-avatarWidth*.08,baseY-avatarHeight*.56,avatarWidth*.16,avatarHeight*.19,avatarWidth*.04,factionAccent);
        if(visitor.bag){line(centerX-avatarWidth*.24,baseY-avatarHeight*.55,centerX+avatarWidth*.22,baseY-avatarHeight*.25,'#72564b',Math.max(2,w*.003));round(centerX+avatarWidth*.12,baseY-avatarHeight*.36,avatarWidth*.2,avatarHeight*.16,avatarWidth*.05,'#bd8c69')}
        if(visitor.phase==='waiting'){
          round(centerX-avatarWidth*.28,headY-headSize*1.7,avatarWidth*.56,avatarHeight*.12,avatarHeight*.05,'#fffaf0');
          ctx.fillStyle='#79a38c';ctx.beginPath();ctx.arc(centerX-avatarWidth*.12,headY-headSize*1.64,avatarWidth*.025,0,Math.PI*2);ctx.arc(centerX,headY-headSize*1.64,avatarWidth*.025,0,Math.PI*2);ctx.arc(centerX+avatarWidth*.12,headY-headSize*1.64,avatarWidth*.025,0,Math.PI*2);ctx.fill();
        }
      }
    };paint($('cafeScene'));if(!sessionStarted)paint($('introScene'))}
  if(!visitorActors.length&&!state.shiftClosed)createVisitor();
  drawCafeScene();setInterval(()=>{if(document.visibilityState==='visible')drawCafeScene()},60);$('waveBars').innerHTML='<i></i>'.repeat(28);checkBadges();
  if(awaySeconds>0&&offlineGain===0&&awaySeconds>=OFFLINE_CAP)toast('Bạn đã vắng mặt hơn 8 giờ. Thu nhập offline đã chạm giới hạn.');
  $('tutorialScreen').hidden=true;$('tutorialDock').hidden=true;$('gameShell').inert=false;$('gameShell').removeAttribute('aria-hidden');
  $('introScreen').style.pointerEvents='auto';
  $('introEnter').style.pointerEvents='auto';
  $('introEnter').disabled=false;
  if(!sessionStarted){$('tutorialScreen').hidden=true;$('tutorialDock').hidden=true;}
  addCreatorProjectCard();render();save();applyUiSettings();if(state.shiftClosed)closeShift();
  $('replayTutorial').addEventListener('click',replayTutorial);
  $('tutorialContinue').addEventListener('click',doTutorialAction);$('tutorialSkip').addEventListener('click',skipTutorial);
  $('tutorialScreen').addEventListener('click',event=>{if(event.target===$('tutorialScreen'))enableOutsideTutorial()});$('tutorialDockExpand').addEventListener('click',()=>{if(tutorialActive)doTutorialAction();else replayTutorial()});$('tutorialDockSkip').addEventListener('click',skipTutorial);
  $('introEnter').addEventListener('click',()=>{if(sessionStarted)return;document.body.classList.remove('intro-open');$('introScreen').hidden=true;$('tutorialScreen').hidden=true;$('gameShell').inert=false;$('gameShell').removeAttribute('aria-hidden');startGameSession();if(!state.tutorialDone){window.setTimeout(()=>{if(!state.tutorialDone)startTutorial();},220)}});
  let creatorTrigger=$('creatorCreditOpen');const openCreatorDialog=event=>{creatorTrigger=event.currentTarget;$('creatorDialog').hidden=false;$('creatorClose').focus()};$('creatorCreditOpen').addEventListener('click',openCreatorDialog);$('creatorClose').addEventListener('click',()=>{$('creatorDialog').hidden=true;creatorTrigger.focus()});$('creatorDialog').addEventListener('click',event=>{if(event.target===$('creatorDialog'))$('creatorClose').click()});$('creatorDialog').addEventListener('keydown',event=>{if(event.key==='Escape')$('creatorClose').click()});
})();