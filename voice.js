import {
collection,
addDoc,
serverTimestamp
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;

let isRecording = false;

let startY = 0;
let cancelRecording = false;

let recordingTimer = null;
let seconds = 0;


const voiceButton =
document.getElementById("voiceButton");



voiceButton.addEventListener(
"pointerdown",
(e)=>{

startY = e.clientY;

cancelRecording = false;

voiceButton.setPointerCapture(
e.pointerId
);

startRecording();

});





voiceButton.addEventListener(
"pointermove",
(e)=>{


if(!isRecording) return;



let distance =
startY - e.clientY;



// السحب للأعلى لإلغاء
if(distance > 80){


cancelRecording = true;


voiceButton.textContent =
"❌";


}



});






voiceButton.addEventListener(
"pointerup",
()=>{


if(!isRecording)
return;



if(cancelRecording){

cancelCurrentRecording();

}else{

stopRecording();

}


});







async function startRecording(){


if(isRecording)
return;


try{


audioStream =
await navigator.mediaDevices.getUserMedia({

audio:true

});



mediaRecorder =
new MediaRecorder(audioStream);



audioChunks=[];



mediaRecorder.ondataavailable =
(e)=>{

if(e.data.size > 0){

audioChunks.push(e.data);

}

};






mediaRecorder.onstop =
async ()=>{


if(cancelRecording){

audioChunks=[];

return;

}



const blob =
new Blob(
audioChunks,
{
type:"audio/webm"
}
);



const reader =
new FileReader();


reader.readAsDataURL(blob);



reader.onloadend =
async ()=>{


const audioBase64 =
reader.result;



// إظهار الصوت عند المرسل

addVoiceMessage(
audioBase64
);




// إرسال Firestore

try{


await addDoc(

collection(
window.chatDB,
"chats",
window.chatID,
"messages"
),

{

type:"voice",

audio:
audioBase64,

senderId:
window.chatUser.uid,

receiverId:
window.chatFriend.uid,

createdAt:
serverTimestamp()

}

);


console.log(
"voice sent"
);



}catch(error){

console.error(
error
);

}



};


};





mediaRecorder.start();



isRecording = true;


seconds = 0;


voiceButton.classList.add(
"recording"
);



recordingTimer =
setInterval(()=>{


seconds++;


let s =
seconds < 10
?
"0"+seconds
:
seconds;



voiceButton.textContent =
"🔴 "+s;



},1000);



}





catch(error){


console.error(error);


alert(
"لم يتم السماح بالميكروفون"
);


}

}









function stopRecording(){


if(!isRecording)
return;



clearInterval(
recordingTimer
);



mediaRecorder.stop();



audioStream
.getTracks()
.forEach(
track=>track.stop()
);



isRecording=false;



voiceButton.textContent =
"🎤";


voiceButton.classList.remove(
"recording"
);


}









function cancelCurrentRecording(){


if(!isRecording)
return;



cancelRecording=true;



clearInterval(
recordingTimer
);



mediaRecorder.stop();



audioStream
.getTracks()
.forEach(
track=>track.stop()
);



isRecording=false;



voiceButton.textContent =
"🎤";


voiceButton.classList.remove(
"recording"
);


console.log(
"voice cancelled"
);


}









function addVoiceMessage(url){


const box =
document.createElement("div");


box.className =
"message mine";



const audio =
document.createElement("audio");


audio.controls = true;


audio.src = url;


audio.style.width =
"230px";



box.appendChild(audio);



document
.getElementById("messages")
.appendChild(box);



const messages =
document.getElementById("messages");


messages.scrollTop =
messages.scrollHeight;


}
