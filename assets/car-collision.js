// Oriented footprints in the ground plane, shared by the driver and traffic.
export function overlaps(a,b){
 const ac=Math.cos(a.heading||0),as=Math.sin(a.heading||0),bc=Math.cos(b.heading||0),bs=Math.sin(b.heading||0),dx=b.x-a.x,dz=b.z-a.z;
 for(let axis=0;axis<4;axis++){
  const x=axis===0?ac:axis===1?as:axis===2?bc:bs,z=axis===0?-as:axis===1?ac:axis===2?-bs:bc;
  const ra=a.w*Math.abs(x*ac-z*as)+a.d*Math.abs(x*as+z*ac);
  const rb=b.w*Math.abs(x*bc-z*bs)+b.d*Math.abs(x*bs+z*bc);
  if(Math.abs(dx*x+dz*z)>=ra+rb)return false;
 }
 return true;
}
export function collisionAt(player,staticObjects,dynamicObjects){
 const c=Math.abs(Math.cos(player.heading||0)),s=Math.abs(Math.sin(player.heading||0));
 if(Math.abs(player.x)+player.w*c+player.d*s>21.9||Math.abs(player.z)+player.w*s+player.d*c>21.9)return 'boundary';
 for(const object of staticObjects)if(overlaps(player,object))return object.kind||'obstacle';
 for(const object of dynamicObjects)if(object.active&&overlaps(player,object))return object.kind;
 return '';
}
