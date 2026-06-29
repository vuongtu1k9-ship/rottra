import { createSignal } from "solid-js";
import type { Product } from "~/shared/dtos/models";

export const [selectedProduct, setSelectedProduct] = createSignal<Product | null>(null);
