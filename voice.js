const voiceButton = document.getElementById("voiceButton");

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

voiceButton.addEventListener("click", async () => {

    if (!isRecording) {

        try {

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });

            mediaRecorder = new MediaRecorder(stream);

            audioChunks = [];

            mediaRecorder.addEventListener("dataavailable", event => {

                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }

            });

            mediaRecorder.addEventListener("stop", () => {

                const audioBlob = new Blob(
                    audioChunks,
                    { type: "audio/webm" }
                );

                const audioURL = URL.createObjectURL(audioBlob);

                const audio = document.createElement("audio");

                audio.controls = true;
                audio.src = audioURL;

                audio.style.maxWidth = "250px";

                messages.appendChild(audio);

                messages.scrollTop = messages.scrollHeight;

            });

            mediaRecorder.start();

            isRecording = true;

            voiceButton.textContent = "⏹️";

            voiceButton.style.background = "#00e889";
            voiceButton.style.color = "#00150e";

        } catch (error) {

            console.error("Microphone error:", error);

            alert(
                "لم يتم السماح باستخدام الميكروفون."
            );

        }

    } else {

        mediaRecorder.stop();

        mediaRecorder.stream
            .getTracks()
            .forEach(track => track.stop());

        isRecording = false;

        voiceButton.textContent = "🎤";

        voiceButton.style.background = "";
        voiceButton.style.color = "";

    }

});
