import {
collection,
addDoc,
serverTimestamp
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


import {
ref,
uploadBytes,
getDownloadURL
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";



const voiceButton =
document.getElementById("voiceButton");


let recorder = null;
let stream = null;
let chunks = [];

let isRecording = false;
let timer = null;
let seconds = 0;



voiceButton.addEventListener(
"pointerdown",
async(e)=>{


e.preventDefault();


if(isRecording)
return;



try{


voiceButton.setPointerCapture(
e.pointerId
);



await startRecording();



}

catch(error){

console.error(error);

alert(
"خطأ في تشغيل الميكروفون"
);

resetVoice();

}



});





async function startRecording(){


if(
!window.storage ||
!window.chatDB ||
!window.chatID ||
!window.chatUser ||
!window.chatFriend
){

console.error(
"Firebase غير جاهز"
);

return;

}



stream =
await navigator.mediaDevices.getUserMedia(
{
audio:true
}
);



recorder =
new MediaRecorder(
stream,
{
mimeType:"audio/webm"
}
);



chunks=[];



recorder.ondataavailable =
event=>{

if(event.data.size > 0){

chunks.push(event.data);

}

};





recorder.onstop =
async()=>{


const blob =
new Blob(
chunks,
{
type:"audio/webm"
}
);



if(blob.size === 0){

resetVoice();

return;

}



try{


const voiceRef =
ref(
window.storage,
"voices/"+Date.now()+".webm"
);



await uploadBytes(
voiceRef,
blob
);



const url =
await getDownloadURL(
voiceRef
);



await addDoc(

collection(
window.chatDB,
"chats",
window.chatID,
"messages"
),

{

type:"voice",

audio:url,

senderId:
window.chatUser.uid,

receiverId:
window.chatFriend.uid,

createdAt:
serverTimestamp()

}

);



}

catch(error){

console.error(
error
);

alert(
"فشل إرسال الصوت"
);


}



resetVoice();



};





recorder.start(100);



isRecording=true;


seconds=0;


voiceButton.innerHTML="🔴 0s";



timer=setInterval(()=>{


seconds++;


voiceButton.innerHTML=
"🔴 "+seconds+"s";


},1000);



}





// رفع الإصبع = إنهاء التسجيل

document.addEventListener(
"pointerup",
stopRecording
);


document.addEventListener(
"touchend",
stopRecording
);


document.addEventListener(
"pointercancel",
stopRecording
);





function stopRecording(){


if(!isRecording)
return;



if(recorder &&
recorder.state !== "inactive"){

recorder.stop();

}



if(stream){

stream
.getTracks()
.forEach(
track=>track.stop()
);

}



}





function resetVoice(){


if(timer){

clearInterval(timer);

}


timer=null;


recorder=null;

stream=null;

chunks=[];

isRecording=false;


voiceButton.innerHTML="🎤";


}
