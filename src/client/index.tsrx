import { render } from "solid-js/web";
import { Root } from "./root.tsrx";

const root = document.getElementById("root");
if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error("Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?");
}

const skeleton = document.getElementById("ssr-app");

render(() => <Root />, root);

requestAnimationFrame(() => {
  skeleton?.remove();
});
