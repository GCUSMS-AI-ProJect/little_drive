import * as THREE from './vendor/three-r180/three.module.min.js';

function blockHead(){
 // Six tiny pixel faces share one atlas and one draw call. No image download.
 const width=48,size=8,pixels=new Uint8Array(width*size*4),skin=[204,155,115],hair=[75,51,39];
 for(let face=0;face<6;face++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let rgb=skin;
  if(face===2||face===4&&y<6||face<2&&(y<3||x<2)||face===5&&(y<2||y===2&&(x===0||x===7)))rgb=hair;
  if(face===5){if(y===4&&(x===1||x===2||x===5||x===6))rgb=x===2||x===5?[66,88,109]:[244,240,226];if(y===5&&(x===3||x===4))rgb=[166,112,78];if(y===6&&x>=2&&x<=5)rgb=x===3||x===4?[139,81,64]:hair;}
  const offset=((size-1-y)*width+face*size+x)*4;pixels.set([...rgb,255],offset);
 }
 const texture=new THREE.DataTexture(pixels,width,size);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 const geometry=new THREE.BoxGeometry(1,1,1),uv=geometry.attributes.uv;
 for(let i=0;i<uv.count;i++){const face=Math.floor(i/4);uv.setXY(i,(face*size+.1+uv.getX(i)*7.8)/width,(.1+uv.getY(i)*7.8)/size);}
 return {geometry,material:new THREE.MeshLambertMaterial({map:texture})};
}

// Small reusable pools: no new geometry, objects or timers during animation.
export function createTraffic(scene,materials,box){
 const layer=new THREE.Group();scene.add(layer);
 const crossings=[];
 for(const z of [-10,10]){
  for(const offset of [-4.7,4.7]){crossings.push({z:z+offset});for(let x=-3.5;x<=3.5;x+=1)box(.55,.018,1.5,materials.line,x,.043,z+offset);}
  for(const x of [-16,0,16])for(const side of [-1,1]){if(x!==0&&Math.sign(x)===side)continue;for(let stripe=-2.8;stripe<=2.8;stripe+=.8)box(1.5,.018,.45,materials.line,x+side*5,.043,z+stripe);}
 }
 const lampGeometry=new THREE.SphereGeometry(.12,8,6),lampMatrix=new THREE.Matrix4();
 const lights={};
 for(const axis of ['ns','ew']){
  lights[axis]=['red','amber','green'].map(()=>new THREE.MeshBasicMaterial({color:0x29302b}));
  for(let bulb=0;bulb<3;bulb++){
   const mesh=new THREE.InstancedMesh(lampGeometry,lights[axis][bulb],12);layer.add(mesh);let i=0;
   for(const z of [-10,10])for(const x of [-16,0,16]){
    const px=x+(x===16?-4.5:4.5),pz=z+(z<0?-4.3:4.3);
    // The two heads face perpendicular approaches; both sides have visible lamps.
    const hx=px+(axis==='ew'?.8:0),hz=pz+(axis==='ns'?.65:0);
    if(bulb===0){box(.1,3.7,.1,materials.stone,hx,1.85,hz);box(axis==='ew'?.3:.42,1,axis==='ew'?.42:.3,materials.dark,hx,3.35,hz);}
    for(const face of [-1,1]){lampMatrix.makeTranslation(hx+(axis==='ew'?face*.19:0),3.63-bulb*.28,hz+(axis==='ns'?face*.19:0));mesh.setMatrixAt(i++,lampMatrix);}
   }mesh.instanceMatrix.needsUpdate=true;
  }
 }
 const geometry=new THREE.BoxGeometry(1,1,1),part=new THREE.Object3D(),root=new THREE.Object3D(),matrix=new THREE.Matrix4();
 const batch=(geo,material,count)=>{const mesh=new THREE.InstancedMesh(geo,material,count);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;layer.add(mesh);return mesh;};
 const paint=batch(geometry,new THREE.MeshLambertMaterial({color:0xffffff}),2),cab=batch(geometry,materials.window,2),chassis=batch(geometry,materials.dark,2),wheels=batch(new THREE.CylinderGeometry(.31,.31,.2,10),materials.wheel,8),front=batch(geometry,new THREE.MeshBasicMaterial({color:0xffefc9}),4),rear=batch(geometry,new THREE.MeshBasicMaterial({color:0xac6657}),4);
 const head=blockHead(),shirts=batch(geometry,new THREE.MeshLambertMaterial({color:0xffffff}),9),legs=batch(geometry,new THREE.MeshLambertMaterial({color:0xffffff}),12),heads=batch(head.geometry,head.material,3),hands=batch(geometry,new THREE.MeshLambertMaterial({color:0xcc9b73}),6);
 const color=new THREE.Color(),carColors=[0x78919e,0xb98e76,0x929b80],shirtColors=[0x36a6aa,0x9875ba,0xa5af71],pantsColors=[0x4c5e93,0x53526c,0x626b59];
 for(let i=0;i<3;i++){for(let j=0;j<3;j++)shirts.setColorAt(i*3+j,color.set(shirtColors[i]));for(let j=0;j<4;j++)legs.setColorAt(i*4+j,color.set(j<2?pantsColors[i]:0x423c38));}
 const cars=Array.from({length:2},(_,i)=>({active:false,wait:i===0?1:5,x:0,z:0,direction:1,speed:0,roll:0,stopped:false}));
 const people=Array.from({length:3},(_,i)=>({active:false,wait:1+i*2,x:0,z:0,direction:1,speed:0,walking:false,distance:0,stage:'waiting',crossingZ:0,sidewalkDirection:1,leavingDistance:0}));
 function chooseCrossing(person){let selected=crossings[0],count=0;for(const crossing of crossings){if(people.some(other=>other!==person&&other.active&&Math.abs(other.crossingZ-crossing.z)<.6))continue;count++;if(Math.random()<1/count)selected=crossing;}return selected.z;}
 let elapsed=0,phase=-1,ns='red',ew='red';
 function setPart(mesh,index,x,y,z,w,h,d,rx=0,rz=0){part.position.set(x,y,z);part.rotation.set(rx,0,rz);part.scale.set(w,h,d);part.updateMatrix();matrix.multiplyMatrices(root.matrix,part.matrix);mesh.setMatrixAt(index,matrix);}
 function signal(value,axis){lights[axis].forEach((material,i)=>material.color.set(value===['red','amber','green'][i]?[0xef6054,0xf0b94e,0x68c990][i]:0x29302b));}
 function update(dt,player){
  elapsed+=dt;const cycle=elapsed%40,nextPhase=cycle<12?0:cycle<14?1:cycle<16?2:cycle<28?3:cycle<30?4:5;
  if(nextPhase!==phase){phase=nextPhase;ns=phase===0?'green':phase===1?'amber':'red';ew=phase===3?'green':phase===4?'amber':'red';signal(ns,'ns');signal(ew,'ew');}
  cars.forEach((car,i)=>{
   if(!car.active){car.wait-=dt;if(car.wait<=0){car.active=true;car.direction=Math.random()<.5?1:-1;car.z=(Math.random()<.5?-10:10)-car.direction*1.65;car.x=i===0?-car.direction*(7+Math.random()*2):-car.direction*23;car.speed=2.1+Math.random()*.6;car.roll=0;paint.setColorAt(i,color.set(carColors[Math.floor(Math.random()*carColors.length)]));}}
   let movement=0;car.stopped=false;
   if(car.active){movement=car.speed*dt;
    if(ew!=='green')for(const junction of [-16,0,16]){const stop=junction-car.direction*6.2,distance=(stop-car.x)*car.direction;if(distance>=-.02&&distance<movement+.02){movement=Math.max(0,distance);car.stopped=true;}}
    if(Math.abs(player.z-car.z)<2.2){const gap=(player.x-car.x)*car.direction;if(gap>0&&gap<3.8){movement=0;car.stopped=true;}}
    car.x+=movement*car.direction;car.roll-=movement/.31;if(Math.abs(car.x)>24){car.active=false;car.wait=4+Math.random()*8;}
   }
   root.position.set(car.x,0,car.z);root.rotation.set(0,-car.direction*Math.PI/2,0);root.scale.setScalar(car.active?1:0);root.updateMatrix();
   setPart(paint,i,0,.69,0,1.6,.48,2.85);setPart(cab,i,0,1.18,.1,1.25,.53,1.4);setPart(chassis,i,0,.39,0,1.5,.18,2.75);
   for(let j=0;j<4;j++)setPart(wheels,i*4+j,j<2?-.85:.85,.32,j%2? .85:-.85,1,1,1,car.roll,Math.PI/2);
   for(let j=0;j<2;j++){setPart(front,i*2+j,j? .5:-.5,.76,-1.44,.25,.13,.035);setPart(rear,i*2+j,j? .5:-.5,.76,1.44,.25,.11,.035);}
  });
  people.forEach((person,i)=>{
   if(!person.active){person.wait-=dt;if(person.wait<=0){person.active=true;person.stage='approach';person.direction=Math.random()<.5?1:-1;person.sidewalkDirection=Math.random()<.5?1:-1;person.x=-person.direction*5.3;person.crossingZ=chooseCrossing(person)+(Math.random()-.5)*.45;person.z=person.crossingZ-person.sidewalkDirection*2;person.speed=1.4+Math.random()*.15;person.distance=0;person.leavingDistance=0;}}
   if(person.active){const distance=person.speed*dt;
    if(person.stage==='approach'){const step=Math.min(distance,Math.abs(person.crossingZ-person.z));person.z+=step*person.sidewalkDirection;person.distance+=step;if(Math.abs(person.crossingZ-person.z)<.001)person.stage='waiting';}
    if(person.stage==='waiting'&&cycle>=30&&cycle<31.5)person.stage='crossing';
    if(person.stage==='crossing'){person.x+=distance*person.direction;person.distance+=distance;if(person.x*person.direction>=5.3){person.x=person.direction*5.3;person.stage='leaving';}}
    else if(person.stage==='leaving'){person.z+=distance*person.sidewalkDirection;person.distance+=distance;person.leavingDistance+=distance;if(person.leavingDistance>=2){person.active=false;person.wait=8+Math.random()*12;}}
   }
   person.walking=person.active&&person.stage!=='waiting';const stride=person.walking?Math.sin(person.distance*7)*.5:0;
   const facing=person.stage==='crossing'||person.stage==='waiting'?-person.direction*Math.PI/2:person.sidewalkDirection>0?Math.PI:0;
   root.position.set(person.x,0,person.z);root.rotation.set(0,facing,0);root.scale.setScalar(person.active?1:0);root.updateMatrix();
   setPart(shirts,i*3,0,1.1,0,.48,.7,.28);setPart(heads,i,0,1.69,0,.48,.48,.48);
   for(let j=0;j<2;j++){const side=j?1:-1,armAngle=side*stride,legAngle=-armAngle;
    setPart(shirts,i*3+j+1,side*.365,1.43-.25*Math.cos(armAngle),-.25*Math.sin(armAngle),.23,.5,.27,armAngle);
    setPart(hands,i*2+j,side*.365,1.43-.62*Math.cos(armAngle),-.62*Math.sin(armAngle),.23,.24,.27,armAngle);
    setPart(legs,i*4+j,side*.13,.75-.32*Math.cos(legAngle),-.32*Math.sin(legAngle),.23,.64,.27,legAngle);
    setPart(legs,i*4+j+2,side*.13,.75-.69*Math.cos(legAngle),-.69*Math.sin(legAngle)-.025,.24,.12,.32,legAngle);
   }
  });
  for(const mesh of [paint,cab,chassis,wheels,front,rear,shirts,legs,heads,hands])mesh.instanceMatrix.needsUpdate=true;paint.instanceColor.needsUpdate=true;
 }
 // Give pooled colors a valid buffer before the first spawn.
 for(let i=0;i<2;i++)paint.setColorAt(i,color.set(carColors[i]));update(0,{x:0,z:11});
 return {update,getState:()=>({elapsed,ns,ew,crosswalks:crossings.length+8,signals:12,cars:cars.filter(c=>c.active).map(c=>({x:c.x,z:c.z,direction:c.direction,stopped:c.stopped})),people:people.filter(p=>p.active).map(p=>({x:p.x,z:p.z,walking:p.walking,stage:p.stage}))})};
}
