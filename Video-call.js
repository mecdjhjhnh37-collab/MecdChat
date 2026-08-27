// ============================================================
// Mecd Chat - Video Call
// Video-call.js FIXED
// ============================================================


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
serverTimestamp
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";



// ================= Firebase =================


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



const app =
initializeApp(firebaseConfig);


const auth =
getAuth(app);


const db =
getFirestore(app);




// ================= Variables =================


let currentUser = null;

let friendUser = null;

let callId = null;

let peerConnection = null;

let localStream = null;


let unsubscribeCall = null;

let unsubscribeCandidates = null;


let callerId = null;


let ended = false;



let callStartedAt = null;

let callConnected = false;



// ================= HTML =================


const $ =
id =>
document.getElementById(id);



const isVideoPage =
!!$("remoteVideo");



let remoteVideo;
let localVideo;
let remotePlaceholder;
let remoteAvatar;
let remoteName;
let topName;
let topStatus;
let callStatus;
let loading;
let errorBox;



if(isVideoPage){


remoteVideo =
$("remoteVideo");


localVideo =
$("localVideo");


remotePlaceholder =
$("remotePlaceholder");


remoteAvatar =
$("remoteAvatar");


remoteName =
$("remoteName");


topName =
$("topName");


topStatus =
$("topStatus");


callStatus =
$("callStatus");


loading =
$("loading");


errorBox =
$("errorBox");

}



// ================= URL =================


const params =
new URLSearchParams(
window.location.search
);



const friendId =
params.get("friend");


const incomingCall =
params.get("call");




// ================= WebRTC =================


const rtcConfig = {


iceServers:[


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



// ================= Status =================


function setStatus(text){


if(callStatus)
callStatus.textContent=text;


if(topStatus)
topStatus.textContent=text;


}




function showError(text){


console.error(text);


if(errorBox){

errorBox.textContent=text;

errorBox.classList.remove(
"hidden"
);

}


setStatus(
"تعذر الاتصال"
);


}




// ================= Friend =================


async function loadFriend(){


const snap =
await getDoc(

doc(
db,
"users",
friendId
)

);



if(!snap.exists()){

throw new Error(
"الصديق غير موجود"
);

}



const data =
snap.data();



friendUser={


uid:
friendId,


name:
data.name ||
"مستخدم Mecd",


photo:
data.photo ||
""


};



if(remoteName)
remoteName.textContent =
friendUser.name;


if(topName)
topName.textContent =
friendUser.name;



if(friendUser.photo && remoteAvatar){


remoteAvatar.innerHTML =

`
<img src="${friendUser.photo}">
`;


}


}
// ================= Local Media =================


async function getLocalMedia(){


if(localStream){

return localStream;

}



try{


localStream =
await navigator.mediaDevices.getUserMedia({

video:{

width:{
ideal:1280
},

height:{
ideal:720
},

facingMode:
"user"

},


audio:{

echoCancellation:true,

noiseSuppression:true

}


});



if(localVideo){

localVideo.srcObject =
localStream;


await localVideo.play()
.catch(()=>{});

}


return localStream;



}

catch(error){


console.error(
error
);


throw new Error(
"لم يتم السماح بالكاميرا أو المايك"
);


}


}




// ================= Peer =================



function createPeer(){



if(peerConnection)
return;



peerConnection =
new RTCPeerConnection(
rtcConfig
);





peerConnection.onicecandidate =
async e=>{


if(
!e.candidate ||
!callId
)
return;



const type =
currentUser.uid === callerId

?
"callerCandidates"

:
"calleeCandidates";



await addDoc(

collection(

db,

"videoCalls",

callId,

type

),

e.candidate.toJSON()

);


};






peerConnection.ontrack =
async e=>{


if(
e.streams &&
e.streams[0]
){


remoteVideo.srcObject =
e.streams[0];


await remoteVideo.play()
.catch(()=>{});



if(remotePlaceholder)

remotePlaceholder.classList.add(
"hidden"
);



callConnected =
true;


if(!callStartedAt)

callStartedAt =
Date.now();


setStatus(
"متصل"
);


}


};






peerConnection.onconnectionstatechange =
()=>{


console.log(
peerConnection.connectionState
);



if(
peerConnection.connectionState ===
"connected"
){

callConnected=true;

setStatus(
"متصل"
);

}


if(
peerConnection.connectionState ===
"failed"
){

setStatus(
"فشل الاتصال"
);

}



};



}





function addTracks(){


if(
!localStream ||
!peerConnection
)
return;



localStream
.getTracks()
.forEach(

track=>{


peerConnection.addTrack(

track,

localStream

);


}

);


}







// ================= ICE Listener =================



function listenICE(type){



const ref =
collection(

db,

"videoCalls",

callId,

type

);




unsubscribeCandidates =

onSnapshot(

ref,

snapshot=>{


snapshot.docChanges()
.forEach(

async change=>{


if(
change.type !==
"added"
)
return;



await peerConnection
.addIceCandidate(

new RTCIceCandidate(
change.doc.data()
)

);


}

);



}

);



}








// ================= Outgoing =================



async function startOutgoingCall(){



setStatus(
"جارٍ الاتصال..."
);



await getLocalMedia();



const callRef =
doc(
collection(
db,
"videoCalls"
)
);



callId =
callRef.id;



callerId =
currentUser.uid;



createPeer();



addTracks();



listenICE(
"calleeCandidates"
);





const offer =
await peerConnection
.createOffer();



await peerConnection
.setLocalDescription(
offer
);





await setDoc(

callRef,

{


callerId:
currentUser.uid,


calleeId:
friendUser.uid,


callerName:
currentUser.displayName ||
"مستخدم Mecd",



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


}


);





unsubscribeCall =

onSnapshot(

callRef,

async snap=>{


if(!snap.exists())
return;



const data =
snap.data();





if(
data.answer &&
!peerConnection.currentRemoteDescription
){



await peerConnection
.setRemoteDescription(

new RTCSessionDescription(
data.answer
)

);



setStatus(
"متصل"
);


}



if(
data.status==="ended"
){

endRemote();

}


}

);



setStatus(
"بانتظار الرد..."
);



}






// ================= Incoming =================



async function answerCall(){



callId =
incomingCall;



const ref =
doc(

db,

"videoCalls",

callId

);




const snap =
await getDoc(ref);



if(!snap.exists())

throw new Error(
"المكالمة غير موجودة"
);



const data =
snap.data();



callerId =
data.callerId;



friendUser={

uid:
data.callerId,

name:
data.callerName ||
"مستخدم Mecd"

};



if(remoteName)

remoteName.textContent =
friendUser.name;



await getLocalMedia();



createPeer();



addTracks();



listenICE(
"callerCandidates"
);




await peerConnection
.setRemoteDescription(

new RTCSessionDescription(
data.offer
)

);



const answer =
await peerConnection
.createAnswer();



await peerConnection
.setLocalDescription(
answer
);



await updateDoc(

ref,

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
"متصل"
);



}
// ================= End Call =================


async function saveCallHistory(){


if(
!currentUser ||
!friendUser ||
!callId
)
return;



const chatId = [

currentUser.uid,

friendUser.uid

]
.sort()
.join("_");



await setDoc(

doc(

db,

"chats",

chatId,

"messages",

"videoCall_"+callId

),

{


type:
"call",


callType:
"video",


callId:
callId,


senderId:
currentUser.uid,


receiverId:
friendUser.uid,


duration:

callConnected && callStartedAt

?

Math.floor(
(Date.now()-callStartedAt)
/1000
)

:

0,



status:

callConnected

?
"completed"

:

"missed",



createdAt:
serverTimestamp()


}


);


}






async function endCall(){



if(ended)
return;



ended=true;



await saveCallHistory()
.catch(console.error);



if(callId){


await updateDoc(

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


}

)
.catch(()=>{});


}



cleanup();



history.back();



}






async function endRemote(){


if(ended)
return;


ended=true;



await saveCallHistory()
.catch(()=>{});


cleanup();



setTimeout(()=>{

history.back();

},700);


}







// ================= Cleanup =================



function cleanup(){



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

t=>t.stop()

);


localStream=null;


}



if(localVideo)

localVideo.srcObject=null;



if(remoteVideo)

remoteVideo.srcObject=null;



}







// ================= Controls =================



function setupControls(){



const mute =
$("muteButton");

const camera =
$("cameraButton");

const end =
$("endButton");

const back =
$("backButton");





if(mute){


mute.onclick=()=>{


if(!localStream)
return;



localStream
.getAudioTracks()
.forEach(

t=>{

t.enabled =
!t.enabled;

mute.textContent =
t.enabled
?
"🎤"
:
"🔇";

}

);



};


}






if(camera){


camera.onclick=()=>{


if(!localStream)
return;



localStream
.getVideoTracks()
.forEach(

t=>{

t.enabled =
!t.enabled;


camera.textContent =
t.enabled
?
"📹"
:
"🚫";

}

);



};


}






if(end)

end.onclick =
endCall;



if(back)

back.onclick =
endCall;



}








// ================= Incoming Calls =================



export function listenIncomingCalls(){



if(!currentUser)
return;



onSnapshot(

collection(
db,
"videoCalls"
),

snapshot=>{


snapshot.docChanges()
.forEach(

change=>{


if(
change.type !==
"added"
)

return;



const data =
change.doc.data();



if(

data.calleeId === currentUser.uid &&

data.status==="ringing"

){



const id =
change.doc.id;



const accept =
confirm(
"📹 مكالمة فيديو واردة"
);



if(accept){


location.href =
"./Video-call.html?call="
+
id;


}

else{


updateDoc(

doc(
db,
"videoCalls",
id
),

{

status:"ended"

}

);


}



}



}

);


}

);



}









// ================= Init =================



function init(){


if(!isVideoPage)
return;



setupControls();



onAuthStateChanged(

auth,

async user=>{


if(!user){


showError(
"يجب تسجيل الدخول"
);


return;


}



currentUser =
user;



try{


if(incomingCall){


await answerCall();



}

else{


await loadFriend();


await startOutgoingCall();



}



if(loading)

loading.classList.add(
"hidden"
);



}

catch(e){


showError(
e.message
);


}



}

);



}





init();

