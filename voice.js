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

let recording = false;
let startTime = 0;
let timer = null;



// بدء التسجيل
voiceButton.addEventListener(
"pointerdown",
async(e)=>{

e.preventDefault();


if(recording) return;


if(
!window.storage ||
!window.chatDB ||
!window.chatID ||
!window.chatUser ||
!window.chatFriend
){

console.error("Firebase غير جاهز");
return;

}


try{


stream =
await navigator.mediaDevices.getUserMedia(
{
audio:true
}
);



recorder =
new MediaRecorder(stream);



chunks=[];



recorder.ondataavailable =
event=>{

if(event.data.size > 0){

chunks.push(event.data);

}

};





recorder.onstop =
async()=>{


try{


if(chunks.length===0){

reset();

return;

}



const audioBlob =
new Blob(
chunks,
{
type:"audio/webm"
}
);



const fileRef =
ref(
window.storage,
"voices/"+Date.now()+".webm"
);



await uploadBytes(
fileRef,
audioBlob
);



const url =
await getDownloadURL(
fileRef
);




// حفظ الرسالة

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



console.log(
"تم إرسال الصوت"
);



}
catch(error){

console.error(
error
);

alert(
"خطأ في إرسال الصوت"
);


}



reset();


};





recorder.start();



recording=true;


startTime=Date.now();


voiceButton.textContent="🔴";



// عداد التسجيل

timer=setInterval(()=>{


let sec =
Math.floor(
(Date.now()-startTime)/1000
);


voiceButton.textContent=
"🔴 "+sec+"s";


},1000);



}

catch(error){

console.error(error);

alert(
"اسمح للميكروفون"
);

reset();


}



});







// إيقاف عند رفع الإصبع

voiceButton.addEventListener(
"pointerup",
stopRecording
);



voiceButton.addEventListener(
"pointerleave",
()=>{

if(recording){

stopRecording();

}

});




function stopRecording(){


if(!recording)
return;



if(recorder){

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




function reset(){


if(timer){

clearInterval(timer);

}


timer=null;


recorder=null;

stream=null;

chunks=[];


recording=false;


voiceButton.textContent="🎤";


}
