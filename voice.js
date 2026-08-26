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
let timer = null;
let seconds = 0;

let stopRequested = false;



// ========================================
// بدء التسجيل
// ========================================

voiceButton.addEventListener(
  "pointerdown",
  async (event) => {

    event.preventDefault();

    if (isRecording)
      return;


    try {

      if (
        voiceButton.setPointerCapture &&
        event.pointerId !== undefined
      ) {

        voiceButton.setPointerCapture(
          event.pointerId
        );

      }


      await startRecording();

    }

    catch (error) {

      console.error(
        "Microphone error:",
        error
      );

      resetVoice();

      alert(
        "لم يتم السماح بالميكروفون"
      );

    }

  }
);



// ========================================
// تشغيل التسجيل
// ========================================

async function startRecording() {

  if (
    !window.storage ||
    !window.chatDB ||
    !window.chatID ||
    !window.chatUser ||
    !window.chatFriend
  ) {

    console.error(
      "Firebase variables missing"
    );

    return;

  }


  stream =
    await navigator.mediaDevices.getUserMedia(
      {
        audio: true
      }
    );


  // اختيار صيغة الصوت المدعومة
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
    async () => {

      await finishRecording();

    };



  recorder.start(100);


  isRecording = true;

  stopRequested = false;

  seconds = 0;


  voiceButton.innerHTML =
    "🔴 0s";


  timer =
    setInterval(
      () => {

        seconds++;

        voiceButton.innerHTML =
          "🔴 " +
          seconds +
          "s";

      },
      1000
    );

}



// ========================================
// رفع الإصبع = إيقاف التسجيل
// ========================================

document.addEventListener(
  "pointerup",
  stopRecording
);


document.addEventListener(
  "pointercancel",
  stopRecording
);


document.addEventListener(
  "touchend",
  stopRecording
);



function stopRecording() {

  if (!isRecording)
    return;


  if (stopRequested)
    return;


  stopRequested = true;


  if (
    recorder &&
    recorder.state !== "inactive"
  ) {

    recorder.stop();

  }

}



// ========================================
// إنهاء التسجيل بعد MediaRecorder.stop()
// ========================================

async function finishRecording() {

  try {

    clearInterval(timer);

    timer = null;


    // ننتظر لحظة حتى تصل آخر قطعة صوت
    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          100
        )
    );


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


    console.log(
      "Voice size:",
      blob.size
    );


    if (blob.size === 0) {

      throw new Error(
        "ملف الصوت فارغ"
      );

    }



    // ====================================
    // رفع الصوت إلى Firebase Storage
    // ====================================

    const extension =
      mime.includes("webm")
        ?
        "webm"
        :
        "audio";


    const voiceRef =
      ref(
        window.storage,
        "voices/" +
        Date.now() +
        "." +
        extension
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
      "Voice URL:",
      url
    );



    // ====================================
    // حفظ الرسالة
    // ====================================

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
      "Voice send error:",
      error
    );


    alert(
      "حدث خطأ أثناء إرسال التسجيل"
    );

  }


  finally {


    // إيقاف الميكروفون
    if (stream) {

      stream
        .getTracks()
        .forEach(
          track => track.stop()
        );

    }


    resetVoice();

  }

}



// ========================================
// إعادة الزر للوضع الطبيعي
// ========================================

function resetVoice() {

  if (timer) {

    clearInterval(timer);

  }


  timer = null;


  if (stream) {

    stream
      .getTracks()
      .forEach(
        track => {

          if (
            track.readyState !== "ended"
          ) {

            track.stop();

          }

        }
      );

  }


  recorder = null;

  stream = null;

  chunks = [];

  isRecording = false;

  stopRequested = false;

  seconds = 0;


  voiceButton.innerHTML =
    "🎤";

}
