import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three-r180/three.module.min.js';
import {createTraffic} from '../assets/car-traffic.js';

const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(1,1,1);
const materials=Object.fromEntries(['line','stone','dark','window','wheel'].map(key=>[key,new THREE.MeshLambertMaterial({color:0xaaaaaa})]));
const box=(w,h,d,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);scene.add(mesh);return mesh;};
const traffic=createTraffic(scene,materials,box),player={x:0,z:30};
let sawCars=false,sawWaiting=false,sawMoving=false,sawPeople=false,sawWalking=false;
const signals=new Set();
for(let i=0;i<180*60;i++){
 const before=traffic.getState();traffic.update(1/60,player);const state=traffic.getState();
 assert(state.cars.length<=2&&state.people.length<=3,'Population stays bounded');
 assert(!(state.ns==='green'&&state.ew==='green'),'Conflicting approaches never get green together');
 signals.add(state.ns);signals.add(state.ew);
 for(const car of state.cars){assert(Number.isFinite(car.x)&&Math.abs(car.x)<=24);assert(Math.abs(Math.abs(car.z)-10)<2);sawCars=true;if(car.stopped&&state.ew!=='green')sawWaiting=true;}
 if(state.ew==='green'&&before.cars.length&&state.cars.length&&Math.abs(state.cars[0].x-before.cars[0].x)>.001)sawMoving=true;
 for(const person of state.people){assert(Number.isFinite(person.x)&&Math.abs(person.x)<=5.3);assert([-14.7,-5.3,5.3,14.7].some(z=>Math.abs(person.z-z)<2.3));sawPeople=true;if(person.stage==='crossing'){sawWalking=true;assert.equal(state.ns,'red');assert.equal(state.ew,'red');assert(person.walking);}}
}
assert(sawCars&&sawWaiting&&sawMoving&&sawPeople&&sawWalking,'Traffic spawns, waits, drives and crosses');
assert.equal(signals.size,3,'Red, amber and green all appear');
let dynamicCount=0;scene.traverse(mesh=>{if(mesh.isInstancedMesh){dynamicCount++;assert([...mesh.instanceMatrix.array].every(Number.isFinite),'Instance transforms remain finite');}});
assert.equal(dynamicCount,16);
const actors=traffic.getColliders(),car=actors.find(actor=>actor.kind==='vehicle'),person=actors.find(actor=>actor.kind==='person');
actors.forEach(actor=>{actor.active=false;actor.wait=100;});
Object.assign(car,{active:true,x:0,z:0,direction:1,speed:2});
const parked={x:2.7,z:0,w:1.09,d:1.6,heading:0};
for(let i=0;i<60;i++)traffic.update(1/60,parked);
assert(car.stopped&&car.x===0,'A random car waits in front of the player');
Object.assign(person,{active:true,x:-1.62,z:0,direction:1,speed:1.5,stage:'crossing',distance:0});
const blockingPlayer={x:0,z:0,w:1.09,d:1.6,heading:0};
traffic.update(.1,blockingPlayer);assert.equal(person.x,-1.62,'A pedestrian does not walk through the player');assert.equal(person.walking,false);
blockingPlayer.z=5;traffic.update(.1,blockingPlayer);assert(person.x>-1.62&&person.walking,'A pedestrian continues when the car moves away');
assert.equal(traffic.getStaticColliders().length,12,'All traffic light poles have footprints');
console.log('PASS: 180 simulated seconds; bounded random traffic, red-light stops, green-light driving, pedestrian crossing, signal phases and finite transforms.');
