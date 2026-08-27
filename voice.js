import {
initializeApp
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";


import {
getFirestore,
doc,
setDoc,
getDoc,
onSnapshot,
deleteDoc,
serverTimestamp
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


import {
getAuth,
onAuthStateChanged
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";



const firebaseConfig={

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



const appFirebase =
initializeApp(firebaseConfig);


const db =
getFirestore(appFirebase);


const auth =
getAuth(appFirebase);



const remoteVideo =
document.getElementById(
"remoteVideo"
);


const localVideo =
document.getElementById(
"localVideo"
);


const callStatus =
document.getElementById(
"callStatus"
);


const loading =
document.getElementById(
"loading"
);


const backButton =
document.getElementById(
"backButton"
);


const micButton =
document.getElementById(
"micButton"
);


const cameraButton =
document.getElementById(
"cameraButton"
);


const endButton =
document.getElementById(
"endButton"
);



let currentUser=null;

let friendID=null;

let localStream=null;

let peer=null;

let currentCall=null;

let micEnabled=true;

let cameraEnabled=true;

let unsubscribeCall=null;



/*
=========================
   قراءة الصديق من الرابط
=========================
*/


function getFriendID(){

const params =
new URLSearchParams(
location.search
);


return params.get(
"friend"
);

}




/*
=========================
   تشغيل الكاميرا
=========================
*/


async function startCamera(){

try{


localStream =
await navigator.mediaDevices.getUserMedia({

video:true,

audio:true

});


localVideo.srcObject =
localStream;



}catch(error){


alert(
"لا يمكن تشغيل الكاميرا أو المايك"
);


console.error(
error
);


}

}




/*
=========================
   إنشاء Peer
=========================
*/


function createPeer(){


peer =
new Peer();


peer.on(
"open",
id=>{


console.log(
"Peer ID:",
id
);


startCallListener();


}

);



peer.on(
"call",
call=>{


answerCall(
call
);


}

);


}




/*
=========================
   استقبال اتصال
=========================
*/


function answerCall(call){


currentCall =
call;


call.answer(
localStream
);



call.on(
"stream",
stream=>{


remoteVideo.srcObject =
stream;


setStatus(
"متصل"
);


}

);



}




/*
=========================
   بدء اتصال
=========================
*/


async function makeCall(){


if(!friendID)
return;


const friendDoc =
await getDoc(

doc(
db,
"users",
friendID
)

);



if(!friendDoc.exists()){


alert(
"المستخدم غير موجود"
);


return;

}



const friend =
friendDoc.data();



if(!friend.peerID){


alert(
"المستخدم غير متاح"
);


return;

}



const call =
peer.call(

friend.peerID,

localStream

);



currentCall =
call;



call.on(

"stream",

stream=>{


remoteVideo.srcObject =
stream;


setStatus(
"متصل"
);


}

);



}




/*
=========================
   حفظ Peer ID
=========================
*/


async function savePeerID(id){


await setDoc(

doc(
db,
"users",
currentUser.uid
),

{

peerID:id,

onlineCall:true,

lastCall:
serverTimestamp()

},

{

merge:true

}

);


}




/*
=========================
   مراقبة المكالمات
=========================
*/


function startCallListener(){


savePeerID(
peer.id
);


}



/*
=========================
   الحالة
=========================
*/


function setStatus(text){

callStatus.textContent =
text;


if(text==="متصل"){

callStatus.classList.add(
"online"
);

}else{

callStatus.classList.remove(
"online"
);

}

}




/*
=========================
   إنهاء المكالمة
=========================
*/


function endCall(){


if(currentCall){

currentCall.close();

currentCall=null;

}


if(localStream){


localStream.getTracks()
.forEach(
track=>{
track.stop();
}
);


}



remoteVideo.srcObject=null;


setStatus(
"انتهت المكالمة"
);



}




/*
=========================
   المايك
=========================
*/


micButton.onclick=()=>{


if(!localStream)
return;



const audio =
localStream.getAudioTracks()[0];


if(audio){


micEnabled =
!micEnabled;


audio.enabled =
micEnabled;



micButton.textContent =
micEnabled
?
"🎤"
:
"🔇";


}


};




/*
=========================
   الكاميرا
=========================
*/


cameraButton.onclick=()=>{


if(!localStream)
return;


const video =
localStream.getVideoTracks()[0];


if(video){


cameraEnabled =
!cameraEnabled;


video.enabled =
cameraEnabled;



cameraButton.textContent =
cameraEnabled
?
"📷"
:
"🚫";


}


};




/*
=========================
   خروج
=========================
*/


endButton.onclick=()=>{

endCall();

};



backButton.onclick=()=>{


endCall();


history.back();


};





/*
=========================
   تشغيل
=========================
*/


onAuthStateChanged(

auth,

async user=>{


if(!user){


loading.textContent =
"يجب تسجيل الدخول";


return;

}



currentUser =
user;


friendID =
getFriendID();



await startCamera();


createPeer();



document.getElementById(
"loading"
).style.display="none";


document.getElementById(
"app"
).style.display="flex";



setStatus(
"جاهز"
);



/*
اتصال تلقائي بعد تجهيز Peer
*/


setTimeout(()=>{


makeCall();


},3000);



}

);
