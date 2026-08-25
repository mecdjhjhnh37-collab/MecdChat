import {
collection,
addDoc,
serverTimestamp,
doc,
updateDoc,
setDoc
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const voiceButton =
document.getElementById("voiceButton");


let recorder = null;
let stream = null;
let chunks = [];

let isRecording = false;
let cancelRecording = false;



// بدء التسجيل
voiceButton.addEventListener(
"pointerdown",
async(e)=>{


if(isRecording) return;


cancelRecording = false;


voiceButton.setPointerCapture(
e.pointerId
);


try{


stream =
await navigator.mediaDevices.getUserMedia({

audio:true

});



recorder =
new MediaRecorder(stream);



chunks = [];



recorder.ondataavailable =
(event)=>{


if(event.data.size > 0){

chunks.push(event.data);

}

};





recorder.onstop =
async()=>{


if(cancelRecording){

chunks=[];

return;

}




const blob =
new Blob(
chunks,
{
type:"audio/webm"
}
);



const reader =
new FileReader();



reader.readAsDataURL(blob);



reader.onloadend =
async()=>{


const audio =
reader.result;



// عرض عند المرسل
addVoiceMessage(audio);



// إرسال Firestore

await addDoc(

collection(
window.chatDB,
"chats",
window.chatID,
"messages"
),

{

type:"voice",

audio:audio,

senderId:
window.chatUser.uid,

receiverId:
window.chatFriend.uid,

createdAt:
serverTimestamp()

}

);


};


};



recorder.start();



isRecording=true;



// إظهار للطرف الثاني
await setRecordingStatus(true);



voiceButton.classList.add(
"recording"
);


voiceButton.textContent =
"🔴";


}catch(error){

console.error(error);

alert(
"لم يتم السماح بالميكروفون"
);

}


});





// رفع الإصبع
voiceButton.addEventListener(
"pointerup",
async()=>{


if(!isRecording)
return;



if(cancelRecording){

cancelCurrentRecording();

}else{

stopRecording();

}


});





// السحب لفوق للإلغاء
voiceButton.addEventListener(
"pointermove",
(e)=>{


if(!isRecording)
return;



if(e.clientY < voiceButton.getBoundingClientRect().top - 50){


cancelRecording=true;


voiceButton.textContent =
"❌";


}


});






async function stopRecording(){



if(!recorder)
return;



recorder.stop();



stream
.getTracks()
.forEach(
track=>track.stop()
);



isRecording=false;



await setRecordingStatus(false);



voiceButton.classList.remove(
"recording"
);


voiceButton.textContent =
"🎤";


}







function cancelCurrentRecording(){



cancelRecording=true;



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



isRecording=false;



setRecordingStatus(false);



voiceButton.classList.remove(
"recording"
);


voiceButton.textContent =
"🎤";


}







// حالة التسجيل للطرف الثاني
async function setRecordingStatus(status){


if(
!window.chatUser ||
!window.chatFriend
)
return;



try{


await setDoc(

doc(
window.chatDB,
"users",
window.chatUser.uid
),

{

recording:status

},

{

merge:true

}

);



}catch(error){

console.error(
"Recording status error",
error
);

}


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
