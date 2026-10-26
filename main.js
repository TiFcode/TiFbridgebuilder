import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js';
import { MTLLoader } from 'https://unpkg.com/three@0.161.0/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'https://unpkg.com/three@0.161.0/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'https://unpkg.com/three@0.161.0/examples/jsm/geometries/RoundedBoxGeometry.js';

const canvas = document.querySelector('#game');
const instruction = document.querySelector('#instruction');
const meterFill = document.querySelector('#meter-fill');
const meterLabel = document.querySelector('#meter-label');
const toast = document.querySelector('#toast');
const testButton = document.querySelector('#test');
const undoButton = document.querySelector('#undo');
const clearButton = document.querySelector('#clear');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#b9d9cf'); scene.fog = new THREE.Fog('#b9d9cf', 18, 42);
// The construction plane must remain legible.  This is a side-on game view,
// with just enough orbit/zoom for depth, rather than a free camera that lets
// the player accidentally look down the bridge and turn the piers into a wall.
const camera = new THREE.PerspectiveCamera(38, 1, .1, 100); camera.position.set(2.8, 2.5, 19.5);
const controls = new OrbitControls(camera, canvas); controls.target.set(0, -1.15, .15); controls.enableDamping=true; controls.dampingFactor=.07; controls.minDistance=12; controls.maxDistance=24; controls.maxPolarAngle=1.46; controls.minPolarAngle=1.20; controls.minAzimuthAngle=-.38; controls.maxAzimuthAngle=.38; controls.enablePan=false; controls.screenSpacePanning=true;
const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -.42);
const dragPoint = new THREE.Vector3();
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
function pbrTexture(url, repeat=[1,1]) { const t=textureLoader.load(url); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(...repeat); return t; }
function dataTexture(url, repeat=[1,1]) { const t=textureLoader.load(url); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(...repeat); return t; }

const mat = (color, extra={}) => new THREE.MeshStandardMaterial({ color, roughness: .7, ...extra });
const wood=mat('#cb8658',{map:pbrTexture('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_floor_deck/wood_floor_deck_diff_1k.jpg',[2,1]),normalMap:dataTexture('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_floor_deck/wood_floor_deck_nor_gl_1k.jpg',[2,1]),roughnessMap:dataTexture('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_floor_deck/wood_floor_deck_rough_1k.jpg',[2,1]),roughness:.58}), woodDark=mat('#87503d'), pink=mat('#ef8b9a'), cream=mat('#fff3d8'), yellow=mat('#f6bd3f'), black=mat('#17202c',{roughness:.34,metalness:.72}), glass=mat('#8dd4e8',{roughness:.12,metalness:.12,transparent:true,opacity:.76}), green=mat('#7cc78e'), leaf=mat('#69ae81'), mint=mat('#d7d3cd',{map:pbrTexture('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_diff_1k.jpg',[4,3]),normalMap:dataTexture('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_nor_gl_1k.jpg',[4,3]),roughnessMap:dataTexture('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_rough_1k.jpg',[4,3]),roughness:.82});
scene.add(new THREE.HemisphereLight('#fff3cd', '#6b8294', 2.7));
const sun = new THREE.DirectionalLight('#fff0b4', 3.3); sun.position.set(-8, 11, 10); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-13;sun.shadow.camera.right=13;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-9;scene.add(sun);
const rim = new THREE.DirectionalLight('#b9c8ff', 1.35);rim.position.set(8,5,4);scene.add(rim);
function add(g,m,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;}
function box(w,h,d,m,x=0,y=0,z=0){return add(new THREE.BoxGeometry(w,h,d),m,x,y,z)}
function sphere(r,m,x=0,y=0,z=0){return add(new THREE.SphereGeometry(r,20,14),m,x,y,z)}
function cyl(r,h,m,x=0,y=0,z=0,rot=0){const o=add(new THREE.CylinderGeometry(r,r,h,16),m,x,y,z);o.rotation.z=rot;return o}

// A toy-room diorama: window, desk, shelves, rug, books and little toys sit behind the bridge.
box(28,16,.25,mint,0,3.1,-2.5); box(28,.4,5,mat('#e6c9a6'),0,-4.1,.6);
for(let x=-13;x<=13;x+=2) box(.035,.025,4.4,mat('#c4a57e'),x,-3.9,.6);
// Window with warm late-afternoon light.
box(6.6,4.2,.11,cream,-6.8,3.25,-2.32); box(6.15,3.7,.12,mat('#b8e6f3'),-6.8,3.25,-2.19);box(.12,3.7,.14,cream,-6.8,3.25,-2.08);box(6.15,.12,.14,cream,-6.8,3.25,-2.08);sphere(.62,new THREE.MeshBasicMaterial({color:'#fff4bd'}),-8.3,4.2,-2.05);
for(let i=0;i<4;i++) sphere(.32+(i%2)*.09,new THREE.MeshBasicMaterial({color:'#f3fbff'}),-6+i*.36,4.2+(i%2)*.13,-2.02);
// Furniture and props are loaded below as authored PBR models; the room shell is deliberately the only built-in geometry.
// The bridge piers are loaded below as individual scanned book-set models, not colour blocks.
box(3.25,.28,1.1,pink,-5.65,-.42,.1);box(3.25,.28,1.1,pink,5.65,-.42,.1);
for(const x of [-6.9,-4.45,4.45,6.9]) cyl(.1,1.05,wood,x,-1.05,.22);

function sizeAndPlace(model, position, maxSize, rotation=[0,0,0]) { model.rotation.set(...rotation); model.updateMatrixWorld(true); const initial=new THREE.Box3().setFromObject(model), size=initial.getSize(new THREE.Vector3()); const factor=maxSize/Math.max(size.x,size.y,size.z,.001); model.scale.multiplyScalar(factor); model.updateMatrixWorld(true); const fitted=new THREE.Box3().setFromObject(model), center=fitted.getCenter(new THREE.Vector3()); model.position.set(position[0]-center.x,position[1]-fitted.min.y,position[2]-center.z); }
function loadPbrModel(url, position, maxSize=1, rotation=[0,0,0]) { gltfLoader.load(url, gltf=>{ const model=gltf.scene; sizeAndPlace(model,position,maxSize,rotation); model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true; if(o.material) o.material.envMapIntensity=1.15;}}); scene.add(model); }, undefined, err=>console.warn('Model PBR unavailable', err)); }
const ph='https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/';
loadPbrModel(`${ph}SchoolDesk_01/SchoolDesk_01_1k.gltf`, [6.2,-3.78,-.55], 2.4, [0,-.48,0]);
loadPbrModel(`${ph}SchoolChair_01/SchoolChair_01_1k.gltf`, [4.45,-3.78,.2], 1.65, [0,-.95,0]);
loadPbrModel(`${ph}Shelf_01/Shelf_01_1k.gltf`, [9.5,-3.78,-1.65], 2.55, [0,.48,0]);
loadPbrModel(`${ph}dirty_football/dirty_football_1k.gltf`, [-9.4,-3.77,.38], .55, [0,.4,0]);
// Exactly four oversized physical books: two below each end of the bridge.
// They use scanned Poly Haven book materials; the page block, raised cover,
// spine bands and page grooves make them read as books at phone scale instead
// of the old encyclopedia-set "palisade".
const bookTex='https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/decorative_book_set_01/';
const pageMat=mat('#ead9b7',{map:pbrTexture(`${bookTex}book_hardcover_01_diff_1k.jpg`,[1,1]),roughness:.78});
function bookMaterial(tint){ return new THREE.MeshStandardMaterial({color:tint,map:pbrTexture(`${bookTex}book_hardcover_01_cover23_1k.jpg`,[1,1]),roughness:.48,metalness:.02}); }
function addRealBook(x,y,z,tilt=0,tint='#a95354'){
  const g=new THREE.Group(); g.position.set(x,y,z); g.rotation.z=tilt; scene.add(g);
  const body=new THREE.Mesh(new RoundedBoxGeometry(3.72,1.55,.76,6,.10),pageMat); body.castShadow=body.receiveShadow=true; g.add(body);
  const cover=bookMaterial(tint);
  for(const yy of [-.83,.83]){const c=new THREE.Mesh(new RoundedBoxGeometry(3.93,.15,.91,5,.055),cover);c.position.y=yy;c.castShadow=c.receiveShadow=true;g.add(c);}
  const spine=new THREE.Mesh(new RoundedBoxGeometry(.18,1.72,.93,5,.055),cover);spine.position.x=-1.88;spine.castShadow=spine.receiveShadow=true;g.add(spine);
  for(const xx of [-1.12,-.3,.56,1.32]){const groove=new THREE.Mesh(new THREE.BoxGeometry(.018,1.40,.78),new THREE.MeshStandardMaterial({color:'#a99576',roughness:.85}));groove.position.set(xx,0,.01);g.add(groove);}
  return g;
}
addRealBook(-5.65,-3.02,.08,.035,'#a94c52'); addRealBook(-5.65,-1.42,.10,-.025,'#315d83');
addRealBook(5.65,-3.02,.08,-.035,'#3b7b72'); addRealBook(5.65,-1.42,.10,.025,'#c27a35');
// Only three loose books, deliberately kept off the construction space.
addRealBook(-8.3,-3.25,.18,.75,'#775383').scale.setScalar(.34); addRealBook(7.85,-3.52,.22,-.36,'#b34e55').scale.setScalar(.30); addRealBook(8.55,-3.50,.20,.08,'#315d83').scale.setScalar(.26);
loadPbrModel(`${ph}rubber_duck_toy/rubber_duck_toy_1k.gltf`, [-8.05,-3.78,-.35], .68, [0,.35,0]);
let busTemplate=null;
gltfLoader.load('https://static.poly.pizza/90875552-dda2-4f1c-868b-0c63971a8347.glb', gltf=>{busTemplate=gltf.scene;sizeAndPlace(busTemplate,[0,0,0],2.45,[0,Math.PI/2,0]);busTemplate.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});},undefined,err=>console.warn('Bus model unavailable',err));

// Every construction member has the same real-world length.  The lower row is
// positioned on an equilateral-triangle grid, so the player can make a proper
// truss without ever stretching a member.
const BEAM_LENGTH=1.5;
const BEAM_LENGTH_TOLERANCE=.09;
const anchors=[[-4.50,-.08],[-3.00,-.08],[-1.50,-.08],[0,-.08],[1.50,-.08],[3.00,-.08],[4.50,-.08],[-3.75,-1.379],[-2.25,-1.379],[-.75,-1.379],[.75,-1.379],[2.25,-1.379],[3.75,-1.379]].map(([x,y],id)=>({id,x,y}));
const anchorMeshes=[], hitTargets=[];
anchors.forEach(a=>{const tone=a.y>-.4?'#ffbe83':'#74d9c3';const ring=add(new THREE.TorusGeometry(.105,.029,10,18),new THREE.MeshStandardMaterial({color:'#fff7e7',emissive:tone,emissiveIntensity:.78,roughness:.25}),a.x,a.y,.48);ring.userData.anchor=a;anchorMeshes.push(ring);hitTargets.push(ring);const core=add(new THREE.SphereGeometry(.048,12,10),new THREE.MeshStandardMaterial({color:tone,emissive:tone,emissiveIntensity:1.1,roughness:.22}),a.x,a.y,.49);core.userData.anchor=a;hitTargets.push(core);});

const bridgeGroup=new THREE.Group();scene.add(bridgeGroup);const previewGroup=new THREE.Group();scene.add(previewGroup);
const members=[];let dragStart=null,dragging=false,testing=false,bus=null,simulation=null,lastFrame=0;
function hasMember(a,b){return members.some(m=>(m.a===a&&m.b===b)||(m.a===b&&m.b===a));}
function renderBeamPoints(group,A,B,material=wood,opacity=1,caps=true){const dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy);if(len<.02)return;const m=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,len,16),material.clone());m.material.transparent=opacity<1;m.material.opacity=opacity;m.position.set((A.x+B.x)/2,(A.y+B.y)/2,.42);m.rotation.z=-Math.atan2(dx,dy);m.castShadow=true;m.receiveShadow=true;group.add(m);if(caps)for(const p of [A,B]){const cap=new THREE.Mesh(new THREE.SphereGeometry(.13,16,12),woodDark);cap.position.set(p.x,p.y,.42);group.add(cap);}}
function renderBeam(group,a,b,material=wood,opacity=1){renderBeamPoints(group,anchors[a],anchors[b],material,opacity);}
function pointFor(id){return simulation?simulation.nodes[id].p:anchors[id];}
function renderBridge(){bridgeGroup.clear();const active=simulation?simulation.beams:members;active.filter(m=>!m.broken).forEach(m=>{const A=pointFor(m.a),B=pointFor(m.b);renderBeamPoints(bridgeGroup,A,B,anchors[m.a].y>-.4&&anchors[m.b].y>-.4?pink:wood);});}
function beamLength(a,b){return Math.hypot(anchors[a].x-anchors[b].x,anchors[a].y-anchors[b].y);}
function isFixedLengthBeam(a,b){return a!==b&&Math.abs(beamLength(a,b)-BEAM_LENGTH)<=BEAM_LENGTH_TOLERANCE;}
function addBeam(a,b){if(!isFixedLengthBeam(a,b)||hasMember(a,b))return false;members.push({a,b});renderBridge();updateMeter();return true;}
function roadComplete(){return [0,1,2,3,4,5,6].every((id,i,row)=>i===0||hasMember(row[i-1],id));}
function triangulations(){return members.filter(m=>Math.abs(anchors[m.a].y-anchors[m.b].y)>.35).length;}
function updateMeter(health=null){if(health===null){meterFill.style.width='0%';meterLabel.textContent='SIM';}else{const n=Math.max(0,Math.min(100,Math.round(health)));meterFill.style.width=`${n}%`;meterLabel.textContent=`${n}%`;}if(!testing)instruction.textContent=dragStart===null?'Trage o bară de 1,50 spre un punct verde.':'Eliberează numai pe un punct verde ca să fixezi bara.';}
function notify(text){toast.textContent=text;toast.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove('show'),2600);}
function setPointer(e){const r=canvas.getBoundingClientRect();pointer.x=(e.clientX-r.left)/r.width*2-1;pointer.y=-(e.clientY-r.top)/r.height*2+1;raycaster.setFromCamera(pointer,camera);}
function anchorAt(e){ const rect=canvas.getBoundingClientRect(); let winner=null,best=44; for(const a of anchors){const v=new THREE.Vector3(a.x,a.y,.48).project(camera); const x=rect.left+(v.x+1)*rect.width/2,y=rect.top+(1-v.y)*rect.height/2,d=Math.hypot(e.clientX-x,e.clientY-y);if(d<best){best=d;winner=a;}} return winner; }
function pointAt(e){setPointer(e); return raycaster.ray.intersectPlane(dragPlane,dragPoint) ? dragPoint.clone() : null;}
function clearPreview(){previewGroup.clear();anchorMeshes.forEach(m=>m.material.emissive.set('#87c9fb'));}
function fixedEndFrom(a,freeEnd){const start=anchors[a],delta=new THREE.Vector2(freeEnd.x-start.x,freeEnd.y-start.y);if(delta.lengthSq()<.001)delta.set(1,0);delta.setLength(BEAM_LENGTH);return new THREE.Vector3(start.x+delta.x,start.y+delta.y,.42);}
function preview(a,freeEnd,target){previewGroup.clear();if(a===null||!freeEnd)return;const valid=target&&isFixedLengthBeam(a,target.id);const end=valid?new THREE.Vector3(target.x,target.y,.42):fixedEndFrom(a,freeEnd);const previewMat=mat(valid?'#73f3b0':'#ffcb72',{emissive:valid?'#29d98b':'#ff9e46',emissiveIntensity:.85,roughness:.35});renderBeamPoints(previewGroup,anchors[a],end,previewMat,.86,false);const cursor=new THREE.Mesh(new THREE.SphereGeometry(.14,18,14),new THREE.MeshStandardMaterial({color:valid?'#d6ffec':'#fff0c8',emissive:valid?'#47f2ad':'#ffb15e',emissiveIntensity:1.2,roughness:.24}));cursor.position.copy(end);cursor.position.z=.46;previewGroup.add(cursor);if(valid)anchorMeshes.filter(m=>m.userData.anchor.id===target.id).forEach(m=>m.material.emissive.set('#4ee9b0'));}
canvas.addEventListener('pointerdown',e=>{if(testing)return;const a=anchorAt(e);if(!a)return;dragStart=a.id;dragging=true;controls.enabled=false;canvas.setPointerCapture?.(e.pointerId);anchorMeshes.filter(m=>m.userData.anchor.id===a.id).forEach(m=>m.material.emissive.set('#ffbf75'));updateMeter();e.preventDefault();});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;clearPreview();const a=anchorAt(e);preview(dragStart,pointAt(e),a);});
function finishDrag(e){if(!dragging)return;const end=anchorAt(e);if(end&&isFixedLengthBeam(dragStart,end.id))addBeam(dragStart,end.id);else notify(`Bara are lungime fixă: ${BEAM_LENGTH.toFixed(2)}. Alege un punct verde.`);dragStart=null;dragging=false;controls.enabled=true;clearPreview();updateMeter();}
canvas.addEventListener('pointerup',finishDrag);canvas.addEventListener('pointercancel',finishDrag);
undoButton.onclick=()=>{if(!testing&&members.length){members.pop();renderBridge();updateMeter();}};clearButton.onclick=()=>{if(!testing){members.splice(0);renderBridge();clearPreview();dragStart=null;updateMeter();}};
function buildBus(){if(busTemplate){const g=busTemplate.clone(true);g.position.add(new THREE.Vector3(-6.3,.04,.68));return g;}const g=new THREE.Group();g.position.set(-6.3,.04,.76);const body=new THREE.Mesh(new THREE.BoxGeometry(2.45,.78,.72),yellow);body.position.y=.22;body.castShadow=true;g.add(body);const hood=new THREE.Mesh(new THREE.BoxGeometry(.42,.42,.68),yellow);hood.position.set(1.4,.03,0);hood.castShadow=true;g.add(hood);const roof=new THREE.Mesh(new THREE.BoxGeometry(1.95,.17,.77),yellow);roof.position.set(-.12,.67,0);roof.castShadow=true;g.add(roof);for(let i=0;i<5;i++){const w=new THREE.Mesh(new THREE.BoxGeometry(.3,.28,.02),glass);w.position.set(-.84+i*.38,.34,.37);g.add(w);}for(const x of[-.72,1]){const t=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.16,18),black);t.rotation.x=Math.PI/2;t.position.set(x,-.24,.02);t.castShadow=true;g.add(t);const h=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.17,14),cream);h.rotation.x=Math.PI/2;h.position.set(x,-.24,.02);g.add(h);}const sign=new THREE.Mesh(new THREE.BoxGeometry(.62,.15,.02),mat('#e97370'));sign.position.set(-.1,.89,.38);g.add(sign);return g;}
function bridgeReady(){return roadComplete();}
function startSimulation(){simulation={elapsed:0,maxStrain:0,failed:false,settle:0,nodes:anchors.map((a,id)=>({p:new THREE.Vector2(a.x,a.y),v:new THREE.Vector2(),fixed:id===0||id===6})),beams:members.map(m=>({a:m.a,b:m.b,rest:Math.hypot(anchors[m.a].x-anchors[m.b].x,anchors[m.a].y-anchors[m.b].y),broken:false}))};}
function structuralStep(dt){const s=simulation,n=s.nodes,forces=n.map(()=>new THREE.Vector2(0,-.34));const progress=Math.min(1,s.elapsed/9.4),busX=-4.28+progress*8.56;for(let i=0;i<6;i++){const A=n[i].p,B=n[i+1].p;if(busX>=Math.min(A.x,B.x)&&busX<=Math.max(A.x,B.x)){const u=(busX-A.x)/Math.max(.001,B.x-A.x);forces[i].y-=3.9*(1-u);forces[i+1].y-=3.9*u;break;}}for(const b of s.beams){if(b.broken)continue;const A=n[b.a],B=n[b.b],d=B.p.clone().sub(A.p),len=d.length(),strain=(len-b.rest)/b.rest; s.maxStrain=Math.max(s.maxStrain,Math.abs(strain));if(Math.abs(strain)>.145){b.broken=true;s.failed=true;continue;}const dir=d.multiplyScalar(1/Math.max(.001,len)),relative=B.v.clone().sub(A.v).dot(dir),force=dir.multiplyScalar((len-b.rest)*115+relative*2.8);if(!A.fixed)forces[b.a].add(force);if(!B.fixed)forces[b.b].sub(force);}for(let i=0;i<n.length;i++){const node=n[i];if(node.fixed){node.p.set(anchors[i].x,anchors[i].y);node.v.set(0,0);continue;}node.v.addScaledVector(forces[i],dt);node.v.multiplyScalar(Math.exp(-2.2*dt));node.p.addScaledVector(node.v,dt);}s.elapsed+=dt;for(let i=0;i<n.length;i++){anchorMeshes.filter(m=>m.userData.anchor.id===i).forEach(m=>m.position.set(n[i].p.x,n[i].p.y,m.position.z));}renderBridge();const health=s.failed?0:Math.max(0,100-s.maxStrain/.145*100);updateMeter(health);if(bus){let roadY=0;for(let i=0;i<6;i++){const A=n[i].p,B=n[i+1].p;if(busX>=Math.min(A.x,B.x)&&busX<=Math.max(A.x,B.x)){const u=(busX-A.x)/Math.max(.001,B.x-A.x);roadY=THREE.MathUtils.lerp(A.y,B.y,u);bus.position.x=busX;bus.position.y=roadY+.05;bus.rotation.z=Math.atan2(B.y-A.y,B.x-A.x);break;}}if(s.failed){bus.position.y-=dt*2.2;}}if(s.failed||s.elapsed>9.4){s.settle+=dt;if(s.settle>1.25)finishSimulation(!s.failed);}}
function finishSimulation(passed){testing=false;testButton.disabled=false;if(bus){scene.remove(bus);bus=null;}simulation=null;anchors.forEach((a,i)=>anchorMeshes.filter(m=>m.userData.anchor.id===i).forEach(m=>m.position.set(a.x,a.y,m.position.z)));renderBridge();instruction.textContent=passed?'Test trecut: deformarea a rămas în limite.':'Podul a cedat: adaugă triunghiuri şi testează din nou.';notify(passed?'Test fizic trecut! ✨':'Podul a cedat sub sarcina autobuzului.');updateMeter();}
testButton.onclick=()=>{if(testing)return;if(!bridgeReady()){notify('Unește mai întâi toate punctele roz ale șoselei.');return;}testing=true;clearPreview();startSimulation();bus=buildBus();scene.add(bus);testButton.disabled=true;instruction.textContent='Simulare structurală în timp real…';notify('Încărcare, deformare şi rupere a grinzilor active.');};
function resize(){const r=canvas.getBoundingClientRect(),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);window.visualViewport?.addEventListener('resize',resize);window.addEventListener('orientationchange',()=>setTimeout(resize,80));resize();
function animate(t){requestAnimationFrame(animate);const dt=Math.min(.033,(t-lastFrame||16)/1000);lastFrame=t;controls.update();if(!testing)anchorMeshes.forEach((m,i)=>m.rotation.z=t*.001*(i%2?1:-1));if(testing&&simulation)structuralStep(dt);renderer.render(scene,camera);}updateMeter();animate(0);
