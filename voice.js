import {
  collection,
  addDoc,
  serverTimestamp
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


const voiceButton =
  document.getElementById("voiceButton");


let recorder = null;
let stream = null;
let chunks = [];

let isRecording = false;
let starting = false;
let stopRequested = false;


// ==========================================
// بدء التسجيل عند الضغط
// ==========================================

voiceButton.addEventListener(
  "pointerdown",
  async (event) => {

    event.preventDefault();

    if (isRecording || starting)
      return;

    starting = true;

    try {

      await startRecording();

    } catch (error) {

      console.error(
        "Microphone error:",
        error
      );

      stopMicrophone();

      resetVoice();

      alert(
        "لم يتم السماح بالميكروفون"
      );

    } finally {

      starting = false;

    }

  }
);


// ==========================================
// رفع الإصبع = إيقاف
// ==========================================

voiceButton.addEventListener(
  "pointerup",
  (event) => {

    event.preventDefault();

    stopRecording();

  }
);


// ==========================================
// إذا سحب المستخدم إصبعه من الزر
// ==========================================

voiceButton.addEventListener(
  "pointercancel",
  () => {

    stopRecording();

  }
);


// ==========================================
// إذا خرج المؤشر من الزر أثناء الضغط
// ==========================================

voiceButton.addEventListener(
  "lostpointercapture",
  () => {

    if (isRecording) {

      stopRecording();

    }

  }
);


// ==========================================
// بدء التسجيل
// ==========================================

async function startRecording() {

  if (
    !window.storage ||
    !window.chatDB ||
    !window.chatID ||
    !window.chatUser ||
    !window.chatFriend
  ) {

    throw new Error(
      "Firebase غير جاهز"
    );

  }


  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    throw new Error(
      "المتصفح لا يدعم الميكروفون"
    );

  }


  stream =
    await navigator.mediaDevices.getUserMedia(
      {
        audio: true
      }
    );


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


  recorder =
    mimeType
      ?
      new MediaRecorder(
        stream,
        {
          mimeType: mimeType
        }
      )
      :
      new MediaRecorder(stream);


  chunks = [];

  stopRequested = false;


  recorder.ondataavailable =
    (event) => {

      if (
        event.data &&
        event.data.size > 0
      ) {

        chunks.push(
          event.data
        );

      }

    };


  recorder.onstop =
    () => {

      finishRecording();

    };


  recorder.start();


  isRecording = true;


  // شكل زر التسجيل
  voiceButton.innerHTML =
    "🔴";


  voiceButton.classList.add(
    "recording"
  );


  console.log(
    "بدأ التسجيل"
  );

}


// ==========================================
// إيقاف التسجيل
// ==========================================

function stopRecording() {

  if (!isRecording)
    return;


  if (stopRequested)
    return;


  stopRequested = true;


  console.log(
    "إيقاف التسجيل..."
  );


  if (
    recorder &&
    recorder.state !== "inactive"
  ) {

    recorder.stop();

  }

}


// ==========================================
// إنهاء التسجيل وإرساله
// ==========================================

async function finishRecording() {

  try {

    // إيقاف الميكروفون
    stopMicrophone();


    if (
      !chunks ||
      chunks.length === 0
    ) {

      throw new Error(
        "لم يتم تسجيل أي صوت"
      );

    }


    const mime =
      recorder &&
      recorder.mimeType
        ?
        recorder.mimeType
        :
        "audio/webm";


    const blob =
      new Blob(
        chunks,
        {
          type: mime
        }
      );


    if (blob.size === 0) {

      throw new Error(
        "ملف الصوت فارغ"
      );

    }


    console.log(
      "حجم التسجيل:",
      blob.size
    );


    // ======================================
    // إظهار الصوت فوراً في الدردشة
    // ======================================

    const localURL =
      URL.createObjectURL(
        blob
      );


    showVoiceMessage(
      localURL
    );


    // ======================================
    // رفع الصوت إلى Firebase
    // ======================================

    const extension =
      mime.includes("webm")
        ?
        "webm"
        :
        "audio";


    const fileName =
      "voices/" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2) +
      "." +
      extension;


    const voiceRef =
      ref(
        window.storage,
        fileName
      );


    await uploadBytes(
      voiceRef,
      blob
    );


    const url =
      await getDownloadURL(
        voiceRef
      );


    console.log(
      "تم رفع التسجيل"
    );


    // ======================================
    // حفظ الرسالة في Firestore
    // ======================================

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
      "Voice error:",
      error
    );

    alert(
      "حدث خطأ أثناء إرسال التسجيل"
    );

  }

  finally {

    resetVoice();

  }

}


// ==========================================
// إظهار التسجيل مباشرة في الدردشة
// ==========================================

function showVoiceMessage(url) {

  const messages =
    document.getElementById(
      "messages"
    );


  if (!messages)
    return;


  // إزالة رسالة "ابدأ المحادثة"
  const empty =
    messages.querySelector(
      ".empty"
    );


  if (empty) {

    empty.remove();

  }


  const box =
    document.createElement(
      "div"
    );


  box.className =
    "message mine";


  const audio =
    document.createElement(
      "audio"
    );


  audio.controls = true;

  audio.preload = "metadata";

  audio.src = url;


  audio.style.width =
    "230px";

  audio.style.maxWidth =
    "100%";


  box.appendChild(
    audio
  );


  const label =
    document.createElement(
      "span"
    );


  label.textContent =
    "🎤 رسالة صوتية";


  label.style.display =
    "block";


  label.style.fontSize =
    "12px";


  label.style.marginTop =
    "5px";


  box.appendChild(
    label
  );


  messages.appendChild(
    box
  );


  messages.scrollTop =
    messages.scrollHeight;

}


// ==========================================
// إيقاف الميكروفون
// ==========================================

function stopMicrophone() {

  if (!stream)
    return;


  stream
    .getTracks()
    .forEach(
      track => {

        track.stop();

      }
    );


  stream = null;

}


// ==========================================
// إعادة زر الميكروفون
// ==========================================

function resetVoice() {

  stopMicrophone();


  recorder = null;

  chunks = [];

  isRecording = false;

  starting = false;

  stopRequested = false;


  voiceButton.innerHTML =
    "🎤";


  voiceButton.classList.remove(
    "recording"
  );

}
