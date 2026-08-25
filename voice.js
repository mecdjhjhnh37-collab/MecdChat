import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// العناصر
const voiceButton = document.getElementById("voiceButton");
const messages = document.getElementById("messages");


// المتغيرات
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let isRecording = false;


// بدء التسجيل
async function startRecording(){

    if(isRecording) return;


    try {

        audioStream =
        await navigator.mediaDevices.getUserMedia({
            audio:true
        });


        mediaRecorder =
        new MediaRecorder(audioStream);


        audioChunks = [];


        mediaRecorder.ondataavailable = (event)=>{

            if(event.data.size > 0){

                audioChunks.push(event.data);

            }

        };


        mediaRecorder.onstop = async ()=>{


            const audioBlob =
            new Blob(
                audioChunks,
                {
                    type:"audio/webm"
                }
            );


            // تحويل الصوت إلى Base64
            const reader =
            new FileReader();


            reader.readAsDataURL(audioBlob);


            reader.onloadend = async ()=>{


                const audioBase64 =
                reader.result;



                // إظهار الصوت عند المرسل
                addVoiceMessage(audioBase64);



                // حفظ الصوت في Firestore
                await addDoc(
                    collection(db,"messages"),
                    {

                        type:"voice",

                        audio: audioBase64,

                        senderId:"000001",

                        createdAt:
                        serverTimestamp()

                    }
                );


            };


        };


        mediaRecorder.start();


        isRecording = true;


        voiceButton.textContent="🔴";

        voiceButton.classList.add(
            "recording"
        );


    }

    catch(error){

        console.error(error);

        alert(
            "لم يتم السماح بالميكروفون"
        );

    }

}




// إيقاف التسجيل
function stopRecording(){


    if(!isRecording) return;



    mediaRecorder.stop();



    audioStream
    .getTracks()
    .forEach(track=>{

        track.stop();

    });



    isRecording=false;



    voiceButton.textContent="🎤";


    voiceButton.classList.remove(
        "recording"
    );


}





// إضافة رسالة صوتية للمحادثة
function addVoiceMessage(audioURL){


    const box =
    document.createElement("div");


    box.className =
    "message mine";



    const audio =
    document.createElement("audio");



    audio.controls = true;


    audio.src = audioURL;



    audio.style.width =
    "230px";



    box.appendChild(audio);



    messages.appendChild(box);



    messages.scrollTop =
    messages.scrollHeight;


}





// ضغط الزر
voiceButton.addEventListener(
"pointerdown",
()=>{

    startRecording();

});




// رفع الإصبع
voiceButton.addEventListener(
"pointerup",
()=>{

    stopRecording();

});




// إذا خرج الإصبع من الزر
voiceButton.addEventListener(
"pointerleave",
()=>{

    stopRecording();

});
