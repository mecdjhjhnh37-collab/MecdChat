import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


// ======================================================
// زر الميكروفون
// ======================================================

const voiceButton =
  document.getElementById("voiceButton");


if (!voiceButton) {

  console.error("❌ voiceButton غير موجود");

} else {


  // منع مشاكل اللمس
  voiceButton.style.touchAction = "none";
  voiceButton.style.userSelect = "none";
  voiceButton.style.webkitUserSelect = "none";


  // ======================================================
  // المتغيرات
  // ======================================================

  let mediaRecorder = null;

  let audioStream = null;

  let audioChunks = [];

  let isRecording = false;

  let isStarting = false;

  let isSending = false;

  let pointerId = null;


  // ======================================================
  // إنشاء حالة التسجيل
  // ======================================================

  let statusBox =
    document.getElementById("voiceStatus");


  if (!statusBox) {

    statusBox =
      document.createElement("div");

    statusBox.id =
      "voiceStatus";

    statusBox.style.position =
      "fixed";

    statusBox.style.bottom =
      "72px";

    statusBox.style.left =
      "10px";

    statusBox.style.right =
      "10px";

    statusBox.style.padding =
      "9px";

    statusBox.style.background =
      "rgba(0,0,0,.88)";

    statusBox.style.color =
      "#00e889";

    statusBox.style.textAlign =
      "center";

    statusBox.style.fontSize =
      "13px";

    statusBox.style.borderRadius =
      "12px";

    statusBox.style.zIndex =
      "99999";

    statusBox.style.display =
      "none";

    document.body.appendChild(
      statusBox
    );

  }


  function status(text) {

    console.log(
      "🎤 VOICE:",
      text
    );

    statusBox.textContent =
      text;

    statusBox.style.display =
      "block";

  }


  function hideStatus() {

    statusBox.style.display =
      "none";

  }


  // ======================================================
  // الضغط على الميكروفون
  // ======================================================

  voiceButton.addEventListener(
    "pointerdown",
    async (event) => {

      event.preventDefault();

      if (
        isRecording ||
        isStarting ||
        isSending
      ) {

        return;

      }


      pointerId =
        event.pointerId;


      try {

        voiceButton.setPointerCapture(
          event.pointerId
        );

      } catch (error) {

        console.log(error);

      }


      isStarting = true;


      status(
        "🟡 جاري تشغيل الميكروفون..."
      );


      try {

        await startRecording();

      }

      catch (error) {

        console.error(
          "❌ Start error:",
          error
        );


        status(
          "❌ " +
          error.message
        );


        cleanup();


        if (
          error.name ===
          "NotAllowedError"
        ) {

          alert(
            "🎤 يجب السماح للموقع باستخدام الميكروفون."
          );

        } else {

          alert(
            "تعذر تشغيل الميكروفون:\n" +
            error.message
          );

        }

      }


      isStarting = false;

    }
  );


  // ======================================================
  // رفع الإصبع
  // ======================================================

  voiceButton.addEventListener(
    "pointerup",
    (event) => {

      event.preventDefault();


      if (
        pointerId !== null &&
        event.pointerId !== pointerId
      ) {

        return;

      }


      pointerId = null;


      if (isRecording) {

        status(
          "🟠 جاري إيقاف التسجيل..."
        );

        stopRecording();

      }

    }
  );


  // ======================================================
  // إلغاء اللمس
  // ======================================================

  voiceButton.addEventListener(
    "pointercancel",
    (event) => {

      event.preventDefault();

      pointerId = null;


      if (isRecording) {

        stopRecording();

      }

    }
  );


  // ======================================================
  // منع القائمة
  // ======================================================

  voiceButton.addEventListener(
    "contextmenu",
    (event) => {

      event.preventDefault();

    }
  );


  // ======================================================
  // بدء التسجيل
  // ======================================================

  async function startRecording() {


    // ----------------------------------------------
    // فحص Firebase
    // ----------------------------------------------

    if (!window.storage) {

      throw new Error(
        "Firebase Storage غير جاهز"
      );

    }


    if (!window.chatDB) {

      throw new Error(
        "Firestore غير جاهز"
      );

    }


    if (!window.chatID) {

      throw new Error(
        "chatID غير موجود"
      );

    }


    if (!window.chatUser) {

      throw new Error(
        "المستخدم غير موجود"
      );

    }


    if (!window.chatFriend) {

      throw new Error(
        "الصديق غير موجود"
      );

    }


    // ----------------------------------------------
    // فحص المتصفح
    // ----------------------------------------------

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      throw new Error(
        "المتصفح لا يدعم الميكروفون"
      );

    }


    if (
      typeof MediaRecorder ===
      "undefined"
    ) {

      throw new Error(
        "MediaRecorder غير مدعوم"
      );

    }


    // ----------------------------------------------
    // فتح الميكروفون
    // ----------------------------------------------

    audioStream =
      await navigator.mediaDevices.getUserMedia({

        audio: {

          echoCancellation: true,

          noiseSuppression: true,

          autoGainControl: true

        }

      });


    // ----------------------------------------------
    // اختيار صيغة الصوت
    // ----------------------------------------------

    let mimeType = "";


    const formats = [

      "audio/webm;codecs=opus",

      "audio/webm",

      "audio/mp4"

    ];


    for (
      const format of formats
    ) {

      if (
        MediaRecorder.isTypeSupported(
          format
        )
      ) {

        mimeType =
          format;

        break;

      }

    }


    console.log(
      "🎵 MIME:",
      mimeType
    );


    // ----------------------------------------------
    // إنشاء MediaRecorder
    // ----------------------------------------------

    if (mimeType) {

      mediaRecorder =
        new MediaRecorder(

          audioStream,

          {
            mimeType:
              mimeType
          }

        );

    } else {

      mediaRecorder =
        new MediaRecorder(
          audioStream
        );

    }


    audioChunks = [];


    // ----------------------------------------------
    // استقبال الصوت
    // ----------------------------------------------

    mediaRecorder.ondataavailable =
      (event) => {

        console.log(
          "📦 Audio chunk:",
          event.data.size
        );


        if (
          event.data &&
          event.data.size > 0
        ) {

          audioChunks.push(
            event.data
          );

        }

      };


    // ----------------------------------------------
    // انتهاء التسجيل
    // ----------------------------------------------

    mediaRecorder.onstop =
      async () => {

        console.log(
          "⏹️ MediaRecorder stopped"
        );


        await finishRecording();

      };


    // ----------------------------------------------
    // خطأ
    // ----------------------------------------------

    mediaRecorder.onerror =
      (event) => {

        console.error(
          "❌ Recorder error:",
          event.error
        );


        status(
          "❌ خطأ أثناء التسجيل"
        );

      };


    // ----------------------------------------------
    // بدء
    // ----------------------------------------------

    mediaRecorder.start(100);


    isRecording =
      true;


    voiceButton.textContent =
      "🔴";


    voiceButton.classList.add(
      "recording"
    );


    status(
      "🔴 جاري التسجيل... ارفع إصبعك للإرسال"
    );


    console.log(
      "🎤 بدأ التسجيل"
    );

  }


  // ======================================================
  // إيقاف التسجيل
  // ======================================================

  function stopRecording() {


    if (!isRecording) {

      return;

    }


    if (!mediaRecorder) {

      return;

    }


    if (
      mediaRecorder.state ===
      "inactive"
    ) {

      return;

    }


    console.log(
      "⏹️ إيقاف التسجيل"
    );


    try {

      mediaRecorder.stop();

    }

    catch (error) {

      console.error(
        error
      );

    }

  }


  // ======================================================
  // إنهاء التسجيل ورفع الصوت
  // ======================================================

  async function finishRecording() {


    if (isSending) {

      return;

    }


    isSending =
      true;


    try {


      // --------------------------------------------
      // نوع الملف
      // --------------------------------------------

      const mimeType =
        mediaRecorder &&
        mediaRecorder.mimeType
          ?
          mediaRecorder.mimeType
          :
          "audio/webm";


      // --------------------------------------------
      // إيقاف الميكروفون
      // --------------------------------------------

      stopMicrophone();


      // --------------------------------------------
      // فحص البيانات
      // --------------------------------------------

      console.log(
        "📦 عدد أجزاء الصوت:",
        audioChunks.length
      );


      if (
        audioChunks.length === 0
      ) {

        throw new Error(
          "لم يتم تسجيل أي صوت"
        );

      }


      // --------------------------------------------
      // إنشاء Blob
      // --------------------------------------------

      const blob =
        new Blob(

          audioChunks,

          {
            type:
              mimeType
          }

        );


      console.log(
        "🎵 حجم الملف:",
        blob.size
      );


      if (blob.size === 0) {

        throw new Error(
          "ملف الصوت فارغ"
        );

      }


      status(
        "🟢 تم التسجيل — تجهيز الملف..."
      );


      // --------------------------------------------
      // الامتداد
      // --------------------------------------------

      let extension =
        "webm";


      if (
        mimeType.includes("mp4")
      ) {

        extension =
          "mp4";

      }


      // --------------------------------------------
      // اسم الملف
      // --------------------------------------------

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
          .substring(2, 10) +

        "." +

        extension;


      console.log(
        "📁 File:",
        fileName
      );


      // --------------------------------------------
      // Firebase Storage
      // --------------------------------------------

      const voiceRef =
        ref(

          window.storage,

          fileName

        );


      status(
        "⬆️ جاري رفع الصوت: 0%"
      );


      const uploadTask =
        uploadBytesResumable(

          voiceRef,

          blob,

          {
            contentType:
              mimeType
          }

        );


      // --------------------------------------------
      // انتظار انتهاء الرفع
      // --------------------------------------------

      await new Promise(
        (resolve, reject) => {


          uploadTask.on(

            "state_changed",

            (snapshot) => {


              const progress =

                Math.round(

                  (
                    snapshot.bytesTransferred /
                    snapshot.totalBytes
                  ) * 100

                );


              console.log(
                "⬆️ Upload:",
                progress + "%"
              );


              status(
                "⬆️ جاري رفع الصوت: " +
                progress +
                "%"
              );

            },


            (error) => {

              console.error(
                "❌ Upload error:",
                error
              );


              reject(error);

            },


            () => {

              console.log(
                "✅ Upload finished"
              );


              resolve();

            }

          );

        }

      );


      // --------------------------------------------
      // الحصول على الرابط
      // --------------------------------------------

      status(
        "🔗 جاري الحصول على رابط الصوت..."
      );


      const downloadURL =
        await getDownloadURL(
          voiceRef
        );


      console.log(
        "🔗 URL:",
        downloadURL
      );


      // --------------------------------------------
      // حفظ الرسالة
      // --------------------------------------------

      status(
        "💾 جاري حفظ الرسالة..."
      );


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
            downloadURL,

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


      status(
        "✅ تم إرسال الرسالة الصوتية"
      );


      setTimeout(
        hideStatus,
        2000
      );


    }

    catch (error) {


      console.error(
        "❌ VOICE ERROR:",
        error
      );


      let message =
        error.message ||
        "خطأ غير معروف";


      // رسائل Firebase أوضح

      if (
        error.code ===
        "storage/unauthorized"
      ) {

        message =
          "ليس لديك صلاحية رفع الملفات إلى Storage";

      }


      else if (
        error.code ===
        "storage/canceled"
      ) {

        message =
          "تم إلغاء رفع الملف";

      }


      else if (
        error.code ===
        "storage/unknown"
      ) {

        message =
          "حدث خطأ غير معروف في Firebase Storage";

      }


      status(
        "❌ " + message
      );


      alert(
        "❌ لم يتم إرسال التسجيل:\n\n" +
        message
      );

    }


    finally {


      cleanup();


      isSending =
        false;

    }

  }


  // ======================================================
  // إيقاف الميكروفون
  // ======================================================

  function stopMicrophone() {


    if (!audioStream) {

      return;

    }


    audioStream
      .getTracks()
      .forEach(
        (track) => {

          try {

            track.stop();

          }

          catch (error) {

            console.log(error);

          }

        }
      );


    audioStream =
      null;

  }


  // ======================================================
  // تنظيف
  // ======================================================

  function cleanup() {


    stopMicrophone();


    mediaRecorder =
      null;


    audioChunks =
      [];


    isRecording =
      false;


    isStarting =
      false;


    pointerId =
      null;


    voiceButton.textContent =
      "🎤";


    voiceButton.classList.remove(
      "recording"
    );

  }


  console.log(
    "🎤 voice.js جاهز"
  );

}
