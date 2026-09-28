let video = document.querySelector('#mainContent .video video');
const videoWrapper = document.querySelector('#mainContent .video');
const optionsDialog = $('optionsDialog');

let stallTimeout = null;
const STALL_GRACE_MS = 600;
let currentScene = null;
let optionsShown = false;

$('homepageStartBtn').addEventListener('click', (e) => {
    const rect = $('homepageStartBtn').getBoundingClientRect();

    const top = rect.top;
    const left = rect.left;
    const width = rect.width;
    const height = rect.height;

    $('floatingAnimatedStartBtn').style.top = top + "px";
    $('floatingAnimatedStartBtn').style.left = left + "px";
    $('floatingAnimatedStartBtn').style.width = width + "px";
    $('floatingAnimatedStartBtn').style.height = height + "px";

    $('floatingAnimatedStartBtn').classList.remove('hidden');

    setTimeout(() => {
        $('floatingAnimatedStartBtn').style.transition = "transform 0.4s ease, width 0.4s ease, height 0.4s ease";
        $('floatingAnimatedStartBtn').style.borderRadius = "0px";
        $('floatingAnimatedStartBtn').style.transform = `translateY(-${top}px) translateX(-${left}px)`;
        $('floatingAnimatedStartBtn').classList.add('animationScale');
        setTimeout(() => {
            $('homepage').classList.add('hidden');
            $('mainContent').classList.remove('hidden');

            document.documentElement.requestFullscreen().catch(() => {});

            const startScene = storyTimeline.find(s => s.type === 'start');
            playScene(startScene);
        }, 500);
        setTimeout(() => {
            $('floatingAnimatedStartBtn').classList.add('hidden');
        }, 700);
    }, 100);
});

window.addEventListener('load', () => {
    setTimeout(() => {
        $('loadingScr').classList.add('hidden');
    }, 400);
});

/*=============================
            Slow Connections
=============================*/
function getConnectionInfo() {
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

function isSlowConnection() {
    const conn = getConnectionInfo();
    if (!conn) return false;
    if (conn.saveData) return true;
    if (conn.effectiveType && ['slow-2g', '2g'].includes(conn.effectiveType)) return true;
    if (typeof conn.downlink === 'number' && conn.downlink < 1) return true;
    return false;
}

const preloadPool = new Map(); // sceneName -> <video> element
const PRELOAD_BUFFER_SECONDS = 2; // cuántos segundos de inicio queremos "calentar"

function preloadScene(sceneName) {
    if (isSlowConnection()) return;
    if (preloadPool.has(sceneName)) return;

    const sceneObj = findScene(sceneName);
    if (!sceneObj) return;

    const el = document.createElement('video');
    el.muted = true;
    el.preload = 'auto';
    el.src = sceneObj.videofile;

    const stopBuffering = () => {
        if (el.buffered.length && el.buffered.end(0) >= PRELOAD_BUFFER_SECONDS) {
            el.removeEventListener('progress', stopBuffering);
            el.pause();
        }
    };
    el.addEventListener('progress', stopBuffering);
    el.addEventListener('error', () => {
        preloadPool.delete(sceneName);
        el.remove();
    });

    $('preloadPool').appendChild(el);
    preloadPool.set(sceneName, el);
    el.load();
}

function clearPreloadPool() {
    preloadPool.forEach(el => {
        el.src = '';
        el.remove();
    });
    preloadPool.clear();
}

function handleStall() {
    if (stallTimeout) return;
    stallTimeout = setTimeout(() => {
        $('loadingScr').classList.remove('hidden');
    }, STALL_GRACE_MS);
}
function handleResume() {
    clearTimeout(stallTimeout);
    stallTimeout = null;
    $('loadingScr').classList.add('hidden');
}

/*=============================
            Video/Timeline System
=============================*/
const storyTimeline = [
    {
        type: "start",
        scene: "start",
        videofile: "/webs/proyectoreligioncole/assets/video/intro.webm",
        videofilefallback: "/webs/proyectoreligioncole/assets/video/intro.mp4",
        optionsOnFinish: [
            { text:"1. Regañarlos", callScene:"frIntro_reganiarlos" },
            { text:"2. Hablar con ellos", callScene:"frIntro_hablarconellos" },
            { text:"3. Comprenderlos", callScene:"frIntro_comprenderlos" }
        ]
    },
    {
        type: "step",
        scene: "frIntro_reganiarlos",
        videofile: "/webs/proyectoreligioncole/assets/video/pt1_option_1o2.webm",
        videofilefallback: "/webs/proyectoreligioncole/assets/video/pt1_option_1o2.mp4",
        optionsOnFinish: [
            { text:"1. Comprenderlos", callScene:"frIntro_comprenderlos" }
        ]
    },
    {
        type: "step",
        scene: "frIntro_hablarconellos",
        videofile: "/webs/proyectoreligioncole/assets/video/option_2o1.webm",
        videofilefallback: "/webs/proyectoreligioncole/assets/video/option_2o1.mp4",
        optionsOnFinish: [
            { text:"1. Regañarlos", callScene:"frIntro_reganiarlos" },
            { text:"2. Comprenderlos", callScene:"frIntro_comprenderlos" }
        ]
    },
    {
        type: "step",
        scene: "frIntro_comprenderlos",
        videofile: "/webs/proyectoreligioncole/assets/video/pt2.webm",
        videofilefallback: "/webs/proyectoreligioncole/assets/video/pt2.mp4",
        optionsOnFinish: [
            { text:"1. Pedir Dinero", callScene:"frComprenderlos_pedirdinero" },
            { text:"2. Rendirse", callScene:"frComprenderlos_rendirse" },
            { text:"3. Rezar", callScene:"frComprenderlos_rezar" }
        ]
    },
    {
        type: "step",
        scene: "frComprenderlos_pedirdinero",
        videofile: "/webs/proyectoreligioncole/assets/video/pt2_option_1.webm",
        videofilefallback: "/webs/proyectoreligioncole/assets/video/pt2_option_1.mp4",
        optionsOnFinish: [
            { text:"1. Rendirse", callScene:"frComprenderlos_rendirse" },
            { text:"2. Rezar", callScene:"frComprenderlos_rezar" }
        ]
    },
    {
        type: "step",
        scene: "frComprenderlos_rendirse",
        videofile: "/webs/proyectoreligioncole/assets/video/pt2_option_2.webm",
        videofilefallback: "/webs/proyectoreligioncole/assets/video/pt2_option_2.mp4",
        optionsOnFinish: [
            { text:"1. Pedir Dinero", callScene:"frComprenderlos_pedirdinero" },
            { text:"2. Rezar", callScene:"frComprenderlos_rezar" }
        ]
    },
    {
        type: "step",
        scene: "frComprenderlos_rezar",
        videofile: "/webs/proyectoreligioncole/assets/video/pt2_option_3.webm",
        videofilefallback: "/webs/proyectoreligioncole/assets/video/pt2_option_3.mp4",
        optionsOnFinish: [
            { text:"1. Buscar Ayuda", callScene:"frRezar_buscarayuda" },
            { text:"2. Rezar", callScene:"frRezar_rezar" },
            { text:"3. Buscar en Libros", callScene:"frRezar_buscarenlibros" }
        ]
    },
    {
        type: "step",
        scene: "frRezar_rezar",
        videofile: "/webs/proyectoreligioncole/assets/video/pt3_option_2o2.webm",
        videofilefallback: "/webs/proyectoreligioncole/assets/video/pt3_option_2o2.mp4",
        optionsOnFinish: [
            { text:"1. Buscar Ayuda", callScene:"frRezar_buscarayuda" }
        ]
    },
    {
        type: "step",
        scene: "frRezar_buscarenlibros",
        videofile: "/webs/proyectoreligioncole/assets/video/pt3_buscarenlibros2.webm",
        videofilefallback: "/webs/proyectoreligioncole/assets/video/pt3_buscarenlibros2.mp4",
        optionsOnFinish: [
            { text:"1. Buscar Ayuda", callScene:"frRezar_buscarayuda" },
            { text:"2. Rezar", callScene:"frRezar_rezar" }
        ]
    },
    {
        type: "end",
        scene: "frRezar_buscarayuda",
        videofile: "/webs/proyectoreligioncole/assets/video/pt3_buscarayuda.webm",
        videofilefallback: "/webs/proyectoreligioncole/assets/video/pt3_buscarayuda.mp4",
        optionsOnFinish: []
    },
];



function findScene(sceneName) {
    return storyTimeline.find(s => s.scene === sceneName);
}
function playScene(sceneObj) {
    if (!sceneObj) {
        showSceneNotFound();
        return;
    }

    currentScene = sceneObj;
    optionsShown = false;

    optionsDialog.classList.remove('show');
    videoWrapper.classList.remove('moveToLeft');

    video.src = sceneObj.videofile;
    video.load();
    video.play().catch(() => {});
}



video.addEventListener('timeupdate', () => {
    if (!currentScene || optionsShown) return;
    if (currentScene.type === 'end') return;

    if (video.duration && (video.duration - video.currentTime) <= 3) {
        optionsShown = true;
        videoWrapper.classList.add('moveToLeft');
        showOptions(currentScene.optionsOnFinish);
    }
});
video.addEventListener('ended', () => {
    if (!currentScene) return;

    if (currentScene.type === 'end') {
        $('timelineEnd').classList.add('show');
        return;
    }

    if (!optionsShown) {
        optionsShown = true;
        videoWrapper.classList.add('moveToLeft');
        showOptions(currentScene.optionsOnFinish);
    }
});
video.addEventListener('error', () => {
    if (currentScene && currentScene.videofilefallback && video.src !== currentScene.videofilefallback) {
        video.src = currentScene.videofilefallback;
        video.load();
        video.play().catch(() => {});
    } else {
        showSceneNotFound();
    }
});

video.addEventListener('waiting', handleStall);
video.addEventListener('stalled', handleStall);
video.addEventListener('playing', handleResume);
video.addEventListener('canplaythrough', handleResume);


function showOptions(options) {
    optionsDialog.querySelector('span').textContent = "Que vas a hacer ahora?";
    optionsDialog.querySelectorAll('button').forEach(btn => btn.remove());

    clearPreloadPool();

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.textContent = opt.text;
        btn.addEventListener('click', () => {
            if (!preloadPool.has(opt.callScene)) {
                $('loadingScr').classList.remove('hidden');
            }
            const nextScene = findScene(opt.callScene);
            playScene(nextScene);
        });
        optionsDialog.appendChild(btn);

        preloadScene(opt.callScene);
    });

    optionsDialog.classList.add('show');
}
function showSceneNotFound() {
    optionsDialog.querySelectorAll('button').forEach(btn => btn.remove());
    optionsDialog.querySelector('span').textContent = "Ocurrio un error inesperado. Esta escena no existe.";
    videoWrapper.classList.add('moveToLeft');
    optionsDialog.classList.add('show');
}