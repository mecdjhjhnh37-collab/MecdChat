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
let fingerDown = false;


// =====================================================
// الضغط على الميكروفون
// =====================================================

voiceButton.addEventListener(
  "pointerdown",
  async (event) => {

    event.preventDefault();

    fingerDown = true;

    if (isRecording || isStarting) {
      return;
    }

    isStarting = true;


    try {

      await startRecording();

    }

    catch (error) {

      console.error(
        "Microphone error:",
        error
      );

      stopMicrophone();

      resetVoice();

      alert(
        "لم يتم السماح بالميكروفون"
      );

      return;

    }

    finally {

      isStarting = false;

    }


    // إذا رفع المستخدم إصبعه
    // قبل انتهاء تشغيل الميكروفون
    if (!fingerDown && isRecording) {

      stopRecording();

    }

  }
);


// =====================================================
// رفع الإصبع من أي مكان
// =====================================================

document.addEventListener(
  "pointerup",
  () => {

    if (!fingerDown) {
      return;
    }

    fingerDown = false;

    stopRecording();

  }
);


// =====================================================
// إذا ألغى الهاتف اللمس
// =====================================================

document.addEventListener(
  "pointercancel",
  () => {

    fingerDown = false;

    stopRecording();

  }
);


// =====================================================
// بدء التسجيل
// =====================================================

async function startRecording() {

  // التأكد من جاهزية Firebase
  if (
    !window.storage ||
    !window.chatDB ||
    !window.chatID ||
    !window.chatUser ||
    !window.chatFriend
  ) {

    throw new Error(
      "Firebase chat variables are missing"
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


  // ===================================================
  // اختيار صيغة الصوت
  // ===================================================

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


  // ===================================================
  // استقبال أجزاء الصوت
  // ===================================================

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


  // ===================================================
  // عند إيقاف MediaRecorder
  // ===================================================

  mediaRecorder.onstop =
    async () => {

      await finishRecording();

    };


  // ===================================================
  // بدء التسجيل
  // ===================================================

  mediaRecorder.start();


  isRecording = true;


  // الزر يصبح أحمر
  voiceButton.textContent =
    "🔴";


  voiceButton.classList.add(
    "recording"
  );


  console.log(
    "🎤 Recording started"
  );

}


// =====================================================
// إيقاف التسجيل
// =====================================================

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
    "⏹️ Recording stopped"
  );


  mediaRecorder.stop();

}


// =====================================================
// إنهاء التسجيل
// =====================================================

async function finishRecording() {

  try {

    // -----------------------------------------------
    // التأكد من وجود الصوت
    // -----------------------------------------------

    if (
      !audioChunks ||
      audioChunks.length === 0
    ) {

      throw new Error(
        "No audio data"
      );

    }


    // -----------------------------------------------
    // نوع الملف
    // -----------------------------------------------

    const mimeType =
      mediaRecorder &&
      mediaRecorder.mimeType
        ? mediaRecorder.mimeType
        : "audio/webm";


    // -----------------------------------------------
    // إنشاء Blob
    // -----------------------------------------------

    const blob =
      new Blob(
        audioChunks,
        {
          type: mimeType
        }
      );


    if (blob.size === 0) {

      throw new Error(
        "Audio blob is empty"
      );

    }


    console.log(
      "🎵 Audio size:",
      blob.size
    );


    // =================================================
    // رفع الصوت إلى Firebase Storage
    // =================================================

    const fileName =
      "voices/" +
      window.chatID +
      "/" +
      window.chatUser.uid +
      "_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2) +
      ".webm";


    console.log(
      "⬆️ Uploading voice..."
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


    // =================================================
    // الحصول على رابط الصوت
    // =================================================

    const downloadURL =
      await getDownloadURL(
        voiceRef
      );


    console.log(
      "✅ Voice uploaded"
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
      "✅ Voice message saved"
    );

  }

  catch (error) {

    console.error(
      "❌ Voice error:",
      error
    );


    alert(
      "حدث خطأ أثناء إرسال الرسالة الصوتية"
    );

  }

  finally {

    stopMicrophone();

    resetVoice();

  }

}


// =====================================================
// إيقاف الميكروفون
// =====================================================

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


// =====================================================
// إعادة زر الميكروفون
// =====================================================

function resetVoice() {

  stopMicrophone();


  mediaRecorder = null;

  audioChunks = [];

  isRecording = false;

  isStarting = false;

  fingerDown = false;


  voiceButton.textContent =
    "🎤";


  voiceButton.classList.remove(
    "recording"
  );

}
