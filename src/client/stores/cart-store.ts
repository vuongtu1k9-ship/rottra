import { createSignal } from "solid-js";
import { isServer } from "solid-js/web";
import type { CartItem } from "~/shared/dtos/models";

export const [cartItems, setCartItems] = createSignal<CartItem[]>([]);
let isCartFetched = false;

export const initCart = () => {
  if (isServer) return;
  try {
    const stored = JSON.parse(localStorage.getItem("cartItems") || "[]") as CartItem[];
    setCartItems(stored);
  } catch {}
};

export const fetchUserCart = async () => {
  if (isServer || isCartFetched) return;
  try {
    isCartFetched = true;
    const res = await fetch("/api/cart");
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.cart) {
        const localCart = JSON.parse(localStorage.getItem("cartItems") || "[]") as CartItem[];
        const mergedCart = [...data.cart] as CartItem[];

        if (localCart.length > 0) {
          for (const localItem of localCart) {
            if (!mergedCart.find((dbItem) => dbItem.goods === localItem.goods)) {
              mergedCart.push(localItem);
            }
          }
          if (mergedCart.length > data.cart.length) {
            syncCartToDb(mergedCart);
          }
        }

        setCartItems(mergedCart);
        localStorage.setItem("cartItems", JSON.stringify(mergedCart));
        window.dispatchEvent(new Event("cart_updated"));
      }
    }
  } catch (err) {
    console.error("Failed to fetch user cart", err);
  }
};

const syncCartToDb = async (cart: CartItem[]) => {
  if (isServer) return;
  try {
    await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cart }),
    });
  } catch (err) {
    console.error("Failed to sync cart to DB", err);
  }
};

export const updateCart = (newCart: CartItem[], isLoggedIn: boolean = false) => {
  setCartItems(newCart);
  if (!isServer) {
    localStorage.setItem("cartItems", JSON.stringify(newCart));
    window.dispatchEvent(new Event("cart_updated"));

    if (isLoggedIn) {
      syncCartToDb(newCart);
    }
  }
};

export const clearCart = () => {
  isCartFetched = false;
  setCartItems([]);
  if (!isServer) {
    localStorage.removeItem("cartItems");
    window.dispatchEvent(new Event("cart_updated"));
  }
};
