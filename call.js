/* =========================================
   Mecd Chat - Voice Call
   call.js
========================================= */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* =========================================
   إعدادات الاتصال
========================================= */

const db = window.chatDB;

let currentUser = null;
let friendUser = null;
let callID = null;

let unsubscribeCall = null;


/* =========================================
   استقبال بيانات المستخدم من chat.html
========================================= */

function loadUsers(){

  currentUser = window.chatUser;
  friendUser = window.chatFriend;

}


/* =========================================
   إنشاء ID للمكالمة
========================================= */

function createCallID(){

  if(!currentUser || !friendUser){
    return null;
  }

  return [
    currentUser.uid,
    friendUser.uid
  ]
  .sort()
  .join("_");

}


/* =========================================
   CSS شاشة الاتصال
========================================= */

function addCallStyles(){

  if(document.getElementById("mecd-call-style")){
    return;
  }

  const style = document.createElement("style");

  style.id = "mecd-call-style";

  style.textContent = `

  #mecdCallScreen{

    position:fixed;
    inset:0;
    background:
      radial-gradient(
        circle at top,
        #123d35,
        transparent 45%
      ),
      linear-gradient(
        180deg,
        #07110f,
        #020504
      );

    z-index:100000;

    display:none;

    flex-direction:column;

    align-items:center;

    justify-content:center;

    color:white;

    font-family:Arial,Tahoma,sans-serif;

    text-align:center;

    padding:25px;

  }


  #mecdCallAvatar{

    width:110px;
    height:110px;

    border-radius:30px;

    background:#12352c;

    display:flex;

    align-items:center;
    justify-content:center;

    overflow:hidden;

    font-size:50px;

    margin-bottom:20px;

  }


  #mecdCallAvatar img{

    width:100%;
    height:100%;

    object-fit:cover;

  }


  #mecdCallName{

    font-size:25px;

    font-weight:bold;

    margin-bottom:10px;

  }


  #mecdCallStatus{

    color:#00e889;

    font-size:15px;

    margin-bottom:50px;

  }


  .mecd-call-buttons{

    display:flex;

    gap:25px;

    align-items:center;

    justify-content:center;

  }


  .mecd-call-btn{

    width:70px;
    height:70px;

    border:0;

    border-radius:50%;

    font-size:28px;

    cursor:pointer;

    color:white;

  }


  #mecdEndCall{

    background:#d93636;

  }


  #mecdAcceptCall{

    background:#00c96b;

  }


  #mecdRejectCall{

    background:#d93636;

  }


  `;

  document.head.appendChild(style);

}


/* =========================================
   إنشاء شاشة الاتصال
========================================= */

function createCallScreen(){

  if(document.getElementById("mecdCallScreen")){
    return;
  }


  const screen =
    document.createElement("div");

  screen.id =
    "mecdCallScreen";


  screen.innerHTML = `

    <div id="mecdCallAvatar">
      👤
    </div>

    <div id="mecdCallName">
      جاري الاتصال...
    </div>

    <div id="mecdCallStatus">
      يتصل...
    </div>

    <div class="mecd-call-buttons">

      <button
        id="mecdRejectCall"
        class="mecd-call-btn"
        type="button">
        📵
      </button>

      <button
        id="mecdAcceptCall"
        class="mecd-call-btn"
        type="button"
        style="display:none">
        📞
      </button>

      <button
        id="mecdEndCall"
        class="mecd-call-btn"
        type="button">
        📵
      </button>

    </div>

  `;


  document.body.appendChild(screen);


  document
    .getElementById("mecdEndCall")
    .addEventListener(
      "click",
      endCall
    );


  document
    .getElementById("mecdRejectCall")
    .addEventListener(
      "click",
      rejectCall
    );


  document
    .getElementById("mecdAcceptCall")
    .addEventListener(
      "click",
      acceptCall
    );

}


/* =========================================
   عرض معلومات الشخص
========================================= */

function setCallUser(user){

  const avatar =
    document.getElementById(
      "mecdCallAvatar"
    );

  const name =
    document.getElementById(
      "mecdCallName"
    );


  if(!user){
    return;
  }


  name.textContent =
    user.name ||
    "مستخدم Mecd";


  if(user.photo){

    avatar.innerHTML =
      `<img src="${escapeHtml(user.photo)}"
            alt="صورة الحساب">`;

  }else{

    avatar.textContent =
      "👤";

  }

}


/* =========================================
   حماية الصورة
========================================= */

function escapeHtml(value){

  return String(value).replace(
    /[&<>'"]/g,
    c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      "'":"&#39;",
      '"':"&quot;"
    }[c])
  );

}


/* =========================================
   إظهار الشاشة
========================================= */

function showCallScreen(){

  document
    .getElementById("mecdCallScreen")
    .style.display =
      "flex";

}


/* =========================================
   إخفاء الشاشة
========================================= */

function hideCallScreen(){

  document
    .getElementById("mecdCallScreen")
    .style.display =
      "none";

}


/* =========================================
   بدء الاتصال
========================================= */

async function startCall(){

  loadUsers();

  callID =
    createCallID();


  if(
    !currentUser ||
    !friendUser ||
    !callID
  ){

    alert(
      "تعذر بدء الاتصال"
    );

    return;

  }


  createCallScreen();

  addCallStyles();

  setCallUser(friendUser);


  const status =
    document.getElementById(
      "mecdCallStatus"
    );


  status.textContent =
    "يتصل...";


  document
    .getElementById(
      "mecdAcceptCall"
    )
    .style.display =
      "none";


  showCallScreen();


  try{

    await setDoc(

      doc(
        db,
        "calls",
        callID
      ),

      {

        callerId:
          currentUser.uid,

        receiverId:
          friendUser.uid,

        callerName:
          currentUser.displayName ||
          currentUser.name ||
          "مستخدم Mecd",

        callerPhoto:
          currentUser.photoURL ||
          currentUser.photo ||
          "",

        receiverName:
          friendUser.name ||
          "مستخدم Mecd",

        receiverPhoto:
          friendUser.photo ||
          "",

        status:
          "ringing",

        createdAt:
          serverTimestamp()

      },

      {
        merge:true
      }

    );


    listenToCall();


  }catch(error){

    console.error(
      "Start call error:",
      error
    );

    alert(
      "حدث خطأ أثناء بدء الاتصال"
    );

    hideCallScreen();

  }

}


/* =========================================
   مراقبة المكالمة
========================================= */

function listenToCall(){

  if(unsubscribeCall){

    unsubscribeCall();

  }


  unsubscribeCall =
    onSnapshot(

      doc(
        db,
        "calls",
        callID
      ),

      snap => {

        if(!snap.exists()){

          hideCallScreen();

          return;

        }


        const data =
          snap.data();


        if(
          data.status ===
          "accepted"
        ){

          document
            .getElementById(
              "mecdCallStatus"
            )
            .textContent =
              "تم الرد على المكالمة";

        }


        if(
          data.status ===
          "rejected"
        ){

          document
            .getElementById(
              "mecdCallStatus"
            )
            .textContent =
              "تم رفض المكالمة";


          setTimeout(
            hideCallScreen,
            1000
          );

        }


        if(
          data.status ===
          "ended"
        ){

          hideCallScreen();

        }

      },

      error => {

        console.error(
          "Call listener error:",
          error
        );

      }

    );

}


/* =========================================
   قبول المكالمة
========================================= */

async function acceptCall(){

  if(!callID){
    return;
  }


  try{

    await updateDoc(

      doc(
        db,
        "calls",
        callID
      ),

      {

        status:
          "accepted",

        answeredAt:
          serverTimestamp()

      }

    );


    document
      .getElementById(
        "mecdCallStatus"
      )
      .textContent =
        "متصل";


    document
      .getElementById(
        "mecdAcceptCall"
      )
      .style.display =
        "none";


  }catch(error){

    console.error(
      "Accept call error:",
      error
    );

  }

}


/* =========================================
   رفض المكالمة
========================================= */

async function rejectCall(){

  if(!callID){
    return;
  }


  try{

    await updateDoc(

      doc(
        db,
        "calls",
        callID
      ),

      {

        status:
          "rejected",

        endedAt:
          serverTimestamp()

      }

    );

  }catch(error){

    console.error(
      "Reject call error:",
      error
    );

  }


  hideCallScreen();

}


/* =========================================
   إنهاء المكالمة
========================================= */

async function endCall(){

  if(!callID){

    hideCallScreen();

    return;

  }


  try{

    await updateDoc(

      doc(
        db,
        "calls",
        callID
      ),

      {

        status:
          "ended",

        endedAt:
          serverTimestamp()

      }

    );

  }catch(error){

    console.error(
      "End call error:",
      error
    );

  }


  hideCallScreen();


  if(unsubscribeCall){

    unsubscribeCall();

    unsubscribeCall =
      null;

  }

}


/* =========================================
   المكالمات الواردة
========================================= */

function listenIncomingCalls(){

  loadUsers();


  if(
    !currentUser
  ){

    return;

  }


  /*
     نراقب وثيقة الاتصال الخاصة
     بالمستخدم الحالي.
  */

  const callRef =
    doc(
      db,
      "calls",
      callID ||
      ""
    );


}


/* =========================================
   ربط زر الاتصال
========================================= */

function connectCallButton(){

  const button =
    document.getElementById(
      "callButton"
    );


  if(!button){

    console.error(
      "callButton غير موجود"
    );

    return;

  }


  button.addEventListener(

    "click",

    () => {

      startCall();

    }

  );

}


/* =========================================
   تشغيل الملف
========================================= */

function initCall(){

  addCallStyles();

  createCallScreen();

  connectCallButton();

}


initCall();


/* =========================================
   جعل الدوال متاحة
========================================= */

window.startMecdCall =
  startCall;

window.endMecdCall =
  endCall;
