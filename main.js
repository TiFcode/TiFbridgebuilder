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
// CC0 recordings from OpenGameArt (looneybits: start; domasx2: idle loop).
// Both are started directly from the Test button gesture so Safari permits
// playback; the loop is faded in only after the ignition has begun.
const engineStartSound = new Audio('assets/audio/engine-start.ogg');
const engineRunSound = new Audio('assets/audio/engine-idle-loop.ogg');
engineStartSound.preload = engineRunSound.preload = 'auto';
engineStartSound.volume = .38; engineRunSound.loop = true; engineRunSound.volume = 0;
let engineFadeTimer = 0, engineStartTimer = 0;
function stopBusAudio(){
  clearInterval(engineFadeTimer); clearTimeout(engineStartTimer); engineFadeTimer=engineStartTimer=0;
  engineStartSound.pause(); engineStartSound.currentTime=0;
  engineRunSound.pause(); engineRunSound.currentTime=0; engineRunSound.volume=0;
}
function startBusAudio(){
  stopBusAudio();
  // Calling play synchronously in this click path avoids iOS' autoplay gate.
  engineStartSound.play().catch(()=>{});
  engineRunSound.play().catch(()=>{});
  engineStartTimer=setTimeout(()=>{
    const target=.18;
    engineFadeTimer=setInterval(()=>{
      engineRunSound.volume=Math.min(target,engineRunSound.volume+.018);
      if(engineRunSound.volume>=target) { clearInterval(engineFadeTimer); engineFadeTimer=0; }
    },80);
  },900);
}

// iOS Safari will terminate a page that grows its WebGL allocation during an
// animation.  Keep a deliberately modest, fixed rendering budget on phones.
const isMobile = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.32;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#78c9e8'); scene.fog = new THREE.Fog('#78c9e8', 26, 58);
// The construction plane must remain legible.  This is a side-on game view,
// with just enough orbit/zoom for depth, rather than a free camera that lets
// the player accidentally look down the bridge and turn the piers into a wall.
const camera = new THREE.PerspectiveCamera(38, 1, .1, 100); camera.position.set(2.8, 2.5, 19.5);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, -1.15, .15);
controls.enableDamping=true; controls.dampingFactor=.07;
// Keep the construction plane usable, but let the player actually inspect the
// playroom: broad orbit, close/far zoom, and genuine pan are all available.
controls.minDistance=5.5; controls.maxDistance=21.5;
controls.minPolarAngle=.28; controls.maxPolarAngle=2.62;
controls.enablePan=true; controls.panSpeed=1.05; controls.screenSpacePanning=true;
controls.zoomSpeed=1.2; controls.rotateSpeed=.9;
const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -.42);
const dragPoint = new THREE.Vector3();
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
function pbrTexture(url, repeat=[1,1]) { const t=textureLoader.load(url); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(...repeat); return t; }
function dataTexture(url, repeat=[1,1]) { const t=textureLoader.load(url); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(...repeat); return t; }

const mat = (color, extra={}) => new THREE.MeshStandardMaterial({ color, roughness: .7, ...extra });
const wood=mat('#d97b36',{map:pbrTexture('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_floor_deck/wood_floor_deck_diff_1k.jpg',[2,1]),normalMap:dataTexture('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_floor_deck/wood_floor_deck_nor_gl_1k.jpg',[2,1]),roughnessMap:dataTexture('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_floor_deck/wood_floor_deck_rough_1k.jpg',[2,1]),roughness:.52}), woodDark=mat('#74351e'), pink=mat('#ff6684'), cream=mat('#fff3d8'), yellow=mat('#ffc62f'), black=mat('#17202c',{roughness:.34,metalness:.72}), glass=mat('#48ccef',{roughness:.12,metalness:.12,transparent:true,opacity:.76}), green=mat('#55d28a'), leaf=mat('#36bb74'), mint=mat('#ffb29e',{map:pbrTexture('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_diff_1k.jpg',[4,3]),normalMap:dataTexture('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_nor_gl_1k.jpg',[4,3]),roughnessMap:dataTexture('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_rough_1k.jpg',[4,3]),roughness:.72});
const asphalt=mat('#343b43',{map:pbrTexture('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_rocks_04/aerial_rocks_04_diff_1k.jpg',[2.5,1]),normalMap:dataTexture('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_rocks_04/aerial_rocks_04_nor_gl_1k.jpg',[2.5,1]),roughness:.82});
const concrete=mat('#aeb8bc',{roughness:.78});
scene.add(new THREE.HemisphereLight('#fff5c7', '#348cc4', 3.25));
const sun = new THREE.DirectionalLight('#fff0a8', 4.0); sun.position.set(-8, 11, 10); sun.castShadow=true; sun.shadow.mapSize.set(isMobile ? 1024 : 1536,isMobile ? 1024 : 1536); sun.shadow.camera.left=-22;sun.shadow.camera.right=22;sun.shadow.camera.top=14;sun.shadow.camera.bottom=-11;scene.add(sun);
const rim = new THREE.DirectionalLight('#b9c8ff', 1.35);rim.position.set(8,5,4);scene.add(rim);
function add(g,m,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;}
function box(w,h,d,m,x=0,y=0,z=0){return add(new THREE.BoxGeometry(w,h,d),m,x,y,z)}
function sphere(r,m,x=0,y=0,z=0){return add(new THREE.SphereGeometry(r,20,14),m,x,y,z)}
function cyl(r,h,m,x=0,y=0,z=0,rot=0){const o=add(new THREE.CylinderGeometry(r,r,h,16),m,x,y,z);o.rotation.z=rot;return o}

// A full playroom recedes behind the bridge. The rear wall is deliberately far
// back; it is a room, not the old flat wall immediately behind the game.
box(56,16,.25,mint,0,3.1,-24); box(56,.4,48,mat('#efb765'),0,-4.1,-1);
box(.25,16,48,cream,-27.7,3.1,-1); box(.25,16,48,cream,27.7,3.1,-1);
for(let x=-27;x<=27;x+=2) box(.035,.025,47.4,mat('#ba7640'),x,-3.9,-1);
// Window with warm late-afternoon light, set into the distant rear wall.
box(6.6,4.2,.11,cream,-6.8,3.25,-23.82); box(6.15,3.7,.12,mat('#48d0f1'),-6.8,3.25,-23.69);box(.12,3.7,.14,cream,-6.8,3.25,-23.58);box(6.15,.12,.14,cream,-6.8,3.25,-23.58);sphere(.62,new THREE.MeshBasicMaterial({color:'#fff4bd'}),-8.3,4.2,-23.55);
for(let i=0;i<4;i++) sphere(.32+(i%2)*.09,new THREE.MeshBasicMaterial({color:'#f3fbff'}),-6+i*.36,4.2+(i%2)*.13,-23.52);
// Furniture and props are loaded below as authored PBR models; the room shell is deliberately the only built-in geometry.
// The bridge piers are loaded below as individual scanned book-set models, not colour blocks.
box(3.25,.28,1.1,pink,-5.65,-.42,.1);box(3.25,.28,1.1,pink,5.65,-.42,.1);
for(const x of [-6.9,-4.45,4.45,6.9]) cyl(.1,1.05,wood,x,-1.05,.22);

function sizeAndPlace(model, position, maxSize, rotation=[0,0,0]) { model.rotation.set(...rotation); model.updateMatrixWorld(true); const initial=new THREE.Box3().setFromObject(model), size=initial.getSize(new THREE.Vector3()); const factor=maxSize/Math.max(size.x,size.y,size.z,.001); model.scale.multiplyScalar(factor); model.updateMatrixWorld(true); const fitted=new THREE.Box3().setFromObject(model), center=fitted.getCenter(new THREE.Vector3()); model.position.set(position[0]-center.x,position[1]-fitted.min.y,position[2]-center.z); }
function loadPbrModel(url, position, maxSize=1, rotation=[0,0,0]) { gltfLoader.load(url, gltf=>{ const model=gltf.scene; sizeAndPlace(model,position,maxSize,rotation); model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true; if(o.material) o.material.envMapIntensity=1.15;}}); scene.add(model); }, undefined, err=>console.warn('Model PBR unavailable', err)); }
const ph='https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/';
loadPbrModel(`${ph}SchoolDesk_01/SchoolDesk_01_1k.gltf`, [6.2,-3.78,-5.6], 2.4, [0,-.48,0]);
loadPbrModel(`${ph}SchoolChair_01/SchoolChair_01_1k.gltf`, [4.45,-3.78,-4.55], 1.65, [0,-.95,0]);
loadPbrModel(`${ph}Shelf_01/Shelf_01_1k.gltf`, [9.5,-3.78,-7.7], 2.55, [0,.48,0]);
loadPbrModel(`${ph}dirty_football/dirty_football_1k.gltf`, [-9.4,-3.77,-2.5], .55, [0,.4,0]);
loadPbrModel(`${ph}dirty_football/dirty_football_1k.gltf`, [1.9,-3.78,-6.8], .42, [0,-.8,0]);
loadPbrModel(`${ph}rubber_duck_toy/rubber_duck_toy_1k.gltf`, [-2.9,-3.78,-6.7], .7, [0,-.45,0]);
loadPbrModel(`${ph}rubber_duck_toy/rubber_duck_toy_1k.gltf`, [10.4,-3.78,-4.4], .52, [0,.75,0]);
loadPbrModel(`${ph}rubber_duck_toy/rubber_duck_toy_1k.gltf`, [-12.7,-3.78,-8.5], .62, [0,-.9,0]);
loadPbrModel(`${ph}rubber_duck_toy/rubber_duck_toy_1k.gltf`, [13.3,-3.78,-10.8], .58, [0,.1,0]);
loadPbrModel(`${ph}dirty_football/dirty_football_1k.gltf`, [-3.8,-3.78,-10.9], .48, [0,.7,0]);
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
loadPbrModel(`${ph}rubber_duck_toy/rubber_duck_toy_1k.gltf`, [-8.05,-3.78,-3.6], .68, [0,.35,0]);
let busTemplate=null;
gltfLoader.load('https://static.poly.pizza/90875552-dda2-4f1c-868b-0c63971a8347.glb', gltf=>{
  busTemplate=gltf.scene;
  // Inspecting the actual GLB bounds shows its long axis is local Y and its
  // vertical axis is local Z (not Three.js' usual Y-up convention).  Map
  // Y → world X (the road) and Z → world Y (up) in one immutable model-space
  // transform.  A yaw alone left the bus' length pointing upward.
  sizeAndPlace(busTemplate,[0,0,0],2.45,[-Math.PI/2,0,-Math.PI/2]);
  busTemplate.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
},undefined,err=>console.warn('Bus model unavailable',err));

// Every construction member has the same real-world length.  The lower row is
// positioned on an equilateral-triangle grid, so the player can make a proper
// truss without ever stretching a member.
const BEAM_LENGTH=1.5;
const BEAM_LENGTH_TOLERANCE=.09;
const ROAD_HALF_WIDTH=1.42, TRUSS_Z=1.54;
const anchors=[[-4.50,-.08],[-3.00,-.08],[-1.50,-.08],[0,-.08],[1.50,-.08],[3.00,-.08],[4.50,-.08],[-3.75,-1.379],[-2.25,-1.379],[-.75,-1.379],[.75,-1.379],[2.25,-1.379],[3.75,-1.379]].map(([x,y],id)=>({id,x,y}));
const anchorMeshes=[], hitTargets=[];
anchors.forEach(a=>{const tone=a.y>-.4?'#ffbe83':'#74d9c3';const ring=add(new THREE.TorusGeometry(.105,.029,10,18),new THREE.MeshStandardMaterial({color:'#fff7e7',emissive:tone,emissiveIntensity:.78,roughness:.25}),a.x,a.y,TRUSS_Z+.03);ring.userData.anchor=a;anchorMeshes.push(ring);hitTargets.push(ring);const core=add(new THREE.SphereGeometry(.048,12,10),new THREE.MeshStandardMaterial({color:tone,emissive:tone,emissiveIntensity:1.1,roughness:.22}),a.x,a.y,TRUSS_Z+.04);core.userData.anchor=a;hitTargets.push(core);});

const bridgeGroup=new THREE.Group();scene.add(bridgeGroup);const previewGroup=new THREE.Group();scene.add(previewGroup);
const deckGroup=new THREE.Group(); scene.add(deckGroup);
const members=[]; const roadDeckPieces=[];
let dragStart=null,dragging=false,brushMode=false,testing=false,bus=null,simulation=null,lastFrame=0,lastHeatRender=-Infinity,physicsAccumulator=0;
// The structural model is made of straight members, but a real bus has tyres
// and suspension: it does not teleport its chassis from one road joint angle
// to the next.  This state is deliberately visual-only; load placement still
// uses the exact physical nodes in structuralStep().
let busMotion=null;
const unitBeamGeometry=new THREE.CylinderGeometry(.105,.105,1,16);
const beamCapGeometry=new THREE.SphereGeometry(.13,16,12);
// Group.clear() only unlinks children.  It does *not* release their GPU
// buffers or cloned heatmap materials, which was the mobile Safari crash.
function clearRenderGroup(group){
  group.traverse(o=>{
    if(!o.isMesh)return;
    // Simulation meshes intentionally share these two geometries. They stay
    // alive for the page lifetime and are never reallocated during a test.
    if(o.geometry!==unitBeamGeometry&&o.geometry!==beamCapGeometry)o.geometry?.dispose();
    const materials=Array.isArray(o.material)?o.material:[o.material];
    materials.forEach(m=>m?.dispose());
  });
  group.clear();
}
function hasMember(a,b){return members.some(m=>(m.a===a&&m.b===b)||(m.a===b&&m.b===a));}
function renderBeamPoints(group,A,B,material=wood,opacity=1,caps=true,z=TRUSS_Z){const dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy);if(len<.02)return;const m=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,len,16),material.clone());m.material.transparent=opacity<1;m.material.opacity=opacity;m.position.set((A.x+B.x)/2,(A.y+B.y)/2,z);m.rotation.z=-Math.atan2(dx,dy);m.castShadow=true;m.receiveShadow=true;group.add(m);if(caps)for(const p of [A,B]){const cap=new THREE.Mesh(new THREE.SphereGeometry(.13,16,12),woodDark.clone());cap.position.set(p.x,p.y,z);group.add(cap);}}
function renderBeam(group,a,b,material=wood,opacity=1,z=TRUSS_Z){renderBeamPoints(group,anchors[a],anchors[b],material,opacity,true,z);}
function pointFor(id){return simulation?simulation.nodes[id].p:anchors[id];}
// This is deliberately a *display* range, not the structural failure range.
// A bridge that is safely carrying the bus should already show its load; red
// must not be reserved for the single frame immediately before a break.
const HEATMAP_VISUAL_RANGE=.032;
function heatIntensity(strain=0){return Math.pow(Math.min(1,Math.abs(strain)/HEATMAP_VISUAL_RANGE),.58);}
function heatMaterial(strain=0){
  // Blue = relaxed, yellow = working, red = heavily loaded. Axial tension is
  // constant along one member, therefore every section of that wooden member
  // receives the same physically meaningful stress colour.
  const intensity=heatIntensity(strain);
  const color=new THREE.Color().setHSL(THREE.MathUtils.lerp(.58,.0,intensity), .97, THREE.MathUtils.lerp(.43,.56,intensity));
  return new THREE.MeshStandardMaterial({color,emissive:color.clone().multiplyScalar(.42+intensity*.72),roughness:.32,metalness:.01});
}
function setHeatMaterial(material,strain=0){
  const intensity=heatIntensity(strain);
  material.color.setHSL(THREE.MathUtils.lerp(.58,.0,intensity),.97,THREE.MathUtils.lerp(.43,.56,intensity));
  material.emissive.copy(material.color).multiplyScalar(.42+intensity*.72);
}
function makeSimulationBeamView(beam){
  // One set of meshes/materials per member for the entire test.  Updating
  // transforms and colours is allocation-free, which also keeps Safari safe.
  const material=heatMaterial(0);
  const sides=[TRUSS_Z,-TRUSS_Z].map(z=>{const member=new THREE.Mesh(unitBeamGeometry,material);member.castShadow=member.receiveShadow=true;const capA=new THREE.Mesh(beamCapGeometry,material),capB=new THREE.Mesh(beamCapGeometry,material);capA.castShadow=capA.receiveShadow=capB.castShadow=capB.receiveShadow=true;bridgeGroup.add(member,capA,capB);return {member,capA,capB,z};});
  beam.view={sides,material};
}
function updateSimulationBeamView(beam){
  const A=pointFor(beam.a),B=pointFor(beam.b),dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy),view=beam.view;
  if(!view)return;
  view.sides.forEach(side=>{side.member.position.set((A.x+B.x)/2,(A.y+B.y)/2,side.z);side.member.rotation.z=-Math.atan2(dx,dy);side.member.scale.set(1,len,1);side.capA.position.set(A.x,A.y,side.z);side.capB.position.set(B.x,B.y,side.z);});
  setHeatMaterial(view.material,beam.strain);
}
function buildSimulationBridge(){
  clearRenderGroup(bridgeGroup);
  simulation.beams.filter(b=>!b.broken).forEach(makeSimulationBeamView);
  simulation.beams.filter(b=>!b.broken).forEach(updateSimulationBeamView);
}
function renderHeatBeam(group,A,B,strain){
  // An axial member has one physically uniform strain along its length; a
  // single heat-coloured beam is therefore both accurate and vastly cheaper
  // than rebuilding eight tiny cylinders every frame.
  renderBeamPoints(group,A,B,heatMaterial(strain));
}
function createRoadPiece(length, ghost=false){
  const group=new THREE.Group(); group.userData.length=length; group.userData.ghost=ghost;
  const slab=new THREE.Mesh(new THREE.BoxGeometry(length,.18,ROAD_HALF_WIDTH*2), ghost ? new THREE.MeshStandardMaterial({color:'#bfd6db',transparent:true,opacity:.34,roughness:.7}) : asphalt.clone());
  slab.position.y=.03; slab.castShadow=slab.receiveShadow=!ghost; group.add(slab);
  const curbMat=ghost ? new THREE.MeshStandardMaterial({color:'#f1ffff',transparent:true,opacity:.42}) : mat('#edf4ee',{roughness:.48});
  for(const z of [-ROAD_HALF_WIDTH-.035,ROAD_HALF_WIDTH+.035]){const curb=new THREE.Mesh(new THREE.BoxGeometry(length,.13,.11),curbMat);curb.position.set(0,.17,z);curb.castShadow=curb.receiveShadow=!ghost;group.add(curb);}
  const stripeMat=ghost ? new THREE.MeshStandardMaterial({color:'#ffffff',transparent:true,opacity:.48}) : mat('#fff7d0',{roughness:.52});
  for(let d=-length*.32;d<=length*.32;d+=.45){const stripe=new THREE.Mesh(new THREE.BoxGeometry(.25,.018,.12),stripeMat);stripe.position.set(d,.135,0);stripe.receiveShadow=true;group.add(stripe);}
  const cross=new THREE.Mesh(new THREE.BoxGeometry(.10,.16,ROAD_HALF_WIDTH*2),ghost ? curbMat : concrete);cross.position.set(0,0,0);cross.castShadow=cross.receiveShadow=!ghost;group.add(cross);
  deckGroup.add(group); return group;
}
function placeRoadPiece(piece,A,B){
  const dx=B.x-A.x,dy=B.y-A.y,len=Math.max(.01,Math.hypot(dx,dy));
  piece.position.set((A.x+B.x)/2,(A.y+B.y)/2,0); piece.rotation.z=Math.atan2(dy,dx); piece.scale.x=len/piece.userData.length;
}
function renderRoadDeck(){
  clearRenderGroup(deckGroup); roadDeckPieces.length=0;
  // The pale deck is an intentional blueprint: the player immediately sees a
  // two-lane road to complete, instead of two unrelated stacks of books.
  // Once testing begins this guide must disappear. Every visible road slab
  // then comes from a pair of simulation nodes and bends with the structure.
  if(!testing){ const guide=createRoadPiece(9,true); placeRoadPiece(guide,{x:-4.5,y:-.08},{x:4.5,y:-.08}); guide.userData.guide=true; }
  for(let i=1;i<=6;i++)if(hasMember(i-1,i)){const piece=createRoadPiece(BEAM_LENGTH);placeRoadPiece(piece,anchors[i-1],anchors[i]);roadDeckPieces.push({piece,a:i-1,b:i});}
  if(roadComplete()){
    const left=createRoadPiece(1.16),right=createRoadPiece(1.16); placeRoadPiece(left,{x:-5.66,y:-.08},{x:-4.5,y:-.08});placeRoadPiece(right,{x:4.5,y:-.08},{x:5.66,y:-.08});
  }
}
function updateRoadDeck(){ if(!simulation)return; for(const entry of roadDeckPieces)placeRoadPiece(entry.piece,pointFor(entry.a),pointFor(entry.b)); }
function renderBridge(){clearRenderGroup(bridgeGroup);const active=simulation?simulation.beams:members;active.filter(m=>!m.broken).forEach(m=>{const A=pointFor(m.a),B=pointFor(m.b),material=simulation?heatMaterial(m.strain||0):(anchors[m.a].y>-.4&&anchors[m.b].y>-.4?pink:wood);renderBeamPoints(bridgeGroup,A,B,material,1,true,TRUSS_Z);renderBeamPoints(bridgeGroup,A,B,material,1,true,-TRUSS_Z);});renderRoadDeck();}
function beamLength(a,b){return Math.hypot(anchors[a].x-anchors[b].x,anchors[a].y-anchors[b].y);}
function isFixedLengthBeam(a,b){return a!==b&&Math.abs(beamLength(a,b)-BEAM_LENGTH)<=BEAM_LENGTH_TOLERANCE;}
function addBeam(a,b){if(!isFixedLengthBeam(a,b)||hasMember(a,b))return false;members.push({a,b});renderBridge();updateMeter();return true;}
function roadComplete(){return [0,1,2,3,4,5,6].every((id,i,row)=>i===0||hasMember(row[i-1],id));}
function triangulations(){return members.filter(m=>Math.abs(anchors[m.a].y-anchors[m.b].y)>.35).length;}
function updateMeter(health=null){if(health===null){meterFill.style.width='0%';meterLabel.textContent='SIM';}else{const n=Math.max(0,Math.min(100,Math.round(health)));meterFill.style.width=`${n}%`;meterLabel.textContent=`${n}%`;}if(!testing)instruction.textContent=brushMode?'Treci peste buline: barele compatibile apar automat.':'Treci cu degetul prin zona bulinelor pentru a construi.';}
function notify(text){toast.textContent=text;toast.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove('show'),2600);}
function setPointer(e){const r=canvas.getBoundingClientRect();pointer.x=(e.clientX-r.left)/r.width*2-1;pointer.y=-(e.clientY-r.top)/r.height*2+1;raycaster.setFromCamera(pointer,camera);}
function anchorAt(e){ const rect=canvas.getBoundingClientRect(); let winner=null,best=44; for(const a of anchors){const v=new THREE.Vector3(a.x,a.y,.48).project(camera); const x=rect.left+(v.x+1)*rect.width/2,y=rect.top+(1-v.y)*rect.height/2,d=Math.hypot(e.clientX-x,e.clientY-y);if(d<best){best=d;winner=a;}} return winner; }
function brushAt(e){
  const rect=canvas.getBoundingClientRect(); const nearby=[];
  for(const a of anchors){const v=new THREE.Vector3(a.x,a.y,.48).project(camera);const x=rect.left+(v.x+1)*rect.width/2,y=rect.top+(1-v.y)*rect.height/2;if(Math.hypot(e.clientX-x,e.clientY-y)<76)nearby.push(a.id);}
  // Fill every fixed-length member whose centre is under the wide fingertip.
  // This makes strokes in any direction build a local truss, not require pixel-perfect taps.
  for(let a=0;a<anchors.length;a++)for(let b=a+1;b<anchors.length;b++){
    if(!isFixedLengthBeam(a,b)||hasMember(a,b))continue;
    const A=anchors[a],B=anchors[b],v=new THREE.Vector3((A.x+B.x)/2,(A.y+B.y)/2,.48).project(camera);
    const x=rect.left+(v.x+1)*rect.width/2,y=rect.top+(1-v.y)*rect.height/2;
    if(nearby.includes(a)||nearby.includes(b)||Math.hypot(e.clientX-x,e.clientY-y)<54)addBeam(a,b);
  }
  if(nearby.length) anchorMeshes.filter(m=>nearby.includes(m.userData.anchor.id)).forEach(m=>m.material.emissive.set('#4ee9b0'));
}
function pointAt(e){setPointer(e); return raycaster.ray.intersectPlane(dragPlane,dragPoint) ? dragPoint.clone() : null;}
function clearPreview(){clearRenderGroup(previewGroup);anchorMeshes.forEach(m=>m.material.emissive.set('#87c9fb'));}
function fixedEndFrom(a,freeEnd){const start=anchors[a],delta=new THREE.Vector2(freeEnd.x-start.x,freeEnd.y-start.y);if(delta.lengthSq()<.001)delta.set(1,0);delta.setLength(BEAM_LENGTH);return new THREE.Vector3(start.x+delta.x,start.y+delta.y,.42);}
function preview(a,freeEnd,target){clearRenderGroup(previewGroup);if(a===null||!freeEnd)return;const valid=target&&isFixedLengthBeam(a,target.id);const end=valid?new THREE.Vector3(target.x,target.y,TRUSS_Z):fixedEndFrom(a,freeEnd);const previewMat=mat(valid?'#73f3b0':'#ffcb72',{emissive:valid?'#29d98b':'#ff9e46',emissiveIntensity:.85,roughness:.35});renderBeamPoints(previewGroup,anchors[a],end,previewMat,.86,false,TRUSS_Z);const cursor=new THREE.Mesh(new THREE.SphereGeometry(.14,18,14),new THREE.MeshStandardMaterial({color:valid?'#d6ffec':'#fff0c8',emissive:valid?'#47f2ad':'#ffb15e',emissiveIntensity:1.2,roughness:.24}));cursor.position.copy(end);cursor.position.z=TRUSS_Z+.04;previewGroup.add(cursor);if(valid)anchorMeshes.filter(m=>m.userData.anchor.id===target.id).forEach(m=>m.material.emissive.set('#4ee9b0'));}
canvas.addEventListener('pointerdown',e=>{if(testing)return;const a=anchorAt(e);if(!a)return;dragStart=a.id;dragging=true;brushMode=true;controls.enabled=false;canvas.setPointerCapture?.(e.pointerId);const p=pointAt(e);preview(dragStart,p,anchorAt(e));brushAt(e);updateMeter();e.preventDefault();});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;const p=pointAt(e);preview(dragStart,p,anchorAt(e));brushAt(e);});
function finishDrag(e){if(!dragging)return;brushAt(e);dragStart=null;dragging=false;brushMode=false;controls.enabled=true;clearPreview();updateMeter();}
canvas.addEventListener('pointerup',finishDrag);canvas.addEventListener('pointercancel',finishDrag);
undoButton.onclick=()=>{if(!testing&&members.length){members.pop();renderBridge();updateMeter();}};clearButton.onclick=()=>{if(!testing){members.splice(0);renderBridge();clearPreview();dragStart=null;updateMeter();}};
function buildBus(){const vehicle=new THREE.Group(); // Match the first applied load position: no frame-one jump into the bridge.
  vehicle.position.set(-4.28,.27,.58);if(busTemplate){const model=busTemplate.clone(true); /* The normalized asset lies on road axis X, but its bonnet points toward -X. It travels -X → +X, so flip only the visual child around the world-up axis. */ const forward=new THREE.Group(); forward.rotation.y=Math.PI; forward.add(model); vehicle.add(forward); return vehicle;}const body=new THREE.Mesh(new THREE.BoxGeometry(2.45,.78,.72),yellow);body.position.y=.22;body.castShadow=true;vehicle.add(body);const hood=new THREE.Mesh(new THREE.BoxGeometry(.42,.42,.68),yellow);hood.position.set(1.4,.03,0);hood.castShadow=true;vehicle.add(hood);const roof=new THREE.Mesh(new THREE.BoxGeometry(1.95,.17,.77),yellow);roof.position.set(-.12,.67,0);roof.castShadow=true;vehicle.add(roof);for(let i=0;i<5;i++){const w=new THREE.Mesh(new THREE.BoxGeometry(.3,.28,.02),glass);w.position.set(-.84+i*.38,.34,.37);vehicle.add(w);}for(const x of[-.72,1]){const t=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.16,18),black);t.rotation.x=Math.PI/2;t.position.set(x,-.24,.02);t.castShadow=true;vehicle.add(t);const h=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.17,14),cream);h.rotation.x=Math.PI/2;h.position.set(x,-.24,.02);vehicle.add(h);}const sign=new THREE.Mesh(new THREE.BoxGeometry(.62,.15,.02),mat('#e97370'));sign.position.set(-.1,.89,.38);vehicle.add(sign);return vehicle;}
function bridgeReady(){return roadComplete();}
function startSimulation(){
  lastHeatRender=-Infinity;
  physicsAccumulator=0;
  simulation={elapsed:0,maxStrain:0,failed:false,settle:0,nodes:anchors.map((a,id)=>({p:new THREE.Vector2(a.x,a.y),v:new THREE.Vector2(),fixed:id===0||id===6})),beams:members.map(m=>({a:m.a,b:m.b,rest:Math.hypot(anchors[m.a].x-anchors[m.b].x,anchors[m.a].y-anchors[m.b].y),strain:0,broken:false,view:null}))};
  buildSimulationBridge();
  // Remove the construction blueprint and rebuild the actual deck from the
  // simulated nodes before the first physics step.
  renderRoadDeck();
}
function sampleBusRoad(nodes, x){
  // Catmull-Rom interpolation makes the chassis follow the continuous tyre
  // path over neighbouring road slabs. The deck itself remains the exact
  // member-based geometry used by the solver.
  const scaled=THREE.MathUtils.clamp((x+4.5)/1.5,0,6), i=Math.min(5,Math.floor(scaled)), u=scaled-i;
  const y0=nodes[Math.max(0,i-1)].p.y, y1=nodes[i].p.y, y2=nodes[i+1].p.y, y3=nodes[Math.min(6,i+2)].p.y;
  const u2=u*u,u3=u2*u;
  const y=.5*((2*y1)+(-y0+y2)*u+(2*y0-5*y1+4*y2-y3)*u2+(-y0+3*y1-3*y2+y3)*u3);
  const dydu=.5*((-y0+y2)+2*(2*y0-5*y1+4*y2-y3)*u+3*(-y0+3*y1-3*y2+y3)*u2);
  return {y, angle:Math.atan2(dydu/1.5,1)};
}
function structuralStep(dt){const s=simulation,n=s.nodes,forces=n.map(()=>new THREE.Vector2(0,-.34));const progress=Math.min(1,s.elapsed/9.4),busX=-4.28+progress*8.56;for(let i=0;i<6;i++){const A=n[i].p,B=n[i+1].p;if(busX>=Math.min(A.x,B.x)&&busX<=Math.max(A.x,B.x)){const u=(busX-A.x)/Math.max(.001,B.x-A.x);forces[i].y-=3.9*(1-u);forces[i+1].y-=3.9*u;break;}}for(const b of s.beams){if(b.broken)continue;const A=n[b.a],B=n[b.b],d=B.p.clone().sub(A.p),len=d.length(),strain=(len-b.rest)/b.rest;b.strain=strain;s.maxStrain=Math.max(s.maxStrain,Math.abs(strain));if(Math.abs(strain)>.145){b.broken=true;s.failed=true;if(b.view){b.view.sides.forEach(side=>bridgeGroup.remove(side.member,side.capA,side.capB));b.view.material.dispose();}continue;}const dir=d.multiplyScalar(1/Math.max(.001,len)),relative=B.v.clone().sub(A.v).dot(dir),force=dir.multiplyScalar((len-b.rest)*115+relative*2.8);if(!A.fixed)forces[b.a].add(force);if(!B.fixed)forces[b.b].sub(force);}for(let i=0;i<n.length;i++){const node=n[i];if(node.fixed){node.p.set(anchors[i].x,anchors[i].y);node.v.set(0,0);continue;}node.v.addScaledVector(forces[i],dt);node.v.multiplyScalar(Math.exp(-2.2*dt));node.p.addScaledVector(node.v,dt);}s.elapsed+=dt;for(let i=0;i<n.length;i++){anchorMeshes.filter(m=>m.userData.anchor.id===i).forEach(m=>m.position.set(n[i].p.x,n[i].p.y,m.position.z));}updateRoadDeck();if(s.elapsed-lastHeatRender>1/20){s.beams.filter(b=>!b.broken).forEach(updateSimulationBeamView);lastHeatRender=s.elapsed;}const health=s.failed?0:Math.max(0,100-s.maxStrain/.145*100);updateMeter(health);if(bus){const road=sampleBusRoad(n,busX);if(!busMotion)busMotion={x:busX,y:road.y+.31,angle:road.angle};busMotion.x=THREE.MathUtils.damp(busMotion.x,busX,18,dt);busMotion.y=THREE.MathUtils.damp(busMotion.y,road.y+.31,13,dt);busMotion.angle=THREE.MathUtils.damp(busMotion.angle,road.angle,11,dt);bus.position.set(busMotion.x,busMotion.y,.58);bus.rotation.z=busMotion.angle;if(s.failed)bus.position.y-=dt*2.2;}if(s.failed||s.elapsed>9.4){s.settle+=dt;if(s.settle>1.25)finishSimulation(!s.failed);}}
function finishSimulation(passed){testing=false;testButton.disabled=false;stopBusAudio();if(bus){scene.remove(bus);bus=null;}busMotion=null;simulation=null;anchors.forEach((a,i)=>anchorMeshes.filter(m=>m.userData.anchor.id===i).forEach(m=>m.position.set(a.x,a.y,m.position.z)));renderBridge();instruction.textContent=passed?'Test trecut: deformarea a rămas în limite.':'Podul a cedat: adaugă triunghiuri şi testează din nou.';notify(passed?'Test fizic trecut! ✨':'Podul a cedat sub sarcina autobuzului.');updateMeter();}
testButton.onclick=()=>{if(testing)return;if(!bridgeReady()){notify('Unește mai întâi toate punctele roz ale șoselei.');return;}testing=true;clearPreview();startSimulation();bus=buildBus();scene.add(bus);startBusAudio();testButton.disabled=true;instruction.textContent='Simulare structurală în timp real…';notify('Încărcare, deformare şi rupere a grinzilor active.');};
function resize(){const r=canvas.getBoundingClientRect(),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);window.visualViewport?.addEventListener('resize',resize);window.addEventListener('orientationchange',()=>setTimeout(resize,80));resize();
let webglLost=false;
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();webglLost=true;testing=false;testButton.disabled=false;instruction.textContent='Motorul grafic s-a oprit. Reîncarcă pagina pentru a continua.';notify('WebGL a rămas fără resurse; reîncarcă pagina.');});
canvas.addEventListener('webglcontextrestored',()=>{webglLost=false;renderBridge();});
function animate(t){requestAnimationFrame(animate);if(webglLost)return;const dt=Math.min(.033,(t-lastFrame||16)/1000);lastFrame=t;controls.update();if(!testing)anchorMeshes.forEach((m,i)=>m.rotation.z=t*.001*(i%2?1:-1));if(testing&&simulation){physicsAccumulator=Math.min(physicsAccumulator+dt,.05);while(physicsAccumulator>=1/120&&testing&&simulation){structuralStep(1/120);physicsAccumulator-=1/120;}}renderer.render(scene,camera);}renderBridge();updateMeter();animate(0);
