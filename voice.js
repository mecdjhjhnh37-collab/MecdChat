let recorder;
let audioChunks = [];

const voiceBtn = document.getElementById("voiceRecordBtn");

voiceBtn.onclick = async () => {

    if (!recorder || recorder.state === "inactive") {

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        recorder = new MediaRecorder(stream);

        audioChunks = [];

        recorder.ondataavailable = e => {
            audioChunks.push(e.data);
        };

        recorder.onstop = () => {

            const audio = new Blob(audioChunks, {
                type: "audio/webm"
            });

            const url = URL.createObjectURL(audio);

            const player = document.createElement("audio");
            player.controls = true;
            player.src = url;

            document.body.appendChild(player);
        };

        recorder.start();

        voiceBtn.innerHTML = "⏹️";

    } else {

        recorder.stop();

        voiceBtn.innerHTML = "🎤";
    }
};
