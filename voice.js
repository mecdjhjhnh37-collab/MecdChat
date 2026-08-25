const voiceButton = document.getElementById("voiceButton");

let recorder;
let stream;
let chunks = [];


voiceButton.addEventListener("pointerdown", async ()=>{

    stream = await navigator.mediaDevices.getUserMedia({
        audio:true
    });


    recorder = new MediaRecorder(stream);

    chunks = [];


    recorder.ondataavailable = (e)=>{

        chunks.push(e.data);

    };


    recorder.start();


    voiceButton.classList.add("recording");

    voiceButton.textContent = "🔴";

});


voiceButton.addEventListener("pointerup", ()=>{


    if(!recorder) return;


    recorder.stop();


    stream.getTracks().forEach(track=>{

        track.stop();

    });


    voiceButton.classList.remove("recording");

    voiceButton.textContent = "🎤";


});
