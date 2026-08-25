import {

storage

}

from "./firebase.js";


import {

collection,
addDoc,
serverTimestamp,
doc,
setDoc

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


if(isRecording) return;



try{


stream =
await navigator.mediaDevices.getUserMedia({

audio:true

});



recorder =
new MediaRecorder(stream);



chunks=[];



recorder.ondataavailable =
e=>{

if(e.data.size>0){

chunks.push(e.data);

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



// رفع الصوت إلى Storage

const fileRef =
ref(

storage,

"voices/"+Date.now()+".webm"

);



await uploadBytes(
fileRef,
blob
);



const audioURL =
await getDownloadURL(
fileRef
);




// حفظ الرسالة في Firestore

await addDoc(

collection(

window.chatDB,

"chats",

window.chatID,

"messages"

),

{

type:"voice",

audio:audioURL,

senderId:
window.chatUser.uid,

receiverId:
window.chatFriend.uid,

createdAt:
serverTimestamp()

}

);



};



recorder.start();


isRecording=true;


voiceButton.textContent="🔴";


}catch(error){

console.error(error);

alert("لم يتم السماح بالميكروفون");

}


});




voiceButton.addEventListener(
"pointerup",
()=>{


if(!isRecording)
return;



recorder.stop();



stream
.getTracks()
.forEach(
t=>t.stop()
);



isRecording=false;


voiceButton.textContent="🎤";


});
