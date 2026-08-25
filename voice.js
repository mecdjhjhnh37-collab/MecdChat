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


        mediaRecorder.onstop = ()=>{


            const audioBlob =
            new Blob(
                audioChunks,
                {
                    type:"audio/webm"
                }
            );


            saveVoiceToFirestore(audioBlob);


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



// حفظ الصوت في Firestore
async function saveVoiceToFirestore(blob){


    const reader = new FileReader();


    reader.onloadend = async ()=>{


        const base64Audio =
        reader.result;


        try{


            await addDoc(

                collection(
                    db,
                    "chats",
                    chatID,
                    "messages"
                ),

                {

                    audioData: base64Audio,

                    senderId:
                    currentUser.uid,


                    createdAt:
                    serverTimestamp()

                }

            );


            addVoiceMessage(base64Audio);


        }catch(error){

            console.error(
                "Voice save error:",
                error
            );

            alert("فشل حفظ الصوت");

        }


    };


    reader.readAsDataURL(blob);


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


    voiceButton.classList.remove("recording");


}





// عرض الصوت داخل المحادثة
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




// سحب الإصبع خارج الزر
voiceButton.addEventListener(
"pointerleave",
()=>{

    stopRecording();

});
