import {
getStorage,
ref,
uploadBytes,
getDownloadURL
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


import {
collection,
addDoc,
serverTimestamp
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";



const voiceButton =
document.getElementById(
"voiceButton"
);



let mediaRecorder = null;

let audioChunks = [];

let recording = false;



function getChatData(){

return {

db:
window.chatDB,

storage:
window.storage,

chatID:
window.chatID,

user:
window.chatUser,

friend:
window.chatFriend

};

}



/*
=========================
 بدء التسجيل
=========================
*/


async function startRecording(){


try{


const stream =
await navigator.mediaDevices.getUserMedia({

audio:true

});



mediaRecorder =
new MediaRecorder(
stream
);



audioChunks=[];



mediaRecorder.ondataavailable =
event=>{


if(event.data.size>0){

audioChunks.push(
event.data
);

}

};



mediaRecorder.onstop =
async ()=>{


const audioBlob =
new Blob(

audioChunks,

{

type:"audio/webm"

}

);



await sendVoice(
audioBlob
);



stream
.getTracks()
.forEach(
track=>{
track.stop();
}
);



};



mediaRecorder.start();



recording=true;


voiceButton.textContent =
"⏹️";


voiceButton.style.background =
"#e80045";



}catch(error){


console.error(
"Microphone error:",
error
);



alert(
"لا يمكن تشغيل المايك"
);


}


}




/*
=========================
 إيقاف التسجيل
=========================
*/


function stopRecording(){


if(
mediaRecorder &&
recording
){


mediaRecorder.stop();


recording=false;



voiceButton.textContent =
"🎤";


voiceButton.style.background =
"#18231f";


}


}




/*
=========================
 إرسال الصوت
=========================
*/


async function sendVoice(blob){


const {

db,

storage,

chatID,

user,

friend

}=getChatData();



if(
!db ||
!storage ||
!chatID ||
!user ||
!friend
){

console.error(
"Chat data missing"
);

return;

}




try{


const fileName =

"voice_" +

Date.now() +

".webm";



const storageRef =

ref(

storage,

"voices/"+fileName

);



await uploadBytes(

storageRef,

blob

);



const url =

await getDownloadURL(

storageRef

);




await addDoc(

collection(

db,

"chats",

chatID,

"messages"

),

{

type:
"voice",

audio:
url,

senderId:
user.uid,

receiverId:
friend.uid,

createdAt:
serverTimestamp()

}

);



}catch(error){


console.error(
"Voice send error:",
error
);


alert(
"حدث خطأ أثناء إرسال الصوت"
);


}


}





/*
=========================
 زر الصوت
=========================
*/


voiceButton.addEventListener(

"click",

()=>{


if(recording){

stopRecording();

}else{

startRecording();

}


}

);// =========================
// منع مشاكل الهاتف
// =========================

window.addEventListener(

"beforeunload",

()=>{

if(
mediaRecorder &&
recording
){

mediaRecorder.stop();

}

}

);



// =========================
// فحص وجود المايك
// =========================

async function checkMicrophone(){

if(
!navigator.mediaDevices ||
!navigator.mediaDevices.getUserMedia
){

alert(
"هذا الجهاز لا يدعم تسجيل الصوت"
);

return false;

}


return true;

}




// =========================
// تعديل startRecording
// =========================

const oldStartRecording =
startRecording;


startRecording = async function(){


const ok =
await checkMicrophone();


if(!ok)
return;



await oldStartRecording();


};




// =========================
// تغيير شكل الزر أثناء التسجيل
// =========================

function updateVoiceButton(){

if(recording){

voiceButton.textContent="⏹️";

voiceButton.title=
"إيقاف التسجيل";

}else{

voiceButton.textContent="🎤";

voiceButton.title=
"تسجيل صوت";

}

}




// =========================
// تنظيف التسجيل
// =========================

function cleanupRecorder(){


if(mediaRecorder){


mediaRecorder.stream
?.getTracks()
.forEach(

track=>{

track.stop();

}

);


mediaRecorder=null;


}



audioChunks=[];


recording=false;


updateVoiceButton();


}




// =========================
// عند رفض الإذن
// =========================

navigator.mediaDevices
?.getUserMedia({

audio:true

})
.then(

stream=>{

stream
.getTracks()
.forEach(
t=>t.stop()
);

}

)
.catch(

error=>{

console.log(
"Microphone permission:",
error
);

}

);
