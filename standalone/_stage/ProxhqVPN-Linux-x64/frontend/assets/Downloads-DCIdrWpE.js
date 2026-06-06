import{c as Je,o as Ce,p as st,a as lt,r as ye,D as ue,M as ke,A as De,q as _e,s as Ve,t as Ue,v as be,w as Ee,G as Le,l as Qe,j as v,x as ct,y as Ge,z as et,B as $e,S as dt,E as ut,H as ht,I as pt,m as ft,k as mt}from"./index-CI_hBWHp.js";const gt=[["rect",{width:"20",height:"5",x:"2",y:"3",rx:"1",key:"1wp1u1"}],["path",{d:"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8",key:"1s80jp"}],["path",{d:"M10 12h4",key:"a56b0p"}]],tt=Je("archive",gt);const xt=[["rect",{width:"16",height:"20",x:"4",y:"2",rx:"2",ry:"2",key:"76otgf"}],["line",{x1:"12",x2:"12.01",y1:"18",y2:"18",key:"1dp563"}]],wt=Je("tablet",xt);function Oe(J){throw new Error('Could not dynamically require "'+J+'". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.')}var We={exports:{}};var Xe;function bt(){return Xe||(Xe=1,(function(J,ge){(function(x){J.exports=x()})(function(){return(function x(G,S,l){function a(g,w){if(!S[g]){if(!G[g]){var f=typeof Oe=="function"&&Oe;if(!w&&f)return f(g,!0);if(n)return n(g,!0);var b=new Error("Cannot find module '"+g+"'");throw b.code="MODULE_NOT_FOUND",b}var i=S[g]={exports:{}};G[g][0].call(i.exports,function(p){var o=G[g][1][p];return a(o||p)},i,i.exports,x,G,S,l)}return S[g].exports}for(var n=typeof Oe=="function"&&Oe,c=0;c<l.length;c++)a(l[c]);return a})({1:[function(x,G,S){var l=x("./utils"),a=x("./support"),n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";S.encode=function(c){for(var g,w,f,b,i,p,o,d=[],r=0,u=c.length,y=u,k=l.getTypeOf(c)!=="string";r<c.length;)y=u-r,f=k?(g=c[r++],w=r<u?c[r++]:0,r<u?c[r++]:0):(g=c.charCodeAt(r++),w=r<u?c.charCodeAt(r++):0,r<u?c.charCodeAt(r++):0),b=g>>2,i=(3&g)<<4|w>>4,p=1<y?(15&w)<<2|f>>6:64,o=2<y?63&f:64,d.push(n.charAt(b)+n.charAt(i)+n.charAt(p)+n.charAt(o));return d.join("")},S.decode=function(c){var g,w,f,b,i,p,o=0,d=0,r="data:";if(c.substr(0,r.length)===r)throw new Error("Invalid base64 input, it looks like a data url.");var u,y=3*(c=c.replace(/[^A-Za-z0-9+/=]/g,"")).length/4;if(c.charAt(c.length-1)===n.charAt(64)&&y--,c.charAt(c.length-2)===n.charAt(64)&&y--,y%1!=0)throw new Error("Invalid base64 input, bad content length.");for(u=a.uint8array?new Uint8Array(0|y):new Array(0|y);o<c.length;)g=n.indexOf(c.charAt(o++))<<2|(b=n.indexOf(c.charAt(o++)))>>4,w=(15&b)<<4|(i=n.indexOf(c.charAt(o++)))>>2,f=(3&i)<<6|(p=n.indexOf(c.charAt(o++))),u[d++]=g,i!==64&&(u[d++]=w),p!==64&&(u[d++]=f);return u}},{"./support":30,"./utils":32}],2:[function(x,G,S){var l=x("./external"),a=x("./stream/DataWorker"),n=x("./stream/Crc32Probe"),c=x("./stream/DataLengthProbe");function g(w,f,b,i,p){this.compressedSize=w,this.uncompressedSize=f,this.crc32=b,this.compression=i,this.compressedContent=p}g.prototype={getContentWorker:function(){var w=new a(l.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new c("data_length")),f=this;return w.on("end",function(){if(this.streamInfo.data_length!==f.uncompressedSize)throw new Error("Bug : uncompressed data size mismatch")}),w},getCompressedWorker:function(){return new a(l.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize",this.compressedSize).withStreamInfo("uncompressedSize",this.uncompressedSize).withStreamInfo("crc32",this.crc32).withStreamInfo("compression",this.compression)}},g.createWorkerFrom=function(w,f,b){return w.pipe(new n).pipe(new c("uncompressedSize")).pipe(f.compressWorker(b)).pipe(new c("compressedSize")).withStreamInfo("compression",f)},G.exports=g},{"./external":6,"./stream/Crc32Probe":25,"./stream/DataLengthProbe":26,"./stream/DataWorker":27}],3:[function(x,G,S){var l=x("./stream/GenericWorker");S.STORE={magic:"\0\0",compressWorker:function(){return new l("STORE compression")},uncompressWorker:function(){return new l("STORE decompression")}},S.DEFLATE=x("./flate")},{"./flate":7,"./stream/GenericWorker":28}],4:[function(x,G,S){var l=x("./utils"),a=(function(){for(var n,c=[],g=0;g<256;g++){n=g;for(var w=0;w<8;w++)n=1&n?3988292384^n>>>1:n>>>1;c[g]=n}return c})();G.exports=function(n,c){return n!==void 0&&n.length?l.getTypeOf(n)!=="string"?(function(g,w,f,b){var i=a,p=b+f;g^=-1;for(var o=b;o<p;o++)g=g>>>8^i[255&(g^w[o])];return-1^g})(0|c,n,n.length,0):(function(g,w,f,b){var i=a,p=b+f;g^=-1;for(var o=b;o<p;o++)g=g>>>8^i[255&(g^w.charCodeAt(o))];return-1^g})(0|c,n,n.length,0):0}},{"./utils":32}],5:[function(x,G,S){S.base64=!1,S.binary=!1,S.dir=!1,S.createFolders=!0,S.date=null,S.compression=null,S.compressionOptions=null,S.comment=null,S.unixPermissions=null,S.dosPermissions=null},{}],6:[function(x,G,S){var l=null;l=typeof Promise<"u"?Promise:x("lie"),G.exports={Promise:l}},{lie:37}],7:[function(x,G,S){var l=typeof Uint8Array<"u"&&typeof Uint16Array<"u"&&typeof Uint32Array<"u",a=x("pako"),n=x("./utils"),c=x("./stream/GenericWorker"),g=l?"uint8array":"array";function w(f,b){c.call(this,"FlateWorker/"+f),this._pako=null,this._pakoAction=f,this._pakoOptions=b,this.meta={}}S.magic="\b\0",n.inherits(w,c),w.prototype.processChunk=function(f){this.meta=f.meta,this._pako===null&&this._createPako(),this._pako.push(n.transformTo(g,f.data),!1)},w.prototype.flush=function(){c.prototype.flush.call(this),this._pako===null&&this._createPako(),this._pako.push([],!0)},w.prototype.cleanUp=function(){c.prototype.cleanUp.call(this),this._pako=null},w.prototype._createPako=function(){this._pako=new a[this._pakoAction]({raw:!0,level:this._pakoOptions.level||-1});var f=this;this._pako.onData=function(b){f.push({data:b,meta:f.meta})}},S.compressWorker=function(f){return new w("Deflate",f)},S.uncompressWorker=function(){return new w("Inflate",{})}},{"./stream/GenericWorker":28,"./utils":32,pako:38}],8:[function(x,G,S){function l(i,p){var o,d="";for(o=0;o<p;o++)d+=String.fromCharCode(255&i),i>>>=8;return d}function a(i,p,o,d,r,u){var y,k,N=i.file,V=i.compression,C=u!==g.utf8encode,F=n.transformTo("string",u(N.name)),I=n.transformTo("string",g.utf8encode(N.name)),j=N.comment,X=n.transformTo("string",u(j)),m=n.transformTo("string",g.utf8encode(j)),O=I.length!==N.name.length,t=m.length!==j.length,D="",Z="",q="",ee=N.dir,U=N.date,Y={crc32:0,compressedSize:0,uncompressedSize:0};p&&!o||(Y.crc32=i.crc32,Y.compressedSize=i.compressedSize,Y.uncompressedSize=i.uncompressedSize);var A=0;p&&(A|=8),C||!O&&!t||(A|=2048);var _=0,$=0;ee&&(_|=16),r==="UNIX"?($=798,_|=(function(M,ie){var de=M;return M||(de=ie?16893:33204),(65535&de)<<16})(N.unixPermissions,ee)):($=20,_|=(function(M){return 63&(M||0)})(N.dosPermissions)),y=U.getUTCHours(),y<<=6,y|=U.getUTCMinutes(),y<<=5,y|=U.getUTCSeconds()/2,k=U.getUTCFullYear()-1980,k<<=4,k|=U.getUTCMonth()+1,k<<=5,k|=U.getUTCDate(),O&&(Z=l(1,1)+l(w(F),4)+I,D+="up"+l(Z.length,2)+Z),t&&(q=l(1,1)+l(w(X),4)+m,D+="uc"+l(q.length,2)+q);var H="";return H+=`
\0`,H+=l(A,2),H+=V.magic,H+=l(y,2),H+=l(k,2),H+=l(Y.crc32,4),H+=l(Y.compressedSize,4),H+=l(Y.uncompressedSize,4),H+=l(F.length,2),H+=l(D.length,2),{fileRecord:f.LOCAL_FILE_HEADER+H+F+D,dirRecord:f.CENTRAL_FILE_HEADER+l($,2)+H+l(X.length,2)+"\0\0\0\0"+l(_,4)+l(d,4)+F+D+X}}var n=x("../utils"),c=x("../stream/GenericWorker"),g=x("../utf8"),w=x("../crc32"),f=x("../signature");function b(i,p,o,d){c.call(this,"ZipFileWorker"),this.bytesWritten=0,this.zipComment=p,this.zipPlatform=o,this.encodeFileName=d,this.streamFiles=i,this.accumulate=!1,this.contentBuffer=[],this.dirRecords=[],this.currentSourceOffset=0,this.entriesCount=0,this.currentFile=null,this._sources=[]}n.inherits(b,c),b.prototype.push=function(i){var p=i.meta.percent||0,o=this.entriesCount,d=this._sources.length;this.accumulate?this.contentBuffer.push(i):(this.bytesWritten+=i.data.length,c.prototype.push.call(this,{data:i.data,meta:{currentFile:this.currentFile,percent:o?(p+100*(o-d-1))/o:100}}))},b.prototype.openedSource=function(i){this.currentSourceOffset=this.bytesWritten,this.currentFile=i.file.name;var p=this.streamFiles&&!i.file.dir;if(p){var o=a(i,p,!1,this.currentSourceOffset,this.zipPlatform,this.encodeFileName);this.push({data:o.fileRecord,meta:{percent:0}})}else this.accumulate=!0},b.prototype.closedSource=function(i){this.accumulate=!1;var p=this.streamFiles&&!i.file.dir,o=a(i,p,!0,this.currentSourceOffset,this.zipPlatform,this.encodeFileName);if(this.dirRecords.push(o.dirRecord),p)this.push({data:(function(d){return f.DATA_DESCRIPTOR+l(d.crc32,4)+l(d.compressedSize,4)+l(d.uncompressedSize,4)})(i),meta:{percent:100}});else for(this.push({data:o.fileRecord,meta:{percent:0}});this.contentBuffer.length;)this.push(this.contentBuffer.shift());this.currentFile=null},b.prototype.flush=function(){for(var i=this.bytesWritten,p=0;p<this.dirRecords.length;p++)this.push({data:this.dirRecords[p],meta:{percent:100}});var o=this.bytesWritten-i,d=(function(r,u,y,k,N){var V=n.transformTo("string",N(k));return f.CENTRAL_DIRECTORY_END+"\0\0\0\0"+l(r,2)+l(r,2)+l(u,4)+l(y,4)+l(V.length,2)+V})(this.dirRecords.length,o,i,this.zipComment,this.encodeFileName);this.push({data:d,meta:{percent:100}})},b.prototype.prepareNextSource=function(){this.previous=this._sources.shift(),this.openedSource(this.previous.streamInfo),this.isPaused?this.previous.pause():this.previous.resume()},b.prototype.registerPrevious=function(i){this._sources.push(i);var p=this;return i.on("data",function(o){p.processChunk(o)}),i.on("end",function(){p.closedSource(p.previous.streamInfo),p._sources.length?p.prepareNextSource():p.end()}),i.on("error",function(o){p.error(o)}),this},b.prototype.resume=function(){return!!c.prototype.resume.call(this)&&(!this.previous&&this._sources.length?(this.prepareNextSource(),!0):this.previous||this._sources.length||this.generatedError?void 0:(this.end(),!0))},b.prototype.error=function(i){var p=this._sources;if(!c.prototype.error.call(this,i))return!1;for(var o=0;o<p.length;o++)try{p[o].error(i)}catch{}return!0},b.prototype.lock=function(){c.prototype.lock.call(this);for(var i=this._sources,p=0;p<i.length;p++)i[p].lock()},G.exports=b},{"../crc32":4,"../signature":23,"../stream/GenericWorker":28,"../utf8":31,"../utils":32}],9:[function(x,G,S){var l=x("../compressions"),a=x("./ZipFileWorker");S.generateWorker=function(n,c,g){var w=new a(c.streamFiles,g,c.platform,c.encodeFileName),f=0;try{n.forEach(function(b,i){f++;var p=(function(u,y){var k=u||y,N=l[k];if(!N)throw new Error(k+" is not a valid compression method !");return N})(i.options.compression,c.compression),o=i.options.compressionOptions||c.compressionOptions||{},d=i.dir,r=i.date;i._compressWorker(p,o).withStreamInfo("file",{name:b,dir:d,date:r,comment:i.comment||"",unixPermissions:i.unixPermissions,dosPermissions:i.dosPermissions}).pipe(w)}),w.entriesCount=f}catch(b){w.error(b)}return w}},{"../compressions":3,"./ZipFileWorker":8}],10:[function(x,G,S){function l(){if(!(this instanceof l))return new l;if(arguments.length)throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");this.files=Object.create(null),this.comment=null,this.root="",this.clone=function(){var a=new l;for(var n in this)typeof this[n]!="function"&&(a[n]=this[n]);return a}}(l.prototype=x("./object")).loadAsync=x("./load"),l.support=x("./support"),l.defaults=x("./defaults"),l.version="3.10.1",l.loadAsync=function(a,n){return new l().loadAsync(a,n)},l.external=x("./external"),G.exports=l},{"./defaults":5,"./external":6,"./load":11,"./object":15,"./support":30}],11:[function(x,G,S){var l=x("./utils"),a=x("./external"),n=x("./utf8"),c=x("./zipEntries"),g=x("./stream/Crc32Probe"),w=x("./nodejsUtils");function f(b){return new a.Promise(function(i,p){var o=b.decompressed.getContentWorker().pipe(new g);o.on("error",function(d){p(d)}).on("end",function(){o.streamInfo.crc32!==b.decompressed.crc32?p(new Error("Corrupted zip : CRC32 mismatch")):i()}).resume()})}G.exports=function(b,i){var p=this;return i=l.extend(i||{},{base64:!1,checkCRC32:!1,optimizedBinaryString:!1,createFolders:!1,decodeFileName:n.utf8decode}),w.isNode&&w.isStream(b)?a.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")):l.prepareContent("the loaded zip file",b,!0,i.optimizedBinaryString,i.base64).then(function(o){var d=new c(i);return d.load(o),d}).then(function(o){var d=[a.Promise.resolve(o)],r=o.files;if(i.checkCRC32)for(var u=0;u<r.length;u++)d.push(f(r[u]));return a.Promise.all(d)}).then(function(o){for(var d=o.shift(),r=d.files,u=0;u<r.length;u++){var y=r[u],k=y.fileNameStr,N=l.resolve(y.fileNameStr);p.file(N,y.decompressed,{binary:!0,optimizedBinaryString:!0,date:y.date,dir:y.dir,comment:y.fileCommentStr.length?y.fileCommentStr:null,unixPermissions:y.unixPermissions,dosPermissions:y.dosPermissions,createFolders:i.createFolders}),y.dir||(p.file(N).unsafeOriginalName=k)}return d.zipComment.length&&(p.comment=d.zipComment),p})}},{"./external":6,"./nodejsUtils":14,"./stream/Crc32Probe":25,"./utf8":31,"./utils":32,"./zipEntries":33}],12:[function(x,G,S){var l=x("../utils"),a=x("../stream/GenericWorker");function n(c,g){a.call(this,"Nodejs stream input adapter for "+c),this._upstreamEnded=!1,this._bindStream(g)}l.inherits(n,a),n.prototype._bindStream=function(c){var g=this;(this._stream=c).pause(),c.on("data",function(w){g.push({data:w,meta:{percent:0}})}).on("error",function(w){g.isPaused?this.generatedError=w:g.error(w)}).on("end",function(){g.isPaused?g._upstreamEnded=!0:g.end()})},n.prototype.pause=function(){return!!a.prototype.pause.call(this)&&(this._stream.pause(),!0)},n.prototype.resume=function(){return!!a.prototype.resume.call(this)&&(this._upstreamEnded?this.end():this._stream.resume(),!0)},G.exports=n},{"../stream/GenericWorker":28,"../utils":32}],13:[function(x,G,S){var l=x("readable-stream").Readable;function a(n,c,g){l.call(this,c),this._helper=n;var w=this;n.on("data",function(f,b){w.push(f)||w._helper.pause(),g&&g(b)}).on("error",function(f){w.emit("error",f)}).on("end",function(){w.push(null)})}x("../utils").inherits(a,l),a.prototype._read=function(){this._helper.resume()},G.exports=a},{"../utils":32,"readable-stream":16}],14:[function(x,G,S){G.exports={isNode:typeof Buffer<"u",newBufferFrom:function(l,a){if(Buffer.from&&Buffer.from!==Uint8Array.from)return Buffer.from(l,a);if(typeof l=="number")throw new Error('The "data" argument must not be a number');return new Buffer(l,a)},allocBuffer:function(l){if(Buffer.alloc)return Buffer.alloc(l);var a=new Buffer(l);return a.fill(0),a},isBuffer:function(l){return Buffer.isBuffer(l)},isStream:function(l){return l&&typeof l.on=="function"&&typeof l.pause=="function"&&typeof l.resume=="function"}}},{}],15:[function(x,G,S){function l(N,V,C){var F,I=n.getTypeOf(V),j=n.extend(C||{},w);j.date=j.date||new Date,j.compression!==null&&(j.compression=j.compression.toUpperCase()),typeof j.unixPermissions=="string"&&(j.unixPermissions=parseInt(j.unixPermissions,8)),j.unixPermissions&&16384&j.unixPermissions&&(j.dir=!0),j.dosPermissions&&16&j.dosPermissions&&(j.dir=!0),j.dir&&(N=r(N)),j.createFolders&&(F=d(N))&&u.call(this,F,!0);var X=I==="string"&&j.binary===!1&&j.base64===!1;C&&C.binary!==void 0||(j.binary=!X),(V instanceof f&&V.uncompressedSize===0||j.dir||!V||V.length===0)&&(j.base64=!1,j.binary=!0,V="",j.compression="STORE",I="string");var m=null;m=V instanceof f||V instanceof c?V:p.isNode&&p.isStream(V)?new o(N,V):n.prepareContent(N,V,j.binary,j.optimizedBinaryString,j.base64);var O=new b(N,m,j);this.files[N]=O}var a=x("./utf8"),n=x("./utils"),c=x("./stream/GenericWorker"),g=x("./stream/StreamHelper"),w=x("./defaults"),f=x("./compressedObject"),b=x("./zipObject"),i=x("./generate"),p=x("./nodejsUtils"),o=x("./nodejs/NodejsStreamInputAdapter"),d=function(N){N.slice(-1)==="/"&&(N=N.substring(0,N.length-1));var V=N.lastIndexOf("/");return 0<V?N.substring(0,V):""},r=function(N){return N.slice(-1)!=="/"&&(N+="/"),N},u=function(N,V){return V=V!==void 0?V:w.createFolders,N=r(N),this.files[N]||l.call(this,N,null,{dir:!0,createFolders:V}),this.files[N]};function y(N){return Object.prototype.toString.call(N)==="[object RegExp]"}var k={load:function(){throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")},forEach:function(N){var V,C,F;for(V in this.files)F=this.files[V],(C=V.slice(this.root.length,V.length))&&V.slice(0,this.root.length)===this.root&&N(C,F)},filter:function(N){var V=[];return this.forEach(function(C,F){N(C,F)&&V.push(F)}),V},file:function(N,V,C){if(arguments.length!==1)return N=this.root+N,l.call(this,N,V,C),this;if(y(N)){var F=N;return this.filter(function(j,X){return!X.dir&&F.test(j)})}var I=this.files[this.root+N];return I&&!I.dir?I:null},folder:function(N){if(!N)return this;if(y(N))return this.filter(function(I,j){return j.dir&&N.test(I)});var V=this.root+N,C=u.call(this,V),F=this.clone();return F.root=C.name,F},remove:function(N){N=this.root+N;var V=this.files[N];if(V||(N.slice(-1)!=="/"&&(N+="/"),V=this.files[N]),V&&!V.dir)delete this.files[N];else for(var C=this.filter(function(I,j){return j.name.slice(0,N.length)===N}),F=0;F<C.length;F++)delete this.files[C[F].name];return this},generate:function(){throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")},generateInternalStream:function(N){var V,C={};try{if((C=n.extend(N||{},{streamFiles:!1,compression:"STORE",compressionOptions:null,type:"",platform:"DOS",comment:null,mimeType:"application/zip",encodeFileName:a.utf8encode})).type=C.type.toLowerCase(),C.compression=C.compression.toUpperCase(),C.type==="binarystring"&&(C.type="string"),!C.type)throw new Error("No output type specified.");n.checkSupport(C.type),C.platform!=="darwin"&&C.platform!=="freebsd"&&C.platform!=="linux"&&C.platform!=="sunos"||(C.platform="UNIX"),C.platform==="win32"&&(C.platform="DOS");var F=C.comment||this.comment||"";V=i.generateWorker(this,C,F)}catch(I){(V=new c("error")).error(I)}return new g(V,C.type||"string",C.mimeType)},generateAsync:function(N,V){return this.generateInternalStream(N).accumulate(V)},generateNodeStream:function(N,V){return(N=N||{}).type||(N.type="nodebuffer"),this.generateInternalStream(N).toNodejsStream(V)}};G.exports=k},{"./compressedObject":2,"./defaults":5,"./generate":9,"./nodejs/NodejsStreamInputAdapter":12,"./nodejsUtils":14,"./stream/GenericWorker":28,"./stream/StreamHelper":29,"./utf8":31,"./utils":32,"./zipObject":35}],16:[function(x,G,S){G.exports=x("stream")},{stream:void 0}],17:[function(x,G,S){var l=x("./DataReader");function a(n){l.call(this,n);for(var c=0;c<this.data.length;c++)n[c]=255&n[c]}x("../utils").inherits(a,l),a.prototype.byteAt=function(n){return this.data[this.zero+n]},a.prototype.lastIndexOfSignature=function(n){for(var c=n.charCodeAt(0),g=n.charCodeAt(1),w=n.charCodeAt(2),f=n.charCodeAt(3),b=this.length-4;0<=b;--b)if(this.data[b]===c&&this.data[b+1]===g&&this.data[b+2]===w&&this.data[b+3]===f)return b-this.zero;return-1},a.prototype.readAndCheckSignature=function(n){var c=n.charCodeAt(0),g=n.charCodeAt(1),w=n.charCodeAt(2),f=n.charCodeAt(3),b=this.readData(4);return c===b[0]&&g===b[1]&&w===b[2]&&f===b[3]},a.prototype.readData=function(n){if(this.checkOffset(n),n===0)return[];var c=this.data.slice(this.zero+this.index,this.zero+this.index+n);return this.index+=n,c},G.exports=a},{"../utils":32,"./DataReader":18}],18:[function(x,G,S){var l=x("../utils");function a(n){this.data=n,this.length=n.length,this.index=0,this.zero=0}a.prototype={checkOffset:function(n){this.checkIndex(this.index+n)},checkIndex:function(n){if(this.length<this.zero+n||n<0)throw new Error("End of data reached (data length = "+this.length+", asked index = "+n+"). Corrupted zip ?")},setIndex:function(n){this.checkIndex(n),this.index=n},skip:function(n){this.setIndex(this.index+n)},byteAt:function(){},readInt:function(n){var c,g=0;for(this.checkOffset(n),c=this.index+n-1;c>=this.index;c--)g=(g<<8)+this.byteAt(c);return this.index+=n,g},readString:function(n){return l.transformTo("string",this.readData(n))},readData:function(){},lastIndexOfSignature:function(){},readAndCheckSignature:function(){},readDate:function(){var n=this.readInt(4);return new Date(Date.UTC(1980+(n>>25&127),(n>>21&15)-1,n>>16&31,n>>11&31,n>>5&63,(31&n)<<1))}},G.exports=a},{"../utils":32}],19:[function(x,G,S){var l=x("./Uint8ArrayReader");function a(n){l.call(this,n)}x("../utils").inherits(a,l),a.prototype.readData=function(n){this.checkOffset(n);var c=this.data.slice(this.zero+this.index,this.zero+this.index+n);return this.index+=n,c},G.exports=a},{"../utils":32,"./Uint8ArrayReader":21}],20:[function(x,G,S){var l=x("./DataReader");function a(n){l.call(this,n)}x("../utils").inherits(a,l),a.prototype.byteAt=function(n){return this.data.charCodeAt(this.zero+n)},a.prototype.lastIndexOfSignature=function(n){return this.data.lastIndexOf(n)-this.zero},a.prototype.readAndCheckSignature=function(n){return n===this.readData(4)},a.prototype.readData=function(n){this.checkOffset(n);var c=this.data.slice(this.zero+this.index,this.zero+this.index+n);return this.index+=n,c},G.exports=a},{"../utils":32,"./DataReader":18}],21:[function(x,G,S){var l=x("./ArrayReader");function a(n){l.call(this,n)}x("../utils").inherits(a,l),a.prototype.readData=function(n){if(this.checkOffset(n),n===0)return new Uint8Array(0);var c=this.data.subarray(this.zero+this.index,this.zero+this.index+n);return this.index+=n,c},G.exports=a},{"../utils":32,"./ArrayReader":17}],22:[function(x,G,S){var l=x("../utils"),a=x("../support"),n=x("./ArrayReader"),c=x("./StringReader"),g=x("./NodeBufferReader"),w=x("./Uint8ArrayReader");G.exports=function(f){var b=l.getTypeOf(f);return l.checkSupport(b),b!=="string"||a.uint8array?b==="nodebuffer"?new g(f):a.uint8array?new w(l.transformTo("uint8array",f)):new n(l.transformTo("array",f)):new c(f)}},{"../support":30,"../utils":32,"./ArrayReader":17,"./NodeBufferReader":19,"./StringReader":20,"./Uint8ArrayReader":21}],23:[function(x,G,S){S.LOCAL_FILE_HEADER="PK",S.CENTRAL_FILE_HEADER="PK",S.CENTRAL_DIRECTORY_END="PK",S.ZIP64_CENTRAL_DIRECTORY_LOCATOR="PK\x07",S.ZIP64_CENTRAL_DIRECTORY_END="PK",S.DATA_DESCRIPTOR="PK\x07\b"},{}],24:[function(x,G,S){var l=x("./GenericWorker"),a=x("../utils");function n(c){l.call(this,"ConvertWorker to "+c),this.destType=c}a.inherits(n,l),n.prototype.processChunk=function(c){this.push({data:a.transformTo(this.destType,c.data),meta:c.meta})},G.exports=n},{"../utils":32,"./GenericWorker":28}],25:[function(x,G,S){var l=x("./GenericWorker"),a=x("../crc32");function n(){l.call(this,"Crc32Probe"),this.withStreamInfo("crc32",0)}x("../utils").inherits(n,l),n.prototype.processChunk=function(c){this.streamInfo.crc32=a(c.data,this.streamInfo.crc32||0),this.push(c)},G.exports=n},{"../crc32":4,"../utils":32,"./GenericWorker":28}],26:[function(x,G,S){var l=x("../utils"),a=x("./GenericWorker");function n(c){a.call(this,"DataLengthProbe for "+c),this.propName=c,this.withStreamInfo(c,0)}l.inherits(n,a),n.prototype.processChunk=function(c){if(c){var g=this.streamInfo[this.propName]||0;this.streamInfo[this.propName]=g+c.data.length}a.prototype.processChunk.call(this,c)},G.exports=n},{"../utils":32,"./GenericWorker":28}],27:[function(x,G,S){var l=x("../utils"),a=x("./GenericWorker");function n(c){a.call(this,"DataWorker");var g=this;this.dataIsReady=!1,this.index=0,this.max=0,this.data=null,this.type="",this._tickScheduled=!1,c.then(function(w){g.dataIsReady=!0,g.data=w,g.max=w&&w.length||0,g.type=l.getTypeOf(w),g.isPaused||g._tickAndRepeat()},function(w){g.error(w)})}l.inherits(n,a),n.prototype.cleanUp=function(){a.prototype.cleanUp.call(this),this.data=null},n.prototype.resume=function(){return!!a.prototype.resume.call(this)&&(!this._tickScheduled&&this.dataIsReady&&(this._tickScheduled=!0,l.delay(this._tickAndRepeat,[],this)),!0)},n.prototype._tickAndRepeat=function(){this._tickScheduled=!1,this.isPaused||this.isFinished||(this._tick(),this.isFinished||(l.delay(this._tickAndRepeat,[],this),this._tickScheduled=!0))},n.prototype._tick=function(){if(this.isPaused||this.isFinished)return!1;var c=null,g=Math.min(this.max,this.index+16384);if(this.index>=this.max)return this.end();switch(this.type){case"string":c=this.data.substring(this.index,g);break;case"uint8array":c=this.data.subarray(this.index,g);break;case"array":case"nodebuffer":c=this.data.slice(this.index,g)}return this.index=g,this.push({data:c,meta:{percent:this.max?this.index/this.max*100:0}})},G.exports=n},{"../utils":32,"./GenericWorker":28}],28:[function(x,G,S){function l(a){this.name=a||"default",this.streamInfo={},this.generatedError=null,this.extraStreamInfo={},this.isPaused=!0,this.isFinished=!1,this.isLocked=!1,this._listeners={data:[],end:[],error:[]},this.previous=null}l.prototype={push:function(a){this.emit("data",a)},end:function(){if(this.isFinished)return!1;this.flush();try{this.emit("end"),this.cleanUp(),this.isFinished=!0}catch(a){this.emit("error",a)}return!0},error:function(a){return!this.isFinished&&(this.isPaused?this.generatedError=a:(this.isFinished=!0,this.emit("error",a),this.previous&&this.previous.error(a),this.cleanUp()),!0)},on:function(a,n){return this._listeners[a].push(n),this},cleanUp:function(){this.streamInfo=this.generatedError=this.extraStreamInfo=null,this._listeners=[]},emit:function(a,n){if(this._listeners[a])for(var c=0;c<this._listeners[a].length;c++)this._listeners[a][c].call(this,n)},pipe:function(a){return a.registerPrevious(this)},registerPrevious:function(a){if(this.isLocked)throw new Error("The stream '"+this+"' has already been used.");this.streamInfo=a.streamInfo,this.mergeStreamInfo(),this.previous=a;var n=this;return a.on("data",function(c){n.processChunk(c)}),a.on("end",function(){n.end()}),a.on("error",function(c){n.error(c)}),this},pause:function(){return!this.isPaused&&!this.isFinished&&(this.isPaused=!0,this.previous&&this.previous.pause(),!0)},resume:function(){if(!this.isPaused||this.isFinished)return!1;var a=this.isPaused=!1;return this.generatedError&&(this.error(this.generatedError),a=!0),this.previous&&this.previous.resume(),!a},flush:function(){},processChunk:function(a){this.push(a)},withStreamInfo:function(a,n){return this.extraStreamInfo[a]=n,this.mergeStreamInfo(),this},mergeStreamInfo:function(){for(var a in this.extraStreamInfo)Object.prototype.hasOwnProperty.call(this.extraStreamInfo,a)&&(this.streamInfo[a]=this.extraStreamInfo[a])},lock:function(){if(this.isLocked)throw new Error("The stream '"+this+"' has already been used.");this.isLocked=!0,this.previous&&this.previous.lock()},toString:function(){var a="Worker "+this.name;return this.previous?this.previous+" -> "+a:a}},G.exports=l},{}],29:[function(x,G,S){var l=x("../utils"),a=x("./ConvertWorker"),n=x("./GenericWorker"),c=x("../base64"),g=x("../support"),w=x("../external"),f=null;if(g.nodestream)try{f=x("../nodejs/NodejsStreamOutputAdapter")}catch{}function b(p,o){return new w.Promise(function(d,r){var u=[],y=p._internalType,k=p._outputType,N=p._mimeType;p.on("data",function(V,C){u.push(V),o&&o(C)}).on("error",function(V){u=[],r(V)}).on("end",function(){try{var V=(function(C,F,I){switch(C){case"blob":return l.newBlob(l.transformTo("arraybuffer",F),I);case"base64":return c.encode(F);default:return l.transformTo(C,F)}})(k,(function(C,F){var I,j=0,X=null,m=0;for(I=0;I<F.length;I++)m+=F[I].length;switch(C){case"string":return F.join("");case"array":return Array.prototype.concat.apply([],F);case"uint8array":for(X=new Uint8Array(m),I=0;I<F.length;I++)X.set(F[I],j),j+=F[I].length;return X;case"nodebuffer":return Buffer.concat(F);default:throw new Error("concat : unsupported type '"+C+"'")}})(y,u),N);d(V)}catch(C){r(C)}u=[]}).resume()})}function i(p,o,d){var r=o;switch(o){case"blob":case"arraybuffer":r="uint8array";break;case"base64":r="string"}try{this._internalType=r,this._outputType=o,this._mimeType=d,l.checkSupport(r),this._worker=p.pipe(new a(r)),p.lock()}catch(u){this._worker=new n("error"),this._worker.error(u)}}i.prototype={accumulate:function(p){return b(this,p)},on:function(p,o){var d=this;return p==="data"?this._worker.on(p,function(r){o.call(d,r.data,r.meta)}):this._worker.on(p,function(){l.delay(o,arguments,d)}),this},resume:function(){return l.delay(this._worker.resume,[],this._worker),this},pause:function(){return this._worker.pause(),this},toNodejsStream:function(p){if(l.checkSupport("nodestream"),this._outputType!=="nodebuffer")throw new Error(this._outputType+" is not supported by this method");return new f(this,{objectMode:this._outputType!=="nodebuffer"},p)}},G.exports=i},{"../base64":1,"../external":6,"../nodejs/NodejsStreamOutputAdapter":13,"../support":30,"../utils":32,"./ConvertWorker":24,"./GenericWorker":28}],30:[function(x,G,S){if(S.base64=!0,S.array=!0,S.string=!0,S.arraybuffer=typeof ArrayBuffer<"u"&&typeof Uint8Array<"u",S.nodebuffer=typeof Buffer<"u",S.uint8array=typeof Uint8Array<"u",typeof ArrayBuffer>"u")S.blob=!1;else{var l=new ArrayBuffer(0);try{S.blob=new Blob([l],{type:"application/zip"}).size===0}catch{try{var a=new(self.BlobBuilder||self.WebKitBlobBuilder||self.MozBlobBuilder||self.MSBlobBuilder);a.append(l),S.blob=a.getBlob("application/zip").size===0}catch{S.blob=!1}}}try{S.nodestream=!!x("readable-stream").Readable}catch{S.nodestream=!1}},{"readable-stream":16}],31:[function(x,G,S){for(var l=x("./utils"),a=x("./support"),n=x("./nodejsUtils"),c=x("./stream/GenericWorker"),g=new Array(256),w=0;w<256;w++)g[w]=252<=w?6:248<=w?5:240<=w?4:224<=w?3:192<=w?2:1;g[254]=g[254]=1;function f(){c.call(this,"utf-8 decode"),this.leftOver=null}function b(){c.call(this,"utf-8 encode")}S.utf8encode=function(i){return a.nodebuffer?n.newBufferFrom(i,"utf-8"):(function(p){var o,d,r,u,y,k=p.length,N=0;for(u=0;u<k;u++)(64512&(d=p.charCodeAt(u)))==55296&&u+1<k&&(64512&(r=p.charCodeAt(u+1)))==56320&&(d=65536+(d-55296<<10)+(r-56320),u++),N+=d<128?1:d<2048?2:d<65536?3:4;for(o=a.uint8array?new Uint8Array(N):new Array(N),u=y=0;y<N;u++)(64512&(d=p.charCodeAt(u)))==55296&&u+1<k&&(64512&(r=p.charCodeAt(u+1)))==56320&&(d=65536+(d-55296<<10)+(r-56320),u++),d<128?o[y++]=d:(d<2048?o[y++]=192|d>>>6:(d<65536?o[y++]=224|d>>>12:(o[y++]=240|d>>>18,o[y++]=128|d>>>12&63),o[y++]=128|d>>>6&63),o[y++]=128|63&d);return o})(i)},S.utf8decode=function(i){return a.nodebuffer?l.transformTo("nodebuffer",i).toString("utf-8"):(function(p){var o,d,r,u,y=p.length,k=new Array(2*y);for(o=d=0;o<y;)if((r=p[o++])<128)k[d++]=r;else if(4<(u=g[r]))k[d++]=65533,o+=u-1;else{for(r&=u===2?31:u===3?15:7;1<u&&o<y;)r=r<<6|63&p[o++],u--;1<u?k[d++]=65533:r<65536?k[d++]=r:(r-=65536,k[d++]=55296|r>>10&1023,k[d++]=56320|1023&r)}return k.length!==d&&(k.subarray?k=k.subarray(0,d):k.length=d),l.applyFromCharCode(k)})(i=l.transformTo(a.uint8array?"uint8array":"array",i))},l.inherits(f,c),f.prototype.processChunk=function(i){var p=l.transformTo(a.uint8array?"uint8array":"array",i.data);if(this.leftOver&&this.leftOver.length){if(a.uint8array){var o=p;(p=new Uint8Array(o.length+this.leftOver.length)).set(this.leftOver,0),p.set(o,this.leftOver.length)}else p=this.leftOver.concat(p);this.leftOver=null}var d=(function(u,y){var k;for((y=y||u.length)>u.length&&(y=u.length),k=y-1;0<=k&&(192&u[k])==128;)k--;return k<0||k===0?y:k+g[u[k]]>y?k:y})(p),r=p;d!==p.length&&(a.uint8array?(r=p.subarray(0,d),this.leftOver=p.subarray(d,p.length)):(r=p.slice(0,d),this.leftOver=p.slice(d,p.length))),this.push({data:S.utf8decode(r),meta:i.meta})},f.prototype.flush=function(){this.leftOver&&this.leftOver.length&&(this.push({data:S.utf8decode(this.leftOver),meta:{}}),this.leftOver=null)},S.Utf8DecodeWorker=f,l.inherits(b,c),b.prototype.processChunk=function(i){this.push({data:S.utf8encode(i.data),meta:i.meta})},S.Utf8EncodeWorker=b},{"./nodejsUtils":14,"./stream/GenericWorker":28,"./support":30,"./utils":32}],32:[function(x,G,S){var l=x("./support"),a=x("./base64"),n=x("./nodejsUtils"),c=x("./external");function g(o){return o}function w(o,d){for(var r=0;r<o.length;++r)d[r]=255&o.charCodeAt(r);return d}x("setimmediate"),S.newBlob=function(o,d){S.checkSupport("blob");try{return new Blob([o],{type:d})}catch{try{var r=new(self.BlobBuilder||self.WebKitBlobBuilder||self.MozBlobBuilder||self.MSBlobBuilder);return r.append(o),r.getBlob(d)}catch{throw new Error("Bug : can't construct the Blob.")}}};var f={stringifyByChunk:function(o,d,r){var u=[],y=0,k=o.length;if(k<=r)return String.fromCharCode.apply(null,o);for(;y<k;)d==="array"||d==="nodebuffer"?u.push(String.fromCharCode.apply(null,o.slice(y,Math.min(y+r,k)))):u.push(String.fromCharCode.apply(null,o.subarray(y,Math.min(y+r,k)))),y+=r;return u.join("")},stringifyByChar:function(o){for(var d="",r=0;r<o.length;r++)d+=String.fromCharCode(o[r]);return d},applyCanBeUsed:{uint8array:(function(){try{return l.uint8array&&String.fromCharCode.apply(null,new Uint8Array(1)).length===1}catch{return!1}})(),nodebuffer:(function(){try{return l.nodebuffer&&String.fromCharCode.apply(null,n.allocBuffer(1)).length===1}catch{return!1}})()}};function b(o){var d=65536,r=S.getTypeOf(o),u=!0;if(r==="uint8array"?u=f.applyCanBeUsed.uint8array:r==="nodebuffer"&&(u=f.applyCanBeUsed.nodebuffer),u)for(;1<d;)try{return f.stringifyByChunk(o,r,d)}catch{d=Math.floor(d/2)}return f.stringifyByChar(o)}function i(o,d){for(var r=0;r<o.length;r++)d[r]=o[r];return d}S.applyFromCharCode=b;var p={};p.string={string:g,array:function(o){return w(o,new Array(o.length))},arraybuffer:function(o){return p.string.uint8array(o).buffer},uint8array:function(o){return w(o,new Uint8Array(o.length))},nodebuffer:function(o){return w(o,n.allocBuffer(o.length))}},p.array={string:b,array:g,arraybuffer:function(o){return new Uint8Array(o).buffer},uint8array:function(o){return new Uint8Array(o)},nodebuffer:function(o){return n.newBufferFrom(o)}},p.arraybuffer={string:function(o){return b(new Uint8Array(o))},array:function(o){return i(new Uint8Array(o),new Array(o.byteLength))},arraybuffer:g,uint8array:function(o){return new Uint8Array(o)},nodebuffer:function(o){return n.newBufferFrom(new Uint8Array(o))}},p.uint8array={string:b,array:function(o){return i(o,new Array(o.length))},arraybuffer:function(o){return o.buffer},uint8array:g,nodebuffer:function(o){return n.newBufferFrom(o)}},p.nodebuffer={string:b,array:function(o){return i(o,new Array(o.length))},arraybuffer:function(o){return p.nodebuffer.uint8array(o).buffer},uint8array:function(o){return i(o,new Uint8Array(o.length))},nodebuffer:g},S.transformTo=function(o,d){if(d=d||"",!o)return d;S.checkSupport(o);var r=S.getTypeOf(d);return p[r][o](d)},S.resolve=function(o){for(var d=o.split("/"),r=[],u=0;u<d.length;u++){var y=d[u];y==="."||y===""&&u!==0&&u!==d.length-1||(y===".."?r.pop():r.push(y))}return r.join("/")},S.getTypeOf=function(o){return typeof o=="string"?"string":Object.prototype.toString.call(o)==="[object Array]"?"array":l.nodebuffer&&n.isBuffer(o)?"nodebuffer":l.uint8array&&o instanceof Uint8Array?"uint8array":l.arraybuffer&&o instanceof ArrayBuffer?"arraybuffer":void 0},S.checkSupport=function(o){if(!l[o.toLowerCase()])throw new Error(o+" is not supported by this platform")},S.MAX_VALUE_16BITS=65535,S.MAX_VALUE_32BITS=-1,S.pretty=function(o){var d,r,u="";for(r=0;r<(o||"").length;r++)u+="\\x"+((d=o.charCodeAt(r))<16?"0":"")+d.toString(16).toUpperCase();return u},S.delay=function(o,d,r){setImmediate(function(){o.apply(r||null,d||[])})},S.inherits=function(o,d){function r(){}r.prototype=d.prototype,o.prototype=new r},S.extend=function(){var o,d,r={};for(o=0;o<arguments.length;o++)for(d in arguments[o])Object.prototype.hasOwnProperty.call(arguments[o],d)&&r[d]===void 0&&(r[d]=arguments[o][d]);return r},S.prepareContent=function(o,d,r,u,y){return c.Promise.resolve(d).then(function(k){return l.blob&&(k instanceof Blob||["[object File]","[object Blob]"].indexOf(Object.prototype.toString.call(k))!==-1)&&typeof FileReader<"u"?new c.Promise(function(N,V){var C=new FileReader;C.onload=function(F){N(F.target.result)},C.onerror=function(F){V(F.target.error)},C.readAsArrayBuffer(k)}):k}).then(function(k){var N=S.getTypeOf(k);return N?(N==="arraybuffer"?k=S.transformTo("uint8array",k):N==="string"&&(y?k=a.decode(k):r&&u!==!0&&(k=(function(V){return w(V,l.uint8array?new Uint8Array(V.length):new Array(V.length))})(k))),k):c.Promise.reject(new Error("Can't read the data of '"+o+"'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"))})}},{"./base64":1,"./external":6,"./nodejsUtils":14,"./support":30,setimmediate:54}],33:[function(x,G,S){var l=x("./reader/readerFor"),a=x("./utils"),n=x("./signature"),c=x("./zipEntry"),g=x("./support");function w(f){this.files=[],this.loadOptions=f}w.prototype={checkSignature:function(f){if(!this.reader.readAndCheckSignature(f)){this.reader.index-=4;var b=this.reader.readString(4);throw new Error("Corrupted zip or bug: unexpected signature ("+a.pretty(b)+", expected "+a.pretty(f)+")")}},isSignature:function(f,b){var i=this.reader.index;this.reader.setIndex(f);var p=this.reader.readString(4)===b;return this.reader.setIndex(i),p},readBlockEndOfCentral:function(){this.diskNumber=this.reader.readInt(2),this.diskWithCentralDirStart=this.reader.readInt(2),this.centralDirRecordsOnThisDisk=this.reader.readInt(2),this.centralDirRecords=this.reader.readInt(2),this.centralDirSize=this.reader.readInt(4),this.centralDirOffset=this.reader.readInt(4),this.zipCommentLength=this.reader.readInt(2);var f=this.reader.readData(this.zipCommentLength),b=g.uint8array?"uint8array":"array",i=a.transformTo(b,f);this.zipComment=this.loadOptions.decodeFileName(i)},readBlockZip64EndOfCentral:function(){this.zip64EndOfCentralSize=this.reader.readInt(8),this.reader.skip(4),this.diskNumber=this.reader.readInt(4),this.diskWithCentralDirStart=this.reader.readInt(4),this.centralDirRecordsOnThisDisk=this.reader.readInt(8),this.centralDirRecords=this.reader.readInt(8),this.centralDirSize=this.reader.readInt(8),this.centralDirOffset=this.reader.readInt(8),this.zip64ExtensibleData={};for(var f,b,i,p=this.zip64EndOfCentralSize-44;0<p;)f=this.reader.readInt(2),b=this.reader.readInt(4),i=this.reader.readData(b),this.zip64ExtensibleData[f]={id:f,length:b,value:i}},readBlockZip64EndOfCentralLocator:function(){if(this.diskWithZip64CentralDirStart=this.reader.readInt(4),this.relativeOffsetEndOfZip64CentralDir=this.reader.readInt(8),this.disksCount=this.reader.readInt(4),1<this.disksCount)throw new Error("Multi-volumes zip are not supported")},readLocalFiles:function(){var f,b;for(f=0;f<this.files.length;f++)b=this.files[f],this.reader.setIndex(b.localHeaderOffset),this.checkSignature(n.LOCAL_FILE_HEADER),b.readLocalPart(this.reader),b.handleUTF8(),b.processAttributes()},readCentralDir:function(){var f;for(this.reader.setIndex(this.centralDirOffset);this.reader.readAndCheckSignature(n.CENTRAL_FILE_HEADER);)(f=new c({zip64:this.zip64},this.loadOptions)).readCentralPart(this.reader),this.files.push(f);if(this.centralDirRecords!==this.files.length&&this.centralDirRecords!==0&&this.files.length===0)throw new Error("Corrupted zip or bug: expected "+this.centralDirRecords+" records in central dir, got "+this.files.length)},readEndOfCentral:function(){var f=this.reader.lastIndexOfSignature(n.CENTRAL_DIRECTORY_END);if(f<0)throw this.isSignature(0,n.LOCAL_FILE_HEADER)?new Error("Corrupted zip: can't find end of central directory"):new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html");this.reader.setIndex(f);var b=f;if(this.checkSignature(n.CENTRAL_DIRECTORY_END),this.readBlockEndOfCentral(),this.diskNumber===a.MAX_VALUE_16BITS||this.diskWithCentralDirStart===a.MAX_VALUE_16BITS||this.centralDirRecordsOnThisDisk===a.MAX_VALUE_16BITS||this.centralDirRecords===a.MAX_VALUE_16BITS||this.centralDirSize===a.MAX_VALUE_32BITS||this.centralDirOffset===a.MAX_VALUE_32BITS){if(this.zip64=!0,(f=this.reader.lastIndexOfSignature(n.ZIP64_CENTRAL_DIRECTORY_LOCATOR))<0)throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");if(this.reader.setIndex(f),this.checkSignature(n.ZIP64_CENTRAL_DIRECTORY_LOCATOR),this.readBlockZip64EndOfCentralLocator(),!this.isSignature(this.relativeOffsetEndOfZip64CentralDir,n.ZIP64_CENTRAL_DIRECTORY_END)&&(this.relativeOffsetEndOfZip64CentralDir=this.reader.lastIndexOfSignature(n.ZIP64_CENTRAL_DIRECTORY_END),this.relativeOffsetEndOfZip64CentralDir<0))throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir),this.checkSignature(n.ZIP64_CENTRAL_DIRECTORY_END),this.readBlockZip64EndOfCentral()}var i=this.centralDirOffset+this.centralDirSize;this.zip64&&(i+=20,i+=12+this.zip64EndOfCentralSize);var p=b-i;if(0<p)this.isSignature(b,n.CENTRAL_FILE_HEADER)||(this.reader.zero=p);else if(p<0)throw new Error("Corrupted zip: missing "+Math.abs(p)+" bytes.")},prepareReader:function(f){this.reader=l(f)},load:function(f){this.prepareReader(f),this.readEndOfCentral(),this.readCentralDir(),this.readLocalFiles()}},G.exports=w},{"./reader/readerFor":22,"./signature":23,"./support":30,"./utils":32,"./zipEntry":34}],34:[function(x,G,S){var l=x("./reader/readerFor"),a=x("./utils"),n=x("./compressedObject"),c=x("./crc32"),g=x("./utf8"),w=x("./compressions"),f=x("./support");function b(i,p){this.options=i,this.loadOptions=p}b.prototype={isEncrypted:function(){return(1&this.bitFlag)==1},useUTF8:function(){return(2048&this.bitFlag)==2048},readLocalPart:function(i){var p,o;if(i.skip(22),this.fileNameLength=i.readInt(2),o=i.readInt(2),this.fileName=i.readData(this.fileNameLength),i.skip(o),this.compressedSize===-1||this.uncompressedSize===-1)throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");if((p=(function(d){for(var r in w)if(Object.prototype.hasOwnProperty.call(w,r)&&w[r].magic===d)return w[r];return null})(this.compressionMethod))===null)throw new Error("Corrupted zip : compression "+a.pretty(this.compressionMethod)+" unknown (inner file : "+a.transformTo("string",this.fileName)+")");this.decompressed=new n(this.compressedSize,this.uncompressedSize,this.crc32,p,i.readData(this.compressedSize))},readCentralPart:function(i){this.versionMadeBy=i.readInt(2),i.skip(2),this.bitFlag=i.readInt(2),this.compressionMethod=i.readString(2),this.date=i.readDate(),this.crc32=i.readInt(4),this.compressedSize=i.readInt(4),this.uncompressedSize=i.readInt(4);var p=i.readInt(2);if(this.extraFieldsLength=i.readInt(2),this.fileCommentLength=i.readInt(2),this.diskNumberStart=i.readInt(2),this.internalFileAttributes=i.readInt(2),this.externalFileAttributes=i.readInt(4),this.localHeaderOffset=i.readInt(4),this.isEncrypted())throw new Error("Encrypted zip are not supported");i.skip(p),this.readExtraFields(i),this.parseZIP64ExtraField(i),this.fileComment=i.readData(this.fileCommentLength)},processAttributes:function(){this.unixPermissions=null,this.dosPermissions=null;var i=this.versionMadeBy>>8;this.dir=!!(16&this.externalFileAttributes),i==0&&(this.dosPermissions=63&this.externalFileAttributes),i==3&&(this.unixPermissions=this.externalFileAttributes>>16&65535),this.dir||this.fileNameStr.slice(-1)!=="/"||(this.dir=!0)},parseZIP64ExtraField:function(){if(this.extraFields[1]){var i=l(this.extraFields[1].value);this.uncompressedSize===a.MAX_VALUE_32BITS&&(this.uncompressedSize=i.readInt(8)),this.compressedSize===a.MAX_VALUE_32BITS&&(this.compressedSize=i.readInt(8)),this.localHeaderOffset===a.MAX_VALUE_32BITS&&(this.localHeaderOffset=i.readInt(8)),this.diskNumberStart===a.MAX_VALUE_32BITS&&(this.diskNumberStart=i.readInt(4))}},readExtraFields:function(i){var p,o,d,r=i.index+this.extraFieldsLength;for(this.extraFields||(this.extraFields={});i.index+4<r;)p=i.readInt(2),o=i.readInt(2),d=i.readData(o),this.extraFields[p]={id:p,length:o,value:d};i.setIndex(r)},handleUTF8:function(){var i=f.uint8array?"uint8array":"array";if(this.useUTF8())this.fileNameStr=g.utf8decode(this.fileName),this.fileCommentStr=g.utf8decode(this.fileComment);else{var p=this.findExtraFieldUnicodePath();if(p!==null)this.fileNameStr=p;else{var o=a.transformTo(i,this.fileName);this.fileNameStr=this.loadOptions.decodeFileName(o)}var d=this.findExtraFieldUnicodeComment();if(d!==null)this.fileCommentStr=d;else{var r=a.transformTo(i,this.fileComment);this.fileCommentStr=this.loadOptions.decodeFileName(r)}}},findExtraFieldUnicodePath:function(){var i=this.extraFields[28789];if(i){var p=l(i.value);return p.readInt(1)!==1||c(this.fileName)!==p.readInt(4)?null:g.utf8decode(p.readData(i.length-5))}return null},findExtraFieldUnicodeComment:function(){var i=this.extraFields[25461];if(i){var p=l(i.value);return p.readInt(1)!==1||c(this.fileComment)!==p.readInt(4)?null:g.utf8decode(p.readData(i.length-5))}return null}},G.exports=b},{"./compressedObject":2,"./compressions":3,"./crc32":4,"./reader/readerFor":22,"./support":30,"./utf8":31,"./utils":32}],35:[function(x,G,S){function l(p,o,d){this.name=p,this.dir=d.dir,this.date=d.date,this.comment=d.comment,this.unixPermissions=d.unixPermissions,this.dosPermissions=d.dosPermissions,this._data=o,this._dataBinary=d.binary,this.options={compression:d.compression,compressionOptions:d.compressionOptions}}var a=x("./stream/StreamHelper"),n=x("./stream/DataWorker"),c=x("./utf8"),g=x("./compressedObject"),w=x("./stream/GenericWorker");l.prototype={internalStream:function(p){var o=null,d="string";try{if(!p)throw new Error("No output type specified.");var r=(d=p.toLowerCase())==="string"||d==="text";d!=="binarystring"&&d!=="text"||(d="string"),o=this._decompressWorker();var u=!this._dataBinary;u&&!r&&(o=o.pipe(new c.Utf8EncodeWorker)),!u&&r&&(o=o.pipe(new c.Utf8DecodeWorker))}catch(y){(o=new w("error")).error(y)}return new a(o,d,"")},async:function(p,o){return this.internalStream(p).accumulate(o)},nodeStream:function(p,o){return this.internalStream(p||"nodebuffer").toNodejsStream(o)},_compressWorker:function(p,o){if(this._data instanceof g&&this._data.compression.magic===p.magic)return this._data.getCompressedWorker();var d=this._decompressWorker();return this._dataBinary||(d=d.pipe(new c.Utf8EncodeWorker)),g.createWorkerFrom(d,p,o)},_decompressWorker:function(){return this._data instanceof g?this._data.getContentWorker():this._data instanceof w?this._data:new n(this._data)}};for(var f=["asText","asBinary","asNodeBuffer","asUint8Array","asArrayBuffer"],b=function(){throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")},i=0;i<f.length;i++)l.prototype[f[i]]=b;G.exports=l},{"./compressedObject":2,"./stream/DataWorker":27,"./stream/GenericWorker":28,"./stream/StreamHelper":29,"./utf8":31}],36:[function(x,G,S){(function(l){var a,n,c=l.MutationObserver||l.WebKitMutationObserver;if(c){var g=0,w=new c(p),f=l.document.createTextNode("");w.observe(f,{characterData:!0}),a=function(){f.data=g=++g%2}}else if(l.setImmediate||l.MessageChannel===void 0)a="document"in l&&"onreadystatechange"in l.document.createElement("script")?function(){var o=l.document.createElement("script");o.onreadystatechange=function(){p(),o.onreadystatechange=null,o.parentNode.removeChild(o),o=null},l.document.documentElement.appendChild(o)}:function(){setTimeout(p,0)};else{var b=new l.MessageChannel;b.port1.onmessage=p,a=function(){b.port2.postMessage(0)}}var i=[];function p(){var o,d;n=!0;for(var r=i.length;r;){for(d=i,i=[],o=-1;++o<r;)d[o]();r=i.length}n=!1}G.exports=function(o){i.push(o)!==1||n||a()}}).call(this,typeof Ce<"u"?Ce:typeof self<"u"?self:typeof window<"u"?window:{})},{}],37:[function(x,G,S){var l=x("immediate");function a(){}var n={},c=["REJECTED"],g=["FULFILLED"],w=["PENDING"];function f(r){if(typeof r!="function")throw new TypeError("resolver must be a function");this.state=w,this.queue=[],this.outcome=void 0,r!==a&&o(this,r)}function b(r,u,y){this.promise=r,typeof u=="function"&&(this.onFulfilled=u,this.callFulfilled=this.otherCallFulfilled),typeof y=="function"&&(this.onRejected=y,this.callRejected=this.otherCallRejected)}function i(r,u,y){l(function(){var k;try{k=u(y)}catch(N){return n.reject(r,N)}k===r?n.reject(r,new TypeError("Cannot resolve promise with itself")):n.resolve(r,k)})}function p(r){var u=r&&r.then;if(r&&(typeof r=="object"||typeof r=="function")&&typeof u=="function")return function(){u.apply(r,arguments)}}function o(r,u){var y=!1;function k(C){y||(y=!0,n.reject(r,C))}function N(C){y||(y=!0,n.resolve(r,C))}var V=d(function(){u(N,k)});V.status==="error"&&k(V.value)}function d(r,u){var y={};try{y.value=r(u),y.status="success"}catch(k){y.status="error",y.value=k}return y}(G.exports=f).prototype.finally=function(r){if(typeof r!="function")return this;var u=this.constructor;return this.then(function(y){return u.resolve(r()).then(function(){return y})},function(y){return u.resolve(r()).then(function(){throw y})})},f.prototype.catch=function(r){return this.then(null,r)},f.prototype.then=function(r,u){if(typeof r!="function"&&this.state===g||typeof u!="function"&&this.state===c)return this;var y=new this.constructor(a);return this.state!==w?i(y,this.state===g?r:u,this.outcome):this.queue.push(new b(y,r,u)),y},b.prototype.callFulfilled=function(r){n.resolve(this.promise,r)},b.prototype.otherCallFulfilled=function(r){i(this.promise,this.onFulfilled,r)},b.prototype.callRejected=function(r){n.reject(this.promise,r)},b.prototype.otherCallRejected=function(r){i(this.promise,this.onRejected,r)},n.resolve=function(r,u){var y=d(p,u);if(y.status==="error")return n.reject(r,y.value);var k=y.value;if(k)o(r,k);else{r.state=g,r.outcome=u;for(var N=-1,V=r.queue.length;++N<V;)r.queue[N].callFulfilled(u)}return r},n.reject=function(r,u){r.state=c,r.outcome=u;for(var y=-1,k=r.queue.length;++y<k;)r.queue[y].callRejected(u);return r},f.resolve=function(r){return r instanceof this?r:n.resolve(new this(a),r)},f.reject=function(r){var u=new this(a);return n.reject(u,r)},f.all=function(r){var u=this;if(Object.prototype.toString.call(r)!=="[object Array]")return this.reject(new TypeError("must be an array"));var y=r.length,k=!1;if(!y)return this.resolve([]);for(var N=new Array(y),V=0,C=-1,F=new this(a);++C<y;)I(r[C],C);return F;function I(j,X){u.resolve(j).then(function(m){N[X]=m,++V!==y||k||(k=!0,n.resolve(F,N))},function(m){k||(k=!0,n.reject(F,m))})}},f.race=function(r){var u=this;if(Object.prototype.toString.call(r)!=="[object Array]")return this.reject(new TypeError("must be an array"));var y=r.length,k=!1;if(!y)return this.resolve([]);for(var N=-1,V=new this(a);++N<y;)C=r[N],u.resolve(C).then(function(F){k||(k=!0,n.resolve(V,F))},function(F){k||(k=!0,n.reject(V,F))});var C;return V}},{immediate:36}],38:[function(x,G,S){var l={};(0,x("./lib/utils/common").assign)(l,x("./lib/deflate"),x("./lib/inflate"),x("./lib/zlib/constants")),G.exports=l},{"./lib/deflate":39,"./lib/inflate":40,"./lib/utils/common":41,"./lib/zlib/constants":44}],39:[function(x,G,S){var l=x("./zlib/deflate"),a=x("./utils/common"),n=x("./utils/strings"),c=x("./zlib/messages"),g=x("./zlib/zstream"),w=Object.prototype.toString,f=0,b=-1,i=0,p=8;function o(r){if(!(this instanceof o))return new o(r);this.options=a.assign({level:b,method:p,chunkSize:16384,windowBits:15,memLevel:8,strategy:i,to:""},r||{});var u=this.options;u.raw&&0<u.windowBits?u.windowBits=-u.windowBits:u.gzip&&0<u.windowBits&&u.windowBits<16&&(u.windowBits+=16),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new g,this.strm.avail_out=0;var y=l.deflateInit2(this.strm,u.level,u.method,u.windowBits,u.memLevel,u.strategy);if(y!==f)throw new Error(c[y]);if(u.header&&l.deflateSetHeader(this.strm,u.header),u.dictionary){var k;if(k=typeof u.dictionary=="string"?n.string2buf(u.dictionary):w.call(u.dictionary)==="[object ArrayBuffer]"?new Uint8Array(u.dictionary):u.dictionary,(y=l.deflateSetDictionary(this.strm,k))!==f)throw new Error(c[y]);this._dict_set=!0}}function d(r,u){var y=new o(u);if(y.push(r,!0),y.err)throw y.msg||c[y.err];return y.result}o.prototype.push=function(r,u){var y,k,N=this.strm,V=this.options.chunkSize;if(this.ended)return!1;k=u===~~u?u:u===!0?4:0,typeof r=="string"?N.input=n.string2buf(r):w.call(r)==="[object ArrayBuffer]"?N.input=new Uint8Array(r):N.input=r,N.next_in=0,N.avail_in=N.input.length;do{if(N.avail_out===0&&(N.output=new a.Buf8(V),N.next_out=0,N.avail_out=V),(y=l.deflate(N,k))!==1&&y!==f)return this.onEnd(y),!(this.ended=!0);N.avail_out!==0&&(N.avail_in!==0||k!==4&&k!==2)||(this.options.to==="string"?this.onData(n.buf2binstring(a.shrinkBuf(N.output,N.next_out))):this.onData(a.shrinkBuf(N.output,N.next_out)))}while((0<N.avail_in||N.avail_out===0)&&y!==1);return k===4?(y=l.deflateEnd(this.strm),this.onEnd(y),this.ended=!0,y===f):k!==2||(this.onEnd(f),!(N.avail_out=0))},o.prototype.onData=function(r){this.chunks.push(r)},o.prototype.onEnd=function(r){r===f&&(this.options.to==="string"?this.result=this.chunks.join(""):this.result=a.flattenChunks(this.chunks)),this.chunks=[],this.err=r,this.msg=this.strm.msg},S.Deflate=o,S.deflate=d,S.deflateRaw=function(r,u){return(u=u||{}).raw=!0,d(r,u)},S.gzip=function(r,u){return(u=u||{}).gzip=!0,d(r,u)}},{"./utils/common":41,"./utils/strings":42,"./zlib/deflate":46,"./zlib/messages":51,"./zlib/zstream":53}],40:[function(x,G,S){var l=x("./zlib/inflate"),a=x("./utils/common"),n=x("./utils/strings"),c=x("./zlib/constants"),g=x("./zlib/messages"),w=x("./zlib/zstream"),f=x("./zlib/gzheader"),b=Object.prototype.toString;function i(o){if(!(this instanceof i))return new i(o);this.options=a.assign({chunkSize:16384,windowBits:0,to:""},o||{});var d=this.options;d.raw&&0<=d.windowBits&&d.windowBits<16&&(d.windowBits=-d.windowBits,d.windowBits===0&&(d.windowBits=-15)),!(0<=d.windowBits&&d.windowBits<16)||o&&o.windowBits||(d.windowBits+=32),15<d.windowBits&&d.windowBits<48&&(15&d.windowBits)==0&&(d.windowBits|=15),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new w,this.strm.avail_out=0;var r=l.inflateInit2(this.strm,d.windowBits);if(r!==c.Z_OK)throw new Error(g[r]);this.header=new f,l.inflateGetHeader(this.strm,this.header)}function p(o,d){var r=new i(d);if(r.push(o,!0),r.err)throw r.msg||g[r.err];return r.result}i.prototype.push=function(o,d){var r,u,y,k,N,V,C=this.strm,F=this.options.chunkSize,I=this.options.dictionary,j=!1;if(this.ended)return!1;u=d===~~d?d:d===!0?c.Z_FINISH:c.Z_NO_FLUSH,typeof o=="string"?C.input=n.binstring2buf(o):b.call(o)==="[object ArrayBuffer]"?C.input=new Uint8Array(o):C.input=o,C.next_in=0,C.avail_in=C.input.length;do{if(C.avail_out===0&&(C.output=new a.Buf8(F),C.next_out=0,C.avail_out=F),(r=l.inflate(C,c.Z_NO_FLUSH))===c.Z_NEED_DICT&&I&&(V=typeof I=="string"?n.string2buf(I):b.call(I)==="[object ArrayBuffer]"?new Uint8Array(I):I,r=l.inflateSetDictionary(this.strm,V)),r===c.Z_BUF_ERROR&&j===!0&&(r=c.Z_OK,j=!1),r!==c.Z_STREAM_END&&r!==c.Z_OK)return this.onEnd(r),!(this.ended=!0);C.next_out&&(C.avail_out!==0&&r!==c.Z_STREAM_END&&(C.avail_in!==0||u!==c.Z_FINISH&&u!==c.Z_SYNC_FLUSH)||(this.options.to==="string"?(y=n.utf8border(C.output,C.next_out),k=C.next_out-y,N=n.buf2string(C.output,y),C.next_out=k,C.avail_out=F-k,k&&a.arraySet(C.output,C.output,y,k,0),this.onData(N)):this.onData(a.shrinkBuf(C.output,C.next_out)))),C.avail_in===0&&C.avail_out===0&&(j=!0)}while((0<C.avail_in||C.avail_out===0)&&r!==c.Z_STREAM_END);return r===c.Z_STREAM_END&&(u=c.Z_FINISH),u===c.Z_FINISH?(r=l.inflateEnd(this.strm),this.onEnd(r),this.ended=!0,r===c.Z_OK):u!==c.Z_SYNC_FLUSH||(this.onEnd(c.Z_OK),!(C.avail_out=0))},i.prototype.onData=function(o){this.chunks.push(o)},i.prototype.onEnd=function(o){o===c.Z_OK&&(this.options.to==="string"?this.result=this.chunks.join(""):this.result=a.flattenChunks(this.chunks)),this.chunks=[],this.err=o,this.msg=this.strm.msg},S.Inflate=i,S.inflate=p,S.inflateRaw=function(o,d){return(d=d||{}).raw=!0,p(o,d)},S.ungzip=p},{"./utils/common":41,"./utils/strings":42,"./zlib/constants":44,"./zlib/gzheader":47,"./zlib/inflate":49,"./zlib/messages":51,"./zlib/zstream":53}],41:[function(x,G,S){var l=typeof Uint8Array<"u"&&typeof Uint16Array<"u"&&typeof Int32Array<"u";S.assign=function(c){for(var g=Array.prototype.slice.call(arguments,1);g.length;){var w=g.shift();if(w){if(typeof w!="object")throw new TypeError(w+"must be non-object");for(var f in w)w.hasOwnProperty(f)&&(c[f]=w[f])}}return c},S.shrinkBuf=function(c,g){return c.length===g?c:c.subarray?c.subarray(0,g):(c.length=g,c)};var a={arraySet:function(c,g,w,f,b){if(g.subarray&&c.subarray)c.set(g.subarray(w,w+f),b);else for(var i=0;i<f;i++)c[b+i]=g[w+i]},flattenChunks:function(c){var g,w,f,b,i,p;for(g=f=0,w=c.length;g<w;g++)f+=c[g].length;for(p=new Uint8Array(f),g=b=0,w=c.length;g<w;g++)i=c[g],p.set(i,b),b+=i.length;return p}},n={arraySet:function(c,g,w,f,b){for(var i=0;i<f;i++)c[b+i]=g[w+i]},flattenChunks:function(c){return[].concat.apply([],c)}};S.setTyped=function(c){c?(S.Buf8=Uint8Array,S.Buf16=Uint16Array,S.Buf32=Int32Array,S.assign(S,a)):(S.Buf8=Array,S.Buf16=Array,S.Buf32=Array,S.assign(S,n))},S.setTyped(l)},{}],42:[function(x,G,S){var l=x("./common"),a=!0,n=!0;try{String.fromCharCode.apply(null,[0])}catch{a=!1}try{String.fromCharCode.apply(null,new Uint8Array(1))}catch{n=!1}for(var c=new l.Buf8(256),g=0;g<256;g++)c[g]=252<=g?6:248<=g?5:240<=g?4:224<=g?3:192<=g?2:1;function w(f,b){if(b<65537&&(f.subarray&&n||!f.subarray&&a))return String.fromCharCode.apply(null,l.shrinkBuf(f,b));for(var i="",p=0;p<b;p++)i+=String.fromCharCode(f[p]);return i}c[254]=c[254]=1,S.string2buf=function(f){var b,i,p,o,d,r=f.length,u=0;for(o=0;o<r;o++)(64512&(i=f.charCodeAt(o)))==55296&&o+1<r&&(64512&(p=f.charCodeAt(o+1)))==56320&&(i=65536+(i-55296<<10)+(p-56320),o++),u+=i<128?1:i<2048?2:i<65536?3:4;for(b=new l.Buf8(u),o=d=0;d<u;o++)(64512&(i=f.charCodeAt(o)))==55296&&o+1<r&&(64512&(p=f.charCodeAt(o+1)))==56320&&(i=65536+(i-55296<<10)+(p-56320),o++),i<128?b[d++]=i:(i<2048?b[d++]=192|i>>>6:(i<65536?b[d++]=224|i>>>12:(b[d++]=240|i>>>18,b[d++]=128|i>>>12&63),b[d++]=128|i>>>6&63),b[d++]=128|63&i);return b},S.buf2binstring=function(f){return w(f,f.length)},S.binstring2buf=function(f){for(var b=new l.Buf8(f.length),i=0,p=b.length;i<p;i++)b[i]=f.charCodeAt(i);return b},S.buf2string=function(f,b){var i,p,o,d,r=b||f.length,u=new Array(2*r);for(i=p=0;i<r;)if((o=f[i++])<128)u[p++]=o;else if(4<(d=c[o]))u[p++]=65533,i+=d-1;else{for(o&=d===2?31:d===3?15:7;1<d&&i<r;)o=o<<6|63&f[i++],d--;1<d?u[p++]=65533:o<65536?u[p++]=o:(o-=65536,u[p++]=55296|o>>10&1023,u[p++]=56320|1023&o)}return w(u,p)},S.utf8border=function(f,b){var i;for((b=b||f.length)>f.length&&(b=f.length),i=b-1;0<=i&&(192&f[i])==128;)i--;return i<0||i===0?b:i+c[f[i]]>b?i:b}},{"./common":41}],43:[function(x,G,S){G.exports=function(l,a,n,c){for(var g=65535&l|0,w=l>>>16&65535|0,f=0;n!==0;){for(n-=f=2e3<n?2e3:n;w=w+(g=g+a[c++]|0)|0,--f;);g%=65521,w%=65521}return g|w<<16|0}},{}],44:[function(x,G,S){G.exports={Z_NO_FLUSH:0,Z_PARTIAL_FLUSH:1,Z_SYNC_FLUSH:2,Z_FULL_FLUSH:3,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_ERRNO:-1,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_BUF_ERROR:-5,Z_NO_COMPRESSION:0,Z_BEST_SPEED:1,Z_BEST_COMPRESSION:9,Z_DEFAULT_COMPRESSION:-1,Z_FILTERED:1,Z_HUFFMAN_ONLY:2,Z_RLE:3,Z_FIXED:4,Z_DEFAULT_STRATEGY:0,Z_BINARY:0,Z_TEXT:1,Z_UNKNOWN:2,Z_DEFLATED:8}},{}],45:[function(x,G,S){var l=(function(){for(var a,n=[],c=0;c<256;c++){a=c;for(var g=0;g<8;g++)a=1&a?3988292384^a>>>1:a>>>1;n[c]=a}return n})();G.exports=function(a,n,c,g){var w=l,f=g+c;a^=-1;for(var b=g;b<f;b++)a=a>>>8^w[255&(a^n[b])];return-1^a}},{}],46:[function(x,G,S){var l,a=x("../utils/common"),n=x("./trees"),c=x("./adler32"),g=x("./crc32"),w=x("./messages"),f=0,b=4,i=0,p=-2,o=-1,d=4,r=2,u=8,y=9,k=286,N=30,V=19,C=2*k+1,F=15,I=3,j=258,X=j+I+1,m=42,O=113,t=1,D=2,Z=3,q=4;function ee(e,R){return e.msg=w[R],R}function U(e){return(e<<1)-(4<e?9:0)}function Y(e){for(var R=e.length;0<=--R;)e[R]=0}function A(e){var R=e.state,T=R.pending;T>e.avail_out&&(T=e.avail_out),T!==0&&(a.arraySet(e.output,R.pending_buf,R.pending_out,T,e.next_out),e.next_out+=T,R.pending_out+=T,e.total_out+=T,e.avail_out-=T,R.pending-=T,R.pending===0&&(R.pending_out=0))}function _(e,R){n._tr_flush_block(e,0<=e.block_start?e.block_start:-1,e.strstart-e.block_start,R),e.block_start=e.strstart,A(e.strm)}function $(e,R){e.pending_buf[e.pending++]=R}function H(e,R){e.pending_buf[e.pending++]=R>>>8&255,e.pending_buf[e.pending++]=255&R}function M(e,R){var T,h,s=e.max_chain_length,P=e.strstart,L=e.prev_length,W=e.nice_match,E=e.strstart>e.w_size-X?e.strstart-(e.w_size-X):0,B=e.window,K=e.w_mask,z=e.prev,Q=e.strstart+j,ne=B[P+L-1],re=B[P+L];e.prev_length>=e.good_match&&(s>>=2),W>e.lookahead&&(W=e.lookahead);do if(B[(T=R)+L]===re&&B[T+L-1]===ne&&B[T]===B[P]&&B[++T]===B[P+1]){P+=2,T++;do;while(B[++P]===B[++T]&&B[++P]===B[++T]&&B[++P]===B[++T]&&B[++P]===B[++T]&&B[++P]===B[++T]&&B[++P]===B[++T]&&B[++P]===B[++T]&&B[++P]===B[++T]&&P<Q);if(h=j-(Q-P),P=Q-j,L<h){if(e.match_start=R,W<=(L=h))break;ne=B[P+L-1],re=B[P+L]}}while((R=z[R&K])>E&&--s!=0);return L<=e.lookahead?L:e.lookahead}function ie(e){var R,T,h,s,P,L,W,E,B,K,z=e.w_size;do{if(s=e.window_size-e.lookahead-e.strstart,e.strstart>=z+(z-X)){for(a.arraySet(e.window,e.window,z,z,0),e.match_start-=z,e.strstart-=z,e.block_start-=z,R=T=e.hash_size;h=e.head[--R],e.head[R]=z<=h?h-z:0,--T;);for(R=T=z;h=e.prev[--R],e.prev[R]=z<=h?h-z:0,--T;);s+=z}if(e.strm.avail_in===0)break;if(L=e.strm,W=e.window,E=e.strstart+e.lookahead,B=s,K=void 0,K=L.avail_in,B<K&&(K=B),T=K===0?0:(L.avail_in-=K,a.arraySet(W,L.input,L.next_in,K,E),L.state.wrap===1?L.adler=c(L.adler,W,K,E):L.state.wrap===2&&(L.adler=g(L.adler,W,K,E)),L.next_in+=K,L.total_in+=K,K),e.lookahead+=T,e.lookahead+e.insert>=I)for(P=e.strstart-e.insert,e.ins_h=e.window[P],e.ins_h=(e.ins_h<<e.hash_shift^e.window[P+1])&e.hash_mask;e.insert&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[P+I-1])&e.hash_mask,e.prev[P&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=P,P++,e.insert--,!(e.lookahead+e.insert<I)););}while(e.lookahead<X&&e.strm.avail_in!==0)}function de(e,R){for(var T,h;;){if(e.lookahead<X){if(ie(e),e.lookahead<X&&R===f)return t;if(e.lookahead===0)break}if(T=0,e.lookahead>=I&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+I-1])&e.hash_mask,T=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),T!==0&&e.strstart-T<=e.w_size-X&&(e.match_length=M(e,T)),e.match_length>=I)if(h=n._tr_tally(e,e.strstart-e.match_start,e.match_length-I),e.lookahead-=e.match_length,e.match_length<=e.max_lazy_match&&e.lookahead>=I){for(e.match_length--;e.strstart++,e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+I-1])&e.hash_mask,T=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart,--e.match_length!=0;);e.strstart++}else e.strstart+=e.match_length,e.match_length=0,e.ins_h=e.window[e.strstart],e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+1])&e.hash_mask;else h=n._tr_tally(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++;if(h&&(_(e,!1),e.strm.avail_out===0))return t}return e.insert=e.strstart<I-1?e.strstart:I-1,R===b?(_(e,!0),e.strm.avail_out===0?Z:q):e.last_lit&&(_(e,!1),e.strm.avail_out===0)?t:D}function te(e,R){for(var T,h,s;;){if(e.lookahead<X){if(ie(e),e.lookahead<X&&R===f)return t;if(e.lookahead===0)break}if(T=0,e.lookahead>=I&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+I-1])&e.hash_mask,T=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),e.prev_length=e.match_length,e.prev_match=e.match_start,e.match_length=I-1,T!==0&&e.prev_length<e.max_lazy_match&&e.strstart-T<=e.w_size-X&&(e.match_length=M(e,T),e.match_length<=5&&(e.strategy===1||e.match_length===I&&4096<e.strstart-e.match_start)&&(e.match_length=I-1)),e.prev_length>=I&&e.match_length<=e.prev_length){for(s=e.strstart+e.lookahead-I,h=n._tr_tally(e,e.strstart-1-e.prev_match,e.prev_length-I),e.lookahead-=e.prev_length-1,e.prev_length-=2;++e.strstart<=s&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+I-1])&e.hash_mask,T=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),--e.prev_length!=0;);if(e.match_available=0,e.match_length=I-1,e.strstart++,h&&(_(e,!1),e.strm.avail_out===0))return t}else if(e.match_available){if((h=n._tr_tally(e,0,e.window[e.strstart-1]))&&_(e,!1),e.strstart++,e.lookahead--,e.strm.avail_out===0)return t}else e.match_available=1,e.strstart++,e.lookahead--}return e.match_available&&(h=n._tr_tally(e,0,e.window[e.strstart-1]),e.match_available=0),e.insert=e.strstart<I-1?e.strstart:I-1,R===b?(_(e,!0),e.strm.avail_out===0?Z:q):e.last_lit&&(_(e,!1),e.strm.avail_out===0)?t:D}function oe(e,R,T,h,s){this.good_length=e,this.max_lazy=R,this.nice_length=T,this.max_chain=h,this.func=s}function le(){this.strm=null,this.status=0,this.pending_buf=null,this.pending_buf_size=0,this.pending_out=0,this.pending=0,this.wrap=0,this.gzhead=null,this.gzindex=0,this.method=u,this.last_flush=-1,this.w_size=0,this.w_bits=0,this.w_mask=0,this.window=null,this.window_size=0,this.prev=null,this.head=null,this.ins_h=0,this.hash_size=0,this.hash_bits=0,this.hash_mask=0,this.hash_shift=0,this.block_start=0,this.match_length=0,this.prev_match=0,this.match_available=0,this.strstart=0,this.match_start=0,this.lookahead=0,this.prev_length=0,this.max_chain_length=0,this.max_lazy_match=0,this.level=0,this.strategy=0,this.good_match=0,this.nice_match=0,this.dyn_ltree=new a.Buf16(2*C),this.dyn_dtree=new a.Buf16(2*(2*N+1)),this.bl_tree=new a.Buf16(2*(2*V+1)),Y(this.dyn_ltree),Y(this.dyn_dtree),Y(this.bl_tree),this.l_desc=null,this.d_desc=null,this.bl_desc=null,this.bl_count=new a.Buf16(F+1),this.heap=new a.Buf16(2*k+1),Y(this.heap),this.heap_len=0,this.heap_max=0,this.depth=new a.Buf16(2*k+1),Y(this.depth),this.l_buf=0,this.lit_bufsize=0,this.last_lit=0,this.d_buf=0,this.opt_len=0,this.static_len=0,this.matches=0,this.insert=0,this.bi_buf=0,this.bi_valid=0}function ae(e){var R;return e&&e.state?(e.total_in=e.total_out=0,e.data_type=r,(R=e.state).pending=0,R.pending_out=0,R.wrap<0&&(R.wrap=-R.wrap),R.status=R.wrap?m:O,e.adler=R.wrap===2?0:1,R.last_flush=f,n._tr_init(R),i):ee(e,p)}function fe(e){var R=ae(e);return R===i&&(function(T){T.window_size=2*T.w_size,Y(T.head),T.max_lazy_match=l[T.level].max_lazy,T.good_match=l[T.level].good_length,T.nice_match=l[T.level].nice_length,T.max_chain_length=l[T.level].max_chain,T.strstart=0,T.block_start=0,T.lookahead=0,T.insert=0,T.match_length=T.prev_length=I-1,T.match_available=0,T.ins_h=0})(e.state),R}function pe(e,R,T,h,s,P){if(!e)return p;var L=1;if(R===o&&(R=6),h<0?(L=0,h=-h):15<h&&(L=2,h-=16),s<1||y<s||T!==u||h<8||15<h||R<0||9<R||P<0||d<P)return ee(e,p);h===8&&(h=9);var W=new le;return(e.state=W).strm=e,W.wrap=L,W.gzhead=null,W.w_bits=h,W.w_size=1<<W.w_bits,W.w_mask=W.w_size-1,W.hash_bits=s+7,W.hash_size=1<<W.hash_bits,W.hash_mask=W.hash_size-1,W.hash_shift=~~((W.hash_bits+I-1)/I),W.window=new a.Buf8(2*W.w_size),W.head=new a.Buf16(W.hash_size),W.prev=new a.Buf16(W.w_size),W.lit_bufsize=1<<s+6,W.pending_buf_size=4*W.lit_bufsize,W.pending_buf=new a.Buf8(W.pending_buf_size),W.d_buf=1*W.lit_bufsize,W.l_buf=3*W.lit_bufsize,W.level=R,W.strategy=P,W.method=T,fe(e)}l=[new oe(0,0,0,0,function(e,R){var T=65535;for(T>e.pending_buf_size-5&&(T=e.pending_buf_size-5);;){if(e.lookahead<=1){if(ie(e),e.lookahead===0&&R===f)return t;if(e.lookahead===0)break}e.strstart+=e.lookahead,e.lookahead=0;var h=e.block_start+T;if((e.strstart===0||e.strstart>=h)&&(e.lookahead=e.strstart-h,e.strstart=h,_(e,!1),e.strm.avail_out===0)||e.strstart-e.block_start>=e.w_size-X&&(_(e,!1),e.strm.avail_out===0))return t}return e.insert=0,R===b?(_(e,!0),e.strm.avail_out===0?Z:q):(e.strstart>e.block_start&&(_(e,!1),e.strm.avail_out),t)}),new oe(4,4,8,4,de),new oe(4,5,16,8,de),new oe(4,6,32,32,de),new oe(4,4,16,16,te),new oe(8,16,32,32,te),new oe(8,16,128,128,te),new oe(8,32,128,256,te),new oe(32,128,258,1024,te),new oe(32,258,258,4096,te)],S.deflateInit=function(e,R){return pe(e,R,u,15,8,0)},S.deflateInit2=pe,S.deflateReset=fe,S.deflateResetKeep=ae,S.deflateSetHeader=function(e,R){return e&&e.state?e.state.wrap!==2?p:(e.state.gzhead=R,i):p},S.deflate=function(e,R){var T,h,s,P;if(!e||!e.state||5<R||R<0)return e?ee(e,p):p;if(h=e.state,!e.output||!e.input&&e.avail_in!==0||h.status===666&&R!==b)return ee(e,e.avail_out===0?-5:p);if(h.strm=e,T=h.last_flush,h.last_flush=R,h.status===m)if(h.wrap===2)e.adler=0,$(h,31),$(h,139),$(h,8),h.gzhead?($(h,(h.gzhead.text?1:0)+(h.gzhead.hcrc?2:0)+(h.gzhead.extra?4:0)+(h.gzhead.name?8:0)+(h.gzhead.comment?16:0)),$(h,255&h.gzhead.time),$(h,h.gzhead.time>>8&255),$(h,h.gzhead.time>>16&255),$(h,h.gzhead.time>>24&255),$(h,h.level===9?2:2<=h.strategy||h.level<2?4:0),$(h,255&h.gzhead.os),h.gzhead.extra&&h.gzhead.extra.length&&($(h,255&h.gzhead.extra.length),$(h,h.gzhead.extra.length>>8&255)),h.gzhead.hcrc&&(e.adler=g(e.adler,h.pending_buf,h.pending,0)),h.gzindex=0,h.status=69):($(h,0),$(h,0),$(h,0),$(h,0),$(h,0),$(h,h.level===9?2:2<=h.strategy||h.level<2?4:0),$(h,3),h.status=O);else{var L=u+(h.w_bits-8<<4)<<8;L|=(2<=h.strategy||h.level<2?0:h.level<6?1:h.level===6?2:3)<<6,h.strstart!==0&&(L|=32),L+=31-L%31,h.status=O,H(h,L),h.strstart!==0&&(H(h,e.adler>>>16),H(h,65535&e.adler)),e.adler=1}if(h.status===69)if(h.gzhead.extra){for(s=h.pending;h.gzindex<(65535&h.gzhead.extra.length)&&(h.pending!==h.pending_buf_size||(h.gzhead.hcrc&&h.pending>s&&(e.adler=g(e.adler,h.pending_buf,h.pending-s,s)),A(e),s=h.pending,h.pending!==h.pending_buf_size));)$(h,255&h.gzhead.extra[h.gzindex]),h.gzindex++;h.gzhead.hcrc&&h.pending>s&&(e.adler=g(e.adler,h.pending_buf,h.pending-s,s)),h.gzindex===h.gzhead.extra.length&&(h.gzindex=0,h.status=73)}else h.status=73;if(h.status===73)if(h.gzhead.name){s=h.pending;do{if(h.pending===h.pending_buf_size&&(h.gzhead.hcrc&&h.pending>s&&(e.adler=g(e.adler,h.pending_buf,h.pending-s,s)),A(e),s=h.pending,h.pending===h.pending_buf_size)){P=1;break}P=h.gzindex<h.gzhead.name.length?255&h.gzhead.name.charCodeAt(h.gzindex++):0,$(h,P)}while(P!==0);h.gzhead.hcrc&&h.pending>s&&(e.adler=g(e.adler,h.pending_buf,h.pending-s,s)),P===0&&(h.gzindex=0,h.status=91)}else h.status=91;if(h.status===91)if(h.gzhead.comment){s=h.pending;do{if(h.pending===h.pending_buf_size&&(h.gzhead.hcrc&&h.pending>s&&(e.adler=g(e.adler,h.pending_buf,h.pending-s,s)),A(e),s=h.pending,h.pending===h.pending_buf_size)){P=1;break}P=h.gzindex<h.gzhead.comment.length?255&h.gzhead.comment.charCodeAt(h.gzindex++):0,$(h,P)}while(P!==0);h.gzhead.hcrc&&h.pending>s&&(e.adler=g(e.adler,h.pending_buf,h.pending-s,s)),P===0&&(h.status=103)}else h.status=103;if(h.status===103&&(h.gzhead.hcrc?(h.pending+2>h.pending_buf_size&&A(e),h.pending+2<=h.pending_buf_size&&($(h,255&e.adler),$(h,e.adler>>8&255),e.adler=0,h.status=O)):h.status=O),h.pending!==0){if(A(e),e.avail_out===0)return h.last_flush=-1,i}else if(e.avail_in===0&&U(R)<=U(T)&&R!==b)return ee(e,-5);if(h.status===666&&e.avail_in!==0)return ee(e,-5);if(e.avail_in!==0||h.lookahead!==0||R!==f&&h.status!==666){var W=h.strategy===2?(function(E,B){for(var K;;){if(E.lookahead===0&&(ie(E),E.lookahead===0)){if(B===f)return t;break}if(E.match_length=0,K=n._tr_tally(E,0,E.window[E.strstart]),E.lookahead--,E.strstart++,K&&(_(E,!1),E.strm.avail_out===0))return t}return E.insert=0,B===b?(_(E,!0),E.strm.avail_out===0?Z:q):E.last_lit&&(_(E,!1),E.strm.avail_out===0)?t:D})(h,R):h.strategy===3?(function(E,B){for(var K,z,Q,ne,re=E.window;;){if(E.lookahead<=j){if(ie(E),E.lookahead<=j&&B===f)return t;if(E.lookahead===0)break}if(E.match_length=0,E.lookahead>=I&&0<E.strstart&&(z=re[Q=E.strstart-1])===re[++Q]&&z===re[++Q]&&z===re[++Q]){ne=E.strstart+j;do;while(z===re[++Q]&&z===re[++Q]&&z===re[++Q]&&z===re[++Q]&&z===re[++Q]&&z===re[++Q]&&z===re[++Q]&&z===re[++Q]&&Q<ne);E.match_length=j-(ne-Q),E.match_length>E.lookahead&&(E.match_length=E.lookahead)}if(E.match_length>=I?(K=n._tr_tally(E,1,E.match_length-I),E.lookahead-=E.match_length,E.strstart+=E.match_length,E.match_length=0):(K=n._tr_tally(E,0,E.window[E.strstart]),E.lookahead--,E.strstart++),K&&(_(E,!1),E.strm.avail_out===0))return t}return E.insert=0,B===b?(_(E,!0),E.strm.avail_out===0?Z:q):E.last_lit&&(_(E,!1),E.strm.avail_out===0)?t:D})(h,R):l[h.level].func(h,R);if(W!==Z&&W!==q||(h.status=666),W===t||W===Z)return e.avail_out===0&&(h.last_flush=-1),i;if(W===D&&(R===1?n._tr_align(h):R!==5&&(n._tr_stored_block(h,0,0,!1),R===3&&(Y(h.head),h.lookahead===0&&(h.strstart=0,h.block_start=0,h.insert=0))),A(e),e.avail_out===0))return h.last_flush=-1,i}return R!==b?i:h.wrap<=0?1:(h.wrap===2?($(h,255&e.adler),$(h,e.adler>>8&255),$(h,e.adler>>16&255),$(h,e.adler>>24&255),$(h,255&e.total_in),$(h,e.total_in>>8&255),$(h,e.total_in>>16&255),$(h,e.total_in>>24&255)):(H(h,e.adler>>>16),H(h,65535&e.adler)),A(e),0<h.wrap&&(h.wrap=-h.wrap),h.pending!==0?i:1)},S.deflateEnd=function(e){var R;return e&&e.state?(R=e.state.status)!==m&&R!==69&&R!==73&&R!==91&&R!==103&&R!==O&&R!==666?ee(e,p):(e.state=null,R===O?ee(e,-3):i):p},S.deflateSetDictionary=function(e,R){var T,h,s,P,L,W,E,B,K=R.length;if(!e||!e.state||(P=(T=e.state).wrap)===2||P===1&&T.status!==m||T.lookahead)return p;for(P===1&&(e.adler=c(e.adler,R,K,0)),T.wrap=0,K>=T.w_size&&(P===0&&(Y(T.head),T.strstart=0,T.block_start=0,T.insert=0),B=new a.Buf8(T.w_size),a.arraySet(B,R,K-T.w_size,T.w_size,0),R=B,K=T.w_size),L=e.avail_in,W=e.next_in,E=e.input,e.avail_in=K,e.next_in=0,e.input=R,ie(T);T.lookahead>=I;){for(h=T.strstart,s=T.lookahead-(I-1);T.ins_h=(T.ins_h<<T.hash_shift^T.window[h+I-1])&T.hash_mask,T.prev[h&T.w_mask]=T.head[T.ins_h],T.head[T.ins_h]=h,h++,--s;);T.strstart=h,T.lookahead=I-1,ie(T)}return T.strstart+=T.lookahead,T.block_start=T.strstart,T.insert=T.lookahead,T.lookahead=0,T.match_length=T.prev_length=I-1,T.match_available=0,e.next_in=W,e.input=E,e.avail_in=L,T.wrap=P,i},S.deflateInfo="pako deflate (from Nodeca project)"},{"../utils/common":41,"./adler32":43,"./crc32":45,"./messages":51,"./trees":52}],47:[function(x,G,S){G.exports=function(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name="",this.comment="",this.hcrc=0,this.done=!1}},{}],48:[function(x,G,S){G.exports=function(l,a){var n,c,g,w,f,b,i,p,o,d,r,u,y,k,N,V,C,F,I,j,X,m,O,t,D;n=l.state,c=l.next_in,t=l.input,g=c+(l.avail_in-5),w=l.next_out,D=l.output,f=w-(a-l.avail_out),b=w+(l.avail_out-257),i=n.dmax,p=n.wsize,o=n.whave,d=n.wnext,r=n.window,u=n.hold,y=n.bits,k=n.lencode,N=n.distcode,V=(1<<n.lenbits)-1,C=(1<<n.distbits)-1;e:do{y<15&&(u+=t[c++]<<y,y+=8,u+=t[c++]<<y,y+=8),F=k[u&V];t:for(;;){if(u>>>=I=F>>>24,y-=I,(I=F>>>16&255)===0)D[w++]=65535&F;else{if(!(16&I)){if((64&I)==0){F=k[(65535&F)+(u&(1<<I)-1)];continue t}if(32&I){n.mode=12;break e}l.msg="invalid literal/length code",n.mode=30;break e}j=65535&F,(I&=15)&&(y<I&&(u+=t[c++]<<y,y+=8),j+=u&(1<<I)-1,u>>>=I,y-=I),y<15&&(u+=t[c++]<<y,y+=8,u+=t[c++]<<y,y+=8),F=N[u&C];r:for(;;){if(u>>>=I=F>>>24,y-=I,!(16&(I=F>>>16&255))){if((64&I)==0){F=N[(65535&F)+(u&(1<<I)-1)];continue r}l.msg="invalid distance code",n.mode=30;break e}if(X=65535&F,y<(I&=15)&&(u+=t[c++]<<y,(y+=8)<I&&(u+=t[c++]<<y,y+=8)),i<(X+=u&(1<<I)-1)){l.msg="invalid distance too far back",n.mode=30;break e}if(u>>>=I,y-=I,(I=w-f)<X){if(o<(I=X-I)&&n.sane){l.msg="invalid distance too far back",n.mode=30;break e}if(O=r,(m=0)===d){if(m+=p-I,I<j){for(j-=I;D[w++]=r[m++],--I;);m=w-X,O=D}}else if(d<I){if(m+=p+d-I,(I-=d)<j){for(j-=I;D[w++]=r[m++],--I;);if(m=0,d<j){for(j-=I=d;D[w++]=r[m++],--I;);m=w-X,O=D}}}else if(m+=d-I,I<j){for(j-=I;D[w++]=r[m++],--I;);m=w-X,O=D}for(;2<j;)D[w++]=O[m++],D[w++]=O[m++],D[w++]=O[m++],j-=3;j&&(D[w++]=O[m++],1<j&&(D[w++]=O[m++]))}else{for(m=w-X;D[w++]=D[m++],D[w++]=D[m++],D[w++]=D[m++],2<(j-=3););j&&(D[w++]=D[m++],1<j&&(D[w++]=D[m++]))}break}}break}}while(c<g&&w<b);c-=j=y>>3,u&=(1<<(y-=j<<3))-1,l.next_in=c,l.next_out=w,l.avail_in=c<g?g-c+5:5-(c-g),l.avail_out=w<b?b-w+257:257-(w-b),n.hold=u,n.bits=y}},{}],49:[function(x,G,S){var l=x("../utils/common"),a=x("./adler32"),n=x("./crc32"),c=x("./inffast"),g=x("./inftrees"),w=1,f=2,b=0,i=-2,p=1,o=852,d=592;function r(m){return(m>>>24&255)+(m>>>8&65280)+((65280&m)<<8)+((255&m)<<24)}function u(){this.mode=0,this.last=!1,this.wrap=0,this.havedict=!1,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new l.Buf16(320),this.work=new l.Buf16(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0}function y(m){var O;return m&&m.state?(O=m.state,m.total_in=m.total_out=O.total=0,m.msg="",O.wrap&&(m.adler=1&O.wrap),O.mode=p,O.last=0,O.havedict=0,O.dmax=32768,O.head=null,O.hold=0,O.bits=0,O.lencode=O.lendyn=new l.Buf32(o),O.distcode=O.distdyn=new l.Buf32(d),O.sane=1,O.back=-1,b):i}function k(m){var O;return m&&m.state?((O=m.state).wsize=0,O.whave=0,O.wnext=0,y(m)):i}function N(m,O){var t,D;return m&&m.state?(D=m.state,O<0?(t=0,O=-O):(t=1+(O>>4),O<48&&(O&=15)),O&&(O<8||15<O)?i:(D.window!==null&&D.wbits!==O&&(D.window=null),D.wrap=t,D.wbits=O,k(m))):i}function V(m,O){var t,D;return m?(D=new u,(m.state=D).window=null,(t=N(m,O))!==b&&(m.state=null),t):i}var C,F,I=!0;function j(m){if(I){var O;for(C=new l.Buf32(512),F=new l.Buf32(32),O=0;O<144;)m.lens[O++]=8;for(;O<256;)m.lens[O++]=9;for(;O<280;)m.lens[O++]=7;for(;O<288;)m.lens[O++]=8;for(g(w,m.lens,0,288,C,0,m.work,{bits:9}),O=0;O<32;)m.lens[O++]=5;g(f,m.lens,0,32,F,0,m.work,{bits:5}),I=!1}m.lencode=C,m.lenbits=9,m.distcode=F,m.distbits=5}function X(m,O,t,D){var Z,q=m.state;return q.window===null&&(q.wsize=1<<q.wbits,q.wnext=0,q.whave=0,q.window=new l.Buf8(q.wsize)),D>=q.wsize?(l.arraySet(q.window,O,t-q.wsize,q.wsize,0),q.wnext=0,q.whave=q.wsize):(D<(Z=q.wsize-q.wnext)&&(Z=D),l.arraySet(q.window,O,t-D,Z,q.wnext),(D-=Z)?(l.arraySet(q.window,O,t-D,D,0),q.wnext=D,q.whave=q.wsize):(q.wnext+=Z,q.wnext===q.wsize&&(q.wnext=0),q.whave<q.wsize&&(q.whave+=Z))),0}S.inflateReset=k,S.inflateReset2=N,S.inflateResetKeep=y,S.inflateInit=function(m){return V(m,15)},S.inflateInit2=V,S.inflate=function(m,O){var t,D,Z,q,ee,U,Y,A,_,$,H,M,ie,de,te,oe,le,ae,fe,pe,e,R,T,h,s=0,P=new l.Buf8(4),L=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];if(!m||!m.state||!m.output||!m.input&&m.avail_in!==0)return i;(t=m.state).mode===12&&(t.mode=13),ee=m.next_out,Z=m.output,Y=m.avail_out,q=m.next_in,D=m.input,U=m.avail_in,A=t.hold,_=t.bits,$=U,H=Y,R=b;e:for(;;)switch(t.mode){case p:if(t.wrap===0){t.mode=13;break}for(;_<16;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}if(2&t.wrap&&A===35615){P[t.check=0]=255&A,P[1]=A>>>8&255,t.check=n(t.check,P,2,0),_=A=0,t.mode=2;break}if(t.flags=0,t.head&&(t.head.done=!1),!(1&t.wrap)||(((255&A)<<8)+(A>>8))%31){m.msg="incorrect header check",t.mode=30;break}if((15&A)!=8){m.msg="unknown compression method",t.mode=30;break}if(_-=4,e=8+(15&(A>>>=4)),t.wbits===0)t.wbits=e;else if(e>t.wbits){m.msg="invalid window size",t.mode=30;break}t.dmax=1<<e,m.adler=t.check=1,t.mode=512&A?10:12,_=A=0;break;case 2:for(;_<16;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}if(t.flags=A,(255&t.flags)!=8){m.msg="unknown compression method",t.mode=30;break}if(57344&t.flags){m.msg="unknown header flags set",t.mode=30;break}t.head&&(t.head.text=A>>8&1),512&t.flags&&(P[0]=255&A,P[1]=A>>>8&255,t.check=n(t.check,P,2,0)),_=A=0,t.mode=3;case 3:for(;_<32;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}t.head&&(t.head.time=A),512&t.flags&&(P[0]=255&A,P[1]=A>>>8&255,P[2]=A>>>16&255,P[3]=A>>>24&255,t.check=n(t.check,P,4,0)),_=A=0,t.mode=4;case 4:for(;_<16;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}t.head&&(t.head.xflags=255&A,t.head.os=A>>8),512&t.flags&&(P[0]=255&A,P[1]=A>>>8&255,t.check=n(t.check,P,2,0)),_=A=0,t.mode=5;case 5:if(1024&t.flags){for(;_<16;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}t.length=A,t.head&&(t.head.extra_len=A),512&t.flags&&(P[0]=255&A,P[1]=A>>>8&255,t.check=n(t.check,P,2,0)),_=A=0}else t.head&&(t.head.extra=null);t.mode=6;case 6:if(1024&t.flags&&(U<(M=t.length)&&(M=U),M&&(t.head&&(e=t.head.extra_len-t.length,t.head.extra||(t.head.extra=new Array(t.head.extra_len)),l.arraySet(t.head.extra,D,q,M,e)),512&t.flags&&(t.check=n(t.check,D,M,q)),U-=M,q+=M,t.length-=M),t.length))break e;t.length=0,t.mode=7;case 7:if(2048&t.flags){if(U===0)break e;for(M=0;e=D[q+M++],t.head&&e&&t.length<65536&&(t.head.name+=String.fromCharCode(e)),e&&M<U;);if(512&t.flags&&(t.check=n(t.check,D,M,q)),U-=M,q+=M,e)break e}else t.head&&(t.head.name=null);t.length=0,t.mode=8;case 8:if(4096&t.flags){if(U===0)break e;for(M=0;e=D[q+M++],t.head&&e&&t.length<65536&&(t.head.comment+=String.fromCharCode(e)),e&&M<U;);if(512&t.flags&&(t.check=n(t.check,D,M,q)),U-=M,q+=M,e)break e}else t.head&&(t.head.comment=null);t.mode=9;case 9:if(512&t.flags){for(;_<16;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}if(A!==(65535&t.check)){m.msg="header crc mismatch",t.mode=30;break}_=A=0}t.head&&(t.head.hcrc=t.flags>>9&1,t.head.done=!0),m.adler=t.check=0,t.mode=12;break;case 10:for(;_<32;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}m.adler=t.check=r(A),_=A=0,t.mode=11;case 11:if(t.havedict===0)return m.next_out=ee,m.avail_out=Y,m.next_in=q,m.avail_in=U,t.hold=A,t.bits=_,2;m.adler=t.check=1,t.mode=12;case 12:if(O===5||O===6)break e;case 13:if(t.last){A>>>=7&_,_-=7&_,t.mode=27;break}for(;_<3;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}switch(t.last=1&A,_-=1,3&(A>>>=1)){case 0:t.mode=14;break;case 1:if(j(t),t.mode=20,O!==6)break;A>>>=2,_-=2;break e;case 2:t.mode=17;break;case 3:m.msg="invalid block type",t.mode=30}A>>>=2,_-=2;break;case 14:for(A>>>=7&_,_-=7&_;_<32;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}if((65535&A)!=(A>>>16^65535)){m.msg="invalid stored block lengths",t.mode=30;break}if(t.length=65535&A,_=A=0,t.mode=15,O===6)break e;case 15:t.mode=16;case 16:if(M=t.length){if(U<M&&(M=U),Y<M&&(M=Y),M===0)break e;l.arraySet(Z,D,q,M,ee),U-=M,q+=M,Y-=M,ee+=M,t.length-=M;break}t.mode=12;break;case 17:for(;_<14;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}if(t.nlen=257+(31&A),A>>>=5,_-=5,t.ndist=1+(31&A),A>>>=5,_-=5,t.ncode=4+(15&A),A>>>=4,_-=4,286<t.nlen||30<t.ndist){m.msg="too many length or distance symbols",t.mode=30;break}t.have=0,t.mode=18;case 18:for(;t.have<t.ncode;){for(;_<3;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}t.lens[L[t.have++]]=7&A,A>>>=3,_-=3}for(;t.have<19;)t.lens[L[t.have++]]=0;if(t.lencode=t.lendyn,t.lenbits=7,T={bits:t.lenbits},R=g(0,t.lens,0,19,t.lencode,0,t.work,T),t.lenbits=T.bits,R){m.msg="invalid code lengths set",t.mode=30;break}t.have=0,t.mode=19;case 19:for(;t.have<t.nlen+t.ndist;){for(;oe=(s=t.lencode[A&(1<<t.lenbits)-1])>>>16&255,le=65535&s,!((te=s>>>24)<=_);){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}if(le<16)A>>>=te,_-=te,t.lens[t.have++]=le;else{if(le===16){for(h=te+2;_<h;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}if(A>>>=te,_-=te,t.have===0){m.msg="invalid bit length repeat",t.mode=30;break}e=t.lens[t.have-1],M=3+(3&A),A>>>=2,_-=2}else if(le===17){for(h=te+3;_<h;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}_-=te,e=0,M=3+(7&(A>>>=te)),A>>>=3,_-=3}else{for(h=te+7;_<h;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}_-=te,e=0,M=11+(127&(A>>>=te)),A>>>=7,_-=7}if(t.have+M>t.nlen+t.ndist){m.msg="invalid bit length repeat",t.mode=30;break}for(;M--;)t.lens[t.have++]=e}}if(t.mode===30)break;if(t.lens[256]===0){m.msg="invalid code -- missing end-of-block",t.mode=30;break}if(t.lenbits=9,T={bits:t.lenbits},R=g(w,t.lens,0,t.nlen,t.lencode,0,t.work,T),t.lenbits=T.bits,R){m.msg="invalid literal/lengths set",t.mode=30;break}if(t.distbits=6,t.distcode=t.distdyn,T={bits:t.distbits},R=g(f,t.lens,t.nlen,t.ndist,t.distcode,0,t.work,T),t.distbits=T.bits,R){m.msg="invalid distances set",t.mode=30;break}if(t.mode=20,O===6)break e;case 20:t.mode=21;case 21:if(6<=U&&258<=Y){m.next_out=ee,m.avail_out=Y,m.next_in=q,m.avail_in=U,t.hold=A,t.bits=_,c(m,H),ee=m.next_out,Z=m.output,Y=m.avail_out,q=m.next_in,D=m.input,U=m.avail_in,A=t.hold,_=t.bits,t.mode===12&&(t.back=-1);break}for(t.back=0;oe=(s=t.lencode[A&(1<<t.lenbits)-1])>>>16&255,le=65535&s,!((te=s>>>24)<=_);){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}if(oe&&(240&oe)==0){for(ae=te,fe=oe,pe=le;oe=(s=t.lencode[pe+((A&(1<<ae+fe)-1)>>ae)])>>>16&255,le=65535&s,!(ae+(te=s>>>24)<=_);){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}A>>>=ae,_-=ae,t.back+=ae}if(A>>>=te,_-=te,t.back+=te,t.length=le,oe===0){t.mode=26;break}if(32&oe){t.back=-1,t.mode=12;break}if(64&oe){m.msg="invalid literal/length code",t.mode=30;break}t.extra=15&oe,t.mode=22;case 22:if(t.extra){for(h=t.extra;_<h;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}t.length+=A&(1<<t.extra)-1,A>>>=t.extra,_-=t.extra,t.back+=t.extra}t.was=t.length,t.mode=23;case 23:for(;oe=(s=t.distcode[A&(1<<t.distbits)-1])>>>16&255,le=65535&s,!((te=s>>>24)<=_);){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}if((240&oe)==0){for(ae=te,fe=oe,pe=le;oe=(s=t.distcode[pe+((A&(1<<ae+fe)-1)>>ae)])>>>16&255,le=65535&s,!(ae+(te=s>>>24)<=_);){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}A>>>=ae,_-=ae,t.back+=ae}if(A>>>=te,_-=te,t.back+=te,64&oe){m.msg="invalid distance code",t.mode=30;break}t.offset=le,t.extra=15&oe,t.mode=24;case 24:if(t.extra){for(h=t.extra;_<h;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}t.offset+=A&(1<<t.extra)-1,A>>>=t.extra,_-=t.extra,t.back+=t.extra}if(t.offset>t.dmax){m.msg="invalid distance too far back",t.mode=30;break}t.mode=25;case 25:if(Y===0)break e;if(M=H-Y,t.offset>M){if((M=t.offset-M)>t.whave&&t.sane){m.msg="invalid distance too far back",t.mode=30;break}ie=M>t.wnext?(M-=t.wnext,t.wsize-M):t.wnext-M,M>t.length&&(M=t.length),de=t.window}else de=Z,ie=ee-t.offset,M=t.length;for(Y<M&&(M=Y),Y-=M,t.length-=M;Z[ee++]=de[ie++],--M;);t.length===0&&(t.mode=21);break;case 26:if(Y===0)break e;Z[ee++]=t.length,Y--,t.mode=21;break;case 27:if(t.wrap){for(;_<32;){if(U===0)break e;U--,A|=D[q++]<<_,_+=8}if(H-=Y,m.total_out+=H,t.total+=H,H&&(m.adler=t.check=t.flags?n(t.check,Z,H,ee-H):a(t.check,Z,H,ee-H)),H=Y,(t.flags?A:r(A))!==t.check){m.msg="incorrect data check",t.mode=30;break}_=A=0}t.mode=28;case 28:if(t.wrap&&t.flags){for(;_<32;){if(U===0)break e;U--,A+=D[q++]<<_,_+=8}if(A!==(4294967295&t.total)){m.msg="incorrect length check",t.mode=30;break}_=A=0}t.mode=29;case 29:R=1;break e;case 30:R=-3;break e;case 31:return-4;default:return i}return m.next_out=ee,m.avail_out=Y,m.next_in=q,m.avail_in=U,t.hold=A,t.bits=_,(t.wsize||H!==m.avail_out&&t.mode<30&&(t.mode<27||O!==4))&&X(m,m.output,m.next_out,H-m.avail_out)?(t.mode=31,-4):($-=m.avail_in,H-=m.avail_out,m.total_in+=$,m.total_out+=H,t.total+=H,t.wrap&&H&&(m.adler=t.check=t.flags?n(t.check,Z,H,m.next_out-H):a(t.check,Z,H,m.next_out-H)),m.data_type=t.bits+(t.last?64:0)+(t.mode===12?128:0)+(t.mode===20||t.mode===15?256:0),($==0&&H===0||O===4)&&R===b&&(R=-5),R)},S.inflateEnd=function(m){if(!m||!m.state)return i;var O=m.state;return O.window&&(O.window=null),m.state=null,b},S.inflateGetHeader=function(m,O){var t;return m&&m.state?(2&(t=m.state).wrap)==0?i:((t.head=O).done=!1,b):i},S.inflateSetDictionary=function(m,O){var t,D=O.length;return m&&m.state?(t=m.state).wrap!==0&&t.mode!==11?i:t.mode===11&&a(1,O,D,0)!==t.check?-3:X(m,O,D,D)?(t.mode=31,-4):(t.havedict=1,b):i},S.inflateInfo="pako inflate (from Nodeca project)"},{"../utils/common":41,"./adler32":43,"./crc32":45,"./inffast":48,"./inftrees":50}],50:[function(x,G,S){var l=x("../utils/common"),a=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0],n=[16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78],c=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0],g=[16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64];G.exports=function(w,f,b,i,p,o,d,r){var u,y,k,N,V,C,F,I,j,X=r.bits,m=0,O=0,t=0,D=0,Z=0,q=0,ee=0,U=0,Y=0,A=0,_=null,$=0,H=new l.Buf16(16),M=new l.Buf16(16),ie=null,de=0;for(m=0;m<=15;m++)H[m]=0;for(O=0;O<i;O++)H[f[b+O]]++;for(Z=X,D=15;1<=D&&H[D]===0;D--);if(D<Z&&(Z=D),D===0)return p[o++]=20971520,p[o++]=20971520,r.bits=1,0;for(t=1;t<D&&H[t]===0;t++);for(Z<t&&(Z=t),m=U=1;m<=15;m++)if(U<<=1,(U-=H[m])<0)return-1;if(0<U&&(w===0||D!==1))return-1;for(M[1]=0,m=1;m<15;m++)M[m+1]=M[m]+H[m];for(O=0;O<i;O++)f[b+O]!==0&&(d[M[f[b+O]]++]=O);if(C=w===0?(_=ie=d,19):w===1?(_=a,$-=257,ie=n,de-=257,256):(_=c,ie=g,-1),m=t,V=o,ee=O=A=0,k=-1,N=(Y=1<<(q=Z))-1,w===1&&852<Y||w===2&&592<Y)return 1;for(;;){for(F=m-ee,j=d[O]<C?(I=0,d[O]):d[O]>C?(I=ie[de+d[O]],_[$+d[O]]):(I=96,0),u=1<<m-ee,t=y=1<<q;p[V+(A>>ee)+(y-=u)]=F<<24|I<<16|j|0,y!==0;);for(u=1<<m-1;A&u;)u>>=1;if(u!==0?(A&=u-1,A+=u):A=0,O++,--H[m]==0){if(m===D)break;m=f[b+d[O]]}if(Z<m&&(A&N)!==k){for(ee===0&&(ee=Z),V+=t,U=1<<(q=m-ee);q+ee<D&&!((U-=H[q+ee])<=0);)q++,U<<=1;if(Y+=1<<q,w===1&&852<Y||w===2&&592<Y)return 1;p[k=A&N]=Z<<24|q<<16|V-o|0}}return A!==0&&(p[V+A]=m-ee<<24|64<<16|0),r.bits=Z,0}},{"../utils/common":41}],51:[function(x,G,S){G.exports={2:"need dictionary",1:"stream end",0:"","-1":"file error","-2":"stream error","-3":"data error","-4":"insufficient memory","-5":"buffer error","-6":"incompatible version"}},{}],52:[function(x,G,S){var l=x("../utils/common"),a=0,n=1;function c(s){for(var P=s.length;0<=--P;)s[P]=0}var g=0,w=29,f=256,b=f+1+w,i=30,p=19,o=2*b+1,d=15,r=16,u=7,y=256,k=16,N=17,V=18,C=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0],F=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13],I=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7],j=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],X=new Array(2*(b+2));c(X);var m=new Array(2*i);c(m);var O=new Array(512);c(O);var t=new Array(256);c(t);var D=new Array(w);c(D);var Z,q,ee,U=new Array(i);function Y(s,P,L,W,E){this.static_tree=s,this.extra_bits=P,this.extra_base=L,this.elems=W,this.max_length=E,this.has_stree=s&&s.length}function A(s,P){this.dyn_tree=s,this.max_code=0,this.stat_desc=P}function _(s){return s<256?O[s]:O[256+(s>>>7)]}function $(s,P){s.pending_buf[s.pending++]=255&P,s.pending_buf[s.pending++]=P>>>8&255}function H(s,P,L){s.bi_valid>r-L?(s.bi_buf|=P<<s.bi_valid&65535,$(s,s.bi_buf),s.bi_buf=P>>r-s.bi_valid,s.bi_valid+=L-r):(s.bi_buf|=P<<s.bi_valid&65535,s.bi_valid+=L)}function M(s,P,L){H(s,L[2*P],L[2*P+1])}function ie(s,P){for(var L=0;L|=1&s,s>>>=1,L<<=1,0<--P;);return L>>>1}function de(s,P,L){var W,E,B=new Array(d+1),K=0;for(W=1;W<=d;W++)B[W]=K=K+L[W-1]<<1;for(E=0;E<=P;E++){var z=s[2*E+1];z!==0&&(s[2*E]=ie(B[z]++,z))}}function te(s){var P;for(P=0;P<b;P++)s.dyn_ltree[2*P]=0;for(P=0;P<i;P++)s.dyn_dtree[2*P]=0;for(P=0;P<p;P++)s.bl_tree[2*P]=0;s.dyn_ltree[2*y]=1,s.opt_len=s.static_len=0,s.last_lit=s.matches=0}function oe(s){8<s.bi_valid?$(s,s.bi_buf):0<s.bi_valid&&(s.pending_buf[s.pending++]=s.bi_buf),s.bi_buf=0,s.bi_valid=0}function le(s,P,L,W){var E=2*P,B=2*L;return s[E]<s[B]||s[E]===s[B]&&W[P]<=W[L]}function ae(s,P,L){for(var W=s.heap[L],E=L<<1;E<=s.heap_len&&(E<s.heap_len&&le(P,s.heap[E+1],s.heap[E],s.depth)&&E++,!le(P,W,s.heap[E],s.depth));)s.heap[L]=s.heap[E],L=E,E<<=1;s.heap[L]=W}function fe(s,P,L){var W,E,B,K,z=0;if(s.last_lit!==0)for(;W=s.pending_buf[s.d_buf+2*z]<<8|s.pending_buf[s.d_buf+2*z+1],E=s.pending_buf[s.l_buf+z],z++,W===0?M(s,E,P):(M(s,(B=t[E])+f+1,P),(K=C[B])!==0&&H(s,E-=D[B],K),M(s,B=_(--W),L),(K=F[B])!==0&&H(s,W-=U[B],K)),z<s.last_lit;);M(s,y,P)}function pe(s,P){var L,W,E,B=P.dyn_tree,K=P.stat_desc.static_tree,z=P.stat_desc.has_stree,Q=P.stat_desc.elems,ne=-1;for(s.heap_len=0,s.heap_max=o,L=0;L<Q;L++)B[2*L]!==0?(s.heap[++s.heap_len]=ne=L,s.depth[L]=0):B[2*L+1]=0;for(;s.heap_len<2;)B[2*(E=s.heap[++s.heap_len]=ne<2?++ne:0)]=1,s.depth[E]=0,s.opt_len--,z&&(s.static_len-=K[2*E+1]);for(P.max_code=ne,L=s.heap_len>>1;1<=L;L--)ae(s,B,L);for(E=Q;L=s.heap[1],s.heap[1]=s.heap[s.heap_len--],ae(s,B,1),W=s.heap[1],s.heap[--s.heap_max]=L,s.heap[--s.heap_max]=W,B[2*E]=B[2*L]+B[2*W],s.depth[E]=(s.depth[L]>=s.depth[W]?s.depth[L]:s.depth[W])+1,B[2*L+1]=B[2*W+1]=E,s.heap[1]=E++,ae(s,B,1),2<=s.heap_len;);s.heap[--s.heap_max]=s.heap[1],(function(re,he){var Se,me,Pe,se,Te,Re,xe=he.dyn_tree,He=he.max_code,nt=he.stat_desc.static_tree,it=he.stat_desc.has_stree,at=he.stat_desc.extra_bits,Ke=he.stat_desc.extra_base,Ne=he.stat_desc.max_length,Ie=0;for(se=0;se<=d;se++)re.bl_count[se]=0;for(xe[2*re.heap[re.heap_max]+1]=0,Se=re.heap_max+1;Se<o;Se++)Ne<(se=xe[2*xe[2*(me=re.heap[Se])+1]+1]+1)&&(se=Ne,Ie++),xe[2*me+1]=se,He<me||(re.bl_count[se]++,Te=0,Ke<=me&&(Te=at[me-Ke]),Re=xe[2*me],re.opt_len+=Re*(se+Te),it&&(re.static_len+=Re*(nt[2*me+1]+Te)));if(Ie!==0){do{for(se=Ne-1;re.bl_count[se]===0;)se--;re.bl_count[se]--,re.bl_count[se+1]+=2,re.bl_count[Ne]--,Ie-=2}while(0<Ie);for(se=Ne;se!==0;se--)for(me=re.bl_count[se];me!==0;)He<(Pe=re.heap[--Se])||(xe[2*Pe+1]!==se&&(re.opt_len+=(se-xe[2*Pe+1])*xe[2*Pe],xe[2*Pe+1]=se),me--)}})(s,P),de(B,ne,s.bl_count)}function e(s,P,L){var W,E,B=-1,K=P[1],z=0,Q=7,ne=4;for(K===0&&(Q=138,ne=3),P[2*(L+1)+1]=65535,W=0;W<=L;W++)E=K,K=P[2*(W+1)+1],++z<Q&&E===K||(z<ne?s.bl_tree[2*E]+=z:E!==0?(E!==B&&s.bl_tree[2*E]++,s.bl_tree[2*k]++):z<=10?s.bl_tree[2*N]++:s.bl_tree[2*V]++,B=E,ne=(z=0)===K?(Q=138,3):E===K?(Q=6,3):(Q=7,4))}function R(s,P,L){var W,E,B=-1,K=P[1],z=0,Q=7,ne=4;for(K===0&&(Q=138,ne=3),W=0;W<=L;W++)if(E=K,K=P[2*(W+1)+1],!(++z<Q&&E===K)){if(z<ne)for(;M(s,E,s.bl_tree),--z!=0;);else E!==0?(E!==B&&(M(s,E,s.bl_tree),z--),M(s,k,s.bl_tree),H(s,z-3,2)):z<=10?(M(s,N,s.bl_tree),H(s,z-3,3)):(M(s,V,s.bl_tree),H(s,z-11,7));B=E,ne=(z=0)===K?(Q=138,3):E===K?(Q=6,3):(Q=7,4)}}c(U);var T=!1;function h(s,P,L,W){H(s,(g<<1)+(W?1:0),3),(function(E,B,K,z){oe(E),$(E,K),$(E,~K),l.arraySet(E.pending_buf,E.window,B,K,E.pending),E.pending+=K})(s,P,L)}S._tr_init=function(s){T||((function(){var P,L,W,E,B,K=new Array(d+1);for(E=W=0;E<w-1;E++)for(D[E]=W,P=0;P<1<<C[E];P++)t[W++]=E;for(t[W-1]=E,E=B=0;E<16;E++)for(U[E]=B,P=0;P<1<<F[E];P++)O[B++]=E;for(B>>=7;E<i;E++)for(U[E]=B<<7,P=0;P<1<<F[E]-7;P++)O[256+B++]=E;for(L=0;L<=d;L++)K[L]=0;for(P=0;P<=143;)X[2*P+1]=8,P++,K[8]++;for(;P<=255;)X[2*P+1]=9,P++,K[9]++;for(;P<=279;)X[2*P+1]=7,P++,K[7]++;for(;P<=287;)X[2*P+1]=8,P++,K[8]++;for(de(X,b+1,K),P=0;P<i;P++)m[2*P+1]=5,m[2*P]=ie(P,5);Z=new Y(X,C,f+1,b,d),q=new Y(m,F,0,i,d),ee=new Y(new Array(0),I,0,p,u)})(),T=!0),s.l_desc=new A(s.dyn_ltree,Z),s.d_desc=new A(s.dyn_dtree,q),s.bl_desc=new A(s.bl_tree,ee),s.bi_buf=0,s.bi_valid=0,te(s)},S._tr_stored_block=h,S._tr_flush_block=function(s,P,L,W){var E,B,K=0;0<s.level?(s.strm.data_type===2&&(s.strm.data_type=(function(z){var Q,ne=4093624447;for(Q=0;Q<=31;Q++,ne>>>=1)if(1&ne&&z.dyn_ltree[2*Q]!==0)return a;if(z.dyn_ltree[18]!==0||z.dyn_ltree[20]!==0||z.dyn_ltree[26]!==0)return n;for(Q=32;Q<f;Q++)if(z.dyn_ltree[2*Q]!==0)return n;return a})(s)),pe(s,s.l_desc),pe(s,s.d_desc),K=(function(z){var Q;for(e(z,z.dyn_ltree,z.l_desc.max_code),e(z,z.dyn_dtree,z.d_desc.max_code),pe(z,z.bl_desc),Q=p-1;3<=Q&&z.bl_tree[2*j[Q]+1]===0;Q--);return z.opt_len+=3*(Q+1)+5+5+4,Q})(s),E=s.opt_len+3+7>>>3,(B=s.static_len+3+7>>>3)<=E&&(E=B)):E=B=L+5,L+4<=E&&P!==-1?h(s,P,L,W):s.strategy===4||B===E?(H(s,2+(W?1:0),3),fe(s,X,m)):(H(s,4+(W?1:0),3),(function(z,Q,ne,re){var he;for(H(z,Q-257,5),H(z,ne-1,5),H(z,re-4,4),he=0;he<re;he++)H(z,z.bl_tree[2*j[he]+1],3);R(z,z.dyn_ltree,Q-1),R(z,z.dyn_dtree,ne-1)})(s,s.l_desc.max_code+1,s.d_desc.max_code+1,K+1),fe(s,s.dyn_ltree,s.dyn_dtree)),te(s),W&&oe(s)},S._tr_tally=function(s,P,L){return s.pending_buf[s.d_buf+2*s.last_lit]=P>>>8&255,s.pending_buf[s.d_buf+2*s.last_lit+1]=255&P,s.pending_buf[s.l_buf+s.last_lit]=255&L,s.last_lit++,P===0?s.dyn_ltree[2*L]++:(s.matches++,P--,s.dyn_ltree[2*(t[L]+f+1)]++,s.dyn_dtree[2*_(P)]++),s.last_lit===s.lit_bufsize-1},S._tr_align=function(s){H(s,2,3),M(s,y,X),(function(P){P.bi_valid===16?($(P,P.bi_buf),P.bi_buf=0,P.bi_valid=0):8<=P.bi_valid&&(P.pending_buf[P.pending++]=255&P.bi_buf,P.bi_buf>>=8,P.bi_valid-=8)})(s)}},{"../utils/common":41}],53:[function(x,G,S){G.exports=function(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg="",this.state=null,this.data_type=2,this.adler=0}},{}],54:[function(x,G,S){(function(l){(function(a,n){if(!a.setImmediate){var c,g,w,f,b=1,i={},p=!1,o=a.document,d=Object.getPrototypeOf&&Object.getPrototypeOf(a);d=d&&d.setTimeout?d:a,c={}.toString.call(a.process)==="[object process]"?function(k){process.nextTick(function(){u(k)})}:(function(){if(a.postMessage&&!a.importScripts){var k=!0,N=a.onmessage;return a.onmessage=function(){k=!1},a.postMessage("","*"),a.onmessage=N,k}})()?(f="setImmediate$"+Math.random()+"$",a.addEventListener?a.addEventListener("message",y,!1):a.attachEvent("onmessage",y),function(k){a.postMessage(f+k,"*")}):a.MessageChannel?((w=new MessageChannel).port1.onmessage=function(k){u(k.data)},function(k){w.port2.postMessage(k)}):o&&"onreadystatechange"in o.createElement("script")?(g=o.documentElement,function(k){var N=o.createElement("script");N.onreadystatechange=function(){u(k),N.onreadystatechange=null,g.removeChild(N),N=null},g.appendChild(N)}):function(k){setTimeout(u,0,k)},d.setImmediate=function(k){typeof k!="function"&&(k=new Function(""+k));for(var N=new Array(arguments.length-1),V=0;V<N.length;V++)N[V]=arguments[V+1];var C={callback:k,args:N};return i[b]=C,c(b),b++},d.clearImmediate=r}function r(k){delete i[k]}function u(k){if(p)setTimeout(u,0,k);else{var N=i[k];if(N){p=!0;try{(function(V){var C=V.callback,F=V.args;switch(F.length){case 0:C();break;case 1:C(F[0]);break;case 2:C(F[0],F[1]);break;case 3:C(F[0],F[1],F[2]);break;default:C.apply(n,F)}})(N)}finally{r(k),p=!1}}}}function y(k){k.source===a&&typeof k.data=="string"&&k.data.indexOf(f)===0&&u(+k.data.slice(f.length))}})(typeof self>"u"?l===void 0?this:l:self)}).call(this,typeof Ce<"u"?Ce:typeof self<"u"?self:typeof window<"u"?window:{})},{}]},{},[10])(10)})})(We)),We.exports}var yt=bt();const vt=st(yt),we="/".replace(/\/$/,""),Ae="https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk",St="https://apps.apple.com/us/app/wireguard/id1451685025",Be=`${we}/downloads/ProxhqVPN-Windows-x64.zip`,je=`${we}/downloads/ProxhqVPN-macOS-arm64.zip`,rt=`${we}/downloads/ProxhqVPN-macOS-x64.zip`,ot=`${we}/downloads/ProxhqVPN-Linux-x64.zip`,ze=`${we}/downloads/ProxhqVPN-Android.zip`,Me=`${we}/downloads/ProxhqVPN-iOS.zip`,Pt=`${we}/downloads/ProxhqVPN-Universal-NodeJS.zip`,qe=`${we}/downloads/ProxhqVPN-ALL-PLATFORMS.zip`,ce="2.1.0",ve="June 6, 2026",Nt="https://apps.apple.com/us/app/wireguard/id1441195209",Fe="https://play.google.com/store/apps/details?id=com.wireguard.android",kt="https://apps.apple.com/us/app/wireguard/id1451685025";function Et(){const J=navigator.userAgent;return/AFTB|AFTM|AFTT|AFTS|AFTA|AFTSS|AFTMM|AFTKL|AFTR|AFTDI|AFTBU/i.test(J)||/Silk|Android.*AmazonWebView/i.test(J)&&/Amazon/i.test(J)?"firestick":null}function _t(){const J=navigator.userAgent;return/AFTB|AFTM|AFTT|AFTS|AFTA|AFTSS|AFTMM|AFTKL|AFTR|AFTDI|AFTBU|Silk/i.test(J)&&/Amazon/i.test(J)?"fire":/iPhone|iPad/i.test(J)?"ios":/Android/i.test(J)?"android":/Mac/i.test(J)?"mac":/Win/i.test(J)?"windows":/Linux/i.test(J)?"linux":"unknown"}function At({children:J,label:ge}){return v.jsxs("div",{className:"mt-1.5 mb-1",children:[ge&&v.jsx("div",{className:"text-[8px] text-primary/30 font-mono uppercase tracking-widest mb-1",children:ge}),v.jsxs("pre",{className:"relative group font-mono text-[10px] bg-black border border-primary/15 rounded p-2.5 text-primary/70 overflow-x-auto whitespace-pre-wrap leading-relaxed",children:[J,v.jsx("button",{onClick:()=>navigator.clipboard.writeText(J),className:"absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary/30 hover:text-primary",children:v.jsx(mt,{className:"w-3 h-3"})})]})]})}const Ye=[{group:"DESKTOP & LAPTOP",icon:ke,color:"text-blue-400",items:[{id:"windows",name:"Windows",os:"Windows 10 / 11",icon:ke,iconColor:"text-blue-400",badge:"Auto-Configure Installer",badgeColor:"text-blue-400 border-blue-500/30 bg-blue-900/10",canInstall:!0,downloads:[{label:`Download ProxhqVPN v${ce} — Windows x64 (.zip)`,url:Be,variant:"primary",icon:ue}],steps:[{text:`v${ce} — ${ve}. Includes ⚔ Counter Attack tab, Ghost Trap honeypot, DNS Sinkhole, Network Monitor, SIEM, OSINT Recon, and all recent security upgrades. Force-update available on Downloads page.`},{text:"Download the ProxhqVPN .zip, extract it, and run 'start.bat'. Windows will open the dashboard in your browser automatically."},{text:"SmartScreen warning? Click 'More info' → 'Run anyway'. Normal for any installer downloaded outside the Microsoft Store."},{text:"Screen 1 — Welcome: overview of everything that will install automatically. Click 'Get Started'."},{text:"Screen 2 — License & Tunnel Mode: tick the checkbox to accept, then pick Split Tunnel (★ Recommended — your apps work normally) or Full Tunnel (all traffic encrypted)."},{text:"Screen 3 — Silent WireGuard Install: the wizard downloads WireGuard from wireguard.com and runs it with the /S silent flag. The UI stays fully responsive throughout — a live log and progress bar show every step. Phase badges track: ① WireGuard → ② Sign In → ③ Activate."},{text:"Screen 4 — Sign In: your default browser (Edge/Chrome) opens the ProxhqVPN sign-in page. Sign in, go to WireGuard Config → Generate Config → Download. The wizard watches your Downloads folder — the moment the .conf file lands it picks it up automatically."},{text:"Screen 5 — Auto-Activate: the wizard reads your config, patches AllowedIPs for your chosen tunnel mode, saves it to the WireGuard directory, and runs wireguard.exe /installtunnel — VPN goes live with no extra clicks."},{text:"Screen 6 — Done: green/orange status dots confirm WireGuard, tunnel state, mode, and shortcuts. Click 'Open ProxhqVPN' to reach your dashboard."}],note:"The installer requests admin rights once at launch (needed for WireGuard and tunnel activation). WireGuard installs silently from wireguard.com with no extra prompts. Your default browser handles sign-in so modern auth works correctly."},{id:"macos",name:"macOS",os:"macOS 11+  ·  Intel & Apple Silicon",icon:ke,iconColor:"text-white/90",badge:"GUI Wizard Installer",badgeColor:"text-primary border-primary/30 bg-primary/10",canInstall:!0,downloads:[{label:`Download ProxhqVPN v${ce} — Apple Silicon (.zip)`,url:je,variant:"primary",icon:ue},{label:`Download ProxhqVPN v${ce} — Mac Intel (.zip)`,url:rt,variant:"primary",icon:ue},{label:"WireGuard on Mac App Store",url:St,variant:"store",icon:De}],steps:[{text:`v${ce} — ${ve}. Includes ⚔ Counter Attack tab, Ghost Trap honeypot, DNS Sinkhole, Network Monitor, SIEM, OSINT Recon, and all recent security upgrades. Force-update available on Downloads page.`},{text:"Download the correct .zip for your Mac (Apple Silicon = M1/M2/M3/M4 chips, Intel = older Macs). Unzip and run 'start.sh'."},{text:"Double-click the app to launch the setup wizard."},{text:"If macOS says 'can't be opened because it's from an unidentified developer' — this is normal for apps downloaded outside the App Store."},{text:"To allow it: go to Apple Menu → System Settings → Privacy & Security → scroll to Security → click 'Open Anyway' next to ProxhqVPN."},{text:"Or: right-click (Control+click) the app → Open → Open. After you allow it once, it opens normally forever."},{text:"Follow the wizard: Welcome → License → Install Location (All Users or Just Me) → WireGuard → Done."},{text:"The wizard installs WireGuard and adds ProxhqVPN to your Applications folder. Click 'Launch Now' to sign in."}],note:"No App Store required. The installer uses native macOS dialog boxes — no terminal, no commands."},{id:"linux",name:"Linux",os:"Ubuntu · Debian · Fedora · Arch · More",icon:ke,iconColor:"text-orange-400",badge:"GUI Wizard Installer",badgeColor:"text-orange-400 border-orange-500/30 bg-orange-900/10",canInstall:!0,downloads:[{label:`Download ProxhqVPN v${ce} — Linux x64 (.zip)`,url:ot,variant:"primary",icon:ue},{label:`Download v${ce} — Universal (any OS + Node.js)`,url:Pt,variant:"primary",icon:ue}],steps:[{text:`v${ce} — ${ve}. Includes ⚔ Counter Attack tab, Ghost Trap honeypot, DNS Sinkhole, Network Monitor, SIEM, OSINT Recon, and all recent security upgrades. Force-update available on Downloads page.`},{text:"Download the Linux x64 .zip and extract it — you will get a self-contained 'ProxhqVPN' executable."},{text:"Make it executable: right-click → Properties → Permissions → check 'Allow executing file as program'."},{text:"Double-click the file in your file manager and choose 'Run' or 'Run in Terminal'."},{text:"The wizard uses your desktop's native GUI dialogs (GNOME, KDE, or terminal fallback) — Welcome → License → Install → WireGuard → Done."},{text:"The installer adds a desktop shortcut, registers ProxhqVPN in your app menu, and installs WireGuard via your package manager (apt/dnf/pacman)."},{text:"Or run manually in a terminal:",code:"chmod +x ProxhqVPN-Linux-Install.sh && ./ProxhqVPN-Linux-Install.sh"},{text:"After install: open ProxhqVPN → WireGuard Config → Download .conf, then:",code:"sudo wg-quick up ~/Downloads/proxhq.conf"}],note:"Works on all major distros. Uses zenity (GNOME), yad, or kdialog for native GUI — falls back to terminal if none available."},{id:"chromebook",name:"Chromebook",os:"ChromeOS 73+",icon:ke,iconColor:"text-green-400",badge:"Linux Terminal",badgeColor:"text-green-400 border-green-500/30 bg-green-900/10",canInstall:!0,downloads:[],steps:[{text:"Enable Linux: Settings → Advanced → Developers → Linux development environment → Turn On."},{text:"In the Linux terminal:",code:"sudo apt update && sudo apt install wireguard"},{text:"Download your ProxhqVPN config from the WireGuard Config page."},{text:"Move to Linux files and connect:",code:"sudo wg-quick up /path/to/proxhq.conf"}],note:"Requires ChromeOS 73+ with Linux (Beta) enabled."}]},{group:"MOBILE PHONES & TABLETS",icon:Ve,color:"text-green-400",items:[{id:"android",name:"Android Phone",os:"Android 7+",icon:Ve,iconColor:"text-green-400",badge:"Google Play",badgeColor:"text-green-400 border-green-500/30 bg-green-900/10",canInstall:!0,downloads:[{label:"Download ProxhqVPN Setup Guide — Android (.zip)",url:ze,variant:"primary",icon:ue},{label:"WireGuard on Google Play",url:Fe,variant:"apk"},{label:"WireGuard APK (sideload)",url:Ae,variant:"apk",icon:_e}],steps:[{text:"Install WireGuard from Google Play (link above) — or sideload the APK if Play is unavailable."},{text:"In ProxhqVPN → WireGuard Config → Generate config → show QR Code."},{text:"In WireGuard app → tap + → Scan from QR code → scan the code."},{text:"Tap the toggle to connect. A key icon appears in the Android status bar."},{text:"Optional: enable always-on VPN in Settings → Network → VPN → ProxhqVPN → gear icon → Always-on VPN."}],note:"Android 10+ supports always-on VPN with 'block connections without VPN'."},{id:"iphone",name:"iPhone & iPad",os:"iOS 14+ / iPadOS 14+",icon:Ve,iconColor:"text-blue-300",badge:"App Store",badgeColor:"text-blue-400 border-blue-500/30 bg-blue-900/10",canInstall:!0,downloads:[{label:"Download ProxhqVPN Setup Guide — iPhone (.zip)",url:Me,variant:"primary",icon:ue},{label:"WireGuard on the App Store",url:Nt,variant:"store",icon:De}],steps:[{text:"Install WireGuard from the App Store."},{text:"In ProxhqVPN → WireGuard Config → Generate config → show QR Code."},{text:"In WireGuard app → tap + → Create from QR code → scan."},{text:"Tap Allow when iOS requests VPN permission."},{text:"Toggle the tunnel on. The VPN indicator appears in the iOS status bar."},{text:"For always-on: Settings → General → VPN & Device Management → VPN → Connect On Demand."}]},{id:"android-tablet",name:"Android Tablet",os:"Samsung · Lenovo · Xiaomi · etc.",icon:wt,iconColor:"text-green-400",badge:"Google Play",badgeColor:"text-green-400 border-green-500/30 bg-green-900/10",canInstall:!0,downloads:[{label:"WireGuard on Google Play",url:Fe,variant:"primary"}],steps:[{text:"Install WireGuard from Google Play — identical to Android phone setup."},{text:"Use QR code import from ProxhqVPN → WireGuard Config for easiest setup."},{text:"Toggle to connect. Tablets show the VPN key icon in the status bar."}]}]},{group:"AMAZON FIRE DEVICES",icon:Ue,color:"text-orange-400",items:[{id:"firestick",name:"Amazon Fire Stick",os:"Fire OS 5+ · 4K · 4K Max · Lite · 3rd gen+",icon:Ue,iconColor:"text-orange-400",badge:"Direct APK Install",badgeColor:"text-orange-400 border-orange-500/30 bg-orange-900/10",canInstall:!0,downloads:[{label:"Download WireGuard APK for Fire Stick",url:Ae,variant:"apk",icon:_e}],steps:[{text:"FIRST — Enable unknown sources: Settings → My Fire TV → Developer Options → Apps from Unknown Sources → ON."},{text:"Option A (Silk Browser — easiest): Open the Silk browser on your Fire Stick, navigate to this page, and tap the orange 'Download WireGuard APK' button above. Fire OS will download and prompt you to install."},{text:"Option B (Downloader App): Install the free 'Downloader by AFTVnews' app from the Amazon Appstore, then enter this URL:",code:"https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk"},{text:"After installation, find WireGuard under Your Apps & Games or Recent."},{text:"In ProxhqVPN → WireGuard Config → Generate → Download .conf to Google Drive or Dropbox."},{text:"In WireGuard on Fire Stick → tap + → Import from file → navigate to your downloaded .conf."},{text:"Toggle the tunnel on — Fire Stick shows a VPN key icon at the top."}],note:"Fire Stick runs Fire OS (based on Android). The WireGuard Android APK works natively — no rooting required."},{id:"firetv",name:"Amazon Fire TV Cube",os:"Fire OS 7+",icon:be,iconColor:"text-orange-400",badge:"APK / ADB",badgeColor:"text-orange-400 border-orange-500/30 bg-orange-900/10",canInstall:!0,downloads:[{label:"Download WireGuard APK",url:Ae,variant:"apk",icon:_e}],steps:[{text:"Same APK as Fire Stick above — Fire TV Cube also runs Fire OS."},{text:"Use Silk Browser or Downloader app method (see Fire Stick steps above)."},{text:"Advanced — sideload via ADB over WiFi from a PC:",code:`adb connect YOUR_FIRETV_IP:5555
adb install wireguard.apk`},{text:"Find your Fire TV IP: Settings → My Fire TV → About → Network."},{text:"Enable ADB: Settings → My Fire TV → Developer Options → ADB Debugging → ON."}]}]},{group:"SMART TVs & STREAMING BOXES",icon:be,color:"text-purple-400",items:[{id:"androidtv",name:"Android TV / Google TV",os:"Sony · Philips · TCL · Nvidia Shield · Chromecast",icon:be,iconColor:"text-green-400",badge:"Google Play",badgeColor:"text-green-400 border-green-500/30 bg-green-900/10",canInstall:!0,downloads:[{label:"WireGuard on Google Play (TV)",url:Fe,variant:"primary"},{label:"Sideload APK",url:Ae,variant:"apk",icon:_e}],steps:[{text:"Open Google Play on your Android TV and search for 'WireGuard' — it has a full TV-optimized interface."},{text:"Install WireGuard from the search results."},{text:"In ProxhqVPN → WireGuard Config → Generate → Download .conf to Google Drive."},{text:"On Android TV, open a file manager (FX File Explorer) or install Downloader app."},{text:"Import the .conf from your cloud storage into WireGuard."},{text:"Toggle the tunnel ON — a VPN key appears in the TV status bar."}],note:"Nvidia Shield TV is the best Android TV option — supports WireGuard natively via Google Play."},{id:"appletv",name:"Apple TV",os:"tvOS 17+ (4K 3rd gen)",icon:be,iconColor:"text-white/90",badge:"tvOS App Store",badgeColor:"text-blue-400 border-blue-500/30 bg-blue-900/10",canInstall:!0,downloads:[{label:"WireGuard on tvOS App Store",url:kt,variant:"store",icon:De}],steps:[{text:"Apple TV 4K (tvOS 17+) supports WireGuard natively — search for it in the tvOS App Store."},{text:"Install WireGuard from the App Store on your Apple TV."},{text:"To import a config without a camera — use iCloud Keychain: in WireGuard on iPhone, share the tunnel via iCloud. It automatically appears on your Apple TV."},{text:"Older Apple TV (1st/2nd/3rd gen): use router-level VPN instead (see Routers section)."}],note:"For Apple TV 4K (tvOS 17+) only. iCloud config sharing is the easiest setup method — no USB or QR code needed."},{id:"samsung",name:"Samsung Smart TV",os:"Tizen OS (2016+)",icon:be,iconColor:"text-yellow-400",badge:"Router / Smart DNS",badgeColor:"text-yellow-400 border-yellow-500/30 bg-yellow-900/10",canInstall:!1,downloads:[],steps:[{text:"Samsung Tizen TVs do NOT support WireGuard apps — no VPN app is available on Tizen."},{text:"Best option — Router-level VPN: Install ProxhqVPN on your router (see Routers section). Your Samsung TV is automatically protected along with every device on your network."},{text:"Alternative — Smart DNS (geo-bypass only, no encryption): ProxhqVPN → Smart DNS → copy the DNS IPs."},{text:"On Samsung TV: Settings → General → Network → Network Status → IP Settings → DNS Setting → Enter manually → paste Smart DNS IP."}]},{id:"lg",name:"LG Smart TV",os:"webOS (2016+)",icon:be,iconColor:"text-red-400",badge:"Router / Smart DNS",badgeColor:"text-yellow-400 border-yellow-500/30 bg-yellow-900/10",canInstall:!1,downloads:[],steps:[{text:"LG webOS TVs do NOT support WireGuard apps directly."},{text:"Router VPN: Connect LG TV to a router running ProxhqVPN — full encryption for all TV traffic."},{text:"Smart DNS (geo-bypass): Settings → All Settings → Network → Wired/Wi-Fi Connection → Edit → DNS Server → Enter ProxhqVPN Smart DNS IPs."}]},{id:"roku",name:"Roku",os:"Roku OS",icon:be,iconColor:"text-purple-400",badge:"Router Only",badgeColor:"text-red-400 border-red-500/30 bg-red-900/10",canInstall:!1,downloads:[],steps:[{text:"Roku does NOT support VPN apps or manual DNS changes — it is a closed platform."},{text:"Only option: install ProxhqVPN on your router. All Roku traffic is automatically encrypted and tunneled."},{text:"See the Router Setup section below for OpenWRT, DD-WRT, and pfSense instructions."}]}]},{group:"ROUTERS",icon:Ee,color:"text-cyan-400",items:[{id:"openwrt",name:"OpenWRT",os:"OpenWRT 21.02+",icon:Ee,iconColor:"text-cyan-400",badge:"WireGuard Built-in",badgeColor:"text-cyan-400 border-cyan-500/30 bg-cyan-900/10",canInstall:!0,downloads:[],steps:[{text:"Install WireGuard packages:",code:"opkg update && opkg install wireguard-tools kmod-wireguard luci-proto-wireguard"},{text:"In ProxhqVPN → Router Config → select OpenWRT → copy the generated setup commands."},{text:"SSH into your router and run the provided commands."},{text:"Or use LuCI web UI: Network → Interfaces → Add new → Protocol: WireGuard. Paste the keys and peer config from ProxhqVPN."},{text:"Set the firewall zone for the WireGuard interface to forward traffic correctly."}]},{id:"ddwrt",name:"DD-WRT",os:"DD-WRT build 45000+",icon:Ee,iconColor:"text-cyan-400",badge:"WireGuard",badgeColor:"text-cyan-400 border-cyan-500/30 bg-cyan-900/10",canInstall:!0,downloads:[],steps:[{text:"In DD-WRT web UI: Setup → VPN → WireGuard."},{text:"Enable WireGuard, paste the keys from ProxhqVPN → Router Config."},{text:"Add the ProxhqVPN server as a peer with the public key and endpoint from Router Config."},{text:"Set Allowed IPs to 0.0.0.0/0 for full-tunnel mode."},{text:"Save and apply — DD-WRT routes all connected devices through ProxhqVPN."}]},{id:"pfsense",name:"pfSense / OPNsense",os:"pfSense 2.6+ / OPNsense 22+",icon:Ee,iconColor:"text-cyan-400",badge:"WireGuard Plugin",badgeColor:"text-cyan-400 border-cyan-500/30 bg-cyan-900/10",canInstall:!0,downloads:[],steps:[{text:"In pfSense: System → Package Manager → Available Packages → search 'wireguard' → Install."},{text:"VPN → WireGuard → Settings → Enable → Add Tunnel."},{text:"Generate keys or use keys from ProxhqVPN → WireGuard Config."},{text:"Add a Peer using the ProxhqVPN server public key and endpoint."},{text:"Create an interface assignment for the WireGuard tunnel."},{text:"Set firewall rules to pass traffic through the VPN interface."}]},{id:"asus",name:"ASUS Router (Merlin)",os:"AsusWRT-Merlin",icon:Ee,iconColor:"text-cyan-400",badge:"WireGuard",badgeColor:"text-cyan-400 border-cyan-500/30 bg-cyan-900/10",canInstall:!0,downloads:[],steps:[{text:"Install AsusWRT-Merlin firmware (freeshelter.net/asuswrt-merlin) if not already installed."},{text:"Router web UI: VPN → VPN Client → Add profile → WireGuard."},{text:"Copy Private Key, Public Key, Address, DNS from ProxhqVPN → WireGuard Config."},{text:"Add the ProxhqVPN server endpoint and public key as the Peer."},{text:"Enable the profile — all LAN devices route through ProxhqVPN."}]}]},{group:"GAMING CONSOLES",icon:Le,color:"text-red-400",items:[{id:"ps5",name:"PlayStation 5 / PS4",os:"PlayStation OS",icon:Le,iconColor:"text-blue-400",badge:"Router Only",badgeColor:"text-red-400 border-red-500/30 bg-red-900/10",canInstall:!1,downloads:[],steps:[{text:"PS5 and PS4 do not support VPN apps — use router-level VPN for automatic protection."},{text:"Router method: Install ProxhqVPN on your router — your PlayStation is automatically protected."},{text:"PC hotspot method (Windows): Settings → Network → VPN → Share VPN connection → allow other devices (connect PlayStation via ethernet or WiFi)."}]},{id:"xbox",name:"Xbox (Series X/S, One)",os:"Xbox OS",icon:Le,iconColor:"text-green-400",badge:"Router Only",badgeColor:"text-red-400 border-red-500/30 bg-red-900/10",canInstall:!1,downloads:[],steps:[{text:"Xbox does not support VPN apps — use router-level VPN."},{text:"Router VPN is the recommended method — see Router Setup in ProxhqVPN."},{text:"Alternative: connect Xbox to a Windows PC running WireGuard via Internet Connection Sharing (ICS)."}]}]},{group:"RASPBERRY PI & EMBEDDED",icon:Qe,color:"text-pink-400",items:[{id:"raspberrypi",name:"Raspberry Pi",os:"Raspberry Pi OS / Ubuntu ARM",icon:Qe,iconColor:"text-pink-400",badge:"wg-quick",badgeColor:"text-pink-400 border-pink-500/30 bg-pink-900/10",canInstall:!0,downloads:[],steps:[{text:"Install WireGuard:",code:"sudo apt update && sudo apt install wireguard"},{text:"Download config from ProxhqVPN → WireGuard Config."},{text:"Copy to:",code:"sudo cp proxhq.conf /etc/wireguard/wg0.conf"},{text:"Connect:",code:"sudo wg-quick up wg0"},{text:"Use your Pi as a travel router — all devices on its hotspot tunnel through ProxhqVPN automatically."}]}]}];function Tt({p:J,defaultOpen:ge}){const[x,G]=ye.useState(ge??!1),S=J.icon;return v.jsxs("div",{className:`border rounded-xl overflow-hidden transition-colors ${x?"border-primary/30":"border-primary/15 hover:border-primary/25"}`,children:[v.jsxs("div",{className:"px-4 py-3 flex items-start gap-3",children:[v.jsx("div",{className:"w-9 h-9 rounded-lg bg-black border border-primary/15 flex items-center justify-center shrink-0 mt-0.5",children:v.jsx(S,{className:`w-4 h-4 ${J.iconColor}`})}),v.jsxs("div",{className:"flex-1 min-w-0",children:[v.jsxs("div",{className:"flex items-center gap-2 flex-wrap mb-0.5",children:[v.jsx("span",{className:"text-sm font-bold text-primary",children:J.name}),v.jsx("span",{className:`text-[8px] font-mono border px-1.5 py-0.5 rounded ${J.badgeColor}`,children:J.badge}),!J.canInstall&&v.jsx("span",{className:"text-[8px] font-mono text-yellow-400/70 border border-yellow-500/20 bg-yellow-900/10 px-1.5 py-0.5 rounded",children:"Instructions Only"})]}),v.jsx("div",{className:"text-[9px] text-primary/30 font-mono",children:J.os}),v.jsxs("div",{className:"flex flex-wrap gap-2 mt-2.5",children:[J.downloads.map((l,a)=>{const n=l.icon??ue,c={primary:"bg-primary text-black hover:bg-primary/80",store:"bg-white/10 text-white hover:bg-white/15 border border-white/20",apk:"bg-orange-500/90 text-white hover:bg-orange-500 border border-orange-400/40"};return v.jsxs("a",{href:l.url,target:"_blank",rel:"noopener noreferrer",className:`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg transition-colors ${c[l.variant]}`,children:[v.jsx(n,{className:"w-3 h-3"}),l.label,v.jsx(ht,{className:"w-2 h-2 opacity-50"})]},a)}),v.jsxs("button",{onClick:()=>Wt(J.id,J.name),className:"inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg transition-colors bg-primary/10 text-primary/70 hover:bg-primary/20 hover:text-primary border border-primary/20 hover:border-primary/40",title:"Download README + User Guide + Quick Start as ZIP",children:[v.jsx(tt,{className:"w-3 h-3"}),"Setup Bundle (.zip)"]})]})]}),v.jsx("button",{onClick:()=>G(l=>!l),className:"shrink-0 mt-1 text-primary/30 hover:text-primary transition-colors",children:x?v.jsx(pt,{className:"w-4 h-4"}):v.jsx(ft,{className:"w-4 h-4"})})]}),x&&v.jsxs("div",{className:"px-4 pb-4 border-t border-primary/10 pt-3 space-y-2.5",children:[v.jsx("div",{className:"text-[8px] font-mono text-primary/25 uppercase tracking-widest mb-2",children:"Setup Instructions"}),v.jsx("ol",{className:"space-y-2",children:J.steps.map((l,a)=>v.jsxs("li",{className:"flex gap-2.5",children:[v.jsxs("span",{className:"text-[9px] font-mono text-primary/25 mt-0.5 shrink-0 w-4 text-right",children:[a+1,"."]}),v.jsxs("div",{className:"flex-1",children:[v.jsx("span",{className:"text-[10px] text-primary/65 font-mono leading-relaxed",children:l.text}),l.code&&v.jsx(At,{children:l.code})]})]},a))}),J.note&&v.jsxs("div",{className:"flex items-start gap-2 text-[9px] font-mono text-primary/40 border border-primary/10 rounded px-3 py-2 bg-primary/5 mt-2",children:[v.jsx(et,{className:"w-3 h-3 mt-0.5 shrink-0 text-green-400"}),J.note]})]})]})}function It(){return v.jsxs("div",{className:"border-2 border-orange-500/40 rounded-xl bg-orange-900/10 p-5 space-y-4",children:[v.jsxs("div",{className:"flex items-center gap-3",children:[v.jsx("div",{className:"w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0",children:v.jsx(Ue,{className:"w-5 h-5 text-orange-400"})}),v.jsxs("div",{children:[v.jsx("div",{className:"text-sm font-bold text-orange-400",children:"Amazon Fire Stick Detected!"}),v.jsx("div",{className:"text-[10px] text-orange-400/60 font-mono",children:"You can install WireGuard directly on this Fire Stick"})]})]}),v.jsxs("div",{className:"flex items-start gap-3 border border-orange-500/20 rounded-lg px-3 py-2.5 bg-orange-900/10",children:[v.jsx(ut,{className:"w-4 h-4 text-orange-400 shrink-0 mt-0.5"}),v.jsxs("p",{className:"text-[10px] font-mono text-orange-400/80 leading-relaxed",children:[v.jsx("strong",{children:"Before downloading:"})," Enable Apps from Unknown Sources —"," ",v.jsx("span",{className:"text-orange-300",children:"Settings → My Fire TV → Developer Options → Apps from Unknown Sources → ON"})]})]}),v.jsxs("div",{className:"space-y-2",children:[v.jsx("div",{className:"text-[9px] font-mono text-orange-400/50 uppercase tracking-widest",children:"Step 1 — Download & Install WireGuard"}),v.jsxs("a",{href:Ae,target:"_blank",rel:"noopener noreferrer",className:"flex items-center gap-3 w-full sm:w-auto bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold px-5 py-3 rounded-xl transition-colors",children:[v.jsx(_e,{className:"w-5 h-5"}),v.jsx("span",{children:"Download WireGuard APK for Fire Stick"}),v.jsx(ue,{className:"w-4 h-4 ml-auto sm:ml-0"})]}),v.jsx("div",{className:"text-[9px] font-mono text-orange-400/40",children:"Tap the button above → Fire OS downloads the APK → tap Install when prompted"})]}),v.jsxs("div",{className:"space-y-1",children:[v.jsx("div",{className:"text-[9px] font-mono text-orange-400/50 uppercase tracking-widest",children:"Step 2 — Set Up Your VPN Config"}),v.jsxs("p",{className:"text-[10px] font-mono text-orange-400/70 leading-relaxed",children:["After installing WireGuard, go to ",v.jsx("strong",{className:"text-orange-300",children:"ProxhqVPN → WireGuard Config → Generate"})," on another device, save the .conf file to Google Drive or Dropbox, then import it into WireGuard on your Fire Stick."]})]})]})}const Ct=[{label:"Windows",id:"windows",color:"text-blue-300",bg:"border-blue-500/20 hover:border-blue-400/40"},{label:"macOS",id:"macos",color:"text-white/90",bg:"border-gray-500/20 hover:border-gray-400/40"},{label:"Android",id:"android",color:"text-green-400",bg:"border-green-500/20 hover:border-green-400/40"},{label:"iPhone/iPad",id:"iphone",color:"text-blue-300",bg:"border-blue-500/20 hover:border-blue-400/40"},{label:"Fire Stick",id:"firestick",color:"text-orange-400",bg:"border-orange-500/20 hover:border-orange-400/40"},{label:"Android TV",id:"androidtv",color:"text-green-400",bg:"border-green-500/20 hover:border-green-400/40"},{label:"Apple TV",id:"appletv",color:"text-white/90",bg:"border-gray-500/20 hover:border-gray-400/40"},{label:"Router",id:"openwrt",color:"text-cyan-400",bg:"border-cyan-500/20 hover:border-cyan-400/40"}];function Ut(){const[J,ge]=lt("downloads-search",""),[x,G]=ye.useState(null),[S,l]=ye.useState(!1),[a,n]=ye.useState(null),[c,g]=ye.useState(!1),[w,f]=ye.useState(null);function b(r,u){const y=r.split(".").map(Number),k=u.split(".").map(Number);for(let N=0;N<3;N++){if((y[N]??0)>(k[N]??0))return!0;if((y[N]??0)<(k[N]??0))return!1}return!1}const i=async()=>{g(!0),f(null);try{const r=await fetch("/api/update/check");if(!r.ok)throw new Error("unreachable");const u=await r.json(),y=u.version??"0.0.0";f({upToDate:!b(ce,y),runningVersion:y,latestVersion:ce,changelog:u.changelog})}catch{f({upToDate:!0,runningVersion:ce,latestVersion:ce})}g(!1)};ye.useEffect(()=>{const r=Et();l(!!r),n(_t())},[]);const p=J.toLowerCase(),o=r=>{const u=document.getElementById(`platform-${r}`);u&&u.scrollIntoView({behavior:"smooth",block:"start"})},d=Ye.map(r=>({...r,items:r.items.filter(u=>!p||u.name.toLowerCase().includes(p)||u.os.toLowerCase().includes(p)||r.group.toLowerCase().includes(p)||u.badge.toLowerCase().includes(p))})).filter(r=>r.items.length>0);return Ye.flatMap(r=>r.items),v.jsxs("div",{className:"space-y-7 max-w-4xl",children:[v.jsx(ct,{title:"Downloads — WireGuard VPN Apps for Every Device",description:"Download ProxhqVPN on any device. Native WireGuard apps for Windows, macOS, iOS, Android, Linux, Fire TV, Apple TV, gaming consoles, and routers. Free to download.",path:"/downloads"}),v.jsxs("div",{children:[v.jsxs("h1",{className:"text-lg font-bold tracking-widest uppercase text-primary flex items-center gap-2",children:[v.jsx(ue,{className:"w-5 h-5"})," Download ProxhqVPN"]}),v.jsx("p",{className:"text-xs text-primary/40 mt-1 font-mono",children:"One-click downloads for every platform. ProxhqVPN works on any device that supports WireGuard — phones, tablets, TVs, Fire Stick, routers, desktops, and embedded hardware."})]}),v.jsxs("div",{className:"border border-primary/20 rounded-xl overflow-hidden bg-primary/[0.03]",children:[v.jsxs("div",{className:"flex items-center justify-between px-5 py-3 border-b border-primary/15 bg-primary/[0.04]",children:[v.jsxs("div",{className:"flex items-center gap-2.5",children:[v.jsx(Ge,{className:"w-3.5 h-3.5 text-primary/70"}),v.jsxs("span",{className:"text-[12px] font-bold tracking-widest uppercase text-primary/80",children:["What's New in v",ce]}),v.jsx("span",{className:"text-[9px] font-bold uppercase tracking-widest text-black bg-primary px-1.5 py-0.5 rounded-full leading-none",children:"NOW LIVE"})]}),v.jsx("span",{className:"text-[10px] text-primary/40 font-mono",children:ve})]}),v.jsx("div",{className:"px-5 py-4 grid gap-2 sm:grid-cols-2",children:[{label:"⚔ Counter Attack Tab",desc:"Ghost Trap: live tools to strike back — port scan, OSINT, canary inject, payload reflect",badge:"NEW"},{label:"Canary Beacon Injector",desc:"6 beacon types: Pixel, JS fingerprint, Fake AWS Key, JWT session, DNS, SQL OOB exfil",badge:"NEW"},{label:"Ghost Trap Honeypot",desc:"Personal device & website modes — instant attacker reports + counter-intelligence"},{label:"DNS Sinkhole",desc:"Pi-hole style blocking: Ads, Trackers, Malware, Phishing, Botnet C2"},{label:"Network Monitor",desc:"Real-time traffic flow analysis across all 60 VPN nodes"},{label:"SIEM Event Log",desc:"Unified security timeline with severity filtering across all sources"},{label:"OSINT Recon",desc:"DNS, TLS, HTTP headers, email security, ASN fingerprinting"},{label:"QuantumAudit",desc:"Blockchain smart contract + post-quantum vulnerability scanner"},{label:"Ghost Trace",desc:"VPN-native outbound behavioral analysis — detects C2 beaconing"},{label:"Ghost Chain",desc:"Automated kill-chain discovery and attack-path intelligence"},{label:"JWT Analyzer",desc:"JWKS injection, X5U, Embedded JWK, kid SQL/path injection attacks"},{label:"Subdomain Scanner",desc:"9 passive OSINT sources including crt.sh, AlienVault, Wayback"}].map(({label:r,desc:u,badge:y})=>v.jsxs("div",{className:"flex items-start gap-2.5",children:[v.jsx(et,{className:"w-3.5 h-3.5 text-primary/60 shrink-0 mt-0.5"}),v.jsxs("div",{children:[v.jsxs("div",{className:"flex items-center gap-1.5",children:[v.jsx("div",{className:"text-[11px] font-semibold text-white/80 leading-snug",children:r}),y&&v.jsx("span",{className:"text-[8px] font-bold uppercase tracking-widest text-black bg-primary px-1 py-0.5 rounded-full leading-none",children:y})]}),v.jsx("div",{className:"text-[10px] text-primary/40 font-mono leading-snug mt-0.5",children:u})]})]},r))}),v.jsxs("div",{className:"px-5 py-3 border-t border-primary/10 flex items-center justify-between gap-3 flex-wrap",children:[v.jsx("span",{className:"text-[10px] text-primary/35 font-mono",children:"Already running the standalone app? Re-download below to get all updates."}),v.jsxs("a",{href:qe,className:"inline-flex items-center gap-1.5 text-[11px] font-bold text-black bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/85 transition-colors",children:[v.jsx(tt,{className:"w-3 h-3"})," Download v",ce," — All Platforms"]})]})]}),v.jsxs("div",{className:"border border-primary/20 rounded-xl overflow-hidden bg-primary/[0.02]",children:[v.jsxs("div",{className:"flex items-center justify-between px-5 py-3 border-b border-primary/10 bg-primary/[0.03]",children:[v.jsxs("div",{className:"flex items-center gap-2.5",children:[v.jsx("svg",{className:"w-3.5 h-3.5 text-primary/70",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",strokeWidth:2,children:v.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"})}),v.jsx("span",{className:"text-[12px] font-bold tracking-widest uppercase text-primary/80",children:"Software Updates"}),v.jsxs("span",{className:"text-[10px] font-mono text-primary/40 ml-1",children:["Latest: v",ce]})]}),v.jsx("span",{className:"text-[10px] text-primary/30 font-mono",children:ve})]}),v.jsxs("div",{className:"px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4",children:[v.jsx("div",{className:"flex-1 min-w-0 space-y-1",children:w?w.upToDate?v.jsxs("div",{className:"flex items-center gap-2.5",children:[v.jsx("div",{className:"w-7 h-7 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center shrink-0",children:v.jsx("svg",{className:"w-3.5 h-3.5 text-green-400",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",strokeWidth:2.5,children:v.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M5 13l4 4L19 7"})})}),v.jsxs("div",{children:[v.jsxs("div",{className:"text-[12px] font-semibold text-green-300",children:["You're up to date — v",w.runningVersion]}),v.jsx("div",{className:"text-[10px] text-white/35 font-mono mt-0.5",children:w.runningVersion===ce?"Running the latest version. No action needed.":"Web app is always current. Re-check after a new build ships."})]})]}):v.jsxs("div",{className:"space-y-3",children:[v.jsxs("div",{className:"flex items-center gap-2.5",children:[v.jsx("div",{className:"w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 animate-pulse",children:v.jsx("svg",{className:"w-3.5 h-3.5 text-primary",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",strokeWidth:2,children:v.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"})})}),v.jsxs("div",{children:[v.jsxs("div",{className:"text-[12px] font-semibold text-primary",children:["Update available — v",w.latestVersion]}),v.jsxs("div",{className:"text-[10px] text-white/40 font-mono mt-0.5",children:["You are running v",w.runningVersion,". Download the new version below."]})]})]}),w.changelog&&w.changelog.length>0&&v.jsx("div",{className:"pl-9 space-y-1 max-h-36 overflow-y-auto",children:w.changelog.slice(0,8).map((r,u)=>v.jsxs("div",{className:"flex items-start gap-1.5 text-[10px] text-white/50",children:[v.jsx("span",{className:"text-primary/50 shrink-0 mt-0.5",children:"▸"}),v.jsx("span",{children:r})]},u))}),v.jsxs("div",{className:"pl-9 flex flex-wrap gap-2",children:[v.jsxs("a",{href:qe,className:"inline-flex items-center gap-1.5 text-[11px] font-bold text-black bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/85 transition-colors",children:[v.jsx("svg",{className:"w-3 h-3",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",strokeWidth:2.5,children:v.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"})}),"Update Now"]}),v.jsx("a",{href:"#windows",onClick:()=>setTimeout(()=>document.getElementById("windows")?.scrollIntoView({behavior:"smooth"}),100),className:"inline-flex items-center gap-1.5 text-[11px] font-medium text-primary/70 border border-primary/25 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors",children:"See platform-specific downloads ↓"})]})]}):v.jsxs("div",{className:"space-y-0.5",children:[v.jsxs("div",{className:"text-[12px] font-semibold text-white/80",children:["ProxhqVPN v",ce]}),v.jsxs("div",{className:"text-[11px] text-white/40 leading-snug",children:["Web app users are always on the latest version automatically. Standalone app users can click ",v.jsx("span",{className:"text-primary/70",children:"Check for Updates"})," to see if a newer version is available without waiting for the background check."]})]})}),v.jsxs("div",{className:"flex flex-col items-end gap-2 shrink-0",children:[v.jsx("button",{onClick:i,disabled:c,className:"inline-flex items-center gap-2 text-[11px] font-semibold px-4 py-2 rounded-lg border border-primary/30 bg-primary/8 text-primary hover:bg-primary/15 transition-all disabled:opacity-50 whitespace-nowrap",children:c?v.jsxs(v.Fragment,{children:[v.jsxs("svg",{className:"w-3.5 h-3.5 animate-spin",fill:"none",viewBox:"0 0 24 24",children:[v.jsx("circle",{className:"opacity-25",cx:"12",cy:"12",r:"10",stroke:"currentColor",strokeWidth:"4"}),v.jsx("path",{className:"opacity-75",fill:"currentColor",d:"M4 12a8 8 0 018-8v8z"})]}),"Checking…"]}):v.jsxs(v.Fragment,{children:[v.jsx("svg",{className:"w-3.5 h-3.5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",strokeWidth:2,children:v.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"})}),"Check for Updates"]})}),w&&v.jsx("button",{onClick:()=>f(null),className:"text-[9px] text-white/25 hover:text-white/40 transition-colors font-mono",children:"Clear result"})]})]})]}),S&&v.jsx(It,{}),!S&&a&&a!=="unknown"&&(()=>{const u={windows:{label:"Download ProxhqVPN Installer for Windows (.zip)",url:Be,variant:"primary"},mac:{label:"Download ProxhqVPN Installer for Mac (.zip)",url:je,variant:"primary"},android:{label:"Download ProxhqVPN Setup Guide for Android (.zip)",url:ze,variant:"primary"},ios:{label:"Download ProxhqVPN Setup Guide for iPhone (.zip)",url:Me,variant:"primary"}}[a];if(!u)return null;const y={primary:"bg-primary text-black hover:bg-primary/80",store:"bg-white/10 text-white hover:bg-white/15 border border-white/20",apk:"bg-orange-500/90 text-white hover:bg-orange-500"};return v.jsxs("div",{className:"border border-primary/20 rounded-xl px-5 py-4 bg-primary/5 flex items-center gap-4 flex-wrap",children:[v.jsxs("div",{className:"flex items-center gap-2",children:[v.jsx(Ge,{className:"w-4 h-4 text-primary"}),v.jsxs("div",{children:[v.jsx("div",{className:"text-xs font-bold text-primary",children:"Recommended for your device"}),v.jsxs("div",{className:"text-[9px] text-primary/40 font-mono capitalize",children:[a," detected"]})]})]}),v.jsxs("a",{href:u.url,target:"_blank",rel:"noopener noreferrer",className:`inline-flex items-center gap-2 text-[11px] font-mono font-bold px-4 py-2 rounded-lg transition-colors ${y[u.variant]}`,children:[v.jsx(ue,{className:"w-3.5 h-3.5"})," ",u.label]})]})})(),v.jsxs("div",{className:"space-y-2",children:[v.jsx("div",{className:"text-[8px] font-mono text-primary/25 uppercase tracking-widest",children:"Jump to Platform"}),v.jsx("div",{className:"flex flex-wrap gap-2",children:Ct.map(r=>v.jsx("button",{onClick:()=>o(r.id),className:`text-[10px] font-mono border px-3 py-1.5 rounded-lg bg-black transition-colors ${r.bg} ${r.color}`,children:r.label},r.id))})]}),v.jsxs("div",{className:"border border-primary/20 rounded-xl p-4 bg-primary/5",children:[v.jsxs("div",{className:"text-[9px] font-mono font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-2",children:[v.jsx($e,{className:"w-3 h-3"})," Quick Start (All Platforms)"]}),v.jsxs("ol",{className:"space-y-1 text-[10px] font-mono text-primary/55 grid sm:grid-cols-2 gap-x-6",children:[v.jsxs("li",{className:"flex gap-2",children:[v.jsx("span",{className:"text-primary/25",children:"1."}),v.jsxs("span",{children:["Sign in to ProxhqVPN → ",v.jsx("span",{className:"text-primary",children:"WireGuard Config"})," → click ",v.jsx("strong",{className:"text-primary",children:"Generate"})]})]}),v.jsxs("li",{className:"flex gap-2",children:[v.jsx("span",{className:"text-primary/25",children:"2."}),v.jsxs("span",{children:["Download the generated ",v.jsx("span",{className:"text-primary",children:".conf"})," file or show the QR code"]})]}),v.jsxs("li",{className:"flex gap-2",children:[v.jsx("span",{className:"text-primary/25",children:"3."}),v.jsx("span",{children:"Install WireGuard on your device (use download button below)"})]}),v.jsxs("li",{className:"flex gap-2",children:[v.jsx("span",{className:"text-primary/25",children:"4."}),v.jsx("span",{children:"Import the .conf or scan the QR → Toggle ON → Done"})]})]})]}),v.jsxs("div",{className:"border border-primary/30 rounded-xl p-4 bg-primary/5 space-y-3",children:[v.jsxs("div",{className:"flex items-center justify-between flex-wrap gap-2",children:[v.jsxs("div",{children:[v.jsxs("div",{className:"text-[9px] font-mono font-bold text-primary uppercase tracking-widest flex items-center gap-2",children:[v.jsx(Ge,{className:"w-3 h-3"})," ProxhqVPN v",ce," — ",ve]}),v.jsx("div",{className:"text-[10px] font-mono text-primary/55 mt-0.5",children:"⚔ Counter Attack · Ghost Trap · DNS Sinkhole · Network Monitor · SIEM · OSINT Recon · QuantumAudit · Signature Mining Engine · Force-Update"})]}),v.jsxs("a",{href:qe,target:"_blank",rel:"noopener noreferrer",className:"inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-4 py-2 rounded-lg bg-primary text-black hover:bg-primary/80 transition-colors shrink-0",children:[v.jsx(ue,{className:"w-3.5 h-3.5"})," All Platforms Bundle (.zip)"]})]}),v.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-4 gap-2",children:[{label:"Windows x64",url:Be},{label:"macOS Apple Silicon",url:je},{label:"macOS Intel",url:rt},{label:"Linux x64",url:ot},{label:"Android",url:ze},{label:"iPhone / iPad",url:Me}].map(r=>v.jsxs("a",{href:r.url,target:"_blank",rel:"noopener noreferrer",className:"flex items-center gap-1.5 text-[9px] font-mono text-primary/70 hover:text-primary border border-primary/20 hover:border-primary/50 bg-black rounded-lg px-3 py-2 transition-colors",children:[v.jsx(ue,{className:"w-2.5 h-2.5 shrink-0"})," ",r.label]},r.label))}),v.jsxs("div",{className:"text-[9px] font-mono text-primary/30 flex items-center gap-1.5",children:[v.jsx($e,{className:"w-2.5 h-2.5"}),"Auto-update: the standalone server checks ",v.jsx("span",{className:"text-primary/50",children:"/api/update/check"})," on startup and notifies you when a new version is available."]})]}),v.jsxs("div",{className:"relative",children:[v.jsx(qt,{className:"absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/30"}),v.jsx("input",{value:J,onChange:r=>ge(r.target.value),placeholder:"Search platforms (e.g. Fire Stick, Nvidia Shield, pfSense...)",className:"w-full bg-black border border-primary/20 text-primary text-xs font-mono pl-9 pr-4 py-2 focus:outline-none focus:border-primary/50 rounded-lg"})]}),d.map(r=>{const u=r.icon;return v.jsxs("div",{className:"space-y-3",children:[v.jsxs("div",{className:`flex items-center gap-2 text-[9px] font-mono ${r.color} uppercase tracking-widest`,children:[v.jsx(u,{className:"w-3.5 h-3.5"})," ",r.group]}),v.jsx("div",{className:"space-y-2.5",children:r.items.map(y=>v.jsx("div",{id:`platform-${y.id}`,children:v.jsx(Tt,{p:y,defaultOpen:a===y.id})},y.id))})]},r.group)}),v.jsxs("div",{className:"border border-cyan-500/20 rounded-xl p-4 bg-cyan-900/5 flex items-start gap-3",children:[v.jsx(dt,{className:"w-4 h-4 text-cyan-400 shrink-0 mt-0.5"}),v.jsxs("div",{children:[v.jsx("div",{className:"text-[11px] font-bold text-cyan-400 mb-0.5",children:"Can't install an app? Use your Router."}),v.jsx("p",{className:"text-[10px] font-mono text-cyan-400/60 leading-relaxed",children:"Samsung TVs, LG TVs, Roku, PlayStation, and Xbox cannot run VPN apps. The cleanest solution: install ProxhqVPN on your router. Every device on your network — including your TV, gaming console, and smart home devices — is automatically protected without any extra setup."})]})]})]})}const Ot=`ProxhqVPN — Quick Start Guide
==============================
ALPHA UNLIMITED TECHNOLOGIES LLC | https://proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — CREATE YOUR ACCOUNT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Visit: https://proxhqvpn.com/sign-in
  Sign up with email or use Google / GitHub SSO.

STEP 2 — CHOOSE A PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VPN Basic:           $6.99/mo or $59.99/yr
  Command Center Pro:  $39.99/mo or $349.99/yr
  Subscribe at: https://proxhqvpn.com/pricing
  Use an Ambassador promo code at checkout for a 10% discount.

STEP 3 — GENERATE YOUR WIREGUARD CONFIG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Sign in → WireGuard Config (/wireguard) → click "Generate"
  Download the .conf file (desktop) or show QR code (mobile/TV)

STEP 4 — INSTALL WIREGUARD ON YOUR DEVICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  See your platform-specific README.txt in this bundle for
  exact install instructions for your operating system.
  All platform downloads: https://proxhqvpn.com/downloads

STEP 5 — IMPORT YOUR CONFIG & CONNECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Desktop: Import the .conf file into WireGuard → Activate
  Mobile:  Scan the QR code in the WireGuard app → Toggle ON
  Router:  Paste the generated config block → restart network

STEP 6 — VERIFY YOU'RE PROTECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Visit: https://api64.ipify.org
  The IP shown must be a ProxhqVPN server IP, not your real IP.
  Run a full leak test at: https://proxhqvpn.com/leaks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ★ Exploit Importer — Instructions Tab
    Every detected vulnerability now includes a complete
    step-by-step exploitation guide: tools required (with
    exact install commands), prerequisites, numbered attack
    walkthrough, how to verify, and corrected code remediation.

  ★ 24 Built-In Vulnerability Guides
    SQLi, XSS, RCE, LFI, SSRF, XXE, IDOR, CSRF, JWT attacks,
    Deserialization, SSTI, CORS misconfig, Auth Bypass, .env/.git
    Exposure, Missing Headers, No Rate Limiting, Hardcoded Secrets,
    Buffer Overflow, Mass Assignment, Weak TLS, Spring Actuator,
    Open Redirect, Default Credentials, GraphQL Security.

  ★ Download Full Report Button
    Export a complete .md pentest report from any Exploit Importer
    scan — every finding, full guide, PoC code, and remediation.
    Ready to share with clients or teams.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email:     support@proxhqvpn.com
  Full guide: https://proxhqvpn.com/guide
  Downloads:  https://proxhqvpn.com/downloads
  Pricing:    https://proxhqvpn.com/pricing
`,Rt=`ProxhqVPN — Full User Guide
============================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
★ Exploit Importer — Instructions Tab
  Each detected vulnerability now opens a complete exploitation
  guide covering tools required (with exact install commands for
  all OS), prerequisites, numbered step-by-step attack walkthrough,
  how to verify the exploit, corrected code remediation examples,
  and curated reference links (PortSwigger, OWASP, NVD).

★ 24 Built-In Vulnerability Guides
  SQL Injection, XSS (reflected/stored/DOM), RCE, LFI, SSRF, XXE,
  IDOR, CSRF, JWT Vulnerabilities, Deserialization, SSTI, CORS
  Misconfiguration, Auth Bypass, .env/.git Exposure, Missing Security
  Headers, No Rate Limiting, Hardcoded Secrets, Buffer Overflow, Mass
  Assignment, Weak TLS, Spring Actuator Exposure, Open Redirect,
  Default Credentials, GraphQL Security, CVE-Based Exploits.

★ Download Full Report
  The green "Download Full Report" button in Exploit Importer exports
  a complete Markdown (.md) pentest report covering every finding:
  full guide, PoC code, remediation, and reference links. Ready to
  share with clients or security teams.

★ Three-Tab Result Cards
  Every Exploit Importer finding now has three tabs:
    [Details]      — raw evidence, CVE ID, severity badge
    [Instructions] — complete step-by-step exploitation guide
    [Exploit Code] — ready-to-run PoC code (Python/Bash/SQL/JS/XML)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLAN OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VPN Basic:           $6.99/mo or $59.99/yr
Command Center Pro:  $39.99/mo or $349.99/yr

VPN Basic includes:
  WireGuard VPN, Kill Switch, DNS Shield, DNS Sinkhole,
  Network Traffic Monitor, Leak Detection, Smart DNS,
  Split Tunneling, VPN Gate (double-hop), Onion Browser (Tor over VPN),
  Obfuscation (Stealth Mode), Router Config, VPN Coexistence,
  Device Manager, IP Exposure Scanner, GPS Spoofing,
  Port Forwarding, Dedicated Static IP, Meshnet,
  Data Broker Opt-Out (180+ brokers)

Command Center Pro (everything in Basic plus):
  Alpha Toolkit (Universal Scanner + Verifier + Web Scraper),
  SQLmap Vulnerability Scanner, HTTP Probe, Directory Fuzzer,
  Subdomain Scout, Threat Intelligence, Security Audit,
  Threat Monitor (Beacons), Firewall Manager, Remote Terminal,
  Database Interface, SilkWeb Honeypot, Encoder/Decoder,
  Request Comparer, Payload Generator, CVE Lookup, Intruder,
  SIEM (Security Event Log), OSINT Recon, Canary Tokens,
  Ghost Chain Exploit Arsenal, Exploit Importer,
  OAST Tester, Dependency Scanner, Token Sequencer,
  WebSocket Tester, SAST Scanner

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VPN CONNECTION (/my-vpn)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The main VPN connection page. Shows your active WireGuard tunnel status,
connected server, connection time, and bandwidth. Connect/disconnect here.

WireGuard Config (/wireguard):
  - Generate your private/public keypair (server stores only the public key)
  - Download .conf file or show QR code for mobile import
  - Regenerate at any time (old keypair is immediately revoked)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KILL SWITCH (/kill-switch)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Blocks ALL internet traffic if the VPN drops unexpectedly, preventing
IP leaks. Three modes:
  - Strict: Block everything if VPN is down (recommended)
  - Allow LAN: Block internet but allow local network access
  - Custom: Whitelist specific IPs or CIDRs to always bypass the kill switch

Platform-specific firewall rule generators for Linux (iptables/nftables),
macOS (pf), and Windows (netsh) are included.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAK DETECTION (/leaks)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tests your VPN connection for three types of leaks:
  - DNS Leak: Verifies DNS queries go through ProxhqVPN, not your ISP
  - IPv6 Leak: Checks for IPv6 address exposure (common on dual-stack ISPs)
  - WebRTC Leak: Tests if the browser leaks your local IP via WebRTC

If a leak is detected, follow the on-screen remediation steps.
Enable Kill Switch + use DNS Shield to eliminate most leaks.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DNS SHIELD (/dns-shield)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Encrypted DNS resolver with built-in blocking lists:
  - Ads & Trackers: Blocks 100k+ advertising and tracking domains
  - Malware: Blocks known malware distribution and phishing domains
  - Adult Content: Optional category-based blocking
  - Custom: Add your own allow/block rules (one domain per line)
  - DNS-over-HTTPS: Routes DNS queries over encrypted HTTPS (no ISP snooping)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPLIT TUNNELING (/split-tunnel)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Route only specific traffic through the VPN. Bypass rules by:
  - IP Address / CIDR: Force specific IPs to bypass or use the VPN
  - Domain: Bypass VPN for specific websites (e.g., local banking, corporate intranet)
  - Port: Bypass VPN for specific ports (e.g., gaming UDP ports for low latency)
  - Application: Per-app VPN rules (Linux only via cgroups)

Generates platform-specific scripts (Linux ip rules, Windows route commands).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VPN GATE DOUBLE-HOP (/vpngate)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Routes traffic through an additional relay VPN Gate server before reaching
the destination. Your traffic: Your Device → ProxhqVPN → VPN Gate Relay → Internet.
The destination site sees a VPN Gate relay IP, not your ProxhqVPN server IP.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ONION BROWSER (TOR OVER VPN) (/onion-browser)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Browse .onion sites and surface web through Tor, tunneled through ProxhqVPN.
Connection chain: Your Device → ProxhqVPN → Tor Entry → Tor Relay → Tor Exit → Destination
The Tor exit node IP is shown. You are NOT identified to the destination.

Proxy modes: Direct / ProxhqVPN Onion / Tor / Double-hop / Custom SOCKS4/5/HTTP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SMART DNS (/smart-dns)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DNS-only geo-bypass for streaming (Netflix, Hulu, BBC iPlayer) on any
device including Smart TVs and game consoles that cannot run VPN apps.
Copy the two DNS server IPs and enter them in your device network settings.
Note: Smart DNS does NOT encrypt traffic — for privacy, use the full VPN.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROUTER CONFIG (/router-config)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generates firmware-specific WireGuard configs for routers. Supported:
OpenWRT, DD-WRT, AsusWRT-Merlin, pfSense/OPNsense, GL.iNet, Ubiquiti EdgeOS.
Your current IP is auto-detected and embedded in the kill switch rules.
Protects every device on your network automatically.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IP EXPOSURE SCANNER (/ip-exposure) — VPN Basic
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Shows exactly what your IP reveals: geolocation, ISP, VPN/proxy detection,
WebRTC leak, DNS leak, browser fingerprint risk. Run before and after
connecting to ProxhqVPN to verify coverage.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMMAND CENTER PRO TOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Alpha Toolkit (/alpha-tools):
  Three engines: Universal Scanner (35+ languages, 200+ vuln patterns),
  Vulnerability Verifier (actively probes Scanner findings), Web Scraper
  (browser-based, stores to 14-table SQLite DB). All Tor-routable.

Vulnerability Scanner (/sqlmap):
  Full SQLmap integration for automated SQL injection testing.
  Modes: GET/POST/form-data, all DBMS types, Tor routing, tamper scripts.

HTTP Probe (/http-probe):
  Full HTTP client — all methods, custom headers, body editors.
  Equivalent to Burp Suite Repeater. Full response inspector.

Directory Fuzzer (/dir-fuzzer):
  Brute-force hidden files/dirs with wordlists. Equivalent to ffuf/gobuster.
  Common wordlists: admin panels, API routes, git/config files, backups.

Subdomain Scout (/subdomain-scan):
  Certificate Transparency log enumeration + DNS brute-force.
  Passive (CT logs) or active (DNS resolution) enumeration modes.

Threat Intelligence (/threat-intel):
  IP reputation (AbuseIPDB/Shodan/GreyNoise), WHOIS, TLS cert inspector,
  HTTP headers analyzer, live threat feeds.

Security Audit (/security-audit):
  Self-audit of ProxhqVPN platform — TLS grade, open ports, WireGuard
  key strength, firewall rules, CORS, CSP headers. PASS/WARN/FAIL output.

Intruder (/intruder):
  Automated parameter fuzzer. Modes: Sniper, Battering Ram, Pitchfork,
  Cluster Bomb. Modeled after Burp Intruder.

Payload Generator (/payloads):
  Pre-built payloads: SQLi, XSS, SSTI, SSRF, XXE, RCE, Path Traversal,
  Command Injection, WAF bypass, JWT secrets, credential lists.

CVE Lookup (/cve-search):
  NVD database search by CVE ID or keyword. CVSS score filtering.
  Critical (9.0-10.0), High (7.0-8.9), Medium (4.0-6.9), Low (0.1-3.9).

Encoder / Decoder (/encoder):
  Base64, URL encode, HTML entities, Hex, Binary, MD5, SHA-1/256/512,
  HMAC-SHA256, bcrypt, JWT decode, auto-detect mode.

Request Comparer (/comparer):
  Side-by-side diff of two HTTP requests/responses. Modes: Words, Lines,
  Bytes. Useful for auth bypass detection and IDOR verification.

SIEM — Security Event Log (/siem):
  Unified event log aggregating WireGuard tunnel events, SilkWeb honeypot
  hits, firewall rule blocks, DNS sinkhole blocks, and auth failures.
  Filter by severity, source, time range. Export CSV or JSON.
  Alert rules for email notifications on specific event patterns.

OSINT Recon (/osint-recon):
  Passive intelligence aggregation across 15+ sources: Shodan, Censys,
  AbuseIPDB, VirusTotal, GreyNoise, WHOIS/RDAP, DNSDumpster, crt.sh,
  HaveIBeenPwned, URLhaus, PassiveDNS, BGP/ASN. All queries VPN-routed.
  Export findings as HTML, PDF, or JSON.

Canary Tokens (/canary-tokens):
  Invisible tripwires that alert you the instant someone accesses them.
  Token types: HTTP URL, DNS, PDF/DOCX document, Email pixel, AWS fake
  key, SQL canary row. Alerts include source IP, browser, GeoIP, OS.

Ghost Chain Exploit Arsenal (/ghost-chain):
  200+ categorized exploits with Details tab (technique, CVEs, examples)
  and Exploit PoC tab (copy-ready attack code). Categories: SQLi, XSS,
  RCE, SSRF, XXE, LFI, Deserialization, JWT, OAuth, HTTP Smuggling,
  Cache Poisoning, CORS, WebSocket hijacking, subdomain takeover.
  Integrates with HTTP Probe and Intruder (click Send to tool).

Exploit Importer (/exploit-import):
  Upload Nessus XML, Burp HTML, Nikto, ZAP, or OpenVAS reports.
  Also accepts .txt, .log, .json — ZIP archives auto-extracted.
  30+ pattern categories: SQLi, XSS, RCE, SSRF, XXE, LFI, IDOR, CSRF,
  JWT vulns, SSTI, CORS, mass assignment, GraphQL, buffer overflow,
  exposed .env/.git, hardcoded secrets, open Actuator/Swagger,
  weak TLS, no rate limiting, open redirect, default credentials.
  CVE IDs auto-extracted. Results sorted by severity.

  Each result card has THREE TABS:
    [Details]      Full evidence text, CVE hyperlinks, severity badge
    [Instructions] Complete step-by-step exploitation guide:
                   - Impact assessment
                   - Tools required (with exact install commands)
                   - Before you start / prerequisites
                   - Numbered attack walkthrough with terminal commands
                   - How to verify the exploit succeeded
                   - Remediation with corrected code examples
                   - Reference links (PortSwigger, OWASP, NVD)
    [Exploit Code] Ready-to-run PoC code (Python, Bash, SQL, JS, XML)
                   with one-click clipboard copy

  Download Full Report: Click the green button in the results header
  to download a comprehensive .md (Markdown) report of all findings —
  including full instruction guides for every vulnerability detected.
  Ideal for client deliverables, pentest reports, and team briefings.

  24 Built-in Vulnerability Guides:
    SQL Injection, XSS, RCE, LFI, SSRF, XXE, IDOR, CSRF, JWT attacks,
    Deserialization, SSTI, CORS misconfig, Auth Bypass, .env Exposure,
    .git Exposure, Missing Security Headers, No Rate Limiting,
    Hardcoded Secrets, Buffer Overflow, Mass Assignment, Weak TLS,
    Spring Actuator Exposure, Open Redirect, Default Credentials,
    GraphQL Security, CVE-Based Exploits

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VPN BASIC EXCLUSIVE FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DNS Sinkhole (/dns-sinkhole):
  Pi-hole equivalent built into the VPN. Blocks 100k+ ad networks,
  trackers, malware distribution domains, stalkerware, and coin miners
  at the DNS layer. Custom block/allow lists with wildcard support.
  Query log shows every DNS request with ALLOWED/BLOCKED status.

Network Traffic Monitor (/network-monitor):
  Real-time flow table — every connection through the VPN tunnel.
  Columns: Source IP, Destination IP, Port, Protocol, Bytes In/Out,
  Duration, Country (GeoIP), Threat flag (AbuseIPDB/botnet check).
  Protocol breakdown tab. PCAP capture (30-sec Wireshark-compatible).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADMIN TOOLS (Admin accounts only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dashboard (/dashboard):       Live platform metrics, subscription counts, MRR
VPN Servers (/nodes):         Add/remove/rotate VPN nodes, get setup scripts
Threat Monitor (/beacons):    Real-time intrusion alerts from all nodes + SilkWeb
SilkWeb Decoy (/silkweb):     Honeypot manager — trapped IPs, payloads captured
Firewall (/firewall):         iptables/nftables rules across all nodes
Performance (/monitor):       Real-time CPU/RAM/bandwidth per node
Employee Access (/employees): Manage employee accounts
Remote Terminal (/terminal):  Web shell for live VPN server management
Database (/sql):              Direct SQL interface (local + external DBs)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AMBASSADOR PROGRAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Earn 10% commission on every subscription payment from customers you refer.
Apply at: https://proxhqvpn.com/ambassador/apply
Dashboard: https://proxhqvpn.com/ambassador/dashboard
Full handbook: https://proxhqvpn.com/handbook/ambassador

Commission rates:
  VPN Basic Monthly ($6.99):     $0.70/mo per customer
  VPN Basic Annual ($59.99):     $6.00/yr per customer
  Pro Monthly ($39.99):          $4.00/mo per customer
  Pro Annual ($349.99):          $35.00/yr per customer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACCOUNT & BILLING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Account (/account): Manage profile, 2FA, linked OAuth accounts,
  view active sessions, rotate WireGuard keys, manage billing.
Billing is handled by Stripe (PCI-DSS Level 1). ProxhqVPN never stores
payment card data. Use Account → Manage Billing to cancel or change plans.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email:      support@proxhqvpn.com
Guide:      https://proxhqvpn.com/guide
Pricing:    https://proxhqvpn.com/pricing
Downloads:  https://proxhqvpn.com/downloads
`,Ze={windows:`ProxhqVPN — Windows Setup & User Guide
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Windows 10 or Windows 11 (64-bit)
  - WireGuard for Windows (free, open source)
  - A ProxhqVPN account (proxhqvpn.com/sign-in)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — INSTALL WIREGUARD FOR WINDOWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Download: https://download.wireguard.com/windows-client/wireguard-installer.exe
  1. Run the .exe installer (click "Yes" at the UAC prompt)
  2. WireGuard installs as a Windows Service — no reboot needed
  3. The WireGuard tray icon appears in the system notification area

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — GENERATE YOUR CONFIG FILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Sign in at https://proxhqvpn.com/sign-in
  2. Navigate to WireGuard Config (/wireguard)
  3. Click "Generate" — your private/public keypair is created
     (your private key is generated in your browser; the server
      only stores your public key — maximum privacy)
  4. Click "Download .conf" to save your proxhq.conf file

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — IMPORT THE CONFIG & CONNECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Open WireGuard
  2. Click the drop-down arrow next to "Add Tunnel"
  3. Select "Import tunnel(s) from file"
  4. Browse to your downloaded proxhq.conf file
  5. The tunnel "proxhq" appears in the list
  6. Click "Activate" — the indicator turns green
     Your Windows taskbar shows the WireGuard tunnel icon

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — VERIFY YOUR CONNECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open Command Prompt (Win + R → cmd) and run:
    curl https://api64.ipify.org
  The IP address shown must be a ProxhqVPN server IP, NOT your real IP.
  Run a full leak test at: https://proxhqvpn.com/leaks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WINDOWS-SPECIFIC FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Kill Switch (/kill-switch):
    ProxhqVPN generates Windows netsh firewall rules that block
    ALL internet traffic if the VPN drops. Prevents IP leaks.
    Three modes: Strict / Allow LAN / Custom CIDR whitelist.

  Split Tunneling (/split-tunnel):
    Route only specific apps or IPs through the VPN.
    ProxhqVPN generates Windows "route add" commands for your config.
    Useful for keeping gaming UDP ports on your direct connection.

  DNS Shield (/dns-shield):
    Use ProxhqVPN's encrypted DNS-over-HTTPS to block ads, trackers,
    and malware domains. Add the DNS line to your .conf file:
      DNS = 1.1.1.1, 1.0.0.1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer (/exploit-import) — Command Center Pro:
  Upload scan reports (Nessus, Burp Suite, Nikto, ZAP, OpenVAS)
  and get structured findings with three tabs per result:
    [Details]      Evidence, CVE ID, severity
    [Instructions] Full step-by-step exploitation guide with
                   tool install commands and remediation code
    [Exploit Code] Ready-to-run PoC attack code
  Click "Download Full Report" to export a complete .md report.
  24 built-in vulnerability guides cover SQLi, XSS, RCE, LFI,
  SSRF, XXE, IDOR, JWT attacks, SSTI, CORS, and more.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email:      support@proxhqvpn.com
  Full guide: https://proxhqvpn.com/guide
  Downloads:  https://proxhqvpn.com/downloads
`,mac:`ProxhqVPN — macOS Setup & User Guide
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - macOS 12 Monterey or later (Intel or Apple Silicon)
  - WireGuard from the Mac App Store (free)
  - A ProxhqVPN account (proxhqvpn.com/sign-in)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — INSTALL WIREGUARD FOR MACOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Mac App Store: https://apps.apple.com/us/app/wireguard/id1451685025
  Click "Get" → install with your Apple ID as normal.
  WireGuard appears in your Applications folder and menu bar.

  Alternatively via Homebrew (for CLI usage):
    brew install wireguard-tools

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — GENERATE YOUR CONFIG FILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Sign in at https://proxhqvpn.com/sign-in
  2. Navigate to WireGuard Config (/wireguard)
  3. Click "Generate" — keypair created in-browser
  4. Click "Download .conf" → save proxhq.conf

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — IMPORT & CONNECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  App Store WireGuard:
    1. Open WireGuard → click "Import tunnel(s) from file"
    2. Select your proxhq.conf
    3. macOS shows a VPN configuration prompt — click "Allow"
    4. Go to System Settings → VPN → allow ProxhqVPN if needed
    5. Toggle the tunnel ON in WireGuard — status shows "Active"

  CLI (Homebrew):
    sudo cp proxhq.conf /etc/wireguard/proxhq.conf
    sudo wg-quick up proxhq
    sudo wg-quick down proxhq   # to disconnect

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — VERIFY YOUR CONNECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open Terminal and run:
    curl https://api64.ipify.org
  Must show a ProxhqVPN server IP, not your home IP.
  Full leak test: https://proxhqvpn.com/leaks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MACOS-SPECIFIC FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Kill Switch (/kill-switch):
    ProxhqVPN generates pf (Packet Filter) firewall rules for macOS.
    Paste into /etc/pf.conf — blocks all non-VPN traffic on drop.

  Split Tunneling (/split-tunnel):
    ProxhqVPN generates macOS route commands for per-IP bypass rules.

  DNS Shield: Set DNS = 1.1.1.1 in your .conf for encrypted DNS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer — 24 built-in vulnerability guides, three-tab
  result cards (Details / Instructions / Exploit Code), and the
  Download Full Report button for complete .md pentest reports.
  Command Center Pro only. Full guide: https://proxhqvpn.com/guide

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,linux:`ProxhqVPN — Linux Setup & User Guide
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Ubuntu 20.04+ / Debian 11+ / Fedora 36+ / Arch / Alpine / Kali
  - WireGuard kernel module (built into Linux kernel ≥5.6)
  - wireguard-tools package

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — INSTALL WIREGUARD TOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Ubuntu / Debian / Kali:
    sudo apt update && sudo apt install wireguard wireguard-tools -y

  Fedora / RHEL 9+:
    sudo dnf install wireguard-tools -y

  Arch Linux / Manjaro:
    sudo pacman -S wireguard-tools

  Alpine Linux:
    apk add wireguard-tools

  Raspberry Pi OS (Raspbian):
    sudo apt update && sudo apt install wireguard -y

  Verify: which wg-quick   # should return /usr/bin/wg-quick

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — GENERATE YOUR CONFIG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Sign in at https://proxhqvpn.com/sign-in
  2. Navigate to WireGuard Config (/wireguard)
  3. Click "Generate" → "Copy Config"
  4. Paste into your config file:
       sudo nano /etc/wireguard/proxhq.conf
     (or use the Download .conf button and copy it over)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — CONNECT & MANAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Start VPN:        sudo wg-quick up proxhq
  Stop VPN:         sudo wg-quick down proxhq
  Check status:     sudo wg show
  View interface:   ip a show wg0

  Enable at boot (systemd):
    sudo systemctl enable wg-quick@proxhq
    sudo systemctl start wg-quick@proxhq

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — VERIFY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  curl https://api64.ipify.org
  Should show ProxhqVPN server IP, not your real IP.
  Full leak test: https://proxhqvpn.com/leaks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LINUX-SPECIFIC FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Kill Switch — iptables:
    ProxhqVPN (/kill-switch) generates PostUp/PreDown iptables rules.
    Add them to your [Interface] block in proxhq.conf:
      PostUp   = iptables -I OUTPUT ! -o wg0 -m mark ! --mark $(wg show wg0 fwmark) -m addrtype ! --dst-type LOCAL -j REJECT
      PreDown  = iptables -D OUTPUT ! -o wg0 -m mark ! --mark $(wg show wg0 fwmark) -m addrtype ! --dst-type LOCAL -j REJECT

  Kill Switch — nftables (modern systems):
    ProxhqVPN generates equivalent nftables ruleset via /kill-switch.

  Split Tunneling (/split-tunnel):
    ProxhqVPN generates "ip rule" and "ip route" commands for
    per-IP or per-port VPN bypass on Linux.

  DNS Shield:
    Add to your [Interface] block: DNS = 1.1.1.1, 1.0.0.1
    Or use systemd-resolved for persistent encrypted DNS.

  Chromebook / Raspberry Pi:
    These platforms use the Linux instructions above.
    Raspberry Pi: tested on Raspberry Pi OS Bullseye (64-bit).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer — 24 built-in vulnerability guides, three-tab
  result cards (Details / Instructions / Exploit Code), and the
  Download Full Report button for complete .md pentest reports.
  Ideal for security researchers, red teamers, and bug bounty hunters
  running Kali Linux. Command Center Pro only.
  Full guide: https://proxhqvpn.com/guide

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,android:`ProxhqVPN — Android Setup & User Guide
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Android 8.0 (Oreo) or later, API level 26+
  - Works on phones, tablets, Android TV, and Nvidia Shield

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — INSTALL WIREGUARD FOR ANDROID
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Option A — Google Play Store (recommended):
    https://play.google.com/store/apps/details?id=com.wireguard.android
    Search "WireGuard" → install the official app (by WireGuard LLC)

  Option B — Direct APK (no Play Store needed):
    https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk
    Before installing: Settings → Security → Install unknown apps → ON
    Tap the downloaded APK → Install → Open

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — GET YOUR CONFIG (QR CODE METHOD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. On a desktop/laptop: sign in to proxhqvpn.com
  2. Navigate to WireGuard Config (/wireguard)
  3. Click "Generate" → "Show QR Code"
  4. On your Android: open WireGuard → tap the blue "+" button
  5. Choose "Scan from QR code"
  6. Point your camera at the QR code on your screen
  7. The tunnel is imported with name "proxhq"

  Alternatively — File Import:
  Download the .conf file → copy to phone → WireGuard → + →
  "Import from file" → browse to proxhq.conf

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — CONNECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Tap the tunnel name "proxhq" → tap the toggle switch to ON
  Android shows a VPN key icon in the status bar = connected
  First use: Android asks to allow a VPN connection → tap "OK"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — VERIFY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open Chrome → visit https://api64.ipify.org
  Must show a ProxhqVPN server IP, not your mobile carrier IP.
  Full leak test: https://proxhqvpn.com/leaks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANDROID TV / NVIDIA SHIELD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Android TV and Nvidia Shield run full Android — the Play Store
  WireGuard app installs and works the same way. Use a mouse or
  connect your phone as a remote for QR code scanning.
  Alternatively, use ADB to push the .conf file and import it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer — 24 built-in vulnerability guides, three-tab
  result cards (Details / Instructions / Exploit Code), and the
  Download Full Report button for complete .md pentest reports.
  Access from the ProxhqVPN mobile browser at proxhqvpn.com.
  Command Center Pro only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,ios:`ProxhqVPN — iOS & iPadOS Setup & User Guide
============================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - iPhone or iPad running iOS / iPadOS 15.0 or later
  - WireGuard from the App Store (free, developed by WireGuard LLC)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — INSTALL WIREGUARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  App Store: https://apps.apple.com/us/app/wireguard/id1441195209
  Search "WireGuard" → install the official app
  No sign-in required for the WireGuard app itself

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — GENERATE YOUR CONFIG (QR METHOD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. On a desktop/laptop: sign in to proxhqvpn.com
  2. Navigate to WireGuard Config (/wireguard)
  3. Click "Generate" → "Show QR Code"
  4. On your iPhone/iPad: open WireGuard → tap the "+" button
  5. Choose "Create from QR code"
  6. Point your camera at the QR code on your screen
  7. Name the tunnel "ProxhqVPN" → tap "Save"

  Alternatively — File Import:
  Download the .conf file → share it to WireGuard via iOS Share Sheet

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — CONNECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. iOS will ask to add a VPN configuration — tap "Allow"
  2. Toggle the tunnel ON in WireGuard
  3. The VPN key icon (🔑) appears in the iOS status bar = connected
  4. You can also toggle from Settings → VPN

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — VERIFY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open Safari → visit https://api64.ipify.org
  Must show ProxhqVPN server IP, not your carrier's IP.
  Full leak test: https://proxhqvpn.com/leaks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
iOS-SPECIFIC TIPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  On-Demand Connect:
    In WireGuard, tap your tunnel → "On-Demand" → enable for
    Wi-Fi and/or Cellular. The VPN reconnects automatically.

  Personal Hotspot Sharing:
    Enable VPN on your iPhone, then share via Personal Hotspot.
    Devices connected to the hotspot (Apple TV, laptop) tunnel
    all traffic through ProxhqVPN automatically.

  iPhone as Router for Apple TV:
    This is the recommended way to protect Apple TV with ProxhqVPN.
    iPhone → VPN ON → Personal Hotspot ON → Apple TV connects to hotspot.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer — 24 built-in vulnerability guides, three-tab
  result cards (Details / Instructions / Exploit Code), and the
  Download Full Report button for complete .md pentest reports.
  Access at proxhqvpn.com in Safari. Command Center Pro only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,fire:`ProxhqVPN — Amazon Fire Stick & Fire TV Setup Guide
====================================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Amazon Fire Stick (any generation: Lite, 4K, 4K Max, 4K Plus)
  - Amazon Fire TV Cube or Fire TV Stick
  - The "Downloader" app (free on Amazon App Store)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — ENABLE APPS FROM UNKNOWN SOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  On your Fire Stick remote, navigate to:
    Settings → My Fire TV → Developer Options
    → Apps from Unknown Sources → ON
  If "Developer Options" is not visible:
    Settings → My Fire TV → About → click "Build" 7 times rapidly
    then go back and Developer Options will appear.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — INSTALL THE DOWNLOADER APP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Fire Stick Home → Find → Search → type "Downloader"
  Install the app by AFTVnews (orange icon)
  Open Downloader and allow storage permissions when prompted

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — DOWNLOAD & INSTALL WIREGUARD APK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open Downloader → tap the URL bar → enter this URL exactly:
    https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk
  Tap "Go" → the APK downloads automatically
  When complete: tap "Install" → tap "Done" (not "Open" yet)
  Tap "Delete" to remove the APK file (saves storage space)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — GET YOUR WIREGUARD CONFIG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  On a phone or computer:
    1. Sign in at https://proxhqvpn.com/sign-in
    2. Navigate to WireGuard Config (/wireguard)
    3. Click "Generate" → "Show QR Code"
    4. Leave this screen open (you'll scan it in Step 5)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — IMPORT CONFIG & CONNECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Find WireGuard in your Fire Stick apps:
    Home → Apps → Your Apps & Channels → WireGuard
    (or use Downloader: URL bar → type "wireguard" → Find)
  Open WireGuard → tap the blue "+" button (use D-pad + OK)
  Choose "Scan from QR code"
  Point your Fire Stick camera at the QR code on your phone/computer
  Tap "Create Tunnel" → name it "ProxhqVPN"
  Toggle the tunnel ON → VPN key icon appears at the top of the screen

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — VERIFY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open Silk Browser → visit https://api64.ipify.org
  Must show ProxhqVPN server IP, not your home IP.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIRE STICK TIPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  D-Pad Navigation: Use the directional pad + OK button to navigate
    the WireGuard app. Long-press OK to access context menus.

  Auto-Start: WireGuard does not auto-start on Fire Stick boot.
    Add WireGuard to your favorites and toggle ON each session,
    OR use your router as the VPN instead (see Router README).

  No Camera? Use a USB keyboard + mouse (OTG adapter) to navigate
    to WireGuard → Import from file, and copy the .conf via USB.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer — 24 built-in vulnerability guides with
  step-by-step attack walkthroughs and downloadable .md reports.
  Command Center Pro. Access at proxhqvpn.com in Silk Browser.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,router:`ProxhqVPN — Router Setup & User Guide
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHY USE A ROUTER?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Installing ProxhqVPN on your router protects EVERY device on
  your network automatically — Smart TVs, gaming consoles, phones,
  tablets, smart home devices, laptops — without installing any app
  on each device. One setup, whole-home VPN coverage.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORTED FIRMWARE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - OpenWRT (recommended — best control and kill switch support)
  - DD-WRT (for older routers)
  - AsusWRT-Merlin (for Asus routers)
  - pfSense / OPNsense (for advanced/enterprise routers)
  - GL.iNet (plug-and-play, native WireGuard support)
  - Ubiquiti EdgeOS (EdgeRouter series)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — GENERATE YOUR ROUTER CONFIG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Sign in → Router Config (/router-config)
  Select your router firmware from the dropdown.
  Your LAN IP is auto-detected and embedded in the kill switch rules.
  Click "Generate" → copy the full config block.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPENWRT INSTALLATION (RECOMMENDED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SSH into your router as root:
    ssh root@192.168.1.1

  Install WireGuard packages:
    opkg update
    opkg install wireguard-tools kmod-wireguard luci-proto-wireguard

  Create and paste your config:
    nano /etc/config/network
    (paste the ProxhqVPN generated [interface] and [peer] block)

  Restart networking:
    /etc/init.d/network restart

  Verify from a connected device:
    curl https://api64.ipify.org

  Enable LuCI WireGuard UI (optional):
    opkg install luci-proto-wireguard luci-app-wireguard
    Reboot → Network → Interfaces → WireGuard visible in LuCI

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GL.INET (EASIEST — PLUG AND PLAY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GL.iNet routers (GL-MT3000, GL-AXT1800, GL-AX1800, etc.) have
  native WireGuard client support built in:
    1. Admin Panel (192.168.8.1) → VPN → WireGuard Client
    2. Add Profile → paste the generated config → Save
    3. Toggle WireGuard ON → connected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PFSENSE / OPNSENSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  pfSense: Install the WireGuard package via Package Manager.
  OPNsense: WireGuard is built in (Plugins → os-wireguard).
  Use the ProxhqVPN generated [Interface] and [Peer] values
  to fill in the GUI fields for key, endpoint, and allowed IPs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UBIQUITI EDGEOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  EdgeOS supports WireGuard via DPKG packages:
    configure
    set interfaces wireguard wg0 address <your-vpn-ip>/32
    set interfaces wireguard wg0 private-key <your-private-key>
    set interfaces wireguard wg0 peer <server-pubkey> endpoint <server>:51820
    set interfaces wireguard wg0 peer <server-pubkey> allowed-ips 0.0.0.0/0
    commit ; save

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHICH DEVICES ARE COVERED BY ROUTER VPN?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Samsung TVs / LG TVs / Hisense TVs
  ✓ Roku, Fire TV Stick (via router — no APK needed)
  ✓ PlayStation 4, PlayStation 5
  ✓ Xbox One, Xbox Series X/S
  ✓ Nintendo Switch
  ✓ Apple TV HD / Apple TV 4K
  ✓ Smart home devices (Ring, Nest, Alexa)
  ✓ Any phone, tablet, or laptop on your Wi-Fi

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer — 24 built-in vulnerability guides with
  step-by-step attack walkthroughs and downloadable .md reports.
  Command Center Pro. Access at proxhqvpn.com from any browser.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,appletv:`ProxhqVPN — Apple TV Setup Guide
==================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Apple TV HD (4th gen) or Apple TV 4K (any generation)
  - Running tvOS 17.0 or later
  - Choose one of the three methods below

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 1 — WIREGUARD ON TVOS (RECOMMENDED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WireGuard is available as a native tvOS app:
    App Store on Apple TV → search "WireGuard" → Install
    (Or: https://apps.apple.com/us/app/wireguard/id1451685025)

  Import your config via QR code:
    1. On a desktop/phone: sign in to proxhqvpn.com
    2. Navigate to WireGuard Config (/wireguard)
    3. Click "Generate" → "Show QR Code"
    4. On Apple TV: open WireGuard → tap "+" → "Create from QR code"
       (Use the Apple TV camera or hold your phone's screen in front
        of the Apple TV camera — works via the tvOS QR scanner)
    5. Toggle the tunnel ON → VPN key appears at top of tvOS

  No Apple TV camera? Use the tvOS Share Clipboard method:
    - AirDrop the .conf file to Apple TV from your Mac
    - Or use Apple TV settings to sign into your iCloud
      and then use iCloud Drive to share the file

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 2 — IPHONE PERSONAL HOTSPOT (EASIEST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  You don't need to configure anything on the Apple TV itself.
  1. Set up ProxhqVPN on your iPhone (see iOS README)
  2. Connect Apple TV to your iPhone's Personal Hotspot via Wi-Fi
     (Settings → Wi-Fi on Apple TV → select your iPhone's hotspot)
  3. Enable ProxhqVPN on your iPhone → toggle WireGuard ON
  4. All Apple TV traffic is now tunneled through ProxhqVPN

  Trade-off: Your iPhone battery will drain faster, and your
  Apple TV won't work if your iPhone goes out of range.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 3 — ROUTER SETUP (BEST FOR ALWAYS-ON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Install ProxhqVPN on your router — every device on your Wi-Fi,
  including Apple TV, is automatically protected. No configuration
  needed on the Apple TV at all.
  See the Router README in this bundle for full instructions.
  Supported routers: OpenWRT, GL.iNet, pfSense, OPNsense, AsusWRT,
  DD-WRT, Ubiquiti EdgeOS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open the Infuse or VLC browser on Apple TV and navigate to:
    https://api64.ipify.org
  Or check from any device on the same network:
    curl https://api64.ipify.org

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer — 24 built-in vulnerability guides with
  step-by-step attack walkthroughs and downloadable .md reports.
  Command Center Pro. Access at proxhqvpn.com from Safari on iPhone
  or Mac while your Apple TV is protected by the VPN.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`},Dt=`ProxhqVPN — Changelog
======================
ALPHA UNLIMITED TECHNOLOGIES LLC | https://proxhqvpn.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSION 4.0 — 2025
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEW: Exploit Importer — Instructions Tab
  Every detected vulnerability card now has a dedicated Instructions tab
  containing a complete step-by-step exploitation guide:
    - Impact Assessment
    - Tools Required (with exact apt/brew/pip/gem install commands)
    - Prerequisites & access requirements
    - Numbered attack walkthrough with terminal commands
    - How to verify the exploit succeeded
    - Remediation with corrected code examples (Node.js, Python, Java, PHP)
    - Reference links (PortSwigger, OWASP, NVD)

NEW: 24 Built-In Vulnerability Guides
  SQL Injection, XSS (reflected/stored/DOM), RCE, LFI, SSRF, XXE,
  IDOR, CSRF, JWT Vulnerabilities, Deserialization, SSTI, CORS Misconfig,
  Auth Bypass, .env Exposure, .git Exposure, Missing Security Headers,
  No Rate Limiting, Hardcoded Secrets, Buffer Overflow, Mass Assignment,
  Weak TLS, Spring Boot Actuator Exposure, Open Redirect,
  Default Credentials, GraphQL Security, CVE-Based Exploits.

NEW: Download Full Report
  Green "Download Full Report" button in Exploit Importer results header.
  Exports a complete Markdown (.md) pentest report — every finding,
  full instruction guide, PoC code, remediation, and reference links.
  Ideal for client deliverables and team briefings.

NEW: Three-Tab Result Cards
  Every Exploit Importer finding now has three tabs:
    [Details]      Raw evidence, CVE ID, severity badge
    [Instructions] Complete step-by-step exploitation guide
    [Exploit Code] Ready-to-run PoC code (Python/Bash/SQL/JS/XML)

IMPROVED: Expanded Exploit Importer Detection
  30+ pattern categories now include SSTI (FreeMarker, ERB, Twig, Jinja2),
  CORS wildcard, mass assignment, GraphQL introspection, buffer overflow,
  open redirect, Spring Actuator, weak TLS, and more.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSION 3.0 — 2024
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Ghost Chain Exploit Arsenal: 200+ categorized exploits with PoC code
  - Exploit Importer: upload Nessus/Burp/ZAP/Nikto/OpenVAS reports
  - Canary Tokens: HTTP URL, DNS, document, email, AWS key, SQL canary
  - OSINT Recon: 15+ passive intelligence sources (Shodan, Censys, etc.)
  - SIEM: unified security event log with CSV/JSON export
  - CVE Lookup: NVD database search by CVE ID or keyword
  - Payload Generator: pre-built SQLi, XSS, SSTI, SSRF, XXE, RCE payloads
  - Request Comparer: side-by-side HTTP diff (Words/Lines/Bytes)
  - Encoder/Decoder: Base64, URL, hex, MD5/SHA, JWT decode, bcrypt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSION 2.0 — 2023
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Alpha Toolkit: Universal Scanner + Vulnerability Verifier + Web Scraper
  - SilkWeb Honeypot: SSH/HTTP/FTP/RDP decoy services
  - Firewall Manager: iptables/nftables rules across all VPN nodes
  - Threat Monitor: real-time beacon intrusion alert stream
  - Remote Terminal: web-based shell access to VPN servers
  - HTTP Probe: full HTTP client (Burp Repeater equivalent)
  - Directory Fuzzer: ffuf/gobuster equivalent
  - Subdomain Scout: CT log + DNS brute-force enumeration
  - Intruder: Sniper/Battering Ram/Pitchfork/Cluster Bomb fuzzing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSION 1.0 — 2022
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Initial release
  - WireGuard VPN with AES-256-GCM / ChaCha20-Poly1305
  - Kill Switch (Strict / Allow LAN / Custom)
  - DNS Shield with DNS-over-HTTPS
  - Leak Detection (DNS / IPv6 / WebRTC)
  - VPN Gate Double-Hop relay routing
  - Onion Browser (Tor over VPN)
  - Smart DNS for geo-bypass without VPN encryption
  - Split Tunneling (per-IP, per-domain, per-port)
  - Router Config generator (OpenWRT/DD-WRT/pfSense/GL.iNet)
  - DNS Sinkhole (Pi-hole equivalent)
  - Network Traffic Monitor with PCAP export
  - Device Manager
  - IP Exposure Scanner
  - Obfuscation / Stealth Mode
`,Vt=`ProxhqVPN — Version Information
=================================
Product:   ProxhqVPN
Version:   4.0
Release:   2026
Company:   ALPHA UNLIMITED TECHNOLOGIES LLC
Website:   https://proxhqvpn.com
Support:   support@proxhqvpn.com
Guide:     https://proxhqvpn.com/guide
Pricing:   https://proxhqvpn.com/pricing
Downloads: https://proxhqvpn.com/downloads

Plans:
  VPN Basic           $6.99/mo or $59.99/yr
  Command Center Pro  $39.99/mo or $349.99/yr

WireGuard Protocol:  AES-256-GCM + ChaCha20-Poly1305
`,Lt={windows:{"install.bat":`@echo off
title ProxhqVPN -- Windows Installer v4.0
color 0A
echo.
echo  ================================================
echo   ProxhqVPN -- Windows Setup  v4.0
echo   ALPHA UNLIMITED TECHNOLOGIES LLC
echo   https://proxhqvpn.com
echo  ================================================
echo.
echo  Step 1 -- Downloading WireGuard for Windows...
powershell -Command "Invoke-WebRequest -Uri 'https://download.wireguard.com/windows-client/wireguard-installer.exe' -OutFile '%TEMP%\\wireguard-installer.exe' -UseBasicParsing"
if %errorlevel% neq 0 (
  echo  [ERROR] Download failed. Check your internet connection.
  pause & exit /b 1
)
echo  Download complete.
echo.
echo  Step 2 -- Installing WireGuard...
start /wait "%TEMP%\\wireguard-installer.exe"
echo  WireGuard installed.
echo.
echo  Step 3 -- Launching ProxhqVPN...
start https://proxhqvpn.com/sign-in
echo.
echo  ================================================
echo   SUBSCRIPTION REQUIRED:
echo   An active ProxhqVPN plan is required to connect.
echo   No account? Visit https://proxhqvpn.com/pricing
echo.
echo   AFTER SIGNING IN:
echo   The app detects your plan automatically:
echo     VPN Basic          -- opens your VPN dashboard
echo     Command Center Pro -- opens the full platform
echo.
echo   CONNECT YOUR VPN:
echo   1. Go to WireGuard Config -- Generate -- Download .conf
echo   2. WireGuard: Add Tunnel -- Import file -- Activate
echo   3. Run vpn-verify.bat to confirm connection
echo  ================================================
echo.
pause
`,"vpn-connect.bat":`@echo off
title ProxhqVPN -- Connect / Disconnect
color 0A
echo.
echo  ProxhqVPN -- WireGuard Control v4.0
echo  ================================================
echo  [1] Connect VPN
echo  [2] Disconnect VPN
echo  [3] Show VPN status
echo  [4] Verify connection (check IP)
echo  [Q] Quit
echo.
set /p choice="Enter choice: "
if /i "%choice%"=="1" goto connect
if /i "%choice%"=="2" goto disconnect
if /i "%choice%"=="3" goto status
if /i "%choice%"=="4" goto verify
if /i "%choice%"=="Q" exit
goto end

:connect
echo  Activating ProxhqVPN tunnel...
net start WireGuardTunnel$proxhq 2>nul || (
  echo  Tunnel service not found. Import your .conf file in WireGuard first.
)
goto end

:disconnect
echo  Deactivating ProxhqVPN tunnel...
net stop WireGuardTunnel$proxhq 2>nul
goto end

:status
echo  WireGuard tunnel status:
sc query WireGuardTunnel$proxhq 2>nul || echo  (No tunnel named proxhq found)
goto end

:verify
echo  Checking your public IP...
curl -s https://api64.ipify.org
echo.
goto end

:end
echo.
pause
`,"vpn-verify.bat":`@echo off
title ProxhqVPN -- Connection Verification
color 0A
echo.
echo  ProxhqVPN -- Connection Verification v4.0
echo  ================================================
echo.
echo  Your current public IP address:
curl -s https://api64.ipify.org
echo.
echo.
echo  Checking DNS leak...
nslookup myip.opendns.com resolver1.opendns.com
echo.
echo  If the IP above is a ProxhqVPN server IP -- you are protected.
echo  If it shows your home/ISP IP -- the VPN is NOT active.
echo.
echo  Run a full leak test at: https://proxhqvpn.com/leaks
echo.
pause
`,"kill-switch-install.bat":`@echo off
title ProxhqVPN -- Kill Switch Setup
color 0C
echo.
echo  ProxhqVPN -- Kill Switch v4.0
echo  Blocks ALL internet traffic if VPN drops unexpectedly
echo  ================================================
echo.
echo  Adding Windows Firewall kill switch rules...
echo  (Requires Administrator privileges)
echo.
netsh advfirewall firewall add rule name="ProxhqVPN-KS-BlockAll" dir=out action=block priority=1
netsh advfirewall firewall add rule name="ProxhqVPN-KS-AllowWG" dir=out action=allow program="%PROGRAMFILES%\\WireGuard\\wireguard.exe" priority=2
netsh advfirewall firewall add rule name="ProxhqVPN-KS-AllowLAN" dir=out action=allow remoteip=192.168.0.0/16,10.0.0.0/8,172.16.0.0/12 priority=3
netsh advfirewall firewall add rule name="ProxhqVPN-KS-AllowLoopback" dir=out action=allow remoteip=127.0.0.0/8 priority=4
echo.
echo  Kill switch ENABLED.
echo  All traffic is now blocked except WireGuard and LAN.
echo.
echo  To DISABLE: run kill-switch-remove.bat
echo  Full options: https://proxhqvpn.com/kill-switch
echo.
pause
`,"kill-switch-remove.bat":`@echo off
title ProxhqVPN -- Remove Kill Switch
color 0E
echo.
echo  ProxhqVPN -- Removing Kill Switch Rules...
echo  ================================================
echo.
netsh advfirewall firewall delete rule name="ProxhqVPN-KS-BlockAll"
netsh advfirewall firewall delete rule name="ProxhqVPN-KS-AllowWG"
netsh advfirewall firewall delete rule name="ProxhqVPN-KS-AllowLAN"
netsh advfirewall firewall delete rule name="ProxhqVPN-KS-AllowLoopback"
echo.
echo  Kill switch removed. Normal internet access restored.
echo.
pause
`,"wg-template.conf":`# ProxhqVPN -- WireGuard Config Template
# Version 4.0 | https://proxhqvpn.com
#
# Get your real config at: https://proxhqvpn.com/wireguard
# Sign in -> Generate -> Download .conf
#
# DO NOT USE THESE PLACEHOLDER VALUES.
# Replace every UPPERCASE_PLACEHOLDER with your actual values.

[Interface]
PrivateKey = YOUR_PRIVATE_KEY_FROM_PROXHQVPN_DASHBOARD
Address = 10.0.0.2/32
DNS = 1.1.1.1, 1.0.0.1

[Peer]
PublicKey = SERVER_PUBLIC_KEY_FROM_PROXHQVPN_DASHBOARD
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = YOUR_PROXHQVPN_SERVER_IP:51820
PersistentKeepalive = 25
`},mac:{"install.sh":`#!/bin/bash
# ProxhqVPN -- macOS Installer v4.0
# ALPHA UNLIMITED TECHNOLOGIES LLC | https://proxhqvpn.com

echo ""
echo " ================================================"
echo "  ProxhqVPN -- macOS Setup  v4.0"
echo "  ALPHA UNLIMITED TECHNOLOGIES LLC"
echo "  https://proxhqvpn.com"
echo " ================================================"
echo ""

check_wireguard() {
  if command -v wg &>/dev/null; then
    echo " WireGuard CLI found: $(which wg)"
    return 0
  fi
  return 1
}

if check_wireguard; then
  echo " WireGuard already installed."
else
  echo " WireGuard not found. Choose install method:"
  echo "  [1] Mac App Store (recommended)"
  echo "  [2] Homebrew CLI"
  echo "  [Q] Skip install"
  echo ""
  read -p " Choice: " CHOICE
  case "$CHOICE" in
    1)
      echo " Opening Mac App Store..."
      open "https://apps.apple.com/us/app/wireguard/id1451685025"
      echo " Install WireGuard from the App Store, then re-run this script."
      ;;
    2)
      if ! command -v brew &>/dev/null; then
        echo " Homebrew not found. Installing..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      fi
      brew install wireguard-tools
      ;;
    *)
      echo " Skipping install."
      ;;
  esac
fi

echo ""
echo " Launching ProxhqVPN — please sign in..."
open "https://proxhqvpn.com/sign-in"
echo ""
echo " ================================================"
echo "  SUBSCRIPTION REQUIRED:"
echo "  An active ProxhqVPN plan is required to connect."
echo "  No account? Visit https://proxhqvpn.com/pricing"
echo ""
echo "  AFTER SIGNING IN:"
echo "  The app detects your plan automatically:"
echo "    VPN Basic          -- opens your VPN dashboard"
echo "    Command Center Pro -- opens the full platform"
echo ""
echo "  CONNECT YOUR VPN:"
echo "  1. WireGuard Config -> Generate -> Download .conf"
echo "  2. Import the .conf into WireGuard -> Toggle ON"
echo "  3. Run ./vpn-verify.sh to confirm connection"
echo " ================================================"
echo ""
`,"vpn-connect.sh":`#!/bin/bash
# ProxhqVPN -- macOS VPN Control v4.0
VPN_NAME="proxhq"
CONF_PATH="/etc/wireguard/\${VPN_NAME}.conf"
ACTION="\${1:-status}"

case "$ACTION" in
  up|connect|start)
    echo "Connecting ProxhqVPN..."
    if [ ! -f "$CONF_PATH" ]; then
      echo "[ERROR] Config not found at $CONF_PATH"
      echo "Run: sudo cp /path/to/proxhq.conf /etc/wireguard/"
      exit 1
    fi
    sudo wg-quick up $VPN_NAME && echo "Connected." || echo "[ERROR] Check your config."
    sleep 1
    echo ""
    echo "Current IP:"
    curl -s https://api64.ipify.org
    echo ""
    ;;
  down|disconnect|stop)
    echo "Disconnecting ProxhqVPN..."
    sudo wg-quick down $VPN_NAME && echo "Disconnected."
    ;;
  status)
    echo "Tunnel status:"
    sudo wg show $VPN_NAME 2>/dev/null || echo "(Not active)"
    echo ""
    echo "Current IP:"
    curl -s https://api64.ipify.org
    echo ""
    ;;
  *)
    echo "Usage: ./vpn-connect.sh [connect|disconnect|status]"
    ;;
esac
`,"vpn-verify.sh":`#!/bin/bash
# ProxhqVPN -- macOS Connection Verification v4.0
echo ""
echo " ProxhqVPN -- Connection Verification v4.0"
echo " ================================================"
echo ""
echo " Current public IP:"
curl -s https://api64.ipify.org
echo ""
echo ""
echo " WireGuard status:"
sudo wg show proxhq 2>/dev/null || echo " (Tunnel not active)"
echo ""
echo " Full leak test: https://proxhqvpn.com/leaks"
echo ""
`,"kill-switch-pf.conf":`# ProxhqVPN Kill Switch -- macOS pf Rules
# Version 4.0 | https://proxhqvpn.com
#
# INSTALLATION:
#   sudo cp kill-switch-pf.conf /etc/pf.anchors/proxhqvpn
#   Add to /etc/pf.conf:
#     anchor "proxhqvpn"
#     load anchor "proxhqvpn" from "/etc/pf.anchors/proxhqvpn"
#   Apply: sudo pfctl -f /etc/pf.conf -e
#
# DISABLE:  sudo pfctl -d
#
# Replace SERVER_ENDPOINT_IP with your server's IP from the .conf file.

# Allow loopback
pass quick on lo0 all

# Allow WireGuard UDP to server endpoint (get IP from your .conf Endpoint line)
# Replace SERVER_ENDPOINT_IP:
pass quick proto udp to SERVER_ENDPOINT_IP port 51820

# Allow LAN traffic
pass quick to 192.168.0.0/16
pass quick to 10.0.0.0/8
pass quick to 172.16.0.0/12

# Allow traffic through the WireGuard tunnel interface
pass quick on utun0 all
pass quick on utun1 all
pass quick on utun2 all

# Block everything else (kill switch)
block all
`,"wg-template.conf":`# ProxhqVPN -- WireGuard Config Template
# Version 4.0 | https://proxhqvpn.com
# Get your real config: https://proxhqvpn.com/wireguard -> Generate -> Download .conf

[Interface]
PrivateKey = YOUR_PRIVATE_KEY_FROM_PROXHQVPN_DASHBOARD
Address = 10.0.0.2/32
DNS = 1.1.1.1, 1.0.0.1

[Peer]
PublicKey = SERVER_PUBLIC_KEY_FROM_PROXHQVPN_DASHBOARD
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = YOUR_PROXHQVPN_SERVER_IP:51820
PersistentKeepalive = 25
`},linux:{"install.sh":`#!/bin/bash
# ProxhqVPN -- Linux Installer v4.0
# ALPHA UNLIMITED TECHNOLOGIES LLC | https://proxhqvpn.com
# Supports: Ubuntu, Debian, Kali, Fedora, Arch, Alpine, Raspberry Pi

echo ""
echo " ================================================"
echo "  ProxhqVPN -- Linux Setup  v4.0"
echo "  ALPHA UNLIMITED TECHNOLOGIES LLC"
echo "  https://proxhqvpn.com"
echo " ================================================"
echo ""

# Detect distribution
if [ -f /etc/os-release ]; then
  . /etc/os-release
  DISTRO="$ID"
  DISTRO_NAME="$PRETTY_NAME"
else
  DISTRO="unknown"
  DISTRO_NAME="Unknown Linux"
fi

echo " Detected: $DISTRO_NAME"
echo ""
echo " Installing WireGuard tools..."
echo ""

case "$DISTRO" in
  ubuntu|debian|kali|raspbian|pop)
    sudo apt-get update -q
    sudo apt-get install -y wireguard wireguard-tools resolvconf
    ;;
  fedora)
    sudo dnf install -y wireguard-tools
    ;;
  centos|rhel|rocky|almalinux)
    sudo dnf install -y epel-release
    sudo dnf install -y wireguard-tools
    ;;
  arch|manjaro|endeavouros)
    sudo pacman -S --noconfirm wireguard-tools
    ;;
  alpine)
    apk add --no-cache wireguard-tools
    ;;
  opensuse*|suse*)
    sudo zypper install -y wireguard-tools
    ;;
  *)
    echo " Distro not auto-detected. Manual install:"
    echo "   Ubuntu/Debian/Kali: sudo apt install wireguard-tools"
    echo "   Fedora:             sudo dnf install wireguard-tools"
    echo "   Arch:               sudo pacman -S wireguard-tools"
    echo "   Alpine:             apk add wireguard-tools"
    ;;
esac

if command -v wg &>/dev/null; then
  echo ""
  echo " WireGuard installed: $(wg --version)"
else
  echo ""
  echo " [ERROR] WireGuard installation may have failed."
  echo " Try manual install for your distro."
  exit 1
fi

echo ""
echo " Launching ProxhqVPN — please sign in..."
if command -v xdg-open &>/dev/null; then
  xdg-open "https://proxhqvpn.com/sign-in"
elif command -v sensible-browser &>/dev/null; then
  sensible-browser "https://proxhqvpn.com/sign-in"
fi

echo ""
echo " ================================================"
echo "  SUBSCRIPTION REQUIRED:"
echo "  An active ProxhqVPN plan is required to connect."
echo "  No account? Visit https://proxhqvpn.com/pricing"
echo ""
echo "  AFTER SIGNING IN:"
echo "  The app detects your plan automatically:"
echo "    VPN Basic          -- opens your VPN dashboard"
echo "    Command Center Pro -- opens the full platform"
echo ""
echo "  CONNECT YOUR VPN:"
echo "  1. Sign in -> WireGuard Config -> Generate -> Copy Config"
echo "  2. Run: sudo bash vpn-setup.sh  (paste your config)"
echo "  3. Run: sudo bash vpn-connect.sh connect"
echo "  4. Run: bash vpn-verify.sh to confirm"
echo " ================================================"
echo ""
`,"vpn-setup.sh":`#!/bin/bash
# ProxhqVPN -- WireGuard Config Setup v4.0
# Run this after getting your config from https://proxhqvpn.com/wireguard

CONF_DIR="/etc/wireguard"
CONF_FILE="$CONF_DIR/proxhq.conf"

echo ""
echo " ProxhqVPN -- WireGuard Config Setup v4.0"
echo " ================================================"
echo ""

if [ "$EUID" -ne 0 ]; then
  echo " [ERROR] Run with sudo: sudo bash vpn-setup.sh"
  exit 1
fi

if [ -f "$CONF_FILE" ]; then
  echo " Existing config found at $CONF_FILE"
  read -p " Overwrite? (y/N): " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo " Cancelled."
    exit 0
  fi
fi

echo ""
echo " Paste your WireGuard config from https://proxhqvpn.com/wireguard"
echo " Press Enter twice + Ctrl+D when done:"
echo " ------------------------------------------------"
CONFIG_CONTENT=$(cat)

mkdir -p "$CONF_DIR"
chmod 700 "$CONF_DIR"
echo "$CONFIG_CONTENT" > "$CONF_FILE"
chmod 600 "$CONF_FILE"

echo ""
echo " Config saved to $CONF_FILE"
echo ""
echo " Commands:"
echo "  Connect:    sudo bash vpn-connect.sh connect"
echo "  Disconnect: sudo bash vpn-connect.sh disconnect"
echo "  Autostart:  sudo bash vpn-connect.sh autostart-on"
echo ""
`,"vpn-connect.sh":`#!/bin/bash
# ProxhqVPN -- Linux VPN Control v4.0
VPN_NAME="proxhq"
ACTION="\${1:-status}"

case "$ACTION" in
  up|connect|start)
    echo "Connecting ProxhqVPN..."
    sudo wg-quick up $VPN_NAME || { echo "[ERROR] Failed. Check /etc/wireguard/proxhq.conf exists."; exit 1; }
    echo ""
    echo "Current public IP:"
    curl -s https://api64.ipify.org
    echo ""
    ;;
  down|disconnect|stop)
    echo "Disconnecting ProxhqVPN..."
    sudo wg-quick down $VPN_NAME
    ;;
  status)
    echo "Tunnel status:"
    sudo wg show $VPN_NAME 2>/dev/null || echo "(Not active)"
    echo ""
    echo "Current public IP:"
    curl -s https://api64.ipify.org
    echo ""
    ;;
  autostart-on)
    sudo systemctl enable wg-quick@$VPN_NAME
    sudo systemctl start wg-quick@$VPN_NAME
    echo "Autostart enabled. VPN will start on boot."
    ;;
  autostart-off)
    sudo systemctl disable wg-quick@$VPN_NAME
    sudo systemctl stop wg-quick@$VPN_NAME
    echo "Autostart disabled."
    ;;
  restart)
    sudo wg-quick down $VPN_NAME 2>/dev/null
    sleep 1
    sudo wg-quick up $VPN_NAME
    ;;
  *)
    echo "Usage: sudo bash vpn-connect.sh [connect|disconnect|status|autostart-on|autostart-off|restart]"
    ;;
esac
`,"vpn-verify.sh":`#!/bin/bash
# ProxhqVPN -- Linux Connection Verification v4.0
echo ""
echo " ProxhqVPN -- Connection Verification v4.0"
echo " ================================================"
echo ""
echo " Current public IP:"
curl -s https://api64.ipify.org
echo ""
echo ""
echo " WireGuard tunnel status:"
sudo wg show proxhq 2>/dev/null || echo " (Tunnel not active -- run: sudo bash vpn-connect.sh connect)"
echo ""
echo " Network interfaces:"
ip link show | grep -E "wg|wireguard" | awk '{print "  " $0}'
echo ""
echo " DNS check:"
nslookup whoami.akamai.net 2>/dev/null | grep -i address | tail -1 || dig +short whoami.akamai.net 2>/dev/null
echo ""
echo " Full leak test: https://proxhqvpn.com/leaks"
echo ""
`,"kill-switch-iptables.sh":`#!/bin/bash
# ProxhqVPN -- Kill Switch (iptables) v4.0
# Blocks all internet traffic if VPN drops
# Run: sudo bash kill-switch-iptables.sh [on|off]

WG_INTERFACE="wg0"
WG_PORT="51820"

install_kill_switch() {
  echo " Installing iptables kill switch..."
  # Allow loopback
  iptables -A OUTPUT -o lo -j ACCEPT
  # Allow established/related
  iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
  # Allow WireGuard UDP out
  iptables -A OUTPUT -p udp --dport $WG_PORT -j ACCEPT
  # Allow traffic through WireGuard interface
  iptables -A OUTPUT -o $WG_INTERFACE -j ACCEPT
  # Allow LAN
  iptables -A OUTPUT -d 192.168.0.0/16 -j ACCEPT
  iptables -A OUTPUT -d 10.0.0.0/8 -j ACCEPT
  iptables -A OUTPUT -d 172.16.0.0/12 -j ACCEPT
  # Block everything else
  iptables -A OUTPUT -j DROP
  echo " Kill switch ENABLED. All non-VPN traffic blocked."
}

remove_kill_switch() {
  echo " Removing kill switch..."
  iptables -F OUTPUT
  iptables -P OUTPUT ACCEPT
  echo " Kill switch DISABLED. Normal traffic restored."
}

if [ "$EUID" -ne 0 ]; then echo "Run with sudo."; exit 1; fi

case "\${1:-on}" in
  on|enable|install)   install_kill_switch ;;
  off|disable|remove)  remove_kill_switch ;;
  *)  echo "Usage: sudo bash kill-switch-iptables.sh [on|off]" ;;
esac
echo ""
echo "Full kill switch guide: https://proxhqvpn.com/kill-switch"
`,"kill-switch-nftables.conf":`#!/usr/sbin/nft -f
# ProxhqVPN Kill Switch -- nftables Rules v4.0
# https://proxhqvpn.com/kill-switch
#
# Apply: sudo nft -f kill-switch-nftables.conf
# Remove: sudo nft delete table inet proxhqvpn_killswitch

table inet proxhqvpn_killswitch {
  chain output {
    type filter hook output priority 0; policy drop;
    # Allow loopback
    oif lo accept
    # Allow established connections
    ct state established,related accept
    # Allow WireGuard UDP (replace PORT if different)
    udp dport 51820 accept
    # Allow WireGuard tunnel interface traffic
    oifname "wg0" accept
    # Allow LAN
    ip daddr { 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12 } accept
    # Block everything else (kill switch)
    drop
  }
}
`,"wg-template.conf":`# ProxhqVPN -- WireGuard Config Template
# Version 4.0 | https://proxhqvpn.com
# Get your real config: https://proxhqvpn.com/wireguard -> Generate -> Copy Config
# Then run: sudo bash vpn-setup.sh  (and paste the config)

[Interface]
PrivateKey = YOUR_PRIVATE_KEY_FROM_PROXHQVPN_DASHBOARD
Address = 10.0.0.2/32
DNS = 1.1.1.1, 1.0.0.1
# Optional kill switch (uncomment to enable):
# PostUp   = iptables -A OUTPUT ! -o %i -m mark ! --mark $(wg show %i fwmark) -m addrtype ! --dst-type LOCAL -j REJECT
# PreDown  = iptables -D OUTPUT ! -o %i -m mark ! --mark $(wg show %i fwmark) -m addrtype ! --dst-type LOCAL -j REJECT

[Peer]
PublicKey = SERVER_PUBLIC_KEY_FROM_PROXHQVPN_DASHBOARD
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = YOUR_PROXHQVPN_SERVER_IP:51820
PersistentKeepalive = 25
`},fire:{"SETUP-GUIDE.txt":`ProxhqVPN -- Fire Stick / Fire TV Setup Package
================================================
Version 4.0 | ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

This package contains:
  SETUP-GUIDE.txt          This file
  adb-install-windows.bat  ADB installer for Windows
  adb-install-linux.sh     ADB installer for Linux/macOS
  README.txt               Full setup instructions
  Quick_Start.txt          Quick start guide
  User_Guide.txt           Complete user guide
  CHANGELOG.txt            Version history
  VERSION.txt              Version info

QUICK START (Without ADB):
  1. On Fire Stick: Settings -> My Fire TV -> Developer Options
     -> Apps from Unknown Sources -> ON
  2. Install "Downloader" from Amazon App Store (search: Downloader)
  3. Open Downloader -> enter URL:
       https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk
  4. Tap Go -> Download -> Install
  5. Sign in to proxhqvpn.com on phone/computer
  6. WireGuard Config -> Generate -> Show QR Code
  7. Open WireGuard on Fire Stick -> + -> Scan QR Code
  8. Toggle ON -- VPN key icon confirms connection

ADB METHOD (Advanced):
  Allows installing wirelessly from your PC/Mac without the Downloader app.
  Run adb-install-windows.bat (Windows) or adb-install-linux.sh (Linux/macOS)

Support: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,"adb-install-windows.bat":`@echo off
title ProxhqVPN -- Fire Stick ADB Installer v4.0
color 0A
echo.
echo  ================================================
echo   ProxhqVPN -- Fire Stick ADB Installer  v4.0
echo   ALPHA UNLIMITED TECHNOLOGIES LLC
echo   https://proxhqvpn.com
echo  ================================================
echo.
echo  REQUIREMENTS:
echo    Android Debug Bridge (ADB) must be installed.
echo    Get ADB: https://developer.android.com/tools/releases/platform-tools
echo.
echo  BEFORE RUNNING:
echo    1. Fire Stick: Settings -> My Fire TV -> Developer Options
echo       -> ADB Debugging -> ON
echo       -> Apps from Unknown Sources -> ON
echo    2. Note your Fire Stick IP:
echo       Settings -> My Fire TV -> About -> Network
echo.
set /p FIRE_IP="Enter your Fire Stick IP address: "
if "%FIRE_IP%"=="" (echo Please enter an IP. & pause & exit)
echo.
echo  Connecting to Fire Stick at %FIRE_IP%...
adb connect %FIRE_IP%:5555
echo.
echo  Downloading WireGuard APK...
powershell -Command "Invoke-WebRequest -Uri 'https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk' -OutFile '%TEMP%\\wireguard-fire.apk' -UseBasicParsing"
if %errorlevel% neq 0 (echo [ERROR] Download failed. & pause & exit /b 1)
echo  Download complete.
echo.
echo  Installing WireGuard on Fire Stick...
adb -s %FIRE_IP%:5555 install "%TEMP%\\wireguard-fire.apk"
echo.
echo  ================================================
echo   NEXT STEPS:
echo   1. Open WireGuard on your Fire Stick
echo   2. Tap + -> Scan from QR code
echo   3. Show QR at: https://proxhqvpn.com/wireguard
echo      (Sign in -> Generate -> Show QR Code)
echo   4. Toggle the tunnel ON
echo  ================================================
echo.
pause
`,"adb-install-linux.sh":`#!/bin/bash
# ProxhqVPN -- Fire Stick ADB Installer v4.0
# For Linux and macOS
echo ""
echo " ================================================"
echo "  ProxhqVPN -- Fire Stick ADB Installer  v4.0"
echo "  ALPHA UNLIMITED TECHNOLOGIES LLC"
echo "  https://proxhqvpn.com"
echo " ================================================"
echo ""
echo " REQUIREMENTS: adb must be installed."
echo "   Ubuntu/Debian: sudo apt install adb"
echo "   macOS:         brew install android-platform-tools"
echo ""
echo " BEFORE RUNNING:"
echo "   1. Fire Stick: Settings -> My Fire TV -> Developer Options"
echo "      -> ADB Debugging -> ON"
echo "      -> Apps from Unknown Sources -> ON"
echo "   2. Note Fire Stick IP:"
echo "      Settings -> My Fire TV -> About -> Network"
echo ""
read -p " Enter your Fire Stick IP address: " FIRE_IP
if [ -z "$FIRE_IP" ]; then echo "No IP entered."; exit 1; fi
echo ""
echo " Connecting to Fire Stick at $FIRE_IP..."
adb connect "\${FIRE_IP}:5555"
echo ""
echo " Downloading WireGuard APK..."
APK_URL="https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk"
curl -L -o /tmp/wireguard-fire.apk "$APK_URL" || { echo "[ERROR] Download failed."; exit 1; }
echo " Download complete."
echo ""
echo " Installing WireGuard on Fire Stick..."
adb -s "\${FIRE_IP}:5555" install /tmp/wireguard-fire.apk
echo ""
echo " ================================================"
echo "  NEXT STEPS:"
echo "  1. Open WireGuard on your Fire Stick"
echo "  2. Tap + -> Scan from QR code"
echo "  3. Show QR at: https://proxhqvpn.com/wireguard"
echo "     (Sign in -> Generate -> Show QR Code)"
echo "  4. Toggle the tunnel ON"
echo " ================================================"
echo ""
`},router:{"openwrt-setup.sh":`#!/bin/bash
# ProxhqVPN -- OpenWRT Router Setup v4.0
# ALPHA UNLIMITED TECHNOLOGIES LLC | https://proxhqvpn.com
# Installs WireGuard on your OpenWRT router via SSH

echo ""
echo " ================================================"
echo "  ProxhqVPN -- OpenWRT Router Setup  v4.0"
echo "  ALPHA UNLIMITED TECHNOLOGIES LLC"
echo " ================================================"
echo ""
echo " This installs WireGuard on your OpenWRT router."
echo " Requirements: SSH access to your router (usually root@192.168.1.1)"
echo ""
read -p " Router IP address [192.168.1.1]: " ROUTER_IP
ROUTER_IP="\${ROUTER_IP:-192.168.1.1}"
read -p " SSH username [root]: " SSH_USER
SSH_USER="\${SSH_USER:-root}"
echo ""
echo " Connecting to router at $ROUTER_IP as $SSH_USER..."
echo " (You will be prompted for the router SSH password)"
echo ""

ssh \${SSH_USER}@\${ROUTER_IP} 'bash -s' << 'EOF'
echo "Updating package lists..."
opkg update

echo "Installing WireGuard packages..."
opkg install wireguard-tools kmod-wireguard luci-proto-wireguard luci-app-wireguard

if command -v wg &>/dev/null; then
  echo ""
  echo "WireGuard installed: $(wg --version 2>/dev/null || echo OK)"
  echo ""
  echo "Next: paste your WireGuard config into /etc/config/network"
  echo "Get config from: https://proxhqvpn.com/router-config"
  echo ""
  echo "Then restart networking: /etc/init.d/network restart"
else
  echo "[ERROR] Installation may have failed. Check opkg logs."
fi
EOF

echo ""
echo " ================================================"
echo "  NEXT STEPS:"
echo "  1. Get your router config: https://proxhqvpn.com/router-config"
echo "  2. SSH into router: ssh root@$ROUTER_IP"
echo "  3. Paste config into /etc/config/network"
echo "  4. Run: /etc/init.d/network restart"
echo "  5. Verify from any device: curl https://api64.ipify.org"
echo " ================================================"
echo ""
`,"gliNet-setup.txt":`ProxhqVPN -- GL.iNet Router Setup
===================================
Version 4.0 | ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

GL.iNet routers (GL-MT3000, GL-AXT1800, GL-AX1800, GL-MT1300,
GL-MT2500, GL-X3000, GL-E750) have native WireGuard client support.

STEP 1 -- Get your ProxhqVPN config
  Visit: https://proxhqvpn.com/wireguard
  Sign in -> Generate -> Copy Config (copy the entire block)

STEP 2 -- Open GL.iNet Admin Panel
  Open browser -> go to http://192.168.8.1
  Default login password is on the label under your router.

STEP 3 -- Set up WireGuard Client
  Navigate to: VPN -> WireGuard Client -> Add Profile
  Paste your entire copied config into the profile field.
  Give it a name (e.g. ProxhqVPN) -> Save.

STEP 4 -- Connect
  Toggle the WireGuard Client ON.
  Every device on your GL.iNet network is now VPN-protected.

STEP 5 -- Verify
  From any connected device, visit: https://api64.ipify.org
  The IP should be a ProxhqVPN server IP.

RECOMMENDED SETTINGS:
  VPN -> VPN Policies -> Force all traffic through VPN -> ON
  This ensures no device on your network bypasses the VPN.

KILL SWITCH:
  GL.iNet has a built-in VPN kill switch under VPN -> VPN Policies.
  Enable "Block Non-VPN Traffic" for whole-network protection.

Support: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,"pfsense-opnsense-setup.txt":`ProxhqVPN -- pfSense / OPNsense Setup
=======================================
Version 4.0 | ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

PFSENSE SETUP:
  1. Install WireGuard package:
     System -> Package Manager -> Available Packages
     Search "WireGuard" -> Install

  2. Configure WireGuard:
     VPN -> WireGuard -> Settings -> Enable WireGuard -> Save
     Tunnels tab -> Add Tunnel
       Description: ProxhqVPN
       Listen Port: (leave blank for random)
       Interface Keys: Generate (or paste from ProxhqVPN dashboard)

  3. Add Peer (ProxhqVPN server):
     Public Key: (from your ProxhqVPN .conf Peer section)
     Endpoint: (your ProxhqVPN server IP):51820
     Allowed IPs: 0.0.0.0/0
     Keep Alive: 25

  4. Assign Interface:
     Interfaces -> Assignments -> Add wg0 -> Save
     Configure the interface with address from your .conf

  5. Add firewall rule:
     Firewall -> Rules -> WireGuard tab
     Add rule: Allow All (or restrict as needed)

OPNSENSE SETUP:
  1. Install WireGuard plugin:
     System -> Firmware -> Plugins -> os-wireguard -> Install
     Reboot required.

  2. Configure:
     VPN -> WireGuard -> Local -> Add
     Fill in keys, name "ProxhqVPN", port 51820

  3. Add Endpoint (peer):
     VPN -> WireGuard -> Endpoints -> Add
     Fill in server public key, endpoint IP:51820, AllowedIPs 0.0.0.0/0

  4. Assign interface and add firewall rules.

Get your keys from: https://proxhqvpn.com/wireguard
Support: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,"wg-router-template.conf":`# ProxhqVPN -- Router WireGuard Config Template
# Version 4.0 | https://proxhqvpn.com
#
# Get your REAL config from: https://proxhqvpn.com/router-config
# Select your firmware -> Generate -> Copy the output below
#
# For OpenWRT, paste the [Interface] and [Peer] block values
# into /etc/config/network in the WireGuard section.
#
# DO NOT USE THESE PLACEHOLDER VALUES.

[Interface]
PrivateKey = YOUR_ROUTER_PRIVATE_KEY_FROM_PROXHQVPN
Address = 10.0.0.3/32
DNS = 1.1.1.1

[Peer]
PublicKey = SERVER_PUBLIC_KEY_FROM_PROXHQVPN
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = YOUR_PROXHQVPN_SERVER_IP:51820
PersistentKeepalive = 25
`,"router-kill-switch.sh":`#!/bin/bash
# ProxhqVPN -- Router Kill Switch (OpenWRT) v4.0
# Run on your OpenWRT router via SSH
# Blocks all WAN traffic if WireGuard tunnel goes down

echo "ProxhqVPN Router Kill Switch v4.0"
echo "==================================="
echo ""

# Add kill switch rules via iptables (run on router)
iptables -I FORWARD -i br-lan -o eth0 -j REJECT
iptables -I FORWARD -i br-lan -o wg0 -j ACCEPT
iptables -I OUTPUT -o eth0 -j REJECT
iptables -I OUTPUT -o wg0 -j ACCEPT
iptables -I OUTPUT -o lo -j ACCEPT

echo "Kill switch enabled. LAN traffic blocked except through wg0."
echo ""
echo "To remove: iptables -D FORWARD -i br-lan -o eth0 -j REJECT"
echo "Full guide: https://proxhqvpn.com/kill-switch"
`},android:{"SETUP-GUIDE.txt":`ProxhqVPN -- Android Setup Package
====================================
Version 4.0 | ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

This package contains:
  SETUP-GUIDE.txt   This file
  README.txt        Full platform-specific setup guide
  Quick_Start.txt   Quick start guide
  User_Guide.txt    Complete user guide
  CHANGELOG.txt     Version history
  VERSION.txt       Version info

INSTALL WIREGUARD:
  Option A -- Google Play Store (recommended):
    https://play.google.com/store/apps/details?id=com.wireguard.android

  Option B -- Direct APK download (no Play Store needed):
    URL: https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk
    Enable unknown sources: Settings -> Security -> Install unknown apps -> ON
    Tap the downloaded APK -> Install

CONNECT:
  1. Sign in at https://proxhqvpn.com/wireguard
  2. Generate -> Show QR Code
  3. WireGuard app -> + -> Scan from QR code
  4. Toggle ON -> VPN key icon in status bar = connected

VERIFY:
  Chrome -> https://api64.ipify.org
  Must show ProxhqVPN server IP.
  Full leak test: https://proxhqvpn.com/leaks

ANDROID TV / NVIDIA SHIELD:
  Install WireGuard from Google Play on Android TV.
  For Nvidia Shield: Play Store -> search WireGuard -> install.
  Use ADB or a USB mouse to navigate the QR scanner.
  ADB push method:
    adb connect SHIELD_IP:5555
    adb install wireguard.apk

Support: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`},ios:{"SETUP-GUIDE.txt":`ProxhqVPN -- iOS / iPadOS Setup Package
=========================================
Version 4.0 | ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

This package contains:
  SETUP-GUIDE.txt   This file
  README.txt        Full platform-specific setup guide
  Quick_Start.txt   Quick start guide
  User_Guide.txt    Complete user guide
  CHANGELOG.txt     Version history
  VERSION.txt       Version info

INSTALL WIREGUARD:
  App Store: https://apps.apple.com/us/app/wireguard/id1441195209
  Search "WireGuard" in the App Store -> Get -> Install

CONNECT:
  1. Sign in at https://proxhqvpn.com/wireguard on desktop or laptop
  2. Generate -> Show QR Code
  3. On iPhone/iPad: WireGuard -> + -> Create from QR code
  4. Point camera at QR code -> Save tunnel
  5. Toggle ON -> VPN key icon appears in status bar = connected

ALTERNATIVE -- FILE IMPORT:
  Download the .conf file from ProxhqVPN -> WireGuard Config
  Share the file to WireGuard via iOS Share Sheet:
    Files app -> tap .conf -> Share -> WireGuard -> Import

ON-DEMAND CONNECT:
  In WireGuard: tap your tunnel -> On-Demand
  Enable for Wi-Fi and/or Cellular so VPN reconnects automatically.

USING IPHONE AS ROUTER FOR APPLE TV:
  Enable VPN on iPhone -> Personal Hotspot ON
  Connect Apple TV to iPhone hotspot -> Apple TV is protected.

VERIFY:
  Safari -> https://api64.ipify.org
  Must show ProxhqVPN server IP.
  Full leak test: https://proxhqvpn.com/leaks

Support: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`},appletv:{"SETUP-GUIDE.txt":`ProxhqVPN -- Apple TV Setup Package
=====================================
Version 4.0 | ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

This package contains:
  SETUP-GUIDE.txt   This file
  README.txt        Full platform-specific setup guide
  Quick_Start.txt   Quick start guide
  User_Guide.txt    Complete user guide
  CHANGELOG.txt     Version history
  VERSION.txt       Version info

THREE SETUP METHODS -- choose the one that works for you:

METHOD 1 -- WIREGUARD ON TVOS (recommended for Apple TV 4K):
  App Store on Apple TV -> search "WireGuard" -> Install
  Sign in at proxhqvpn.com -> WireGuard Config -> Generate -> Show QR
  WireGuard on Apple TV -> + -> Create from QR code
  Point the Apple TV camera at the QR on your phone/screen
  Toggle ON -> VPN key icon at top = connected

  No camera? Use iCloud sharing:
    iPhone WireGuard -> tap tunnel -> Share -> add to iCloud
    Apple TV WireGuard -> Import from iCloud Keychain

METHOD 2 -- IPHONE PERSONAL HOTSPOT (easiest):
  1. Install ProxhqVPN on your iPhone (see iOS README)
  2. Enable VPN on iPhone -> toggle WireGuard ON
  3. iPhone -> Personal Hotspot -> ON
  4. Apple TV Settings -> Wi-Fi -> connect to your iPhone hotspot
  All Apple TV traffic tunnels through your iPhone's VPN.

METHOD 3 -- ROUTER SETUP (best for always-on protection):
  Install ProxhqVPN on your router. Every device including Apple TV
  is automatically protected with no configuration on the Apple TV.
  See Router README and: https://proxhqvpn.com/router-config

VERIFY:
  From any device on the same network:
    curl https://api64.ipify.org
  Should show ProxhqVPN server IP.

Support: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`}},Gt={macos:"mac",iphone:"ios","android-tablet":"android",firestick:"fire",firetv:"fire",androidtv:"android",samsung:"router",lg:"router",roku:"router",openwrt:"router",ddwrt:"router",pfsense:"router",asus:"router",ps5:"router",xbox:"router",chromebook:"linux",raspberrypi:"linux"};async function Wt(J,ge){const x=Gt[J]??J,G=Ze[x]??Ze.linux??"",S=new vt,l=`ProxhqVPN-${ge.replace(/[^a-zA-Z0-9]/g,"-")}-v4.0`,a=S.folder(l);a.file("README.txt",G),a.file("User_Guide.txt",Rt),a.file("Quick_Start.txt",Ot),a.file("CHANGELOG.txt",Dt),a.file("VERSION.txt",Vt);const n=Lt[x]??{};for(const[f,b]of Object.entries(n))a.file(f,b);const c=await S.generateAsync({type:"blob",compression:"DEFLATE"}),g=URL.createObjectURL(c),w=document.createElement("a");w.href=g,w.download=`${l}-Setup.zip`,document.body.appendChild(w),w.click(),document.body.removeChild(w),URL.revokeObjectURL(g)}function qt(J){return v.jsxs("svg",{...J,xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round",children:[v.jsx("circle",{cx:"11",cy:"11",r:"8"}),v.jsx("path",{d:"m21 21-4.35-4.35"})]})}export{Ut as default};
