import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

const canvas = document.querySelector('#game');
const instruction = document.querySelector('#instruction');
const meterFill = document.querySelector('#meter-fill');
const meterLabel = document.querySelector('#meter-label');
const toast = document.querySelector('#toast');
const testButton = document.querySelector('#test');
const undoButton = document.querySelector('#undo');
const clearButton = document.querySelector('#clear');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#a9d9f2'); scene.fog = new THREE.Fog('#a9d9f2', 18, 38);
const camera = new THREE.OrthographicCamera(-9, 9, 6, -6, .1, 100); camera.position.set(0, 1.2, 22); camera.lookAt(0, 1.25, 0);
const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
const wood = new THREE.MeshStandardMaterial({ color: '#df8b63', roughness: .7 });
const woodEnd = new THREE.MeshStandardMaterial({ color: '#bd644e', roughness: .8 });
const pink = new THREE.MeshStandardMaterial({ color: '#e67886', roughness: .55 });
const blue = new THREE.MeshStandardMaterial({ color: '#4d83ba', roughness: .55 });
const dark = new THREE.MeshStandardMaterial({ color: '#35385c', roughness: .6 });
const cream = new THREE.MeshStandardMaterial({ color: '#fff0be', roughness: .7 });
const water = new THREE.MeshStandardMaterial({ color: '#5abdda', roughness: .25, transparent: true, opacity: .87 });
const glass = new THREE.MeshStandardMaterial({ color: '#8ccce0', roughness: .22, metalness: .1 });
const yellow = new THREE.MeshStandardMaterial({ color: '#f7bd39', roughness: .48 });
const black = new THREE.MeshStandardMaterial({ color: '#263049', roughness: .48 });
const red = new THREE.MeshStandardMaterial({ color: '#ee6e6e', roughness: .55 });
const green = new THREE.MeshStandardMaterial({ color: '#6fbf83', roughness: .75 });
const leaf = new THREE.MeshStandardMaterial({ color: '#75c98f', roughness: .72 });

scene.add(new THREE.HemisphereLight('#f7e9cc', '#6f8daf', 2.2));
const sun = new THREE.DirectionalLight('#fff0bb', 3.4); sun.position.set(-7, 10, 9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -12; sun.shadow.camera.right = 12; sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -8; scene.add(sun);
const fill = new THREE.DirectionalLight('#cfc4ff', 1.1); fill.position.set(7, 3, 5); scene.add(fill);

function mesh(geometry, material, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; }
function box(w,h,d,mat,x,y,z) { return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z); }
function sphere(r,mat,x,y,z) { return mesh(new THREE.SphereGeometry(r,20,14),mat,x,y,z); }
function cylinder(r,h,mat,x,y,z,rotZ=0) { const m = mesh(new THREE.CylinderGeometry(r,r,h,16),mat,x,y,z); m.rotation.z=rotZ; return m; }
function roundRect(width, height, radius) { const s = new THREE.Shape(); const x=-width/2,y=-height/2; s.moveTo(x+radius,y);s.lineTo(x+width-radius,y);s.quadraticCurveTo(x+width,y,x+width,y+radius);s.lineTo(x+width,y+height-radius);s.quadraticCurveTo(x+width,y+height,x+width-radius,y+height);s.lineTo(x+radius,y+height);s.quadraticCurveTo(x,y+height,x,y+height-radius);s.lineTo(x,y+radius);s.quadraticCurveTo(x,y,x+radius,y); return new THREE.ShapeGeometry(s); }

// Pastel game-room backdrop, viewed from a deliberately fixed side-on camera.
box(24, 14, .2, new THREE.MeshStandardMaterial({color:'#b9ddf4',roughness:1}), 0, 4, -2.2);
const floor = box(24, .35, 5, new THREE.MeshStandardMaterial({color:'#e8d2b4',roughness:.9}), 0, -4.2, .7);
for (let x=-10; x<11; x+=2) box(.05, .02, 4.2, new THREE.MeshStandardMaterial({color:'#d3b694',roughness:1}), x,-4.01,.4);
const sunDisk = sphere(.75, new THREE.MeshBasicMaterial({color:'#fff4b6'}), -6.8, 4.2, -1.95); sunDisk.castShadow=false;
for (let i=0;i<5;i++) { const cloud=sphere(.32+i%2*.08,new THREE.MeshBasicMaterial({color:'#f0f7ff'}),-1.5+i*.32,4.15+(i%2)*.12,-2); cloud.castShadow=false; }
// water and banks
box(20, .18, 1.4, water, 0, -2.7, .15);
for (let x=-8.7;x<9;x+=1.4) { const wave=box(.75,.035,.04,new THREE.MeshBasicMaterial({color:'#c6f3fb'}),x,-2.62,.6); wave.rotation.z=(x%2)*.08; }
function bank(x) { box(3.2,2.35,1.5,green,x,-2.15,.1); box(3.5,.28,1.7,leaf,x,-.98,.1); for(let i=0;i<3;i++) sphere(.28,leaf,x-1+i*.9,-.68+(i%2)*.08,.05); }
bank(-7.8); bank(7.8);
function toyTree(x) { cylinder(.1,1.3,wood,x,-.25,-.5); sphere(.58,leaf,x,.5,-.5); sphere(.42,green,x+.32,.25,-.5); } toyTree(-8.8); toyTree(8.7);
// anchor platforms
box(3.8,.35,1.25,pink,-7.25,-.4,.1); box(3.8,.35,1.25,pink,7.25,-.4,.1);
for (const x of [-8.5,-6,-5.1,5.1,6,8.5]) cylinder(.12,1.45,wood,x,-1.15,.25);

const anchors = [
  [-5.25, -.1],[-3.45, -.1],[-1.65, -.1],[.15,-.1],[1.95,-.1],[3.75,-.1],[5.25,-.1],
  [-3.45,-2.1],[-1.65,-2.35],[.15,-2.45],[1.95,-2.35],[3.75,-2.1]
].map(([x,y], id)=>({id,x,y}));
const anchorMeshes=[]; const hitTargets=[];
anchors.forEach(a=>{ const ring=mesh(new THREE.TorusGeometry(.18,.055,10,20),new THREE.MeshStandardMaterial({color:'#f5f6ff',emissive:'#94c8f5',emissiveIntensity:.8}),a.x,a.y,.42); ring.userData.anchor=a; anchorMeshes.push(ring); hitTargets.push(ring); const core=sphere(.095,new THREE.MeshStandardMaterial({color:'#fff7cf',emissive:'#fff0a0',emissiveIntensity:1.1}),a.x,a.y,.43); core.userData.anchor=a; hitTargets.push(core); });

const bridgeGroup=new THREE.Group(); scene.add(bridgeGroup); const members=[]; let selected=null; let testing=false; let bus; let busStart=performance.now();
function hasMember(a,b){ return members.some(m=>(m.a===a&&m.b===b)||(m.a===b&&m.b===a)); }
function addBeam(a,b){ if(a===b||hasMember(a,b)) return; members.push({a,b}); renderBridge(); updateMeter(); }
function beam(a,b,material=wood){ const ax=anchors[a], bx=anchors[b], dx=bx.x-ax.x,dy=bx.y-ax.y,len=Math.hypot(dx,dy); const g=new THREE.CylinderGeometry(.105,.105,len,12); const m=new THREE.Mesh(g,material); m.castShadow=true;m.receiveShadow=true; m.position.set((ax.x+bx.x)/2,(ax.y+bx.y)/2,.28); m.rotation.z=-Math.atan2(dx,dy); bridgeGroup.add(m); const cap1=new THREE.Mesh(new THREE.SphereGeometry(.14,14,10),woodEnd);cap1.position.set(ax.x,ax.y,.3);cap1.castShadow=true;bridgeGroup.add(cap1); const cap2=cap1.clone();cap2.position.set(bx.x,bx.y,.3);bridgeGroup.add(cap2); }
function renderBridge(){ bridgeGroup.clear(); members.forEach(m=>beam(m.a,m.b, anchors[m.a].y > -.4 && anchors[m.b].y > -.4 ? pink : wood)); }
function roadComplete(){ return [0,1,2,3,4,5,6].every((id,i,arr)=>i===0||hasMember(arr[i-1],id)); }
function triangulations(){ return members.filter(m=>Math.abs(anchors[m.a].y-anchors[m.b].y)>.35).length; }
function strength(){ const road=roadComplete()?42:0; const tris=Math.min(44,triangulations()*7); const braces=Math.min(14,members.filter(m=>Math.abs(anchors[m.a].x-anchors[m.b].x)>2.8).length*3); return Math.min(100,road+tris+braces); }
function updateMeter(){ const v=strength();meterFill.style.width=`${v}%`;meterLabel.textContent=`${v}%`; if(!testing) instruction.textContent=selected===null?'Atinge două puncte luminoase pentru a pune o grindă.':'Alege al doilea punct pentru a uni grinda.'; }
function clearSelected(){ selected=null; anchorMeshes.forEach(m=>m.material.emissive.set('#94c8f5')); }
function notify(text){ toast.textContent=text; toast.classList.add('show'); clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove('show'),2600); }
function selectAnchor(a){ if(testing)return; if(selected===null){selected=a.id; anchorMeshes.find(m=>m.userData.anchor.id===a.id).material.emissive.set('#ffbf75');updateMeter();return;} addBeam(selected,a.id);clearSelected(); }
canvas.addEventListener('pointerdown',e=>{ const r=canvas.getBoundingClientRect();pointer.x=(e.clientX-r.left)/r.width*2-1;pointer.y=-(e.clientY-r.top)/r.height*2+1;raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(hitTargets)[0];if(hit)selectAnchor(hit.object.userData.anchor); });
undoButton.onclick=()=>{if(!testing&&members.length){members.pop();renderBridge();updateMeter();}}; clearButton.onclick=()=>{if(!testing){members.splice(0);renderBridge();clearSelected();updateMeter();}};

function buildBus(){ const g=new THREE.Group(); g.position.set(-7.6,-.02,.65); const body=new THREE.Mesh(new THREE.BoxGeometry(2.65,.8,.7),yellow);body.position.y=.2;body.castShadow=true;g.add(body); const hood=new THREE.Mesh(new THREE.BoxGeometry(.45,.45,.68),yellow);hood.position.set(1.48,.02,0);hood.castShadow=true;g.add(hood); const roof=new THREE.Mesh(new THREE.BoxGeometry(2.1,.18,.74),yellow);roof.position.set(-.15,.67,0);roof.castShadow=true;g.add(roof);
 for(let i=0;i<5;i++){const win=new THREE.Mesh(new THREE.BoxGeometry(.32,.3,.018),glass);win.position.set(-.85+i*.4,.34,.36);g.add(win);} const windshield=new THREE.Mesh(new THREE.BoxGeometry(.23,.33,.018),glass);windshield.position.set(1.23,.3,.36);g.add(windshield);
 for(const x of [-.75,1.05]){ const tire=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.16,18),black);tire.rotation.x=Math.PI/2;tire.position.set(x,-.25,.02);tire.castShadow=true;g.add(tire);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.17,14),cream);hub.rotation.x=Math.PI/2;hub.position.set(x,-.25,.02);g.add(hub); }
 const sign=new THREE.Mesh(roundRect(.65,.18,.05),red);sign.position.set(-.1,.9,.37);g.add(sign); const lamp=sphere(.06,new THREE.MeshStandardMaterial({color:'#fff5a5',emissive:'#fff5a5',emissiveIntensity:1}),1.68,.05,.37);g.add(lamp); return g; }
function bridgeReady(){return roadComplete()&&triangulations()>=5&&strength()>=78;}
testButton.onclick=()=>{ if(testing)return; if(!bridgeReady()){notify(roadComplete()?'Adaugă mai multe grinzi diagonale sub șosea!':'Mai întâi construiește o șosea roz continuă între cele două maluri.');return;} testing=true;clearSelected();bus=buildBus();scene.add(bus);busStart=performance.now();testButton.disabled=true;instruction.textContent='Autobuzul școlar testează podul…';notify('Ține pumnii pentru autobuz! 🚌'); };

function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false); const aspect=w/h; const size=10.5;camera.left=-size*aspect/2;camera.right=size*aspect/2;camera.top=size/2;camera.bottom=-size/2;camera.updateProjectionMatrix();} addEventListener('resize',resize);resize();
function animate(t){requestAnimationFrame(animate); anchorMeshes.forEach((m,i)=>{m.rotation.z=t*.0012*(i%2?1:-1);});if(testing&&bus){const p=Math.min(1,(t-busStart)/6100);bus.position.x=-7.6+p*15.4;bus.position.y=-.02+Math.sin(p*Math.PI*6)*.025;bus.rotation.z=Math.sin(p*Math.PI*4)*.014;if(p===1){testing=false;testButton.disabled=false;scene.remove(bus);bus=null;instruction.textContent='Pod reușit! Ai dus autobuzul în siguranță. Construiește iar pentru încă o rundă.';notify('BRAVO! Podul a trecut testul! ✨');}}
renderer.render(scene,camera);} updateMeter();animate(0);
