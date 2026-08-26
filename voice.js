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


const voiceButton = document.getElementById("voiceButton");

let recorder;
let stream;
let chunks = [];
let isRecording = false;



voiceButton.addEventListener("pointerdown", startRecord);

voiceButton.addEventListener("pointerup", stopRecord);

voiceButton.addEventListener("pointercancel", stopRecord);

voiceButton.addEventListener("pointerleave", stopRecord);



async function startRecord(e){

e.preventDefault();


if(isRecording) return;


if(
!window.storage ||
!window.chatDB ||
!window.chatID
){

console.log("Firebase missing");
return;

}



try{


stream = await navigator.mediaDevices.getUserMedia({
audio:true
});


recorder = new MediaRecorder(stream);


chunks=[];


recorder.ondataavailable = e=>{

if(e.data.size>0){

chunks.push(e.data);

}

};



recorder.start();


isRecording=true;


voiceButton.textContent="⏹️";

console.log("Recording started");


}

catch(err){

console.error(err);

alert("اسمح بالميكروفون");

}



}




function stopRecord(e){

e.preventDefault();


if(!isRecording)
return;


if(recorder){

recorder.stop();

}



if(stream){

stream.getTracks().forEach(t=>t.stop());

}


isRecording=false;

voiceButton.textContent="🎤";

}



recorderStop();



function recorderStop(){


document.addEventListener(
"visibilitychange",
()=>{

if(document.hidden && isRecording){

stopRecord(new Event("stop"));

}

});


}





async function sendVoice(blob){



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




recorder.onstop = async()=>{


if(chunks.length===0)
return;


const blob = new Blob(
chunks,
{
type:"audio/webm"
}
);


await sendVoice(blob);


chunks=[];


};
