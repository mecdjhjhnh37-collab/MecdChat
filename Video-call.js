import {
initializeApp
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getAuth,
onAuthStateChanged
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
getFirestore,
doc,
getDoc,
setDoc,
updateDoc,
collection,
addDoc,
onSnapshot,
getDocs,
deleteDoc,
serverTimestamp
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* =========================
   Firebase
========================= */

const firebaseConfig = {

apiKey:
"AIzaSyA8ZA5fcy1Tl3hZ7_5n91xVOw06syHPGyI",

authDomain:
"mecd-tools.firebaseapp.com",

projectId:
"mecd-tools",

storageBucket:
"mecd-tools.firebasestorage.app",

messagingSenderId:
"643005547408",

appId:
"1:643005547408:web:b1719060ec340dd0e0a915"

};


const firebaseApp =
initializeApp(firebaseConfig);

const auth =
getAuth(firebaseApp);

const db =
getFirestore(firebaseApp);


/* =========================
   العناصر
========================= */

const localVideo =
document.getElementById("localVideo");

const remoteVideo =
document.getElementById("remoteVideo");

const friendName =
document.getElementById("friendName");

const callStatus =
document.getElementById("callStatus");

const loading =
document.getElementById("loading");

const cameraButton =
document.getElementById("cameraButton");

const micButton =
document.getElementById("micButton");

const endButton =
document.getElementById("endButton");


/* =========================
   WebRTC
========================= */

const servers = {

iceServers: [

{
urls:
"stun:stun.l.google.com:19302"
},

{
urls:
"stun:stun1.l.google.com:19302"
}

]

};


let peerConnection = null;

let localStream = null;

let currentUser = null;

let friendUser = null;

let callId = null;

let unsubscribeCall = null;

let unsubscribeCandidates = null;


/* =========================
   إنشاء معرف المكالمة
========================= */

function createCallID(a,b){

return [
a,
b
]
.sort()
.join("_");

}


/* =========================
   تغيير الحالة
========================= */

function setStatus(text,connected=false){

callStatus.textContent =
"● " + text;

callStatus.classList.toggle(
"connected",
connected
);

}


/* =========================
   تحميل الصديق
========================= */

async function loadFriend(){

const params =
new URLSearchParams(
location.search
);

const friendId =
params.get("friend");

if(!friendId){

throw new Error(
"لا يوجد صديق في الرابط"
);

}


const userRef =
doc(
db,
"users",
friendId
);


const snap =
await getDoc(
userRef
);


if(!snap.exists()){

throw new Error(
"المستخدم غير موجود"
);

}


const data =
snap.data();


friendUser = {

uid:
friendId,

name:
data.name ||
"مستخدم Mecd"

};


friendName.textContent =
friendUser.name;


callId =
createCallID(
currentUser.uid,
friendUser.uid
);

}


/* =========================
   تشغيل الكاميرا
========================= */

async function startCamera(){

localStream =
await navigator.mediaDevices.getUserMedia({

video:true,

audio:true

});


localVideo.srcObject =
localStream;

}


/* =========================
   إنشاء Peer
========================= */

function createPeer(){

peerConnection =
new RTCPeerConnection(
servers
);


localStream
.getTracks()
.forEach(
track=>{

peerConnection.addTrack(
track,
localStream
);

});


peerConnection.ontrack =
event=>{

if(
event.streams &&
event.streams[0]
){

remoteVideo.srcObject =
event.streams[0];

setStatus(
"متصل",
true
);

loading.classList.add(
"hidden"
);

}

};


peerConnection.onicecandidate =
async event=>{

if(
!event.candidate
)
return;


await addDoc(

collection(
db,
"videoCalls",
callId,
"candidates"
),

{

candidate:
event.candidate.toJSON(),

from:
currentUser.uid,

createdAt:
serverTimestamp()

}

);

};


peerConnection.onconnectionstatechange =
()=>{

const state =
peerConnection.connectionState;


if(
state === "connected"
){

setStatus(
"متصل",
true
);

loading.classList.add(
"hidden"
);

}


if(
state === "connecting"
){

setStatus(
"جاري الاتصال"
);

}


if(
state === "disconnected" ||
state === "failed" ||
state === "closed"
){

setStatus(
"انتهى الاتصال"
);

}

};

}


/* =========================
   الاستماع لـ ICE
========================= */

function listenCandidates(){

const ref =
collection(
db,
"videoCalls",
callId,
"candidates"
);


unsubscribeCandidates =
onSnapshot(

ref,

async snapshot=>{

for(
const change of snapshot.docChanges()
){

if(
change.type !== "added"
)
continue;


const data =
change.doc.data();


if(
data.from === currentUser.uid
)
continue;


if(
!peerConnection
)
continue;


try{

await peerConnection.addIceCandidate(

new RTCIceCandidate(
data.candidate
)

);

}catch(error){

console.error(
"ICE error:",
error
);

}

}

}

);

}


/* =========================
   بدء المكالمة
========================= */

async function startCall(){

createPeer();

listenCandidates();


const callRef =
doc(
db,
"videoCalls",
callId
);


const offer =
await peerConnection.createOffer();


await peerConnection.setLocalDescription(
offer
);


await setDoc(

callRef,

{

caller:
currentUser.uid,

receiver:
friendUser.uid,

offer:{
type:
offer.type,

sdp:
offer.sdp

},

status:
"ringing",

createdAt:
serverTimestamp()

},

{
merge:true
}

);


listenCall();


setStatus(
"جاري الاتصال"
);

}


/* =========================
   استقبال المكالمة
========================= */

function listenCall(){

const callRef =
doc(
db,
"videoCalls",
callId
);


unsubscribeCall =
onSnapshot(

callRef,

async snapshot=>{

if(
!snapshot.exists()
)
return;


const data =
snapshot.data();


/* =========================
   الطرف المستقبل
========================= */

if(

data.receiver ===
currentUser.uid &&

data.offer &&

!data.answer

){

createPeer();

listenCandidates();


try{

await peerConnection.setRemoteDescription(

new RTCSessionDescription(
data.offer
)

);


const answer =
await peerConnection.createAnswer();


await peerConnection.setLocalDescription(
answer
);


await updateDoc(

callRef,

{

answer:{
type:
answer.type,

sdp:
answer.sdp

},

status:
"connected"

}

);

setStatus(
"جاري الاتصال"
);

}catch(error){

console.error(
"Answer error:",
error
);

}

}


/* =========================
   الطرف المتصل
========================= */

if(

data.caller ===
currentUser.uid &&

data.answer &&

peerConnection &&

!peerConnection.currentRemoteDescription

){

try{

await peerConnection.setRemoteDescription(

new RTCSessionDescription(
data.answer
)

);

}catch(error){

console.error(
"Remote description error:",
error
);

}

}


/* =========================
   انتهاء المكالمة
========================= */

if(
data.status === "ended"
){

closeCall();

}

}

);

}


/* =========================
   إنهاء المكالمة
========================= */

async function endCall(){

try{

if(callId){

await setDoc(

doc(
db,
"videoCalls",
callId
),

{

status:
"ended",

endedAt:
serverTimestamp()

},

{
merge:true
}

);

}

}catch(error){

console.error(
"End call error:",
error
);

}


closeCall();

}


/* =========================
   إغلاق المكالمة
========================= */

function closeCall(){

if(unsubscribeCall){

unsubscribeCall();

unsubscribeCall=null;

}


if(unsubscribeCandidates){

unsubscribeCandidates();

unsubscribeCandidates=null;

}


if(peerConnection){

peerConnection.close();

peerConnection=null;

}


if(localStream){

localStream
.getTracks()
.forEach(
track=>{
track.stop();
}
);

localStream=null;

}


remoteVideo.srcObject =
null;

localVideo.srcObject =
null;


setStatus(
"انتهت المكالمة"
);


setTimeout(

()=>{

history.back();

},

1000

);

}


/* =========================
   الكاميرا
========================= */

cameraButton.onclick =
()=>{

if(!localStream)
return;


const track =
localStream.getVideoTracks()[0];


if(!track)
return;


track.enabled =
!track.enabled;


cameraButton.classList.toggle(
"off",
!track.enabled
);


cameraButton.textContent =
track.enabled
?
"📹"
:
"🚫";

};


/* =========================
   الميكروفون
========================= */

micButton.onclick =
()=>{

if(!localStream)
return;


const track =
localStream.getAudioTracks()[0];


if(!track)
return;


track.enabled =
!track.enabled;


micButton.classList.toggle(
"off",
!track.enabled
);


micButton.textContent =
track.enabled
?
"🎤"
:
"🔇";

};


/* =========================
   زر إنهاء
========================= */

endButton.onclick =
endCall;


/* =========================
   تسجيل الدخول
========================= */

onAuthStateChanged(

auth,

async user=>{

if(!user){

loading.textContent =
"يجب تسجيل الدخول أولاً";

return;

}


currentUser =
user;


try{

await loadFriend();

await startCamera();

loading.classList.add(
"hidden"
);


/*
   نبدأ الاستماع أولاً
   حتى يستطيع الهاتف الثاني
   استقبال المكالمة.
*/

listenCall();


/*
   إذا كان الطرفان فتحا نفس الرابط،
   صاحب الصفحة الذي يدخل أولاً
   يصبح Caller.
*/

const callRef =
doc(
db,
"videoCalls",
callId
);


const existing =
await getDoc(
callRef
);


if(
!existing.exists()
){

await startCall();

}else{

const data =
existing.data();


if(
data.status === "ended"
){

await startCall();

}

}

}catch(error){

console.error(
"Video call error:",
error
);

loading.textContent =
"⚠️ تعذر تشغيل مكالمة الفيديو";

}

});


/* =========================
   مغادرة الصفحة
========================= */

window.addEventListener(
"pagehide",
()=>{

if(peerConnection){

peerConnection.close();

}

});
