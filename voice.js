import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


const voiceButton = document.getElementById("voiceButton");

let recorder = null;
let stream = null;
let chunks = [];
let isRecording = false;
let isProcessing = false;


// ================================
// الضغط على زر الميكروفون
// ضغطة = بدء
// ضغطة ثانية = إيقاف
// ================================

voiceButton.addEventListener("click", async () => {

  if (isProcessing) {
    return;
  }


  // إذا كان يسجل → أوقف التسجيل
  if (isRecording) {

    stopRecording();

    return;
  }


  // إذا لم يكن يسجل → ابدأ التسجيل
  await startRecording();

});



// ================================
// بدء التسجيل
// ================================

async function startRecording() {

  if (isRecording) {
    return;
  }


  if (
    !window.storage ||
    !window.chatDB ||
    !window.chatID ||
    !window.chatUser ||
    !window.chatFriend
  ) {

    console.error("Firebase variables missing");

    alert("الدردشة لم تجهز بعد");

    return;
  }


  try {

    stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });


    let options = {};


    // اختيار نوع صوت مدعوم
    if (
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ) {

      options.mimeType = "audio/webm;codecs=opus";

    }
    else if (
      MediaRecorder.isTypeSupported("audio/webm")
    ) {

      options.mimeType = "audio/webm";

    }


    recorder = new MediaRecorder(
      stream,
      options
    );


    chunks = [];


    recorder.ondataavailable = (event) => {

      if (event.data && event.data.size > 0) {

        chunks.push(event.data);

      }

    };


    recorder.onerror = (event) => {

      console.error(
        "Recorder error:",
        event.error
      );

      cleanupRecorder();

      alert("حدث خطأ أثناء التسجيل");

    };


    recorder.onstop = async () => {

      await uploadVoice();

    };


    recorder.start();


    isRecording = true;


    voiceButton.textContent = "⏹️";

    voiceButton.classList.add("recording");


    console.log("بدأ التسجيل");

  }

  catch (error) {

    console.error(
      "Microphone error:",
      error
    );


    cleanupRecorder();


    alert(
      "لم يتم السماح بالميكروفون"
    );

  }

}



// ================================
// إيقاف التسجيل
// ================================

function stopRecording() {

  if (!recorder || !isRecording) {
    return;
  }


  isRecording = false;

  isProcessing = true;


  voiceButton.textContent = "⏳";


  voiceButton.classList.remove(
    "recording"
  );


  try {

    if (
      recorder.state !== "inactive"
    ) {

      recorder.stop();

    }

  }

  catch (error) {

    console.error(
      "Stop recorder error:",
      error
    );

    cleanupRecorder();

    isProcessing = false;

  }

}



// ================================
// رفع الصوت إلى Firebase
// ================================

async function uploadVoice() {

  try {

    if (chunks.length === 0) {

      console.log(
        "لا يوجد تسجيل"
      );

      cleanupRecorder();

      isProcessing = false;

      return;

    }


    const mimeType =
      recorder?.mimeType ||
      "audio/webm";


    const blob = new Blob(
      chunks,
      {
        type: mimeType
      }
    );


    console.log(
      "حجم الصوت:",
      blob.size
    );


    if (blob.size === 0) {

      throw new Error(
        "الصوت فارغ"
      );

    }


    // اسم فريد للصوت
    const fileName =
      "voices/" +
      window.chatUser.uid +
      "/" +
      Date.now() +
      ".webm";


    const voiceRef =
      ref(
        window.storage,
        fileName
      );


    // رفع الملف
    await uploadBytes(
      voiceRef,
      blob
    );


    console.log(
      "تم رفع الصوت"
    );


    // الحصول على الرابط
    const url =
      await getDownloadURL(
        voiceRef
      );


    console.log(
      "رابط الصوت:",
      url
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

        type: "voice",

        audio: url,

        senderId:
          window.chatUser.uid,

        receiverId:
          window.chatFriend.uid,

        createdAt:
          serverTimestamp()

      }

    );


    console.log(
      "تم إرسال الرسالة الصوتية"
    );

  }

  catch (error) {

    console.error(
      "Voice upload error:",
      error
    );


    alert(
      "حدث خطأ أثناء إرسال الرسالة الصوتية"
    );

  }


  cleanupRecorder();

  isProcessing = false;

}



// ================================
// تنظيف التسجيل
// ================================

function cleanupRecorder() {


  if (stream) {

    stream
      .getTracks()
      .forEach(
        track => {

          track.stop();

        }
      );

  }


  if (recorder) {

    recorder.ondataavailable = null;
    recorder.onstop = null;
    recorder.onerror = null;

  }


  recorder = null;

  stream = null;

  chunks = [];

  isRecording = false;


  voiceButton.textContent = "🎤";

  voiceButton.classList.remove(
    "recording"
  );

}
