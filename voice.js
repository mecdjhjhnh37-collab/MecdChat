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



voiceButton.addEventListener(
"pointerdown",
async()=>{


if(isRecording)
return;



if(
!window.storage ||
!window.chatDB ||
!window.chatID ||
!window.chatUser ||
!window.chatFriend
){

console.error("Firebase variables missing");
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
(e)=>{

if(e.data.size > 0){

chunks.push(e.data);

}

};





recorder.onstop =
async()=>{


if(chunks.length === 0){

resetVoice();

return;

}



const blob =
new Blob(
chunks,
{
type:"audio/webm"
}
);




// رفع إلى Storage

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




// إظهار الصوت عند المرسل فوراً

addVoiceMessage(url);




// حفظ Firestore

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



resetVoice();


};




recorder.start();



isRecording=true;


voiceButton.textContent="🔴";


voiceButton.classList.add(
"recording"
);



}

catch(error){

console.error(error);

alert("لم يتم السماح بالميكروفون");

}



});





voiceButton.addEventListener(
"pointerup",
()=>{


if(!isRecording)
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



});





function resetVoice(){

recorder=null;

stream=null;

chunks=[];

isRecording=false;


voiceButton.textContent="🎤";


voiceButton.classList.remove(
"recording"
);

}







function addVoiceMessage(url){


const box =
document.createElement("div");


box.className =
"message mine";



const audio =
document.createElement("audio");


audio.controls=true;


audio.src=url;


audio.style.width="230px";



box.appendChild(audio);



document
.getElementById("messages")
.appendChild(box);



document
.getElementById("messages")
.scrollTop =
document
.getElementById("messages")
.scrollHeight;


}
