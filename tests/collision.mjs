import assert from 'node:assert/strict';
import {overlaps,collisionAt} from '../assets/car-collision.js';
const player={x:0,z:0,w:1.09,d:1.6,heading:0};
const pole={x:0,z:-3,w:.09,d:.09,kind:'signal'};
assert.equal(collisionAt(player,[pole],[]),'');
assert.equal(collisionAt({...player,z:-1.4},[pole],[]),'signal');
assert.equal(collisionAt({...player,z:-1.3},[pole],[]),'');
assert.equal(collisionAt({...player,heading:Math.PI/2},[{...pole,x:1.5,z:0}],[]),'signal');
assert.equal(collisionAt(player,[{...pole,x:1.5,z:0}],[]),'','A nearby post must not block the unrotated car');
for(const object of [{x:0,z:-3,w:.96,d:1.48,heading:Math.PI/2,kind:'vehicle',active:true},{x:0,z:-3,w:.5,d:.35,kind:'person',active:true}]){
 let z=0,stopped=false;
 for(let step=0;step<100;step++){const next={...player,z:z-8/120};if(collisionAt(next,[],[object])){stopped=true;break;}z=next.z;}
 assert(stopped,'Driving stops before '+object.kind);assert(!overlaps({...player,z},object),'No penetration');
 assert(!collisionAt({...player,z:z+.04},[],[object]),'Reversing releases the car');
 assert.equal(collisionAt({...player,z:-3},[],[{...object,active:false}]),'','Inactive pooled actors cannot block the car');
}
assert.equal(collisionAt({...player,x:21},[],[]),'boundary');
for(let angle=0;angle<Math.PI*2;angle+=.2){assert(overlaps({...player,heading:angle},{...player,x:.2,z:.2}));assert(!overlaps({...player,heading:angle},{...player,x:5,z:5}));}
console.log('PASS: rotated footprints, traffic light poles, vehicles, pedestrians, substep stopping, reverse recovery, inactive actors and boundaries.');
