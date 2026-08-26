voice.js

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


const voiceButton =
  document.getElementById("voiceButton");


let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];

let isRecording = false;
let isStarting = false;
let stopRequested = false;


// ==================================================
// الضغط على زر الميكروفون
// ==================================================

voiceButton.addEventListener(
  "pointerdown",
  async (event) => {

    event.preventDefault();

    if (isRecording || isStarting) {
      return;
    }

    isStarting = true;
    stopRequested = false;


    // تثبيت الإصبع على الزر
    try {

      voiceButton.setPointerCapture(
        event.pointerId
      );

    } catch (error) {

      console.log(
        "Pointer capture error:",
        error
      );

    }


    try {

      await startRecording();

    } catch (error) {

      console.error(
        "Start recording error:",
        error
      );

      stopMicrophone();

      resetVoice();

      alert(
        "لم يتم السماح بالميكروفون"
      );

    }


    isStarting = false;


    // إذا رفع المستخدم إصبعه أثناء تشغيل الميكروفون
    if (
      stopRequested &&
      isRecording
    ) {

      stopRecording();

    }

  }
);


// ==================================================
// رفع الإصبع = إنهاء التسجيل
// ==================================================

voiceButton.addEventListener(
  "pointerup",
  (event) => {

    event.preventDefault();

    stopRequested = true;

    stopRecording();

  }
);


// ==================================================
// إلغاء اللمس
// ==================================================

voiceButton.addEventListener(
  "pointercancel",
  () => {

    stopRequested = true;

    stopRecording();

  }
);


// ==================================================
// فقدان التحكم بالمؤشر
// ==================================================

voiceButton.addEventListener(
  "lostpointercapture",
  () => {

    if (isRecording) {

      stopRequested = true;

      stopRecording();

    }

  }
);


// ==================================================
// بدء التسجيل
// ==================================================

async function startRecording() {

  // التأكد أن Firebase جاهز
  if (
    !window.storage ||
    !window.chatDB ||
    !window.chatID ||
    !window.chatUser ||
    !window.chatFriend
  ) {

    throw new Error(
      "Firebase variables are missing"
    );

  }


  // التأكد من دعم الميكروفون
  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    throw new Error(
      "Microphone is not supported"
    );

  }


  // تشغيل الميكروفون
  audioStream =
    await navigator.mediaDevices.getUserMedia({
      audio: true
    });


  // اختيار صيغة الصوت
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


  // إنشاء MediaRecorder
  if (mimeType) {

    mediaRecorder =
      new MediaRecorder(
        audioStream,
        {
          mimeType: mimeType
        }
      );

  }

  else {

    mediaRecorder =
      new MediaRecorder(
        audioStream
      );

  }


  audioChunks = [];


  // استقبال بيانات الصوت
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


  // عند انتهاء التسجيل
  mediaRecorder.onstop =
    async () => {

      await finishRecording();

    };


  // بدء التسجيل
  mediaRecorder.start();


  isRecording = true;


  voiceButton.textContent = "🔴";


  voiceButton.classList.add(
    "recording"
  );


  console.log(
    "🎤 بدأ التسجيل"
  );

}


// ==================================================
// إيقاف التسجيل
// ==================================================

function stopRecording() {

  if (!isRecording) {
    return;
  }


  if (mediaRecorder) {

    if (
      mediaRecorder.state !== "inactive"
    ) {

      console.log(
        "⏹️ إيقاف التسجيل"
      );

      mediaRecorder.stop();

    }

  }

}


// ==================================================
// إنهاء التسجيل ورفعه وحفظه
// ==================================================

async function finishRecording() {

  try {

    // تحديد نوع التسجيل
    const mimeType =
      mediaRecorder &&
      mediaRecorder.mimeType
        ? mediaRecorder.mimeType
        : "audio/webm";


    // إنشاء ملف الصوت
    const blob =
      new Blob(
        audioChunks,
        {
          type: mimeType
        }
      );


    console.log(
      "🎵 حجم الصوت:",
      blob.size
    );


    if (blob.size === 0) {

      throw new Error(
        "Audio file is empty"
      );

    }


    // ==================================================
    // رفع الصوت إلى Firebase Storage
    // ==================================================

    const fileName =
      "voices/" +
      window.chatUser.uid +
      "/" +
      window.chatID +
      "/" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2) +
      ".webm";


    console.log(
      "⬆️ رفع الصوت..."
    );


    const voiceRef =
      ref(
        window.storage,
        fileName
      );


    await uploadBytes(
      voiceRef,
      blob,
      {
        contentType: "audio/webm"
      }
    );


    // الحصول على الرابط الدائم
    const downloadURL =
      await getDownloadURL(
        voiceRef
      );


    console.log(
      "✅ تم رفع الصوت"
    );


    // ==================================================
    // حفظ الرسالة في Firestore
    // ==================================================

    await addDoc(

      collection(
        window.chatDB,
        "chats",
        window.chatID,
        "messages"
      ),

      {

        type: "voice",

        audio: downloadURL,

        senderId:
          window.chatUser.uid,

        receiverId:
          window.chatFriend.uid,

        createdAt:
          serverTimestamp()

      }

    );


    console.log(
      "✅ تم حفظ الرسالة الصوتية"
    );

  }

  catch (error) {

    console.error(
      "❌ Voice error:",
      error
    );


    alert(
      "حدث خطأ أثناء إرسال التسجيل"
    );

  }

  finally {

    stopMicrophone();

    resetVoice();

  }

}


// ==================================================
// إيقاف الميكروفون
// ==================================================

function stopMicrophone() {

  if (!audioStream) {
    return;
  }


  audioStream
    .getTracks()
    .forEach(
      (track) => {

        track.stop();

      }
    );


  audioStream = null;

}


// ==================================================
// إعادة زر الميكروفون
// ==================================================

function resetVoice() {

  stopMicrophone();


  mediaRecorder = null;

  audioChunks = [];

  isRecording = false;

  isStarting = false;

  stopRequested = false;


  voiceButton.textContent =
    "🎤";


  voiceButton.classList.remove(
    "recording"
  );

}
