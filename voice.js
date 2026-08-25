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

let recordingTimer = null;
let recordingSeconds = 0;
let cancelRecording = false;



const voiceButton =
document.getElementById("voiceButton");





voiceButton.addEventListener(
"pointerdown",
(e)=>{

cancelRecording = false;

voiceButton.setPointerCapture(
e.pointerId
);

startRecording();

});





voiceButton.addEventListener(
"pointerup",
()=>{


if(cancelRecording){

cancelCurrentRecording();

}else{

stopRecording();

}


});





voiceButton.addEventListener(
"pointerleave",
()=>{


if(isRecording){

cancelRecording = true;

voiceButton.textContent="❌";

}


});








async function startRecording(){


if(isRecording) return;



try{


audioStream =
await navigator.mediaDevices.getUserMedia({

audio:true

});



mediaRecorder =
new MediaRecorder(audioStream);



audioChunks=[];



mediaRecorder.ondataavailable = (e)=>{


if(e.data.size > 0){


audioChunks.push(e.data);


}


};






mediaRecorder.onstop = async ()=>{


if(recordingTimer){

clearInterval(recordingTimer);

recordingTimer=null;

}



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






reader.onloadend = async ()=>{


const audioBase64 =
reader.result;






// عرض الصوت عند المرسل

addVoiceMessage(
audioBase64
);







// حفظ الصوت في Firestore


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
"Firestore voice error:",
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




// بدء العداد

recordingSeconds = 0;


recordingTimer =
setInterval(()=>{


recordingSeconds++;


let minutes =
Math.floor(
recordingSeconds / 60
);


let seconds =
recordingSeconds % 60;



if(seconds < 10){

seconds =
"0"+seconds;

}



voiceButton.textContent =
"🔴 "
+
minutes
+
":"
+
seconds;



},1000);







}catch(e){


console.error(e);


alert(
"لم يتم السماح بالميكروفون"
);



}



}









function stopRecording(){



if(!isRecording) return;



if(recordingTimer){

clearInterval(recordingTimer);

recordingTimer=null;

}




mediaRecorder.stop();




audioStream

.getTracks()

.forEach(

track=>track.stop()

);




isRecording=false;




voiceButton.textContent="🎤";



voiceButton.classList.remove(
"recording"
);



}









function cancelCurrentRecording(){



if(!isRecording) return;




if(recordingTimer){

clearInterval(recordingTimer);

recordingTimer=null;

}





cancelRecording = true;



audioChunks=[];




mediaRecorder.stop();




audioStream

.getTracks()

.forEach(

track=>track.stop()

);




isRecording=false;



voiceButton.textContent="🎤";



voiceButton.classList.remove(
"recording"
);



}









function addVoiceMessage(url){



const box =

document.createElement("div");



box.className="message mine";







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
