const SCHOOLS=[
["University of Ibadan","UI","University","Oyo"],["Obafemi Awolowo University","OAU","University","Osun"],
["University of Lagos","UNILAG","University","Lagos"],["University of Nigeria, Nsukka","UNN","University","Enugu"],
["Federal University of Technology, Akure","FUTA","University","Ondo"],["Lagos State University","LASU","University","Lagos"],
["University of Ilorin","UNILORIN","University","Kwara"],["Ahmadu Bello University","ABU","University","Kaduna"],
["University of Benin","UNIBEN","University","Edo"],["University of Port Harcourt","UNIPORT","University","Rivers"],
["Yaba College of Technology","YABATECH","Polytechnic","Lagos"],["Federal Polytechnic, Ede","EDEPOLY","Polytechnic","Osun"],
["The Polytechnic, Ibadan","POLY IBADAN","Polytechnic","Oyo"],["Auchi Polytechnic","AUCHIPOLY","Polytechnic","Edo"],
["Federal Polytechnic, Ilaro","FEDPOLY ILARO","Polytechnic","Ogun"],["Federal Polytechnic, Nekede","FPNO","Polytechnic","Imo"],
["Federal College of Education, Zaria","FCE ZARIA","College","Kaduna"],["Adeyemi College of Education","ACE","College","Ondo"],
["College of Education, Ikere-Ekiti","COE IKERE","College","Ekiti"],["Federal College of Education (Technical), Akoka","FCET AKOKA","College","Lagos"]
];

const DEMO=[
{id:"b1",school:"University of Ibadan",name:"Campus Bites",cat:"Food",price:2500,loc:"Students' Union",delivery:"30–60 min",rating:4.8,about:"Meals, snacks and drinks for students.",wa:"2348012345678",store:"#"},
{id:"b2",school:"University of Ibadan",name:"UI Prints",cat:"Academic Services",price:800,loc:"Faculty Area",delivery:"10–30 min",rating:4.7,about:"Printing, binding, scanning and typing.",wa:"2348098765432",store:"#"},
{id:"b3",school:"University of Ibadan",name:"FreshFold Laundry",cat:"Laundry",price:3000,loc:"Hostel Area",delivery:"Same day",rating:4.6,about:"Pickup and delivery laundry service.",wa:"2348111111111",store:"#"},
{id:"b4",school:"Obafemi Awolowo University",name:"OAU Tech Hub",cat:"Tech",price:12000,loc:"Campus Gate",delivery:"By arrangement",rating:4.9,about:"Accessories, repairs and student tech help.",wa:"2348222222222",store:"#"}
];

const TOOLS=[
["GPA Calculator","Add unlimited courses with units and scores; calculate GPA automatically.","gpa"],
["CGPA Calculator","Add unlimited courses with units and scores; calculate CGPA from course results.","cgpa"],
["Percentage Calculator","Quick percentages, increases and decreases.","percent"],
["Grade Calculator","Find the score needed for a target percentage.","grade"],
["Study Timer","Simple focused study timer with break.","timer"],
["Word Counter","Count words, characters and reading time.","words"],
["Unit Converter","Convert common length, weight and temperature units.","units"],
["Deadline Countdown","Save a deadline and see time remaining.","deadline"],
["Notes Pad","Private quick notes stored on this device.","notes"]
];

const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
let savedFavorites=[];
try{savedFavorites=JSON.parse(localStorage.getItem("cbc_favs")||"[]");if(!Array.isArray(savedFavorites))savedFavorites=[];}catch{savedFavorites=[];}
const state={school:localStorage.getItem("cbc_school")||"", favorites:savedFavorites};
const schools=SCHOOLS.map(x=>({fullName:x[0],abbr:x[1],type:x[2],state:x[3]}));
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function save(){try{localStorage.setItem("cbc_school",state.school);localStorage.setItem("cbc_favs",JSON.stringify(state.favorites))}catch{toast("Local storage is unavailable on this browser.")}}
function selectedBusinesses(){return DEMO.filter(b=>!state.school||b.school===state.school)}
function waUrl(b){
 const phone=String(b.wa||"").replace(/\D/g,"");
 if(!phone) return "#";
 return `https://wa.me/${phone}?text=${encodeURIComponent(`Hi, I found ${b.name} on CampBiz and I'm interested in your services.`)}`;
}
function card(b){
 const fav=state.favorites.includes(b.id);
 const wa=waUrl(b);
 return `<article class="biz-card"><div class="biz-img">${esc(b.cat)}</div><div class="biz-body"><div class="meta">${esc(b.cat)} · ⭐ ${Number(b.rating||0).toFixed(1)}</div><h3>${esc(b.name)}</h3><p>${esc(b.about)}</p><div class="meta">📍 ${esc(b.loc)}<br>🚚 ${esc(b.delivery)}<br>💰 From ₦${Number(b.price||0).toLocaleString()}</div><div class="actions"><a class="whatsapp" href="${wa}" target="_blank" rel="noopener noreferrer">WhatsApp</a><button type="button" data-fav="${esc(b.id)}">${fav?"♥ Saved":"♡ Save"}</button></div></div></article>`
}
function renderFyp(){const el=$("#fyp");el.innerHTML=selectedBusinesses().sort((a,b)=>b.rating-a.rating).map(card).join("")||"<p>No businesses yet for this school.</p>";wireFavs()}
function renderResults(){
 if(!state.school){$("#results").innerHTML="<p>Choose your school on the Home tab first to search businesses.</p>";return}
 const q=$("#searchInput").value.toLowerCase().trim(), cat=$("#categoryFilter").value, pf=$("#priceFilter").value;
 let bs=selectedBusinesses().filter(b=>(!cat||b.cat===cat)&&(!q||`${b.name} ${b.cat} ${b.about} ${b.loc}`.toLowerCase().includes(q)));
 if(pf==="low")bs=bs.filter(b=>b.price<3000); if(pf==="mid")bs=bs.filter(b=>b.price>=3000&&b.price<=10000); if(pf==="high")bs=bs.filter(b=>b.price>10000);
 $("#results").innerHTML=bs.map(card).join("")||"<p>No matching businesses found. Try another search.</p>";
 wireFavs();
}
function wireFavs(){document.querySelectorAll("[data-fav]").forEach(b=>b.onclick=()=>{const id=b.dataset.fav;state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];save();renderFyp();renderResults();renderFavorites()})}
function renderFavorites(){const bs=DEMO.filter(b=>state.favorites.includes(b.id));$("#favoritesGrid").innerHTML=bs.map(card).join("")||"<p>You haven't saved any businesses yet.</p>";wireFavs()}
function renderTools(){
 const html=TOOLS.map((t,i)=>`<div class="tool-card" data-tool="${t[2]}"><strong>${t[0]}</strong><span>${t[1]}</span></div>`).join("");
 $("#toolsGrid").innerHTML=html;$("#toolPreview").innerHTML=TOOLS.slice(0,4).map((t,i)=>`<div class="tool-card" data-tool="${t[2]}"><strong>${t[0]}</strong><span>${t[1]}</span></div>`).join("");
 document.querySelectorAll("[data-tool]").forEach(x=>x.onclick=()=>openTool(x.dataset.tool));
}
function openTool(type){
 const p=$("#toolPanel");p.classList.remove("hidden");
 const map={
 gpa:`<h2>GPA Calculator</h2><p>Add as many courses as you need. Enter the course name, credit units and score.</p><div id="courseRows"></div><button class="actions" id="addCourse">＋ Add course</button><button class="primary" id="calc">Calculate GPA</button><div id="out"></div>`,
 cgpa:`<h2>CGPA Calculator</h2><p>Add every course/result you want included. There is no course-count limit in this tool.</p><div id="courseRows"></div><button class="actions" id="addCourse">＋ Add course</button><button class="primary" id="calc">Calculate CGPA</button><div id="out"></div>`,
 percent:`<h2>Percentage Calculator</h2><input id="a" type="number" placeholder="Value"><input id="b" type="number" placeholder="Percent"><button class="primary" id="calc">Calculate</button><div id="out"></div>`,
 grade:`<h2>Target Score Calculator</h2><input id="total" type="number" placeholder="Total marks"><input id="current" type="number" placeholder="Marks already secured"><input id="target" type="number" placeholder="Target percentage"><button class="primary" id="calc">Calculate</button><div id="out"></div>`,
 timer:`<h2>Study Timer</h2><input id="mins" type="number" value="25" min="1"><button class="primary" id="start">Start</button><div id="out" class="tool-result">25:00</div>`,
 words:`<h2>Word Counter</h2><textarea id="txt" rows="8" placeholder="Paste or type your text..."></textarea><div id="out" class="tool-result">0 words · 0 characters</div>`,
 units:`<h2>Unit Converter</h2><input id="unit" type="number" placeholder="Value"><select id="from"><option>km</option><option>m</option><option>kg</option><option>g</option><option>C</option><option>F</option></select><select id="to"><option>m</option><option>km</option><option>g</option><option>kg</option><option>C</option><option>F</option></select><button class="primary" id="calc">Convert</button><div id="out"></div>`,
 deadline:`<h2>Deadline Countdown</h2><input id="date" type="datetime-local"><button class="primary" id="start">Start countdown</button><div id="out" class="tool-result">Choose a deadline.</div>`,
 notes:`<h2>Private Notes</h2><textarea id="notes" rows="12" placeholder="Your notes stay on this device."></textarea><div class="muted">Saved locally.</div>`
 };
 p.innerHTML=map[type]||"<h2>Tool unavailable</h2>";
 if(type==="gpa"||type==="cgpa"){
   const rows=$("#courseRows");
   const addRow=()=>{const n=rows.children.length+1;const row=document.createElement("div");row.className="course-row";row.innerHTML=`<input class="course-name" placeholder="Course ${n}"><input class="course-unit" type="number" min="0" step="0.5" placeholder="Units"><input class="course-score" type="number" min="0" max="100" step="1" placeholder="Score"><button type="button" class="remove-course">×</button>`;rows.appendChild(row);row.querySelector(".remove-course").onclick=()=>row.remove()};
   $("#addCourse").onclick=addRow; addRow();
   $("#calc").onclick=()=>{const scale=s=>s>=70?5:s>=60?4:s>=50?3:s>=45?2:s>=40?1:0;let units=0,points=0,valid=0;rows.querySelectorAll(".course-row").forEach(r=>{const u=+r.querySelector(".course-unit").value,sc=+r.querySelector(".course-score").value;if(u>0&&sc>=0&&sc<=100){units+=u;points+=u*scale(sc);valid++}});$("#out").innerHTML=valid?`<div class="tool-result">${type==="gpa"?"GPA":"CGPA"}: ${(points/units).toFixed(2)}<br><small>${valid} course(s) · ${units} credit unit(s)</small></div>`:`<div class="tool-result">Add valid course units and scores first.</div>`};
 }
 if(type==="percent")$("#calc").onclick=()=>$("#out").innerHTML=`<div class="tool-result">${((+$("#a").value||0)*(+$("#b").value||0)/100).toLocaleString()}</div>`;
 if(type==="grade")$("#calc").onclick=()=>{let need=((+$("#target").value||0)/100*(+$("#total").value||0))-(+$("#current").value||0);$("#out").innerHTML=`<div class="tool-result">Marks needed: ${Math.max(0,need).toFixed(2)}</div>`};
 if(type==="words")$("#txt").oninput=()=>{let s=$("#txt").value;$("#out").textContent=`${s.trim()?s.trim().split(/\s+/).length:0} words · ${s.length} characters`};
 if(type==="notes"){const k="cbc_notes";try{$("#notes").value=localStorage.getItem(k)||""}catch{};$("#notes").oninput=()=>{try{localStorage.setItem(k,$("#notes").value)}catch{toast("Could not save this note locally.")}}}
 let timerId=null;
 if(type==="timer")$("#start").onclick=()=>{let min=+$("#mins").value;if(!Number.isFinite(min)||min<=0){toast("Enter a study time greater than 0.");return}if(timerId){clearInterval(timerId);timerId=null}let sec=min*60;const out=$("#out");timerId=setInterval(()=>{sec--;out.textContent=`${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;if(sec<=0){clearInterval(timerId);timerId=null;toast("Study session complete!");window.dispatchEvent(new CustomEvent("cbc:timer-complete"))}},1000)};
 let deadlineId=null;
 if(type==="deadline")$("#start").onclick=()=>{
   const raw=$("#date").value, target=new Date(raw).getTime(), out=$("#out");
   if(!raw || Number.isNaN(target) || target<=Date.now()){out.textContent="Choose a future deadline.";return}
   if(deadlineId){clearInterval(deadlineId);deadlineId=null}
   deadlineId=setInterval(()=>{let d=target-Date.now();if(d<=0){clearInterval(deadlineId);deadlineId=null;out.textContent="Deadline reached.";toast("Deadline reached!");window.dispatchEvent(new CustomEvent("cbc:deadline-reached"));return}let days=Math.floor(d/86400000),h=Math.floor(d%86400000/36e5),m=Math.floor(d%36e5/6e4),s=Math.floor(d%6e4/1000);out.textContent=`${days}d ${h}h ${m}m ${s}s remaining`},1000);
 };
 if(type==="units")$("#calc").onclick=()=>{let v=+$("#unit").value||0,f=$("#from").value,t=$("#to").value,r=v;if(f==="km"&&t==="m")r=v*1000;if(f==="m"&&t==="km")r=v/1000;if(f==="kg"&&t==="g")r=v*1000;if(f==="g"&&t==="kg")r=v/1000;if(f==="C"&&t==="F")r=v*9/5+32;if(f==="F"&&t==="C")r=(v-32)*5/9;$("#out").innerHTML=`<div class="tool-result">${r.toFixed(3)}</div>`};
}
function setup(){
 const dl=$("#schoolList");dl.innerHTML=schools.map(s=>`<option value="${s.fullName}">${s.abbr} — ${s.type}, ${s.state}</option>`).join("");
 const cats=[...new Set(DEMO.map(b=>b.cat))];$("#categoryFilter").innerHTML+=cats.map(c=>`<option>${c}</option>`).join("");
 $("#schoolSelect").value=state.school;
 $("#continueSchool").onclick=()=>{const v=$("#schoolSelect").value.trim();const s=schools.find(x=>x.fullName.toLowerCase()===v.toLowerCase()||x.abbr.toLowerCase()===v.toLowerCase());if(!s){toast("Choose a school from the list.");return}state.school=s.fullName;save();$("#homeContent").classList.remove("hidden");renderFyp();renderResults();toast(`Campus set to ${s.fullName}`)};
 if(state.school)$("#homeContent").classList.remove("hidden");
 renderFyp();renderResults();renderFavorites();renderTools();
 $("#searchBtn").onclick=renderResults;$("#searchInput").oninput=renderResults;$("#categoryFilter").onchange=renderResults;$("#priceFilter").onchange=renderResults;
 $("#ownerLogin").onclick=()=>{location.hash="owner";toast("Owner sign-in requires the production Google OAuth backend.")};
}
function closeDrawer(){$("#drawer").classList.remove("open");$("#drawer").setAttribute("aria-hidden","true");$("#backdrop").classList.add("hidden")}
function route(){const requested=location.hash.slice(1)||"home";const id=document.getElementById(requested)?requested:"home";document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));closeDrawer();scrollTo(0,0)}
$("#menuBtn").onclick=()=>{$("#drawer").classList.add("open");$("#drawer").setAttribute("aria-hidden","false");$("#backdrop").classList.remove("hidden")};$("#closeMenu").onclick=()=>closeDrawer();$("#backdrop").onclick=()=>closeDrawer();
document.querySelectorAll("#drawer nav a").forEach(a=>a.addEventListener("click",closeDrawer));
window.addEventListener("hashchange",route);setup();route();
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
  // Enable this after adding public Firebase web configuration:
  // navigator.serviceWorker.register('./firebase-messaging-sw.js').catch(()=>{});
}
