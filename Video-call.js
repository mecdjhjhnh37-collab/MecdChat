let peer;
let myStream;
let currentCall;


const myVideo =
document.getElementById("myVideo");

const remoteVideo =
document.getElementById("remoteVideo");

const idBox =
document.getElementById("id");


async function startCamera(){

    myStream =
    await navigator.mediaDevices.getUserMedia({
        video:true,
        audio:true
    });

    myVideo.srcObject =
    myStream;
}


function createPeer(){

    peer = new Peer();


    peer.on("open", id=>{

        idBox.innerHTML =
        "كودك:<br>"+id;

    });


    peer.on("call", call=>{

        call.answer(myStream);

        currentCall = call;


        call.on("stream", stream=>{

            remoteVideo.srcObject =
            stream;

        });

    });

}



async function createCall(){

    await startCamera();

    if(!peer)
    createPeer();

}



async function joinCall(){

    await startCamera();


    if(!peer)
    createPeer();


    setTimeout(()=>{

        let id =
        document.getElementById("callId").value;


        let call =
        peer.call(id,myStream);


        currentCall =
        call;


        call.on("stream",stream=>{

            remoteVideo.srcObject =
            stream;

        });


    },1000);

}



function endCall(){

    if(currentCall)
    currentCall.close();


    if(myStream){

        myStream.getTracks()
        .forEach(t=>t.stop());

    }


    myVideo.srcObject=null;
    remoteVideo.srcObject=null;


}
export async function startVideoCall(data){

    console.log("بدء مكالمة فيديو مع:", data.friendId);

    // هنا نفتح صفحة مكالمة الفيديو
    window.location.href =
    "video-call.html?friend=" +
    data.friendId;

}
