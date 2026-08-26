// ======================================================
// voice.js
// تسجيل صوت وحفظه في Firestore فقط
// ======================================================

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const voiceButton =
  document.getElementById("voiceButton");


if (!voiceButton) {

  console.error("❌ voiceButton غير موجود");

} else {


  voiceButton.style.touchAction = "none";
  voiceButton.style.userSelect = "none";


  let mediaRecorder = null;

  let audioStream = null;

  let audioChunks = [];

  let isRecording = false;

  let isStarting = false;

  let stopRequested = false;

  let sendingVoice = false;


  // ====================================================
  // الضغط على الميكروفون
  // ====================================================

  voiceButton.addEventListener(
    "pointerdown",
    async (event) => {

      event.preventDefault();


      try {

        voiceButton.setPointerCapture(
          event.pointerId
        );

      } catch (e) {}


      if (
        isRecording ||
        isStarting ||
        sendingVoice
      ) {

        return;

      }


      isStarting = true;
      stopRequested = false;


      voiceButton.textContent = "⏳";


      try {

        await startRecording();


      } catch (error) {

        console.error(
          "❌ Start voice error:",
          error
        );


        resetVoice();


        if (
          error.name === "NotAllowedError"
        ) {

          alert(
            "⚠️ اسمح للموقع باستخدام الميكروفون."
          );

        } else {

          alert(
            "❌ تعذر تشغيل الميكروفون."
          );

        }

      }


      isStarting = false;


      // إذا المستخدم رفع إصبعه
      // أثناء انتظار تشغيل الميكروفون

      if (
        stopRequested &&
        isRecording
      ) {

        stopRecording();

      }

    }
  );


  // ====================================================
  // رفع الإصبع
  // ====================================================

  voiceButton.addEventListener(
    "pointerup",
    (event) => {

      event.preventDefault();


      console.log(
        "☝️ رفع الإصبع"
      );


      if (isStarting) {

        stopRequested = true;

        return;

      }


      if (isRecording) {

        stopRecording();

      }

    }
  );


  // ====================================================
  // إلغاء اللمس
  // ====================================================

  voiceButton.addEventListener(
    "pointercancel",
    () => {

      stopRequested = true;

      stopRecording();

    }
  );


  // ====================================================
  // بدء التسجيل
  // ====================================================

  async function startRecording() {


    if (
      !window.chatDB ||
      !window.chatID ||
      !window.chatUser ||
      !window.chatFriend
    ) {

      throw new Error(
        "Firestore variables missing"
      );

    }


    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      throw new Error(
        "Microphone not supported"
      );

    }


    if (
      typeof MediaRecorder === "undefined"
    ) {

      throw new Error(
        "MediaRecorder not supported"
      );

    }


    // تشغيل الميكروفون

    audioStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true
      });


    // تحديد نوع الصوت

    let mimeType = "";


    if (
      MediaRecorder.isTypeSupported(
        "audio/webm;codecs=opus"
      )
    ) {

      mimeType =
        "audio/webm;codecs=opus";

    }

    else if (
      MediaRecorder.isTypeSupported(
        "audio/webm"
      )
    ) {

      mimeType =
        "audio/webm";

    }

    else if (
      MediaRecorder.isTypeSupported(
        "audio/mp4"
      )
    ) {

      mimeType =
        "audio/mp4";

    }


    // إنشاء Recorder

    if (mimeType) {

      mediaRecorder =
        new MediaRecorder(
          audioStream,
          {
            mimeType: mimeType
          }
        );

    } else {

      mediaRecorder =
        new MediaRecorder(
          audioStream
        );

    }


    audioChunks = [];


    // استقبال أجزاء الصوت

    mediaRecorder.ondataavailable =
      (event) => {

        if (
          event.data &&
          event.data.size > 0
        ) {

          audioChunks.push(
            event.data
          );

        }

      };


    // عند التوقف

    mediaRecorder.onstop =
      async () => {

        console.log(
          "⏹️ انتهى التسجيل"
        );


        await finishRecording();

      };


    mediaRecorder.onerror =
      (event) => {

        console.error(
          "❌ Recorder error:",
          event.error
        );

      };


    // بدء التسجيل

    mediaRecorder.start(100);


    isRecording = true;


    voiceButton.textContent = "🔴";

    voiceButton.classList.add(
      "recording"
    );


    console.log(
      "🔴 التسجيل يعمل"
    );

  }


  // ====================================================
  // إيقاف التسجيل
  // ====================================================

  function stopRecording() {


    if (!isRecording) {

      return;

    }


    if (!mediaRecorder) {

      return;

    }


    if (
      mediaRecorder.state === "inactive"
    ) {

      return;

    }


    console.log(
      "⏹️ إيقاف التسجيل..."
    );


    mediaRecorder.stop();

  }


  // ====================================================
  // تحويل Blob إلى Base64
  // ====================================================

  function blobToDataURL(blob) {

    return new Promise(
      (resolve, reject) => {

        const reader =
          new FileReader();


        reader.onloadend =
          () => {

            resolve(
              reader.result
            );

          };


        reader.onerror =
          reject;


        reader.readAsDataURL(blob);

      }
    );

  }


  // ====================================================
  // إرسال الصوت إلى Firestore
  // ====================================================

  async function finishRecording() {


    if (sendingVoice) {

      return;

    }


    sendingVoice = true;


    voiceButton.textContent = "⬆️";


    try {


      // إيقاف الميكروفون

      stopMicrophone();


      // التأكد من وجود الصوت

      if (
        audioChunks.length === 0
      ) {

        throw new Error(
          "لم يتم تسجيل صوت"
        );

      }


      // إنشاء Blob

      const mimeType =
        mediaRecorder?.mimeType ||
        "audio/webm";


      const blob =
        new Blob(
          audioChunks,
          {
            type: mimeType
          }
        );


      console.log(
        "🎵 حجم التسجيل:",
        blob.size,
        "bytes"
      );


      // =================================================
      // حماية من تجاوز حجم Firestore
      // =================================================

      if (
        blob.size > 700000
      ) {

        alert(
          "⚠️ التسجيل طويل جدًا. حاول تسجيل صوت أقصر."
        );

        resetVoice();

        sendingVoice = false;

        return;

      }


      // =================================================
      // تحويل الصوت إلى Base64
      // =================================================

      const audioData =
        await blobToDataURL(
          blob
        );


      console.log(
        "✅ تم تحويل الصوت"
      );


      // =================================================
      // حفظ الرسالة في Firestore
      // =================================================

      await addDoc(

        collection(
          window.chatDB,
          "chats",
          window.chatID,
          "messages"
        ),

        {

          type:
            "voice",

          audio:
            audioData,

          senderId:
            window.chatUser.uid,

          receiverId:
            window.chatFriend.uid,

          createdAt:
            serverTimestamp()

        }

      );


      console.log(
        "✅ تم حفظ التسجيل في Firestore"
      );


    } catch (error) {


      console.error(
        "❌ Voice Firestore error:",
        error
      );


      alert(
        "❌ حدث خطأ أثناء حفظ التسجيل."
      );

    }


    resetVoice();

    sendingVoice = false;

  }


  // ====================================================
  // إيقاف الميكروفون
  // ====================================================

  function stopMicrophone() {


    if (!audioStream) {

      return;

    }


    audioStream
      .getTracks()
      .forEach(
        track => {

          try {

            track.stop();

          } catch (e) {}

        }
      );


    audioStream = null;

  }


  // ====================================================
  // إعادة الزر
  // ====================================================

  function resetVoice() {


    stopMicrophone();


    mediaRecorder = null;

    audioChunks = [];

    isRecording = false;

    isStarting = false;

    stopRequested = false;


    voiceButton.textContent = "🎤";


    voiceButton.classList.remove(
      "recording"
    );

  }


  // منع القائمة

  voiceButton.addEventListener(
    "contextmenu",
    event => {

      event.preventDefault();

    }
  );


  console.log(
    "🎤 voice.js Firestore جاهز"
  );

}
