export function surface(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function dimensions(bytes,mime){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(mime==='image/png')return [v.getUint32(16),v.getUint32(20)];
 if(mime==='image/jpeg'){
  for(let p=2;p+9<bytes.length;){
   if(bytes[p++]!==255)continue;const marker=bytes[p++];
   if(marker===255){p--;continue;}if(marker===216||marker===1||(marker>=208&&marker<=215))continue;
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return [v.getUint16(p+5),v.getUint16(p+3)];
   const size=v.getUint16(p);if(size<2)break;p+=size;
  }
 }
 if(mime==='image/webp'){
  const tag=String.fromCharCode(...bytes.slice(12,16));
  if(tag==='VP8X')return [1+bytes[24]+256*bytes[25]+65536*bytes[26],1+bytes[27]+256*bytes[28]+65536*bytes[29]];
  if(tag==='VP8 ')return [v.getUint16(26,true)&16383,v.getUint16(28,true)&16383];
  if(tag==='VP8L'){const packed=v.getUint32(21,true);return [(packed&16383)+1,((packed>>>14)&16383)+1];}
 }
 throw Error('Não foi possível verificar as dimensões da imagem.');
}
export async function loadPhoto(file,bytes,mime){
 const [w,h]=dimensions(bytes,mime);if(!w||!h||w*h>20000000)throw Error('Reduza a foto para até 20 megapixels.');
 const url=URL.createObjectURL(file),img=new Image();
 try{img.src=url;await img.decode();const scale=Math.min(1,1600/Math.max(img.width,img.height));
 const canvas=surface(Math.max(1,Math.round(img.width*scale)),Math.max(1,Math.round(img.height*scale)));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas;}finally{URL.revokeObjectURL(url);}
}
export const whole=()=>[[0,0],[1,0],[1,1],[0,1]];
export function corners(canvas){
 const w=160,h=Math.max(16,Math.round(160*canvas.height/canvas.width));if(h>800)return whole();
 const small=surface(w,h),ctx=small.getContext('2d');ctx.drawImage(canvas,0,0,w,h);const pix=ctx.getImageData(0,0,w,h).data;
 const lum=(x,y)=>{const i=4*(y*w+x);return (pix[i]*3+pix[i+1]*6+pix[i+2])/10;};
 const bg=[lum(0,0),lum(w-1,0),lum(0,h-1),lum(w-1,h-1)].sort((a,b)=>a-b)[1];
 const result=whole(),scores=[Infinity,-Infinity,-Infinity,Infinity];let count=0;
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  if(lum(x,y)<Math.max(110,bg+38))continue;
  const u=x/(w-1),v=y/(h-1),sum=u+v,diff=u-v;count++;
  if(sum<scores[0]){scores[0]=sum;result[0]=[u,v];}
  if(diff>scores[1]){scores[1]=diff;result[1]=[u,v];}
  if(sum>scores[2]){scores[2]=sum;result[2]=[u,v];}
  if(diff<scores[3]){scores[3]=diff;result[3]=[u,v];}
 }
 return count>w*h*.14&&validQuad(result)?result:whole();
}
function validQuad(q){
 if(q.length!==4||q.some(p=>p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1)))return false;
 return q.every(([x,y],i)=>{const b=q[(i+1)%4],c=q[(i+2)%4];return (b[0]-x)*(c[1]-b[1])-(b[1]-y)*(c[0]-b[0])>.006;});
}
export function rectify(canvas,q=whole(),turns=0,contrast=1){
 if(!validQuad(q))throw Error('Confira a ordem dos quatro cantos da folha.');
 const p=q.map(([x,y])=>[x*(canvas.width-1),y*(canvas.height-1)]),dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const w=Math.max(2,Math.round(Math.max(dist(p[0],p[1]),dist(p[3],p[2])))),h=Math.max(2,Math.round(Math.max(dist(p[0],p[3]),dist(p[1],p[2]))));
 const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=p;
 const dx1=x1-x2,dx2=x3-x2,dy1=y1-y2,dy2=y3-y2,sx=x0-x1+x2-x3,sy=y0-y1+y2-y3,den=dx1*dy2-dx2*dy1;
 if(Math.abs(den)<.001)throw Error('Recorte muito estreito.');
 const g=(sx*dy2-dx2*sy)/den,k=(dx1*sy-sx*dy1)/den,a=x1-x0+g*x1,b=x3-x0+k*x3,d=y1-y0+g*y1,e=y3-y0+k*y3;
 const original=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
 const copy=surface(w,h),ctx=copy.getContext('2d'),out=ctx.createImageData(w,h);
 for(let y=0;y<h;y++){const v=y/(h-1);for(let x=0;x<w;x++){
  const u=x/(w-1),z=g*u+k*v+1,xx=Math.max(0,Math.min(canvas.width-1,Math.round((a*u+b*v+x0)/z))),yy=Math.max(0,Math.min(canvas.height-1,Math.round((d*u+e*v+y0)/z)));
  const src=4*(yy*canvas.width+xx),dest=4*(y*w+x);
  for(let channel=0;channel<3;channel++)out.data[dest+channel]=(original[src+channel]-128)*contrast+128;out.data[dest+3]=255;
 }}
 ctx.putImageData(out,0,0);
 const n=((turns%4)+4)%4;if(!n)return copy;
 const rotated=surface(n%2?h:w,n%2?w:h),r=rotated.getContext('2d');r.translate(rotated.width/2,rotated.height/2);r.rotate(n*Math.PI/2);r.drawImage(copy,-w/2,-h/2);return rotated;
}
