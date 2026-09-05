import { mutablePromise, qsExists, timeout } from "./util.js";
let modalInited;
export function showModal(s) {
    const modal = qsExists(".modal-container");
    modal.setAttribute("style", s ? "" : "display: none;");
    if (!modalInited) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                showModal(false);
                modal.dispatchEvent(new CustomEvent("close"));
            }
        });
        modalInited = true;
    }
    for (let e of modal.querySelectorAll(".modal-dialog")) {
        e.setAttribute("style", "display: none;");
    }
    if (typeof s === "string") {
        const d = qsExists(modal, s);
        d.setAttribute("style", "");
        return d;
    }
    return modal;
}
export function btn(c, a) {
    let icont;
    if (typeof c === "string") {
        icont = c[0];
    }
    else {
        icont = c[0];
        c = c[1];
    }
    let b = document.createElement("div");
    b.classList.add("menubtn");
    //b.innerHTML=c;
    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent = icont; //false ? "📁" : "📄";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = c;
    b.appendChild(icon);
    b.appendChild(label);
    const menus = qsExists(".menus");
    menus.append(b);
    const act = async () => {
        try {
            //abortAuto();
            await a();
        }
        catch (e) {
            console.error(e.message + "\n" + e.stack);
        }
    };
    b.addEventListener("click", act);
    return {
        action: act, label: c, dom: b,
    };
}
export function rmbtn() {
    for (let b of document.querySelectorAll('.menubtn')) {
        b.parentNode?.removeChild(b);
    }
}
export async function splash(mesg, sp) {
    sp.textContent = mesg;
    await timeout(1);
}
export async function uploadFile(opt = {}) {
    const cas = showModal(".upload");
    if (opt.onShow) {
        opt.onShow({ dom: cas });
    }
    const promise = mutablePromise();
    cas.addEventListener("close", () => promise.reject(new Error("closed")), { once: true });
    const file = qsExists(cas, ".file");
    file.addEventListener("input", async function () {
        const f = this.files && this.files[0];
        showModal();
        promise.resolve(f);
    });
    return promise;
}
//# sourceMappingURL=ui.js.map