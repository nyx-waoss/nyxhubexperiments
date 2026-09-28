/*nyxhub main*/

const msgBoxDialog = document.getElementById('textMsgBox');
async function showPromptBox(title = "Ingrese un valor.") {
    return new Promise((resolve) => {
        msgBoxDialog.classList.remove('hidden');

        msgBoxDialog.querySelector('span').textContent = title;
        msgBoxDialog.querySelector('input').classList.remove('hidden');

        $('main').style.filter = "brightness(0.7)";

        msgBoxDialog.querySelector('.acp').onclick = () => {
            const enteredValue = msgBoxDialog.querySelector('input').value;
            msgBoxDialog.querySelector('input').value = "";
            msgBoxDialog.classList.add('hidden');
            $('main').style.filter = "brightness(1)";
            resolve({confirmed: true, value: enteredValue});
        };

        msgBoxDialog.querySelector('.cls').onclick = () => {
            msgBoxDialog.querySelector('input').value = "";
            msgBoxDialog.classList.add('hidden');
            $('main').style.filter = "brightness(1)";
            resolve({confirmed: false, value: ""});
        };
    });
}
async function showMsgBox(title = "Ingrese un valor.") {
    return new Promise((resolve) => {
        msgBoxDialog.classList.remove('hidden');

        msgBoxDialog.querySelector('span').textContent = title;
        msgBoxDialog.querySelector('input').classList.add('hidden');

        $('main').style.filter = "brightness(0.7)";

        msgBoxDialog.querySelector('.acp').onclick = () => {
            msgBoxDialog.classList.add('hidden');
            $('main').style.filter = "brightness(1)";
            resolve({confirmed: true});
        };

        msgBoxDialog.querySelector('.cls').onclick = () => {
            msgBoxDialog.classList.add('hidden');
            $('main').style.filter = "brightness(1)";
            resolve({confirmed: false});
        };
    });
}

/*=============================
            Enter Website Via Access Code
=============================*/
async function tryAccessWebsite(accesscode) {
    const accessData = await getAccessData();
    const entry = findEntryByAccessCode(accesscode, accessData);

    if (!entry) {
        showMsgBox('No se encontro ningun programa, archivo, o zona de acceso relacionada a este codigo de acceso. Verifique el codigo y vuelva a intentarlo.');
        return;
    }

    saveToken(entry.pageUrl);
    logRecentAccess(entry.pageUrl, 'webpage');
    showMsgBox('Por favor, espere mientras lo redirigimos...');
    window.location.href = entry.pageUrl + '/index.html';
}

/*=============================
            Homepage
=============================*/
async function home_quickActions_enterViaAccessCode() {
    const askForCode = await showPromptBox('Ingrese el codigo de acceso a la pagina a la que desea acceder.');
    if (!askForCode.confirmed) return;
    tryAccessWebsite(askForCode.value);
}

function renderRecentAccess() {
    const log = JSON.parse(localStorage.getItem('nyxhub_recentAccess') || '[]');
    const container = document.querySelector('.recientPages .content');
    container.innerHTML = '';
    if (log.length === 0) {
        container.innerHTML = '<span>No hay accesos recientes.</span>';
        return;
    }
    for (const item of log) {
        const btn = document.createElement('button');
        const date = new Date(item.timestamp).toLocaleString();
        btn.innerHTML = `<i class="fi fi-sr-file"></i> ${item.pageUrl} <small>${date}</small>`;
        btn.onclick = () => {
            window.location.href = item.pageUrl.startsWith('/webs/') ? item.pageUrl + '/index.html' : item.pageUrl;
        };
        container.appendChild(btn);
    }
}

document.addEventListener('DOMContentLoaded', renderRecentAccess);