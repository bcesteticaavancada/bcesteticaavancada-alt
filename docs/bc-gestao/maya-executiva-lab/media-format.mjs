export const MAX_BYTES=8*1024*1024;
export function identify(bytes,declared=''){
 if(!bytes.length||bytes.length>MAX_BYTES)throw Error('O arquivo deve ter até 8 MB.');
 const ascii=(start,n)=>String.fromCharCode(...bytes.subarray(start,start+n));
 let mime;
 if(ascii(0,5)==='%PDF-')mime='application/pdf';
 else if(ascii(0,8)==='\x89PNG\r\n\x1a\n')mime='image/png';
 else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';
 else if(ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP')mime='image/webp';
 else if(ascii(0,4)==='RIFF'&&ascii(8,4)==='WAVE')mime='audio/wav';
 else if(ascii(0,4)==='OggS')mime='audio/ogg';
 else if(ascii(0,4)==='\x1a\x45\xdf\xa3')mime='audio/webm';
 else if(ascii(4,4)==='ftyp'&&['M4A ','mp42','isom','mp41','M4B '].includes(ascii(8,4)))mime='audio/mp4';
 else if(ascii(0,3)==='ID3'||(bytes[0]===255&&[251,243,242].includes(bytes[1])))mime='audio/mpeg';
 else if(bytes[0]===255&&[241,249].includes(bytes[1]))mime='audio/aac';
 const given=String(declared).split(';')[0].replace('audio/x-wav','audio/wav').replace('audio/mp3','audio/mpeg').replace('audio/x-m4a','audio/mp4');
 if(!mime||(given&&given!=='application/octet-stream'&&given!==mime))throw Error('Arquivo incompatível. Confira o formato do original.');
 return mime;
}
