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

let cancelRecording = false;

let startY = 0;

let recordingTimer = null;

let seconds = 0;



const voiceButton =
document.getElementById("voiceButton");





// بدء التسجيل عند الضغط

voiceButton.addEventListener(
"pointerdown",
(e)=>{


startY = e.clientY;

cancelRecording = false;


startRecording();


});







// فحص السحب للأعلى

voiceButton.addEventListener(
"pointermove",
(e)=>{


if(!isRecording)
return;



let moveUp =
startY - e.clientY;



if(moveUp > 80){


cancelRecording = true;


voiceButton.textContent =
"❌";


}



});







// عند رفع الإصبع

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







// إذا انقطع اللمس

voiceButton.addEventListener(
"pointercancel",
()=>{


if(isRecording){

cancelCurrentRecording();

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
new MediaRecorder(
audioStream
);



audioChunks=[];



mediaRecorder.ondataavailable =
(event)=>{


if(event.data.size > 0){

audioChunks.push(event.data);

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






// عرض الصوت عند المرسل

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
"Voice sent"
);



}catch(error){


console.error(
"Voice Firestore error",
error
);


}



};



};







mediaRecorder.start();



isRecording=true;



voiceButton.classList.add(
"recording"
);



seconds=0;



recordingTimer =
setInterval(()=>{


seconds++;


let time =
seconds < 10
?
"0"+seconds
:
seconds;



voiceButton.textContent =
"🔴 "+time;



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



recordingTimer=null;



mediaRecorder.stop();





audioStream
.getTracks()
.forEach(
(track)=>track.stop()
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



recordingTimer=null;



mediaRecorder.stop();





audioStream
.getTracks()
.forEach(
(track)=>track.stop()
);





isRecording=false;



voiceButton.textContent =
"🎤";



voiceButton.classList.remove(
"recording"
);



console.log(
"Recording cancelled"
);



}









function addVoiceMessage(url){


const box =
document.createElement(
"div"
);



box.className =
"message mine";





const audio =
document.createElement(
"audio"
);



audio.controls=true;


audio.src=url;


audio.style.width =
"230px";




box.appendChild(
audio
);





const messages =
document.getElementById(
"messages"
);



messages.appendChild(
box
);




messages.scrollTop =
messages.scrollHeight;



}
