import { createContext, useContext, createSignal, JSX } from "solid-js";
import { isServer } from "solid-js/web";
import type { CartItem } from "~/shared/dtos/models";

interface CartContextType {
  cartItems: () => CartItem[];
  setCartItems: (items: CartItem[]) => void;
  initCart: () => void;
  fetchUserCart: () => Promise<void>;
  updateCart: (newCart: CartItem[], isLoggedIn?: boolean) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType>();

export function CartProvider(props: { children: JSX.Element }) {
  const [cartItemsState, setCartItemsState] = createSignal<CartItem[]>([]);
  let isCartFetched = false;

  const initCart = () => {
    if (isServer) return;
    try {
      const stored = JSON.parse(localStorage.getItem("cartItems") || "[]") as CartItem[];
      setCartItemsState(stored);
    } catch {}
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

  const fetchUserCart = async () => {
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

          setCartItemsState(mergedCart);
          localStorage.setItem("cartItems", JSON.stringify(mergedCart));
          window.dispatchEvent(new Event("cart_updated"));
        }
      }
    } catch (err) {
      console.error("Failed to fetch user cart", err);
    }
  };

  const updateCart = (newCart: CartItem[], isLoggedIn: boolean = false) => {
    setCartItemsState(newCart);
    if (!isServer) {
      localStorage.setItem("cartItems", JSON.stringify(newCart));
      window.dispatchEvent(new Event("cart_updated"));
      if (isLoggedIn) {
        syncCartToDb(newCart);
      }
    }
  };

  const clearCart = () => {
    isCartFetched = false;
    setCartItemsState([]);
    if (!isServer) {
      localStorage.removeItem("cartItems");
      window.dispatchEvent(new Event("cart_updated"));
    }
  };

  return <tsx>
    <CartContext.Provider
      value={{
        cartItems: cartItemsState,
        setCartItems: setCartItemsState,
        initCart,
        fetchUserCart,
        updateCart,
        clearCart,
      }}>
      {props.children}
    </CartContext.Provider>
  </tsx>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
