const voiceButton = document.getElementById("voiceButton");
const messages = document.getElementById("messages");

let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let isRecording = false;


// بدء التسجيل
async function startRecording(){

    if(isRecording) return;

    try{

        audioStream = await navigator.mediaDevices.getUserMedia({
            audio:true
        });


        mediaRecorder = new MediaRecorder(audioStream);

        audioChunks = [];


        mediaRecorder.ondataavailable = (event)=>{

            if(event.data.size > 0){

                audioChunks.push(event.data);

            }

        };


        mediaRecorder.onstop = ()=>{

            const audioBlob = new Blob(
                audioChunks,
                {
                    type:"audio/webm"
                }
            );


            const audioURL =
            URL.createObjectURL(audioBlob);


            addVoiceMessage(audioURL);


        };


        mediaRecorder.start();

        isRecording = true;

        voiceButton.textContent="🔴";

        voiceButton.classList.add("recording");


    }catch(error){

        console.error(error);

        alert("لم يتم السماح بالميكروفون");

    }

}



// إيقاف التسجيل
function stopRecording(){

    if(!isRecording) return;


    mediaRecorder.stop();


    audioStream.getTracks().forEach(track=>{

        track.stop();

    });


    isRecording=false;


    voiceButton.textContent="🎤";

    voiceButton.classList.remove("recording");


}



// إضافة الصوت للمحادثة
function addVoiceMessage(url){


    const box = document.createElement("div");


    box.className =
    "message mine";


    const audio =
    document.createElement("audio");


    audio.controls = true;

    audio.src = url;


    audio.style.width="230px";


    box.appendChild(audio);


    messages.appendChild(box);


    messages.scrollTop =
    messages.scrollHeight;


}



// ضغط مطول
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



// إذا سحب إصبعه خارج الزر
voiceButton.addEventListener(
"pointerleave",
()=>{

    stopRecording();

});
