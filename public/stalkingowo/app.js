//const $ = (el) => document.getElementById(el);



function gotoPage(page = "home") {
    document.querySelectorAll('.page').forEach(pg => pg.classList.add('hidden'));
    $(`page_${page}`).classList.remove('hidden');
}
gotoPage('home');