import { createSignal, createResource } from "solid-js";
import { isServer } from "solid-js/web";
import { Product } from "../product.tsrx";
import { AdminActions } from "./admin-actions.tsrx";

const fetchProducts = async () => {
  if (isServer) return { product: [] };
  const res = await fetch("/api/admin/product");
  if (!res.ok) return { product: [] };
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }
  return { product: [] };
};

export component ManageProduct(props: any) {
  const [data, { refetch }] = createResource(fetchProducts);
  const [selectedProducts, setSelectedProducts] = createSignal<any[]>([]);

  const toggleSelect = (product: any) => {
    const pId = product.id || product._id;
    if (selectedProducts().find((sp) => (sp.id || sp._id) === pId)) {
      setSelectedProducts(selectedProducts().filter((sp) => (sp.id || sp._id) !== pId));
    } else {
      setSelectedProducts([...selectedProducts(), product]);
    }
  };

  const selectAll = () => {
    const list = data()?.product || data()?.products || [];
    if (selectedProducts().length === list.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(list);
    }
  };

  <div class="p-6 space-y-6 animate-in fade-in duration-500">
    <header class="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
      <div class="flex items-center gap-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-800">{"Quản lý sản phẩm"}</h2>
          <p class="text-sm text-gray-500">
            {"Đã chọn: "}
            <span class="font-bold text-blue-600">{selectedProducts().length}</span>
            {" / "}
            {(data()?.product || data()?.products || []).length}
          </p>
        </div>
        <button
          onClick={selectAll}
          class="px-4 py-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors">
          {selectedProducts().length === (data()?.product || data()?.products || []).length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
        </button>
      </div>
    </header>

    <AdminActions
      role={props.role}
      isProduct={true}
      selectedProducts={selectedProducts()}
      onActionComplete={() => {
        setSelectedProducts([]);
        refetch();
      }}
    />

    <Product
      role={props.role}
      adminView={true}
      selectedProducts={selectedProducts()}
      onToggleSelect={toggleSelect}
      productsData={data()?.product || data()?.products || []}
      refetchProducts={refetch}
    />
  </div>
}
