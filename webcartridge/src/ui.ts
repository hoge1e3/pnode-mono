import { qsExists, timeout } from "./util.js";
import MutablePromise from "mutable-promise";
let modalInited: boolean;

export function showModal(s?: string | boolean): HTMLElement {
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

export function btn(c: string | string[], a: Function): void {
    let icont: string;
    if (typeof c === "string") {
        icont = c[0];
    } else {
        icont = c[0];
        c = c[1];
    }
    let b = document.createElement("div");
    b.classList.add("menubtn");
    
    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent = icont;

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = c;
    b.appendChild(icon);
    b.appendChild(label);

    const menus = qsExists(".menus");
    menus.append(b);
    
    const act = async (): Promise<void> => {
        try {
            await a();
        } catch(e: any) {
            console.error(e.message + "\n" + e.stack);
        }
    };
    b.addEventListener("click", act);	    
}

export function rmbtn(): void {
  for (let b of document.querySelectorAll('.menubtn')) {
      b.parentNode?.removeChild(b);
  }
}

export async function splash(mesg: string, sp: HTMLElement): Promise<void> {
  sp.textContent = mesg;
  await timeout(1);    
}

export async function uploadFile(opt: { onShow?: (evt: { dom: HTMLElement }) => void } = {}): Promise<Blob> {
  const cas = showModal(".upload");
  if (opt.onShow) {
    opt.onShow({ dom: cas });
  }
  const promise = new MutablePromise<Blob>();
  cas.addEventListener("close", () => promise.reject(new Error("closed")), { once: true });
  const file = qsExists(cas, ".file");
  file.addEventListener("input", async function (this: HTMLInputElement) {
    const file = this.files && this.files[0];
    showModal();
    promise.resolve(file as Blob);
  });
  return promise;
}
