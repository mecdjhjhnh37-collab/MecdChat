import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const voiceButton = document.getElementById("voiceButton");
const messages = document.getElementById("messages");


let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let isRecording = false;



async function startRecording(){

    if(isRecording) return;


    audioStream = await navigator.mediaDevices.getUserMedia({
        audio:true
    });


    mediaRecorder = new MediaRecorder(audioStream);


    audioChunks = [];


    mediaRecorder.ondataavailable = e=>{

        if(e.data.size > 0){

            audioChunks.push(e.data);

        }

    };



    mediaRecorder.onstop = ()=>{


        const blob = new Blob(
            audioChunks,
            {
                type:"audio/webm"
            }
        );


        const reader = new FileReader();


        reader.readAsDataURL(blob);


        reader.onloadend = async ()=>{


            const audioBase64 = reader.result;



            // عرض عند المرسل
            addVoiceMessage(
                audioBase64,
                "mine"
            );



            // حفظ داخل نفس المحادثة
            await addDoc(

                collection(
                    db,
                    "chats",
                    chatID,
                    "messages"
                ),

                {

                    type:"voice",

                    audio:
                    audioBase64,

                    senderId:
                    currentUser.uid,

                    receiverId:
                    friendUser.uid,

                    createdAt:
                    serverTimestamp()

                }

            );


        };


    };



    mediaRecorder.start();


    isRecording=true;


    voiceButton.textContent="🔴";


}




function stopRecording(){

    if(!isRecording)
    return;


    mediaRecorder.stop();


    audioStream.getTracks()
    .forEach(track=>{
        track.stop();
    });


    isRecording=false;


    voiceButton.textContent="🎤";

}



function addVoiceMessage(
url,
side
){


    const box =
    document.createElement("div");


    box.className =
    "message " + side;



    const audio =
    document.createElement("audio");


    audio.controls=true;


    audio.src=url;


    audio.style.width="230px";



    box.appendChild(audio);


    messages.appendChild(box);


    messages.scrollTop =
    messages.scrollHeight;


}



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
