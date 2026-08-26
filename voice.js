let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let isRecording = false;


const voiceButton = document.getElementById("voiceButton");


voiceButton.addEventListener(
"pointerdown",
startRecording
);


voiceButton.addEventListener(
"pointerup",
stopRecording
);


voiceButton.addEventListener(
"pointerleave",
stopRecording
);



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


mediaRecorder.ondataavailable = e=>{

if(e.data.size > 0){

audioChunks.push(e.data);

}

};



mediaRecorder.onstop = ()=>{


const blob =
new Blob(
audioChunks,
{
type:"audio/webm"
}
);


const url =
URL.createObjectURL(blob);


addVoiceMessage(url);


};



mediaRecorder.start();


isRecording=true;


voiceButton.textContent="🔴";


voiceButton.classList.add(
"recording"
);



}catch(e){

console.error(e);

alert("لم يتم السماح بالميكروفون");

}


}




function stopRecording(){


if(!isRecording) return;


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


}
