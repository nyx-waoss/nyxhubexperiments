/*nyxhub requestAccess.html*/

const msgBoxDialog = document.getElementById('textMsgBox');
const params = new URLSearchParams(window.location.search);
const targetPath = params.get('target');

async function showPromptBox(title = "Ingrese un valor.") {
    return new Promise((resolve) => {
        msgBoxDialog.classList.remove('hidden');
        $('accessButton').disabled = true;
        msgBoxDialog.querySelector('span').textContent = title;
        msgBoxDialog.querySelector('input').classList.remove('hidden');
        msgBoxDialog.querySelector('.acp').onclick = () => {
            const enteredValue = msgBoxDialog.querySelector('input').value;
            msgBoxDialog.querySelector('input').value = "";
            msgBoxDialog.classList.add('hidden');
            $('accessButton').disabled = false;
            resolve({confirmed: true, value: enteredValue});
        };
        msgBoxDialog.querySelector('.cls').onclick = () => {
            msgBoxDialog.querySelector('input').value = "";
            msgBoxDialog.classList.add('hidden');
            $('accessButton').disabled = false;
            resolve({confirmed: false, value: ""});
        };
    });
}

async function showMsgBox(title = "Ingrese un valor.") {
    return new Promise((resolve) => {
        msgBoxDialog.classList.remove('hidden');
        $('accessButton').disabled = true;
        msgBoxDialog.querySelector('span').textContent = title;
        msgBoxDialog.querySelector('input').classList.add('hidden');
        msgBoxDialog.querySelector('.acp').onclick = () => {
            msgBoxDialog.classList.add('hidden');
            $('accessButton').disabled = false;
            resolve({confirmed: true});
        };
        msgBoxDialog.querySelector('.cls').onclick = () => {
            msgBoxDialog.classList.add('hidden');
            $('accessButton').disabled = false;
            resolve({confirmed: false});
        };
    });
}

async function verifyAndRedirect() {
    if (!targetPath) {
        showMsgBox('No se especifico ninguna pagina a la cual acceder.');
        return;
    }

    const accessData = await getAccessData();
    const entry = findEntryByUrl(targetPath, accessData);

    if (!entry) {
        showMsgBox('Esta ruta no corresponde a ningun recurso protegido conocido.');
        return;
    }

    if (isAuthorized(entry.pageUrl)) {
        window.location.href = targetPath;
        return;
    }

    showAccessDialog(entry);
}

async function showAccessDialog(entry) {
    const enterPassword = await showPromptBox("Ingrese la contraseña para acceder a esta pagina.");
    if (!enterPassword.confirmed) return;

    if (enterPassword.value === entry.password) {
        saveToken(entry.pageUrl);
        logRecentAccess(entry.pageUrl, 'webpage');
        window.location.href = targetPath;
    } else {
        await showMsgBox("La contraseña no es correcta.");
        showAccessDialog(entry);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => verifyAndRedirect(), 200);
});