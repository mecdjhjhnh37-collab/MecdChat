/* =========================================
   Mecd Chat
   Real Voice Call System
   WebRTC + Firestore
   Firebase v10.12.2
========================================= */

import {
initializeApp,
getApps,
getApp
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
setDoc,
getDoc,
onSnapshot,
updateDoc,
serverTimestamp,
collection,
addDoc
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* =========================================
   Firebase
========================================= */

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
getApps().length
? getApp()
: initializeApp(
firebaseConfig
);


const auth =
getAuth(
firebaseApp
);


const db =
getFirestore(
firebaseApp
);


/* =========================================
   المستخدم
========================================= */

let currentUser =
null;

let authReadyResolve;

const authReady =
new Promise(
resolve => {

authReadyResolve =
resolve;

}
);


onAuthStateChanged(
auth,
user => {

currentUser =
user;

authReadyResolve(
user
);

}
);


/* =========================================
   Call ID
========================================= */

function createCallID(){

return (

Date.now()
.toString(36)

+

"_"

+

Math.random()
.toString(36)
.substring(2,10)

);

}


/* =========================================
   بدء المكالمة من Chat
========================================= */

export async function startCall({

friendId,
friendName,
friendPhoto

}){

await authReady;


if(!currentUser){

throw new Error(
"يجب تسجيل الدخول أولاً"
);

}


if(!friendId){

throw new Error(
"لم يتم تحديد الصديق"
);

}


if(
friendId ===
currentUser.uid
){

throw new Error(
"لا يمكنك الاتصال بنفسك"
);

}


const callId =
createCallID();


const callerName =
currentUser.displayName ||
"مستخدم Mecd";


const callerPhoto =
currentUser.photoURL ||
"";


const callData = {

callId:

callId,

callerId:

currentUser.uid,

receiverId:

friendId,

callerName:

callerName,

callerPhoto:

callerPhoto,

receiverName:

friendName ||
"مستخدم Mecd",

receiverPhoto:

friendPhoto ||
"",

type:

"audio",

status:

"ringing",

createdAt:

serverTimestamp()

};


try{

/*
إنشاء وثيقة المكالمة
*/

await setDoc(

doc(
db,
"calls",
callId
),

callData

);


/*
إرسال إشعار للطرف الآخر
*/

await setDoc(

doc(
db,
"users",
friendId
),

{

incomingCall: {

callId:

callId,

callerId:

currentUser.uid,

callerName:

callerName,

callerPhoto:

callerPhoto,

receiverId:

friendId,

status:

"ringing",

createdAt:

serverTimestamp()

}

},

{
merge:true
}

);


/*
فتح call.html
*/

const params =
new URLSearchParams();


params.set(
"callId",
callId
);


params.set(
"mode",
"outgoing"
);


params.set(
"name",
friendName ||
"مستخدم Mecd"
);


params.set(
"photo",
friendPhoto ||
""
);


window.location.href =
"call.html?" +
params.toString();


}catch(error){

console.error(
"Start call error:",
error
);

throw error;

}

}


/* =========================================
   استقبال المكالمات
========================================= */

export async function listenIncomingCalls(){

await authReady;


if(!currentUser)
return null;


const userRef =
doc(
db,
"users",
currentUser.uid
);


return onSnapshot(

userRef,

snapshot => {

if(!snapshot.exists())
return;


const data =
snapshot.data();


const incoming =
data.incomingCall;


if(!incoming)
return;


if(
incoming.receiverId !==
currentUser.uid
)
return;


if(
incoming.status !==
"ringing"
)
return;


if(
window.currentIncomingCallId ===
incoming.callId
)
return;


window.currentIncomingCallId =
incoming.callId;


const params =
new URLSearchParams();


params.set(
"callId",
incoming.callId
);


params.set(
"mode",
"incoming"
);


params.set(
"name",
incoming.callerName ||
"مستخدم Mecd"
);


params.set(
"photo",
incoming.callerPhoto ||
""
);


window.location.href =
"call.html?" +
params.toString();

},

error => {

console.error(
"Incoming call error:",
error
);

}

);

}


/* =========================================
   جلب المكالمة
========================================= */

export async function getCall(
callId
){

if(!callId)
return null;


const snapshot =
await getDoc(

doc(
db,
"calls",
callId
)

);


if(!snapshot.exists())
return null;


return {

id:
snapshot.id,

...snapshot.data()

};

}


/* =========================================
   WebRTC
========================================= */

let peerConnection =
null;

let localStream =
null;

let remoteStream =
null;

let stopCallListeners =
[];

let pendingCandidates =
[];

let candidateListenerStarted =
false;


/* =========================================
   إنشاء Peer Connection
========================================= */

function createPeerConnection(
callId
){

const pc =
new RTCPeerConnection({

iceServers:[

{
urls:
"stun:stun.l.google.com:19302"
},

{
urls:
"stun:stun1.l.google.com:19302"
},

{
urls:
"stun:stun2.l.google.com:19302"
}

]

});


/* =========================
   ICE
========================= */

pc.onicecandidate =
async event => {

if(!event.candidate)
return;


if(!currentUser)
return;


try{

await addDoc(

collection(
db,
"calls",
callId,
"candidates"
),

{

candidate:
event.candidate.toJSON(),

senderId:
currentUser.uid,

createdAt:
serverTimestamp()

}

);

}catch(error){

console.error(
"ICE error:",
error
);

}

};


/* =========================
   الصوت القادم
========================= */

pc.ontrack =
event => {

if(!remoteStream){

remoteStream =
new MediaStream();

}


if(
event.streams &&
event.streams[0]
){

event.streams[0]
.getTracks()
.forEach(
track => {

if(
!remoteStream
.getTracks()
.some(
t =>
t.id ===
track.id
)
){

remoteStream.addTrack(
track
);

}

}
);

}

else{

if(
!remoteStream
.getTracks()
.some(
t =>
t.id ===
event.track.id
)
){

remoteStream.addTrack(
event.track
);

}

}


window.onRemoteStream?.(
remoteStream
);

};


/* =========================
   حالة الاتصال
========================= */

pc.onconnectionstatechange =
() => {

console.log(
"WebRTC:",
pc.connectionState
);


if(
pc.connectionState ===
"connected"
){

window.onCallConnected?.();

}


if(
pc.connectionState ===
"failed"
){

window.onCallError?.(
"فشل الاتصال بين الهاتفين"
);

}


if(
pc.connectionState ===
"closed"
){

console.log(
"WebRTC closed"
);

}

};


/* =========================
   ICE state
========================= */

pc.oniceconnectionstatechange =
() => {

console.log(
"ICE:",
pc.iceConnectionState
);


if(
pc.iceConnectionState ===
"failed"
){

console.log(
"ICE failed"
);

}

};


return pc;

}


/* =========================================
   الميكروفون
========================================= */

async function getMicrophone(){

if(
!navigator.mediaDevices ||
!navigator.mediaDevices.getUserMedia
){

throw new Error(
"المتصفح لا يدعم الميكروفون"
);

}


try{

localStream =
await navigator.mediaDevices
.getUserMedia({

audio:{
echoCancellation:true,
noiseSuppression:true,
autoGainControl:true
},

video:false

});


window.localCallStream =
localStream;


return localStream;


}catch(error){

console.error(
"Microphone error:",
error
);


if(
error.name ===
"NotAllowedError"
){

throw new Error(
"يجب السماح باستخدام الميكروفون"
);

}


if(
error.name ===
"NotFoundError"
){

throw new Error(
"لم يتم العثور على ميكروفون"
);

}


throw new Error(
"تعذر تشغيل الميكروفون"
);

}

}


/* =========================================
   إضافة الصوت
========================================= */

function addLocalTracks(){

if(
!peerConnection ||
!localStream
)
return;


localStream
.getTracks()
.forEach(
track => {

peerConnection.addTrack(
track,
localStream
);

}
);

}


/* =========================================
   مراقبة المكالمة
========================================= */

function listenCallDocument(
callId,
callback
){

const callRef =
doc(
db,
"calls",
callId
);


const unsubscribe =
onSnapshot(

callRef,

snapshot => {

if(
!snapshot.exists()
){

callback(null);

return;

}


callback(
snapshot.data()
);

},

error => {

console.error(
"Call listener error:",
error
);

}

);


stopCallListeners.push(
unsubscribe
);


return unsubscribe;

}


/* =========================================
   ICE Candidates
========================================= */

function listenCandidates(
callId,
ownUserId
){

if(candidateListenerStarted)
return;


candidateListenerStarted =
true;


const candidatesRef =
collection(
db,
"calls",
callId,
"candidates"
);


const unsubscribe =
onSnapshot(

candidatesRef,

snapshot => {

snapshot.docChanges()
.forEach(
async change => {

if(
change.type !==
"added"
)
return;


const data =
change.doc.data();


if(
data.senderId ===
ownUserId
)
return;


if(
!data.candidate
)
return;


const candidate =
new RTCIceCandidate(
data.candidate
);


/*
إذا لم يصل Remote Description
نحفظ الـ ICE مؤقتاً
*/

if(
!peerConnection ||
!peerConnection.remoteDescription
){

pendingCandidates.push(
candidate
);

return;

}


try{

await peerConnection
.addIceCandidate(
candidate
);

}catch(error){

console.error(
"ICE add error:",
error
);

}

}
);

},

error => {

console.error(
"Candidates listener error:",
error
);

}

);


stopCallListeners.push(
unsubscribe
);

}


/* =========================================
   إضافة ICE المؤجل
========================================= */

async function flushPendingCandidates(){

if(
!peerConnection ||
!peerConnection.remoteDescription
)
return;


const list =
[
...pendingCandidates
];


pendingCandidates =
[];


for(
const candidate
of list
){

try{

await peerConnection
.addIceCandidate(
candidate
);

}catch(error){

console.error(
"Pending ICE error:",
error
);

}

}

}


/* =========================================
   المكالمة الصادرة
========================================= */

export async function startOutgoingCall(
callId
){

await authReady;


if(!currentUser){

throw new Error(
"يجب تسجيل الدخول"
);

}


const call =
await getCall(
callId
);


if(!call){

throw new Error(
"المكالمة غير موجودة"
);

}


if(
call.callerId !==
currentUser.uid
){

throw new Error(
"لا يمكنك بدء هذه المكالمة"
);

}


localStream =
await getMicrophone();


peerConnection =
createPeerConnection(
callId
);


addLocalTracks();


listenCandidates(
callId,
currentUser.uid
);


/*
إنشاء Offer
*/

const offer =
await peerConnection
.createOffer();


await peerConnection
.setLocalDescription(
offer
);


/*
حفظ Offer
*/

await updateDoc(

doc(
db,
"calls",
callId
),

{

offer:{

type:
offer.type,

sdp:
offer.sdp

},

status:
"calling"

}

);


/*
انتظار Answer
*/

listenCallDocument(

callId,

async data => {

if(!data){

window.onCallEnded?.();

return;

}


if(
data.status ===
"ended"
){

window.onCallEnded?.();

return;

}


if(
data.answer &&
peerConnection &&
!peerConnection.currentRemoteDescription
){

try{

await peerConnection
.setRemoteDescription(

new RTCSessionDescription(
data.answer
)

);


await flushPendingCandidates();


}catch(error){

console.error(
"Answer error:",
error
);

window.onCallError?.(
"تعذر إنشاء الاتصال"
);

}

}

}

);

}


/* =========================================
   قبول المكالمة
========================================= */

export async function acceptIncomingCall(
callId
){

await authReady;


if(!currentUser){

throw new Error(
"يجب تسجيل الدخول"
);

}


const call =
await getCall(
callId
);


if(!call){

throw new Error(
"المكالمة غير موجودة"
);

}


if(
call.receiverId !==
currentUser.uid
){

throw new Error(
"هذه المكالمة ليست لك"
);

}


if(!call.offer){

throw new Error(
"لم يصل طلب الاتصال بعد"
);

}


/*
تشغيل الميكروفون
*/

localStream =
await getMicrophone();


/*
إنشاء WebRTC
*/

peerConnection =
createPeerConnection(
callId
);


addLocalTracks();


listenCandidates(
callId,
currentUser.uid
);


/*
وضع Offer
*/

await peerConnection
.setRemoteDescription(

new RTCSessionDescription(
call.offer
)

);


/*
إضافة ICE المؤجل
*/

await flushPendingCandidates();


/*
إنشاء Answer
*/

const answer =
await peerConnection
.createAnswer();


await peerConnection
.setLocalDescription(
answer
);


/*
حفظ Answer
*/

await updateDoc(

doc(
db,
"calls",
callId
),

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


/*
إظهار الاتصال
*/

window.onCallConnected?.();


/*
مراقبة انتهاء المكالمة
*/

listenCallDocument(

callId,

data => {

if(
!data ||
data.status ===
"ended"
){

window.onCallEnded?.();

}

}

);

}


/* =========================================
   مراقبة المكالمة الواردة
========================================= */

export async function watchIncomingCall(
callId
){

await authReady;


if(!currentUser){

throw new Error(
"يجب تسجيل الدخول"
);

}


if(!callId){

throw new Error(
"رقم المكالمة غير موجود"
);

}


return listenCallDocument(

callId,

data => {

if(!data){

window.onCallEnded?.();

return;

}


if(
data.status ===
"ended"
){

window.onCallEnded?.();

return;

}

}

);

}


/* =========================================
   تنظيف
========================================= */

export async function cleanupCall(
callId
){

/*
إيقاف listeners
*/

stopCallListeners.forEach(
unsubscribe => {

try{

unsubscribe();

}catch(error){

console.error(
error
);

}

}
);


stopCallListeners =
[];


candidateListenerStarted =
false;


/*
إيقاف الميكروفون
*/

if(localStream){

localStream
.getTracks()
.forEach(
track => {

try{

track.stop();

}catch(error){

console.error(
error
);

}

}
);

localStream =
null;

}


window.localCallStream =
null;


/*
إغلاق WebRTC
*/

if(peerConnection){

try{

peerConnection.close();

}catch(error){

console.error(
error
);

}

peerConnection =
null;

}


remoteStream =
null;

pendingCandidates =
[];


/*
تحديث الحالة
*/

if(
callId &&
currentUser
){

try{

const callRef =
doc(
db,
"calls",
callId
);


const snapshot =
await getDoc(
callRef
);


if(snapshot.exists()){

const data =
snapshot.data();


if(
data.callerId ===
currentUser.uid ||

data.receiverId ===
currentUser.uid
){

if(
data.status !==
"ended"
){

await updateDoc(

callRef,

{

status:
"ended",

endedAt:
serverTimestamp()

}

);

}

}

}

}catch(error){

console.error(
"Cleanup error:",
error
);

}

}

}


/* =========================================
   حذف المكالمة الواردة
========================================= */

export async function clearIncomingCall(){

await authReady;


if(!currentUser)
return;


try{

await updateDoc(

doc(
db,
"users",
currentUser.uid
),

{

incomingCall:
null

}

);

}catch(error){

console.error(
"Clear incoming call error:",
error
);

}

}


/* =========================================
   رفض المكالمة
========================================= */

export async function rejectCall(
callId
){

await authReady;


if(!currentUser ||
!callId)
return;


try{

const callRef =
doc(
db,
"calls",
callId
);


const snapshot =
await getDoc(
callRef
);


if(snapshot.exists()){

const data =
snapshot.data();


if(
data.receiverId ===
currentUser.uid
){

await updateDoc(

callRef,

{

status:
"ended",

endedAt:
serverTimestamp()

}

);

}

}

}catch(error){

console.error(
"Reject error:",
error
);

}


await clearIncomingCall();


await cleanupCall(
null
);

}


/* =========================================
   المستخدم الحالي
========================================= */

export function getCurrentUser(){

return currentUser;

}
