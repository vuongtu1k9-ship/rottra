import { Deterministic } from "~/shared/utils/rng";
import { createEffect, onMount, onCleanup, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { Icon } from "solid-heroicons";
import {
  map,
  arrowUpTray,
  circleStack,
  cloudArrowUp,
  trash,
  chartBar,
  informationCircle,
  chevronLeft,
  chevronRight,
  adjustmentsHorizontal,
  play,
  arrowPath,
  truck,
  mapPin,
  commandLine,
  checkCircle,
} from "solid-heroicons/outline";
import { flag, star } from "solid-heroicons/solid";
import { json_HongSon34 } from "~/../scripts/db-ops/migrations/hotfix-hongson34";
import { theme } from "~/client/stores/theme-store";
import "leaflet/dist/leaflet.css";

export component Local() {
  let mapContainer: HTMLDivElement | undefined;
  let map: any;
  let tileLayer: any;
  let L_lib: any;

  const [isDragOver, setIsDragOver] = createSignal(false);
  const [selectedFile, setSelectedFile] = createSignal<any>(null);
  const [uploading, setUploading] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [activeTab, setActiveTab] = createSignal("info");
  const [showSidebar, setShowSidebar] = createSignal(false);
  const [isMapReady, setIsMapReady] = createSignal(false);

  // --- VÍ TIỀN KỸ THUẬT SỐ & MÔ PHỎNG LÝ THUYẾT TRÒ CHƠI ---
  const [agentWallets, setAgentWallets] = createSignal([
    { name: "Trợ Lý Thanh Long", avatar: "🐉", balance: 1520, address: "0xTL...999" },
    { name: "Trợ Lý Bạch Hổ", avatar: "🐯", balance: 2840, address: "0xBH...888" },
    { name: "Trợ Lý Chu Tước", avatar: "🐦", balance: 950, address: "0xCT...777" },
    { name: "Trợ Lý Huyền Vũ", avatar: "🐢", balance: 3110, address: "0xHV...666" },
  ]);
  const [cryptoLogs, setCryptoLogs] = createSignal<string[]>([]);
  const [isSimulatingCrypto, setIsSimulatingCrypto] = createSignal(false);

  const runGameTheorySimulation = () => {
    if (isSimulatingCrypto()) return;
    setIsSimulatingCrypto(true);
    setCryptoLogs([]);

    const addCryptoLog = (msg: string) => {
      setCryptoLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    addCryptoLog("🚀 KHỞI CHẠY THƯƠNG LƯỢNG GAME THEORY");

    setTimeout(() => {
      addCryptoLog("⚖️ [Bạch Hổ] Áp dụng Nash Equilibrium: Giá tối ưu đạt 15 RTR/kg.");
    }, 800);

    setTimeout(() => {
      addCryptoLog("🚚 [Thanh Long] Thỏa thuận Dijkstra Routing: Cước ship = 3 RTR/kg.");
    }, 1800);

    setTimeout(() => {
      addCryptoLog("💰 [Chu Tước] Tạo giao dịch E-Commerce: Đơn hàng 100kg.");
      addCryptoLog("⛓️ [Blockchain] Xác minh & đúc khối mới trên Sổ cái...");
    }, 2800);

    setTimeout(() => {
      setAgentWallets((prev) => {
        return prev.map((w) => {
          if (w.name === "Trợ Lý Bạch Hổ") return { ...w, balance: w.balance + 1200 };
          if (w.name === "Trợ Lý Thanh Long") return { ...w, balance: w.balance + 300 };
          if (w.name === "Trợ Lý Chu Tước") return { ...w, balance: w.balance + 50 };
          return w;
        });
      });
      addCryptoLog("✅ GIAO DỊCH HOÀN TẤT!");
      addCryptoLog("✅ Bạch Hổ: +1200 RTR | Thanh Long: +300 RTR | Chu Tước: +50 RTR");
      setIsSimulatingCrypto(false);
    }, 4000);
  };

  const runFourColorSimulation = () => {
    if (!map || !L_lib) return;
    addLog("🎨 ĐỊNH LÝ 4 MÀU: Tô màu ranh giới 4 vùng tiếp giáp Hồng Sơn...");

    const colors = ["#ef4444", "#3b82f6", "#10b981", "#eab308"];
    const territories = [
      { name: "Vùng Phía Đông (Thanh Long)", coords: [[21.615, 105.29], [21.611, 105.298], [21.605, 105.285]], color: colors[0] },
      { name: "Vùng Phía Tây (Kỳ Lân)", coords: [[21.611, 105.298], [21.618, 105.305], [21.608, 105.312]], color: colors[1] },
      { name: "Vùng Phía Bắc (Huyền Vũ)", coords: [[21.618, 105.305], [21.611, 105.298], [21.615, 105.29]], color: colors[2] },
      { name: "Vùng Phía Nam (Chu Tước)", coords: [[21.605, 105.285], [21.611, 105.298], [21.608, 105.312]], color: colors[3] },
    ];

    territories.forEach((t) => {
      const polygon = L_lib.polygon(t.coords, {
        color: t.color,
        fillColor: t.color,
        fillOpacity: 0.35,
        weight: 3,
      }).addTo(map);
      polygon.bindPopup(`<b>${t.name}</b><br/>Tô màu tối ưu thành công!`);
      leafletPolylines.push(polygon);
    });

    addLog("🎨 ĐỊNH LÝ 4 MÀU: Tô màu phân khu Hồng Sơn hoàn tất!");
  };

  // --- TRỰC QUAN HÓA TỰ HÀNH TRÊN BẢN ĐỒ THỰC TẾ (AGENTIC DISPATCH ON REAL GIS) ---
  const [simState, setSimState] = createSignal("IDLE");
  const [logs, setLogs] = createSignal<string[]>([]);

  // Tọa độ GPS thực tế của các nhà kho tại Hồng Sơn (bảo đảm tất cả nằm trọn vẹn bên trong ranh giới xã)
  const logisticsNodes = [
    { id: 1, name: "Kho A (Thiếu hụt)", lat: 21.615, lng: 105.29, type: "target" },
    { id: 2, name: "Trạm Trung Chuyển", lat: 21.611, lng: 105.298, type: "transit" },
    { id: 3, name: "Kho B (Dự trữ)", lat: 21.618, lng: 105.305, type: "source" },
    { id: 4, name: "Siêu thị C", lat: 21.605, lng: 105.285, type: "market" },
    { id: 5, name: "Kho Cảng D", lat: 21.608, lng: 105.312, type: "source" },
  ];

  let leafletMarkers: any[] = [];
  let leafletPolylines: any[] = [];
  let truckMarker: any = null;

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const startSimulation = () => {
    if (simState() !== "IDLE" || !map || !L_lib) return;

    setLogs([]);
    setSimState("SCANNING");
    addLog("PHÁT HIỆN SỰ CỐ: Kho A đang thiếu hụt 5 Tấn Cà chua.");
    addLog("KÍCH HOẠT HỆ THỐNG TỰ HÀNH: Bắt đầu quét mạng lưới PostgreSQL (Inventory Radar)...");

    // Xóa polylines và xe cũ nếu có
    leafletPolylines.forEach((p) => map.removeLayer(p));
    leafletPolylines = [];
    if (truckMarker) {
      map.removeLayer(truckMarker);
      truckMarker = null;
    }

    // Giai đoạn 1: Quét Radar (Lần lượt bật Popup trên bản đồ thực tế)
    let scanIndex = 0;
    const scanInterval = setInterval(() => {
      if (scanIndex < logisticsNodes.length) {
        const node = logisticsNodes[scanIndex];
        const marker = leafletMarkers.find((m) => m.options.title === node.name);
        if (marker) {
          marker.openPopup();
        }
        scanIndex++;
      } else {
        clearInterval(scanInterval);
        addLog("TÌM THẤY NGUỒN CUNG: Kho B đang dư thừa 8 Tấn Cà chua.");

        // Giai đoạn 2: Tính toán định tuyến (Routing)
        setSimState("ROUTING");
        addLog("CHẠY THUẬT TOÁN TSP: Tính toán lộ trình tối ưu trên bản đồ...");

        // Vẽ tuyến đường Kho B -> Trạm
        setTimeout(() => {
          const p1 = L_lib.polyline([[21.618, 105.305], [21.611, 105.298]], {
            color: "#06b6d4",
            weight: 5,
            opacity: 0.8,
            dashArray: "10, 10",
          }).addTo(map);
          leafletPolylines.push(p1);
          addLog("KẾT NỐI TUYẾN: Kho B -> Trạm (15km)");
        }, 800);

        // Vẽ tuyến đường Trạm -> Kho A
        setTimeout(() => {
          const p2 = L_lib.polyline([[21.611, 105.298], [21.615, 105.29]], {
            color: "#06b6d4",
            weight: 5,
            opacity: 0.8,
            dashArray: "10, 10",
          }).addTo(map);
          leafletPolylines.push(p2);
          addLog("KẾT NỐI TUYẾN: Trạm -> Kho A (10km)");
        }, 1800);

        // Giai đoạn 3: Phân lệnh & Xe di chuyển
        setTimeout(() => {
          setSimState("DISPATCHED");
          addLog("TỐI ƯU HOÀN TẤT: Chọn lộ trình Kho B -> Trạm -> Kho A (Tổng: 25km).");
          addLog(`SINH LỆNH ĐIỀU PHỐI: #ORD-AG-${Math.floor(Deterministic.random() * 10000)}`);
          addLog("HÀNH ĐỘNG: Đã gửi thông báo cho Tài xế Nguyễn Văn A. Xe tải đang di chuyển!");

          // Vẽ icon xe tải trên bản đồ thực bằng SolidJS Component
          const truckContainer = document.createElement("div");
          truckContainer.className =
            "bg-cyan-500 text-white p-[6px] rounded-full border-white animate-bounce flex items-center justify-center";

          // Dùng hàm render để nhúng Component <Icon /> vào thẻ div (Bọc bằng <>...</> để TSRX Compiler không báo lỗi)
          render(() => <><Icon path={truck} class="w-4 h-4" /></>, truckContainer);

          const truckIcon = L_lib.divIcon({
            html: truckContainer,
            className: "",
            iconSize: [30, 30],
          });

          truckMarker = L_lib.marker([21.611, 105.298], { icon: truckIcon }).addTo(map);
        }, 3000);
      }
    }, 500);
  };

  const resetSimulation = () => {
    setSimState("IDLE");
    setLogs([]);
    leafletPolylines.forEach((p) => map.removeLayer(p));
    leafletPolylines = [];
    if (truckMarker) {
      map.removeLayer(truckMarker);
      truckMarker = null;
    }
  };

  const handleFileDrop = (e: any) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: any) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  createEffect(() => {
    if (!isMapReady() || !L_lib || !map) return;
    // Map tiles have been disabled per security/offline policy
  });

  onMount(() => {
    if (!mapContainer || typeof window === "undefined") return;

    import("leaflet").then((leafletModule) => {
      L_lib = leafletModule.default || leafletModule;
      // Tắt attribution mặc định của Leaflet để tự render bằng thẻ JSX của SolidJS
      map = L_lib.map(mapContainer, { attributionControl: false }).setView([21.611, 105.298], 13);

      const geojsonLayer = L_lib.geoJSON(json_HongSon34, {
        style: () => ({
          color: theme() === "dark" ? "#3b82f6" : "#2563eb",
          weight: 2,
          opacity: 1,
          fillColor: "#3b82f6",
          fillOpacity: 0.1,
        }),
        onEachFeature: (feature: any, layer: any) => {
          const props = feature.properties;
          layer.bindPopup(
            "<div style='color:#333; font-family:sans-serif;'><b>" + props.ten_xa + "</b><br/>" + props.dtich_km2 + " km2</div>",
          );
        },
      }).addTo(map);

      // Căn giữa động bản đồ vào vùng hiển thị trống bên phải (bỏ qua khoảng chiếm dụng của Sidebar bên trái)
      map.fitBounds(geojsonLayer.getBounds(), {
        paddingTopLeft: [320, 50],
        paddingBottomRight: [50, 50],
      });

      // Thuật toán Ray-Casting kiểm tra tọa độ có thuộc ranh giới xã Hồng Sơn hay không
      const isPointInHongSon = (lat: number, lng: number): boolean => {
        const coords = json_HongSon34.features[0].geometry.coordinates;
        let inside = false;

        for (let i = 0; i < coords.length; i++) {
          const polygon = coords[i];
          for (let j = 0; j < polygon.length; j++) {
            const ring = polygon[j];

            for (let k = 0, l = ring.length - 1; k < ring.length; l = k++) {
              const xi = ring[k][0], yi = ring[k][1];
              const xj = ring[l][0], yj = ring[l][1];

              const intersect = yi > lat !== yj > lat && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi;
              if (intersect) inside = !inside;
            }
          }
        }
        return inside;
      };

      // Hàm tạo Popup HTML tương tác cao cấp với đầy đủ thông tin địa chính
      const getPopupHTML = (name: string, lat: number, lng: number, type: string) => {
        const typeText =
          type === "target"
            ? "Thiếu hụt"
            : type === "source"
              ? "Dự trữ"
              : type === "transit"
                ? "Trung chuyển"
                : "Tự chọn";
        const typeColor =
          type === "target"
            ? "#f43f5e"
            : type === "source"
              ? "#10b981"
              : type === "transit"
                ? "#06b6d4"
                : "#8b5cf6";
        const props = json_HongSon34.features[0].properties;

        const container = document.createElement("div");
        container.style.color = "#333";
        container.style.fontFamily = "sans-serif";
        container.style.fontSize = "11px";
        container.style.minWidth = "190px";
        container.style.lineHeight = "1.5";

        render(
          () => <tsx>
            <div
              style="display:flex; align-items:center; font-size:13px; color:#1e3a8a; font-weight:bold; border-bottom: 2px solid #3b82f6; padding-bottom: 3px; margin-bottom: 5px;">
              <Icon path={mapPin} style="width: 18px; height: 18px; color: #ef4444; margin-right: 4px;" />
              <span style="color:black">{name}</span>
            </div>
            <div style="margin-bottom: 4px;">
              <span style="color:#4b5563; font-weight: 700;">Phân loại:</span>
              <span
                style={`background: ${typeColor}; color: white; padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: bold; display: inline-block;`}>{typeText}</span>
            </div>
            <div style="margin-bottom: 4px;">
              <span style="color:#4b5563; font-weight: 600;">Tọa độ GPS:</span>
              <code style="background:#f3f4f6; padding:1px 3px; border-radius:3px;">
                {lat.toFixed(5)}
                ,
                {lng.toFixed(5)}
              </code>
            </div>
            <div style="margin-bottom: 4px; border-top: 1px dashed #e5e7eb; padding-top: 4px;">
              <span style="color:#4b5563; font-weight: 600;">Hành chính:</span>
              {props.loai}
              {props.ten_xa}
              , Tỉnh
              {props.ten_tinh}
              (Mã:
              {props.ma_xa}
              )
            </div>
            <div style="margin-bottom: 4px;">
              <span style="color:#4b5563; font-weight: 600;">Thông số địa lý:</span>
            </div>
            <ul style="margin: 0; padding-left: 12px; color:#6b7280; font-size: 10px;">
              <li>
                Diện tích:
                <b>
                  {props.dtich_km2}
                  km²
                </b>
              </li>
              <li>
                Dân số:
                <b>
                  {props.dan_so.toLocaleString()}
                  người
                </b>
              </li>
              <li>
                Mật độ:
                <b>
                  {props.matdo_km2}
                  người/km²
                </b>
              </li>
            </ul>
            <div style="margin-top:8px; display:flex; gap:6px; border-top: 1px solid #f3f4f6; padding-top: 6px;">
              <button
                onClick={() => (window as any).renameMarker(name)}
                style="background:#2563eb; color:white; border:none; padding:3px 8px; border-radius:4px; font-size:9px; cursor:pointer; font-weight:bold; transition:all 0.2s;">Sửa tên</button>
              <button
                onClick={() => (window as any).deleteMarker(name)}
                style="background:#dc2626; color:white; border:none; padding:3px 8px; border-radius:4px; font-size:9px; cursor:pointer; font-weight:bold; transition:all 0.2s;">Xóa</button>
            </div>
          </tsx>,
          container,
        );

        return container;
      };

      // Định nghĩa các hàm sửa/xóa toàn cục để gọi từ Popup HTML
      (window as any).renameMarker = (oldName: string) => {
        const marker = leafletMarkers.find((m) => m.options.title === oldName);
        if (!marker) return;
        const newName = prompt(`Nhập tên mới cho điểm "${oldName}":`, oldName);
        if (newName && newName.trim() !== "") {
          marker.options.title = newName;
          const latlng = marker.getLatLng();
          marker.bindPopup(getPopupHTML(newName, latlng.lat, latlng.lng, (marker.options as any).nodeType || "custom")).openPopup();

          const node = logisticsNodes.find((n) => n.name === oldName);
          if (node) node.name = newName;

          addLog(`ĐÃ ĐỔI TÊN: "${oldName}" thành "${newName}"`);
        }
      };

      (window as any).deleteMarker = (name: string) => {
        const markerIndex = leafletMarkers.findIndex((m) => m.options.title === name);
        if (markerIndex === -1) return;
        if (confirm(`Bạn có chắc chắn muốn xóa điểm "${name}"?`)) {
          const marker = leafletMarkers[markerIndex];
          map.removeLayer(marker);
          leafletMarkers.splice(markerIndex, 1);

          const nodeIndex = logisticsNodes.findIndex((n) => n.name === name);
          if (nodeIndex !== -1) logisticsNodes.splice(nodeIndex, 1);

          addLog(`ĐÃ XÓA ĐIỂM: "${name}"`);
        }
      };

      // Thêm các ghim định vị GPS của hệ thống Logistics thời gian thực (hỗ trợ kéo thả chỉnh vị trí)
      logisticsNodes.forEach((node) => {
        const customColor =
          node.type === "target"
            ? "#f43f5e"
            : node.type === "source"
              ? "#10b981"
              : "#06b6d4";
        const nodeIcon = L_lib.divIcon({
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;">
              <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background-color: ${customColor}; opacity: 0.4; animation: leafletPulsing 2s infinite ease-in-out;"></div>
              <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background-color: ${customColor}; border: 2.5px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.4); cursor: move;"></div>
            </div>
          `,
          className: "",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L_lib.marker([node.lat, node.lng], {
          icon: nodeIcon,
          title: node.name,
          draggable: true,
        }).addTo(map);

        (marker.options as any).nodeType = node.type;

        // Lắng nghe sự kiện kéo thả ghim định vị
        marker.on("dragend", (event: any) => {
          const newLatLng = event.target.getLatLng();

          // Kiểm tra xem ghim có nằm bên trong ranh giới địa lý xã Hồng Sơn hay không
          if (!isPointInHongSon(newLatLng.lat, newLatLng.lng)) {
            alert(`Cảnh báo: Không thể kéo ghim "${node.name}" ra ngoài ranh giới địa lý xã Hồng Sơn! Vị trí đã được hoàn tác.`);
            marker.setLatLng([node.lat, node.lng]);
            return;
          }

          const targetNode = logisticsNodes.find((n) => n.name === node.name);
          if (targetNode) {
            targetNode.lat = newLatLng.lat;
            targetNode.lng = newLatLng.lng;
          }
          marker.bindPopup(getPopupHTML(node.name, newLatLng.lat, newLatLng.lng, node.type));
          addLog(`ĐÃ DI CHUYỂN: "${node.name}" tới [${newLatLng.lat.toFixed(5)}, ${newLatLng.lng.toFixed(5)}]`);
        });

        marker.bindPopup(getPopupHTML(node.name, node.lat, node.lng, node.type));
        leafletMarkers.push(marker);
      });

      // LẮNG NGHE SỰ KIỆN CLICK BẢN ĐỒ: Thêm điểm logistics tự chọn tùy ý (hỗ trợ kéo thả chỉnh vị trí)
      map.on("click", (e: any) => {
        // Tránh kích hoạt khi click lên Marker khác
        if (e.originalEvent.target.classList.contains("leaflet-marker-icon") || e.originalEvent.target.closest(".leaflet-popup")) return;

        // Kiểm tra xem tọa độ nhấp có thuộc xã Hồng Sơn không
        if (!isPointInHongSon(e.latlng.lat, e.latlng.lng)) {
          alert("Cảnh báo: Bạn chỉ được phép chấm điểm mới bên trong ranh giới địa lý xã Hồng Sơn!");
          return;
        }

        const name = prompt("Nhập tên cho điểm logistics mới tại tọa độ này:", `Điểm tự chọn ${leafletMarkers.length + 1}`);
        if (!name || name.trim() === "") return;

        const customColor = "#8b5cf6"; // Tím cực kỳ sang trọng cho điểm tự tạo
        const nodeIcon = L_lib.divIcon({
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;">
              <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background-color: ${customColor}; opacity: 0.4; animation: leafletPulsing 2s infinite ease-in-out;"></div>
              <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background-color: ${customColor}; border: 2.5px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.4); cursor: move;"></div>
            </div>
          `,
          className: "",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L_lib.marker([e.latlng.lat, e.latlng.lng], {
          icon: nodeIcon,
          title: name,
          draggable: true,
        }).addTo(map);

        (marker.options as any).nodeType = "custom";

        // Lắng nghe sự kiện kéo thả ghim tự chọn
        marker.on("dragend", (event: any) => {
          const newLatLng = event.target.getLatLng();
          const targetNode = logisticsNodes.find((n) => n.name === name);
          if (!targetNode) return;

          if (!isPointInHongSon(newLatLng.lat, newLatLng.lng)) {
            alert(`Cảnh báo: Không thể kéo ghim tự chọn "${name}" ra ngoài ranh giới địa lý xã Hồng Sơn! Vị trí đã được hoàn tác.`);
            marker.setLatLng([targetNode.lat, targetNode.lng]);
            return;
          }

          targetNode.lat = newLatLng.lat;
          targetNode.lng = newLatLng.lng;

          marker.bindPopup(getPopupHTML(name, newLatLng.lat, newLatLng.lng, "custom"));
          addLog(`ĐÃ DI CHUYỂN: "${name}" tới [${newLatLng.lat.toFixed(5)}, ${newLatLng.lng.toFixed(5)}]`);
        });

        marker.bindPopup(getPopupHTML(name, e.latlng.lat, e.latlng.lng, "custom")).openPopup();
        leafletMarkers.push(marker);

        logisticsNodes.push({
          id: logisticsNodes.length + 1,
          name: name,
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          type: "custom",
        });

        addLog(`ĐÃ THÊM ĐIỂM MỚI: "${name}" tại [${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}]`);
      });

      setIsMapReady(true);
    }).catch(() => {});
  });

  onCleanup(() => {
    if (map) map.remove();
    delete (window as any).renameMarker;
    delete (window as any).deleteMarker;
  });

  const handleUpload = async () => {
    if (!selectedFile()) return;
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setMessage("Done!");
      setSelectedFile(null);
    }, 1000);
  };
  <div class="w-full h-[calc(100vh-120px)] relative rounded-3xl overflow-hidden border border-gray-100/10">
    <div ref={mapContainer} class={`w-full h-full z-0 ${theme() === "dark" ? "cyber-map" : ""}`} />

    {/* Thanh bản quyền tự chế bằng SolidJS JSX (Thay thế Leaflet Attribution mặc định) */}
    <div
      class="absolute bottom-0 right-0 z-[1000] bg-white/70 backdrop-blur-md px-2 py-0.5 text-[11px] text-gray-700 flex items-center gap-1.5 pointer-events-auto">
      <a
        href="https://leafletjs.com"
        target="_blank"
        title="A JavaScript library for interactive maps"
        class="flex items-center gap-1 hover:text-blue-600 transition-colors">
        <span class="relative inline-flex w-4 h-4 mt-[1px]">
          <Icon path={flag} class="text-red-500 absolute w-4 h-4 drop-shadow-[0_0_1px_rgba(239,68,68,0.5)]" />
          <Icon path={star} class="text-yellow-400 absolute w-1.5 h-1.5 left-[4.4px] top-[3.6px]" />
        </span>
        <span class="font-semibold">{"Leaflet"}</span>
      </a>
      <span class="opacity-40">{"|"}</span>
      <span>{"© OpenStreetMap © CARTO"}</span>
    </div>

    {/* Nút Điều khiển nổi */}
    <div class="absolute top-6 right-6 flex flex-col gap-3 z-[1001]">
      <button
        onClick={() => setShowSidebar(!showSidebar())}
        class={`w-12 h-12 backdrop-blur-lg rounded-2xl flex items-center justify-center shadow-xl hover:scale-110 transition-all border ${
          theme() === "dark" ? "bg-blue-600/80 text-white border-blue-400/30" : "bg-white/80 text-blue-600 border-gray-200"
        }`}
        title="Xem thông tin bản đồ">
        <Icon path={informationCircle} class="w-6 h-6" />
      </button>
    </div>

    {/* Sidebar kính mờ */}
    if (showSidebar()) {
      <div
        class={`absolute top-6 left-6 bottom-6 w-72 backdrop-blur-2xl p-5 rounded-3xl z-[1000] shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300 border ${
          theme() === "dark" ? "bg-black/40 text-white border-white/5" : "bg-white/70 text-gray-800 border-gray-200"
        }`}>
        <div class={`flex p-1 rounded-xl border ${theme() === "dark" ? "bg-white/5 border-white/10" : "bg-gray-100 border-gray-200"}`}>
          <button
            onClick={() => setActiveTab("info")}
            class={`flex-1 py-2 rounded-lg font-bold text-[9px] uppercase transition-all ${
              activeTab() === "info"
                ? (theme() === "dark" ? "bg-white/10 text-blue-400" : "bg-white text-blue-600 shadow-sm")
                : "text-gray-500"
            }`}>
            {"Khám phá"}
          </button>
          <button
            onClick={() => setActiveTab("admin")}
            class={`flex-1 py-2 rounded-lg font-bold text-[9px] uppercase transition-all ${
              activeTab() === "admin"
                ? (theme() === "dark" ? "bg-white/10 text-blue-400" : "bg-white text-blue-600 shadow-sm")
                : "text-gray-500"
            }`}>
            {"Quản trị"}
          </button>
          <button
            onClick={() => setActiveTab("dispatch")}
            class={`flex-1 py-2 rounded-lg font-bold text-[9px] uppercase transition-all ${
              activeTab() === "dispatch"
                ? (theme() === "dark" ? "bg-white/10 text-cyan-400" : "bg-white text-cyan-600 shadow-sm")
                : "text-gray-500"
            }`}>
            {"Điều phối"}
          </button>
          <button
            onClick={() => setActiveTab("crypto")}
            class={`flex-1 py-2 rounded-lg font-bold text-[9px] uppercase transition-all ${
              activeTab() === "crypto"
                ? (theme() === "dark" ? "bg-white/10 text-amber-400" : "bg-white text-amber-600 shadow-sm")
                : "text-gray-500"
            }`}>
            {"Tiền Số"}
          </button>
        </div>

        if (activeTab() === "info") {
          <div class="space-y-4">
            <div class="flex items-center gap-2 text-blue-500">
              <Icon path={map} class="w-5 h-5" />
              <h3 class="font-black text-sm uppercase tracking-tighter">{"Hồng Sơn Geo"}</h3>
            </div>
            <div class={`p-3 rounded-2xl border ${theme() === "dark" ? "bg-white/5 border-white/5" : "bg-blue-50 border-blue-100"}`}>
              <p class="text-[8px] text-gray-500 uppercase font-bold">{"Diện tích"}</p>
              <p class="text-lg font-black">{"44.22 km2"}</p>
            </div>
            <div class={`p-3 rounded-2xl border ${theme() === "dark" ? "bg-white/5 border-white/5" : "bg-purple-50 border-purple-100"}`}>
              <p class="text-[8px] text-gray-500 uppercase font-bold">{"Dân số"}</p>
              <p class="text-lg font-black">{"19,417"}</p>
            </div>
          </div>
        } else if (activeTab() === "admin") {
          <div class="space-y-4">
            <h3 class={`font-black text-sm uppercase ${theme() === "dark" ? "text-purple-400" : "text-purple-600"}`}>{"Cập nhật GIS"}</h3>
            <div
              class={`border-2 border-dashed rounded-2xl p-4 text-center transition-all ${
                isDragOver() ? "border-blue-500 bg-blue-500/10" : (theme() === "dark" ? "border-white/5" : "border-gray-200 bg-gray-50")
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}>
              <Icon path={cloudArrowUp} class="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p class="text-[8px] font-bold text-gray-500">{"Kéo thả tệp .geojson"}</p>
              <input type="file" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileSelect} />
            </div>
            if (selectedFile()) {
              <p class="text-[8px] text-blue-500 truncate font-bold">{"Đã chọn: " + selectedFile().name}</p>
            }
            <button
              onClick={handleUpload}
              class="w-full py-2 bg-blue-600 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-blue-500/20">
              {"Cập nhật"}
            </button>
          </div>
        } else if (activeTab() === "dispatch") {
          <div class="space-y-4 flex-1 flex flex-col min-h-0">
            <div class="flex items-center gap-2 text-cyan-500">
              <Icon path={truck} class="w-5 h-5" />
              <h3 class="font-black text-sm uppercase tracking-tighter">{"Tự hành điều phối"}</h3>
            </div>

            <div class="flex gap-2">
              <button
                onClick={startSimulation}
                disabled={simState() !== "IDLE"}
                class="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-[10px] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20">
                <Icon path={play} class="w-3.5 h-3.5" />
                {"Kích hoạt"}
              </button>
              <button
                onClick={resetSimulation}
                disabled={simState() === "IDLE" || simState() === "SCANNING" || simState() === "ROUTING"}
                class="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl text-[10px] transition-all disabled:opacity-50 flex items-center justify-center">
                <Icon path={arrowPath} class="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              class={`flex-1 overflow-y-auto p-3 rounded-2xl font-mono text-[9px] leading-relaxed space-y-2 border h-64 ${
                theme() === "dark" ? "bg-[#050505] border-white/5 text-cyan-400" : "bg-slate-900 border-slate-700 text-cyan-400"
              }`}>
              if (logs().length === 0) {
                <div class="text-gray-500 italic">{"Nhấn Kích hoạt để chạy mô phỏng định tuyến trên GPS thực tế..."}</div>
              }
              for (const log of logs()) {
                <div class={log.includes("PHÁT HIỆN") ? "text-rose-400" : log.includes("TÌM THẤY") ? "text-emerald-400" : "text-cyan-300"}>
                  {log}
                </div>
              }
            </div>
          </div>
        } else {
          <div class="space-y-4 flex-1 flex flex-col min-h-0">
            <div class="flex items-center gap-2 text-amber-500">
              <Icon path={circleStack} class="w-5 h-5" />
              <h3 class="font-black text-sm uppercase tracking-tighter">{"Hệ thống Tiền Số Agent"}</h3>
            </div>

            {/* Danh sách Ví */}
            <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
              for (const w of agentWallets()) {
                <div
                  class={`p-2 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                    theme() === "dark"
                      ? "bg-white/5 border-white/5 hover:bg-white/10"
                      : "bg-amber-50/50 border-amber-100/50 hover:bg-amber-50"
                  }`}>
                  <div class="flex items-center gap-2">
                    <span class="text-lg">{w.avatar}</span>
                    <div>
                      <p class="font-black text-[9px]">{w.name}</p>
                      <p class="text-[7px] text-gray-400 font-mono">{w.address}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="font-black text-amber-600 text-[10px]">
                      {w.balance}
                      {" RTR"}
                    </p>
                  </div>
                </div>
              }
            </div>

            {/* Các Nút Mô Phỏng */}
            <div class="grid grid-cols-2 gap-2">
              <button
                onClick={runGameTheorySimulation}
                disabled={isSimulatingCrypto()}
                class="py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold rounded-xl text-[9px] transition-all disabled:opacity-50 flex items-center justify-center gap-1 shadow-md shadow-amber-500/10">
                {"🎮 Game Theory"}
              </button>
              <button
                onClick={runFourColorSimulation}
                class="py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold rounded-xl text-[9px] transition-all flex items-center justify-center gap-1 shadow-md shadow-emerald-500/10">
                {"🎨 Đ.Lý 4 Màu"}
              </button>
            </div>

            {/* Nhật Ký Mô Phỏng */}
            <div
              class={`flex-1 overflow-y-auto p-3 rounded-2xl font-mono text-[9px] leading-relaxed space-y-2 border h-44 ${
                theme() === "dark" ? "bg-[#050505] border-white/5 text-amber-400" : "bg-amber-950/20 border-amber-900/30 text-amber-600"
              }`}>
              if (cryptoLogs().length === 0) {
                <div class="text-gray-500 italic">{"Nhấn nút để chạy mô phỏng giao dịch Game Theory hoặc phân vùng 4 màu..."}</div>
              }
              for (const log of cryptoLogs()) {
                <div
                  class={log.includes("GIAO DỊCH HOÀN TẤT")
                    ? "text-emerald-500 font-bold"
                    : log.includes("🚀")
                      ? "text-cyan-500 font-bold"
                      : "text-amber-500"}>
                  {log}
                </div>
              }
            </div>
          </div>
        }

        <button
          onClick={() => setShowSidebar(false)}
          class="mt-auto py-2 text-[8px] uppercase font-bold text-gray-500 hover:text-blue-500 transition-colors">
          {"[ Đóng bảng điều khiển ]"}
        </button>
      </div>
    }
  </div>
}
